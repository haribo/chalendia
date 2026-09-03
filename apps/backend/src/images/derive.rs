//! Turning one uploaded photograph into the files the shop serves.
//!
//! Pure and blocking: no database, no filesystem, no async. Encoding is the
//! most expensive thing this shop does — around two seconds for the three
//! sizes — so the caller runs it on a blocking thread and the measurement that
//! justified doing it after the response lives in
//! `docs/backend/adr/0008-image-pipeline.md`.

use image::{DynamicImage, ImageFormat, ImageReader, imageops::FilterType};
use rgb::FromSlice;

use crate::storage::{Format, Size};

/// Long side of the smallest source worth keeping. Below it the large size
/// would be an upscale, which is a blurred picture rather than a big one.
pub const MINIMUM_LONG_SIDE: u32 = 800;
/// Long side of the largest source the shop keeps. The browser reduces to it
/// before uploading; the shop holds the same line, since a client sends
/// whatever it wants (`docs/design/catalog.md` § 5).
pub const MAXIMUM_LONG_SIDE: u32 = 2400;

/// A ceiling on what a header may claim, so a decompression bomb is refused
/// while reading its dimensions rather than while allocating its pixels. Far
/// above [`MAXIMUM_LONG_SIDE`]: this is the guard, not the rule.
const DECODING_LIMIT: u32 = 20_000;

/// Speed 8 and quality 80, measured in ADR 0008: five times smaller than the
/// same picture in JPEG, at three times the encoding time of speed 10.
const AVIF_QUALITY: f32 = 80.0;
const AVIF_SPEED: u8 = 8;
/// The fallback, for a browser that accepts none of the modern formats.
const JPEG_QUALITY: u8 = 82;
/// Cores the encoder may use. One, so the shop keeps answering while it works.
const ENCODING_THREADS: usize = 1;

#[derive(Debug, PartialEq, Eq)]
pub enum SourceProblem {
    /// Not a JPEG, whatever the name or the declared media type said.
    NotJpeg,
    TooSmall {
        long_side: u32,
    },
    TooLarge {
        long_side: u32,
    },
}

/// What a source is, read from its header alone.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Dimensions {
    pub width: u32,
    pub height: u32,
}

impl Dimensions {
    fn long_side(self) -> u32 {
        self.width.max(self.height)
    }
}

/// Reads the header, confirms the bytes are a JPEG, and holds the long side to
/// the shop's range.
///
/// The header only: an 8 MB file that claims 20 000 px is refused before a
/// single pixel is allocated.
pub fn inspect(bytes: &[u8]) -> Result<Dimensions, SourceProblem> {
    // What the bytes are, never what the request called them: an executable
    // renamed to `.jpg` stops here.
    if !matches!(image::guess_format(bytes), Ok(ImageFormat::Jpeg)) {
        return Err(SourceProblem::NotJpeg);
    }

    let mut reader = ImageReader::new(std::io::Cursor::new(bytes));
    reader.set_format(ImageFormat::Jpeg);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(DECODING_LIMIT);
    limits.max_image_height = Some(DECODING_LIMIT);
    reader.limits(limits);

    let (width, height) = reader
        .into_dimensions()
        .map_err(|_| SourceProblem::NotJpeg)?;
    let dimensions = Dimensions { width, height };

    match dimensions.long_side() {
        long_side if long_side < MINIMUM_LONG_SIDE => Err(SourceProblem::TooSmall { long_side }),
        long_side if long_side > MAXIMUM_LONG_SIDE => Err(SourceProblem::TooLarge { long_side }),
        _ => Ok(dimensions),
    }
}

/// One file the shop will serve.
pub struct Rendition {
    pub size: Size,
    pub format: Format,
    pub bytes: Vec<u8>,
}

/// Every size, in both formats, from one source.
///
/// A size is never produced larger than the source: a 900 px photograph gives a
/// "large" of 900 px, not an upscale to 1400 that costs bytes and adds nothing.
/// Every size still exists, so the serving path has one file to look for rather
/// than a rule about which sizes a given image happens to have.
pub fn derive(source: &[u8]) -> Result<Vec<Rendition>, String> {
    let decoded = decode(source)?;
    let long_side = decoded.width().max(decoded.height());

    let mut renditions = Vec::with_capacity(Size::ALL.len() * Format::ALL.len());

    for size in Size::ALL {
        let scaled = scale_to(&decoded, size.long_side().min(long_side));
        renditions.push(Rendition {
            size,
            format: Format::Avif,
            bytes: encode_avif(&scaled)?,
        });
        renditions.push(Rendition {
            size,
            format: Format::Jpeg,
            bytes: encode_jpeg(&scaled)?,
        });
    }

    Ok(renditions)
}

fn decode(source: &[u8]) -> Result<DynamicImage, String> {
    let mut reader = ImageReader::new(std::io::Cursor::new(source));
    reader.set_format(ImageFormat::Jpeg);
    let mut limits = image::Limits::default();
    limits.max_image_width = Some(DECODING_LIMIT);
    limits.max_image_height = Some(DECODING_LIMIT);
    reader.limits(limits);

    reader
        .decode()
        .map_err(|error| format!("the source cannot be decoded: {error}"))
}

