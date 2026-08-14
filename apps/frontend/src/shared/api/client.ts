import createClient from 'openapi-fetch'

import type { paths } from './generated/openapi'

/**
 * The only way this application talks to the shop.
 *
 * Paths, methods, request bodies and response shapes are checked at compile
 * time against `apps/backend/api/openapi.json`. A field renamed on the server
 * becomes a TypeScript error here, not a broken page in front of a customer —
 * which is the entire reason the contract is generated. Bypassing this client
 * bypasses that guarantee, and lint says so.
 *
 * In development the API answers on its own port; in production the same origin
 * serves both, so the base URL is empty.
 */
export const api = createClient<paths>({
  // Absolute on purpose: a relative base leaves the client building an
  // unparseable URL anywhere that is not a browser window.
  baseUrl: import.meta.env.VITE_API_BASE_URL ?? globalThis.location?.origin ?? '',
  // The session rides in a cookie. Same-origin in production, but development
  // serves the interface and the API on different ports, and a cross-origin
  // request drops cookies unless it is told not to.
  credentials: 'include',
  // Resolved per call rather than captured once, so the transport is the one in
  // place when the request is made — which is also what makes this testable.
  fetch: (request) => globalThis.fetch(request),
})
