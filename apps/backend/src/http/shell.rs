//! The application shell, served with per-URL metadata.
//!
//! Search engines run JavaScript; social and messaging crawlers do not. Without
//! this, every shared product link renders as an empty preview — a loss with no
//! error to notice. See `docs/adr/0005-spa-storefront-over-json-api.md`.

use crate::config::Config;

#[derive(Debug, PartialEq, Eq)]
pub struct PageMetadata {
    pub title: String,
    pub description: String,
    pub canonical: String,
}

/// Everything here is a default until the shop has settings and a catalogue.
/// The mechanism is what this establishes; the values follow their domains.
pub fn metadata_for(path: &str, config: &Config) -> PageMetadata {
    PageMetadata {
        title: "Chalendia".to_owned(),
        description: "A self-hosted shop.".to_owned(),
        canonical: format!("{}{}", config.public_url, path),
    }
}

/// Injects the metadata into the shell's head.
///
/// The path reaches this from the request line, so every injected value is
/// escaped: an unescaped one turns a crafted URL into markup in every visitor's
/// page.
pub fn render(index_html: &str, metadata: &PageMetadata) -> String {
    let tags = format!(
        concat!(
            "<title>{title}</title>",
            r#"<meta name="description" content="{description}">"#,
            r#"<link rel="canonical" href="{canonical}">"#,
            r#"<meta property="og:type" content="website">"#,
            r#"<meta property="og:title" content="{title}">"#,
            r#"<meta property="og:description" content="{description}">"#,
            r#"<meta property="og:url" content="{canonical}">"#,
        ),
        title = escape(&metadata.title),
        description = escape(&metadata.description),
        canonical = escape(&metadata.canonical),
    );

    match index_html.split_once("</head>") {
        Some((head, rest)) => format!("{head}{tags}</head>{rest}"),
        // A shell without a head is a broken build, not a request to fix here.
        None => index_html.to_owned(),
    }
}

fn escape(value: &str) -> String {
    value
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&#39;")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn metadata() -> PageMetadata {
        PageMetadata {
            title: "Chalendia".to_owned(),
            description: "A self-hosted shop.".to_owned(),
            canonical: "https://shop.example/soap".to_owned(),
        }
    }

    #[test]
    fn the_tags_land_inside_the_head() {
        let rendered = render(
            "<html><head><meta charset=\"utf-8\"></head><body></body></html>",
            &metadata(),
        );

        let head = rendered.split_once("</head>").expect("a head").0;
        assert!(head.contains("<title>Chalendia</title>"));
        assert!(head.contains(r#"<link rel="canonical" href="https://shop.example/soap">"#));
        assert!(head.contains(r#"<meta property="og:url" content="https://shop.example/soap">"#));
    }

    #[test]
    fn a_crafted_url_cannot_inject_markup() {
        let hostile = PageMetadata {
            canonical: r#"https://shop.example/"><script>alert(1)</script>"#.to_owned(),
            ..metadata()
        };

        let rendered = render("<html><head></head><body></body></html>", &hostile);

        assert!(!rendered.contains("<script>"));
        assert!(rendered.contains("&lt;script&gt;"));
    }

    #[test]
    fn a_shell_without_a_head_is_served_unchanged() {
        let broken = "<html><body></body></html>";

        assert_eq!(render(broken, &metadata()), broken);
    }
}