/// Keeps the ratio, so a portrait and a landscape photograph of the same
/// product sit in the same grid (`docs/design/catalog.md` § 5).
fn scale_to(decoded: &DynamicImage, long_side: u32) -> image::RgbImage {
    let (width, height) = (decoded.width(), decoded.height());
    let scale = f64::from(long_side) / f64::from(width.max(height));

    let target_width = ((f64::from(width) * scale).round() as u32).max(1);
    let target_height = ((f64::from(height) * scale).round() as u32).max(1);

    // Lanczos: the slowest of the filters here and the only one that keeps a
    // label on a jar readable at 200 px, which is the whole point of the size.
    decoded
        .resize_exact(target_width, target_height, FilterType::Lanczos3)
        .to_rgb8()
}

fn encode_avif(scaled: &image::RgbImage) -> Result<Vec<u8>, String> {
    let encoded = ravif::Encoder::new()
        .with_quality(AVIF_QUALITY)
        .with_speed(AVIF_SPEED)
        // One core, whatever the machine has. Left to itself the encoder takes
        // every core it can find, and a shop that becomes unreachable while a
        // merchant adds a photograph has traded the thing that matters for the
        // thing that does not (`docs/backend/adr/0008-image-pipeline.md`).
        .with_num_threads(Some(ENCODING_THREADS))
        // Reinterpreted, never copied: an `RgbImage` already holds exactly the
        // three interleaved bytes per pixel that the encoder reads, and copying
        // eleven megabytes to say so is work for nothing.
        .encode_rgb(ravif::Img::new(
            scaled.as_raw().as_rgb(),
            scaled.width() as usize,
            scaled.height() as usize,
        ))
        .map_err(|error| format!("avif encoding failed: {error}"))?;

    Ok(encoded.avif_file)
}

