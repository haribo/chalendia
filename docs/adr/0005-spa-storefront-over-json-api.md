# ADR 0005 — SPA storefront over a JSON API

## Status

Active

## Context

The storefront is the shop's acquisition channel: product pages have to be indexable
and shareable. The project also targets the smallest possible server footprint, which
rules out running a second language runtime next to the Rust API.

Three architectures were considered for the public pages.

## Decisions

The backend is a **JSON HTTP API only**. It renders no page.

The frontend is a **single-page application in Vue 3 and TypeScript**, without a
meta-framework (no Nuxt, no server-side rendering), served as static files.

To keep the storefront indexable and shareable despite client-side rendering, the
backend serves the application shell and **injects per-URL metadata** into it for
public routes: title, description, canonical URL, Open Graph tags, and product
structured data (price, availability, image). It also serves a generated
`sitemap.xml` and `robots.txt`.

Static files may be served by the API binary itself or by any reverse proxy; the
metadata injection happens in the API.

## Rationale

- Search engines execute JavaScript, so a SPA is indexable. Social and messaging
  crawlers do not: they read the raw HTML. Without injected metadata, every shared
  product link renders as an empty preview — an acquisition loss with no error to
  notice.
- Structured product data is what search engines use to show price and availability
  in results. It costs one injected block and is not obtainable from client-side
  rendering.
- Server-side rendering would solve both natively, but requires a Node process
  alongside the Rust API: roughly a doubling of the idle memory footprint of the
  application, a second runtime to install, secure and update, and a second place
  where a page can break. That contradicts the project's stated constraint.
- Keeping the API free of any rendering concern also keeps it usable by other
  clients — a mobile app, an import script, a merchant's own tooling.

## Alternatives considered

- **Server-side rendered Vue (Nuxt)** — rejected. Best developer experience and best
  SEO, but the added runtime is exactly the cost the project refuses.
- **HTML rendered by the Rust backend for public pages, Vue for interactive parts** —
  rejected by the project owner. Technically the lightest option with perfect SEO,
  but it means two ways of building UI in one repository, and it makes the frontend
  the secondary surface. The owner wants a single, real frontend.
- **Plain SPA with no metadata injection** — rejected. Cheapest, and silently loses
  every shared link preview.

## Consequences

- The API owns a small set of read models dedicated to page metadata — enough to fill
  the tags for a product, a category, or a content page.
- A new public route type requires its metadata mapping; without it the route is
  shareable but blank in previews. This is part of design conformance, not an extra.
- URLs with active filters are excluded from indexing; only category and product URLs
  are indexed. The rule lives in the storefront design.
- First contentful paint on a product page depends on one API round trip. Perceived
  performance is a frontend responsibility (skeletons, prefetch on hover, cached
  category data), not a reason to revisit this decision.
- The frontend can be hosted separately from the API if an operator wants to, at the
  cost of losing metadata injection. That configuration is unsupported in v1.
