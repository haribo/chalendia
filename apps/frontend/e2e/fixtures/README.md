# Fixture photographs

Three files the photographs journey needs, and what each one is for. They are
committed rather than generated at run time so a failing journey can be
reproduced from the same bytes, and regenerated with the script below when the
rules they exercise change.

| File | What it is | What it proves |
|---|---|---|
| `oriented-landscape.jpg` | 1000 × 800 pixels, EXIF orientation **6** | The browser uprights before converting. Uprighted, the shop stores 800 × 1000; not uprighted, 1000 × 800 — and the note that said which way up it was is gone, so nothing can put it right afterwards. |
| `cut-out.png` | 1000 × 800, a shape on transparency | The browser converts to JPEG and flattens transparency onto white. The shop accepts JPEG only, whatever a file is named. |
| `too-small.jpg` | 640 × 480 | Refused before it leaves: the large size would be an upscale. The merchant learns it from the file they picked rather than from an upload that travelled first. |

To regenerate, from `apps/frontend`:

```python
from PIL import Image

image = Image.new('RGB', (1000, 800), (214, 166, 96))
exif = Image.Exif()
exif[0x0112] = 6
image.save('e2e/fixtures/oriented-landscape.jpg', 'JPEG', quality=60, exif=exif)

png = Image.new('RGBA', (1000, 800), (0, 0, 0, 0))
for x in range(200, 800):
    for y in range(150, 650):
        png.putpixel((x, y), (90, 150, 110, 255))
png.save('e2e/fixtures/cut-out.png', 'PNG')

Image.new('RGB', (640, 480), (180, 180, 180)).save(
    'e2e/fixtures/too-small.jpg', 'JPEG', quality=60
)
```
