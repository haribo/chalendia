# ADR 0008 — Images are derived once, in AVIF, after the upload answers

**Status:** Accepted — 2026-09-03

Implements the pipeline `docs/design/catalog.md` § 5 describes. That section says what a
merchant and a customer observe; this says what it costs and why the costs were accepted.

## Context

A catalogue of physical goods without photographs sells nothing, and a shop that serves
its photographs badly is slow for every visitor, on every page, forever. The encoding is
paid **once per image**; the bytes are paid **on every visit**.

Measured by `cargo test --release --lib derivation_cost -- --ignored --nocapture`, which
lives with the encoder so the numbers below can be re-run rather than believed. One
2400 × 1600 source, with `nasm` present, on **one core** — the bound the shop imposes,
decided below:

| Rendition | Time | Size |
|---|---|---|
| 1400 px AVIF, speed 8 | 2.7 s | **52.8 KB** |
| 1400 px AVIF, speed 10 | 430 ms | 94.6 KB |
| 1400 px JPEG, quality 82 | 35 ms | 235.0 KB |

The whole derivation — decoding once, rescaling three times, encoding six files — takes
**3.7 s**.

The test image is a synthetic gradient rather than a photograph, so the absolute sizes
are not what a merchant's catalogue will show. What the comparison is for is the ratio
between encoders on the same picture, and that holds.

## Decisions

### AVIF, at speed 8

Four and a half times smaller than JPEG for the same picture. A shop with a thousand
products serves that difference to every visitor who browses it; the encoder pays it once.
Speed 10 would be six times faster and 79 % heavier, which trades the thing that repeats
for the thing that does not.

The encoder's `asm` feature is enabled, and it builds with **`nasm`** or not at all.
`nasm` is therefore added to the **build stage** of the image and to the backend job in
CI, and a developer needs it on their machine. It is a build dependency only: the
multi-stage image carries none of it at runtime.

### Derivation happens after the upload has answered

At nearly four seconds an image, a merchant adding ten photographs would wait most of a
minute. The upload stores the source, answers, and the derivation happens behind it.

This was first decided the other way, on the assumption that the sizes took under a
second between them. The measurement above is why it changed — recorded here so the reasoning is not
repeated from the same wrong premise.

### What asynchronous work costs, and how each cost is paid

- **An image has a state**: pending, ready, or failed. The interface shows it; a
  thumbnail that never arrives and says nothing is worse than a wait.
- **The state lives in the database, not in a queue.** A queue in memory loses its work
  if the container restarts mid-encode, and leaves an image that is pending forever. The
  shop looks for pending images when it starts and takes them up again.
- **The source is served meanwhile.** A 2400 px JPEG is heavy and correct; a hole is
  neither. The product page is showable during those few seconds.
- **One encode at a time, on one core, in-process.** No Redis, no worker container: this
  shop is meant to run on a small machine, and an external queue for three images would
  contradict the reason the project exists.

  Left to itself the encoder takes every core it finds, which makes the shop unresponsive
  while it works. It also produces a **larger** file, because the encoder splits an image
  into as many tiles as it has cores and each tile compresses on its own. The same
  1400 px rendition, on the same machine:

  | Cores | Time | Size |
  |---|---|---|
  | 1 | 3.0 s | **52.8 KB** |
  | 2 | 1.0 s | 53.8 KB |
  | 4 | 882 ms | 55.3 KB |
  | 8 | 770 ms | 57.2 KB |

  So one core is not a sacrifice made for responsiveness: it costs seconds paid once per
  image and saves 8 % of the bytes paid on every visit, which is the trade this whole ADR
  is built on. Responsiveness comes free with it.

  The table also shows where the argument would bend: two cores are three times faster
  for 2 % more bytes, and past four the time barely moves while the bytes keep growing. A
  merchant loading a large catalogue on a machine with cores to spare is the case that
  would justify revisiting this, and the number to change is one constant.

## Consequences

- The binary grows from **15.1 MB to 19.4 MB** — 28 % — which is what `ravif`, `rav1e`
  and `image` carry. Paid once in the image, not per request.
- A failed derivation is visible and retryable, never silent.
- Adding a served size later means re-deriving from the kept source, which is the promise
  `docs/design/catalog.md` § 5 makes and the reason the source is kept at all.
- If encoding ever needs to leave the process — many shops on one host, a much larger
  catalogue — the storage layer and the state column are already the seam to do it
  through. That is a later decision, and this one does not prevent it.