fn encode_jpeg(scaled: &image::RgbImage) -> Result<Vec<u8>, String> {
    let mut bytes = Vec::new();
    image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, JPEG_QUALITY)
        .encode_image(scaled)
        .map_err(|error| format!("jpeg encoding failed: {error}"))?;

    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A JPEG of the asked-for shape, with enough variation that an encoder
    /// cannot collapse it to nothing.
    pub(crate) fn a_jpeg(width: u32, height: u32) -> Vec<u8> {
        let mut canvas = image::RgbImage::new(width, height);
        for (x, y, pixel) in canvas.enumerate_pixels_mut() {
            *pixel = image::Rgb([(x % 256) as u8, (y % 256) as u8, ((x + y) % 256) as u8]);
        }

        let mut bytes = Vec::new();
        image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, 90)
            .encode_image(&canvas)
            .expect("the test image encodes");

        bytes
    }

    #[test]
    fn a_source_in_range_reports_its_dimensions() {
        let inspected = inspect(&a_jpeg(2400, 1600)).expect("accepted");

        assert_eq!(
            inspected,
            Dimensions {
                width: 2400,
                height: 1600
            },
        );
    }

    #[test]
    fn a_source_below_the_minimum_is_refused() {
        assert_eq!(
            inspect(&a_jpeg(100, 100)),
            Err(SourceProblem::TooSmall { long_side: 100 }),
        );
    }

    #[test]
    fn the_minimum_is_on_the_long_side_not_on_both() {
        // 800 × 200: a wide banner is in range, and the short side says
        // nothing about it.
        assert!(inspect(&a_jpeg(800, 200)).is_ok());
    }

    #[test]
    fn a_source_above_the_maximum_is_refused() {
        assert_eq!(
            inspect(&a_jpeg(2500, 1000)),
            Err(SourceProblem::TooLarge { long_side: 2500 }),
        );
    }

    #[test]
    fn bytes_that_are_not_a_jpeg_are_refused() {
        // A PNG signature, and text: neither is a JPEG, and neither name
        // itself.
        assert_eq!(
            inspect(b"\x89PNG\r\n\x1a\n\x00\x00\x00\x0dIHDR"),
            Err(SourceProblem::NotJpeg),
        );
        assert_eq!(
            inspect(b"not a picture at all"),
            Err(SourceProblem::NotJpeg)
        );
        assert_eq!(inspect(b""), Err(SourceProblem::NotJpeg));
    }

    #[test]
    fn every_size_is_derived_in_both_formats() {
        let renditions = derive(&a_jpeg(800, 400)).expect("derived");

        for size in Size::ALL {
            for format in Format::ALL {
                assert!(
                    renditions
                        .iter()
                        .any(|rendition| rendition.size == size && rendition.format == format),
                    "{size:?} in {format:?} is missing",
                );
            }
        }
    }

    #[test]
    fn a_derived_size_keeps_the_ratio() {
        // Wider than the large size, so the assertion below is about the
        // rescaling and not about the no-upscale clamp.
        let renditions = derive(&a_jpeg(1600, 800)).expect("derived");
        let large = renditions
            .iter()
            .find(|rendition| rendition.size == Size::Large && rendition.format == Format::Jpeg)
            .expect("the large jpeg");

        let decoded = image::load_from_memory(&large.bytes).expect("readable");

        assert_eq!((decoded.width(), decoded.height()), (1400, 700));
    }

    #[test]
    fn a_source_smaller_than_a_size_is_not_upscaled() {
        // 900 px: the thumbnail and the medium are below it, the large is
        // above, and none of the three comes back bigger than the source.
        let renditions = derive(&a_jpeg(900, 600)).expect("derived");

        // Read through the jpeg renditions: the decoder here is built with
        // jpeg alone, since jpeg is the only format the shop ever reads.
        for rendition in renditions
            .iter()
            .filter(|rendition| rendition.format == Format::Jpeg)
        {
            let decoded = image::load_from_memory(&rendition.bytes).expect("readable");
            assert!(
                decoded.width() <= 900 && decoded.height() <= 600,
                "{:?} was upscaled to {}×{}",
                rendition.size,
                decoded.width(),
                decoded.height(),
            );
        }
    }

    /// Prints what one derivation costs, since the decision to run it after
    /// the response rests on the number
    /// (`docs/backend/adr/0008-image-pipeline.md`).
    ///
    /// Ignored by default: it is a measurement, not an assertion, and a
    /// threshold here would fail on a loaded machine rather than on a
    /// regression. Run it with
    /// `cargo test --release derivation_cost -- --ignored --nocapture`.
    #[test]
    #[ignore = "a measurement, run it on purpose"]
    fn derivation_cost() {
        let source = a_jpeg(2400, 1600);
        let decoded = decode(&source).expect("decoded");

        println!("source: {} bytes, 2400x1600", source.len());

        let mut total = std::time::Duration::ZERO;
        for size in Size::ALL {
            let scaled = scale_to(&decoded, size.long_side());

            let started = std::time::Instant::now();
            let avif = encode_avif(&scaled).expect("avif");
            let avif_took = started.elapsed();

            let started = std::time::Instant::now();
            let jpeg = encode_jpeg(&scaled).expect("jpeg");
            let jpeg_took = started.elapsed();

            total += avif_took + jpeg_took;
            println!(
                "  {:>4} px   avif {:>7} bytes in {:>8.0?}   jpeg {:>7} bytes in {:>8.0?}",
                size.long_side(),
                avif.len(),
                avif_took,
                jpeg.len(),
                jpeg_took,
            );
        }

        let started = std::time::Instant::now();
        derive(&source).expect("derived");
        println!("encoding alone: {total:.2?}");
        println!("decode, scale and encode: {:.2?}", started.elapsed());

        // The two bounds the shop sets, each one a decision the ADR defends:
        // how many cores the encoder may use, and how hard it tries.
        let scaled = scale_to(&decoded, Size::Large.long_side());
        for threads in [1, 2, 4, 8] {
            let started = std::time::Instant::now();
            let encoded = ravif::Encoder::new()
                .with_quality(AVIF_QUALITY)
                .with_speed(AVIF_SPEED)
                .with_num_threads(Some(threads))
                .encode_rgb(ravif::Img::new(
                    scaled.as_raw().as_rgb(),
                    scaled.width() as usize,
                    scaled.height() as usize,
                ))
                .expect("avif");
            println!(
                "  1400 px avif on {threads} core(s): {:>7} bytes in {:>8.0?}",
                encoded.avif_file.len(),
                started.elapsed(),
            );
        }

        for speed in [AVIF_SPEED, 10] {
            let started = std::time::Instant::now();
            let encoded = ravif::Encoder::new()
                .with_quality(AVIF_QUALITY)
                .with_speed(speed)
                .with_num_threads(Some(ENCODING_THREADS))
                .encode_rgb(ravif::Img::new(
                    scaled.as_raw().as_rgb(),
                    scaled.width() as usize,
                    scaled.height() as usize,
                ))
                .expect("avif");
            println!(
                "  1400 px avif at speed {speed:>2}: {:>7} bytes in {:>8.0?}",
                encoded.avif_file.len(),
                started.elapsed(),
            );
        }
    }

    #[test]
    fn avif_is_smaller_than_jpeg_for_the_same_picture() {
        // The reason the shop pays for the encoding at all
        // (`docs/backend/adr/0008-image-pipeline.md`). A photograph, not the
        // synthetic gradient above, would show a far wider gap.
        let renditions = derive(&a_jpeg(800, 800)).expect("derived");

        let size_of = |format| {
            renditions
                .iter()
                .find(|rendition| rendition.size == Size::Large && rendition.format == format)
                .map(|rendition| rendition.bytes.len())
                .expect("the large rendition")
        };

        assert!(
            size_of(Format::Avif) < size_of(Format::Jpeg),
            "avif {} bytes, jpeg {} bytes",
            size_of(Format::Avif),
            size_of(Format::Jpeg),
        );
    }
}
