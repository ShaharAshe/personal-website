// Cloudflare Web Analytics (Task 2.15, design-doc §15). The site is on workers.dev, not a Cloudflare zone, so
// Cloudflare can't inject the beacon itself: BaseLayout adds the dashboard's manual snippet before </body>.
//
// The token is not a secret: it's in the source of every page that loads the beacon. It only names the
// dashboard site the visits are counted under.
//
// Production builds only: `npm run dev` gets no beacon, so local development never counts as a visit. A local
// production build (`npx wrangler dev`, `npm run preview`) does have it; the e2e tests block every request to
// *.cloudflareinsights.com (tests/e2e/fixtures.ts).
//
// The CSP allows exactly this URL in script-src and https://cloudflareinsights.com in connect-src (buildPolicy() in
// scripts/csp/csp.mts, which repeats the URL; tests/analytics.test.ts keeps the two equal).

/** The beacon script. Cloudflare doesn't version-pin it, so it can't have an SRI hash. */
export const CF_BEACON_SRC = 'https://static.cloudflareinsights.com/beacon.min.js';

/** The Web Analytics site token, from the dashboard's JS snippet. */
export const CF_BEACON_TOKEN = '0b8278f159364d498059b3aae8d762ef';

export interface AnalyticsBeacon {
  src: string;
  /** The data-cf-beacon attribute value (JSON). An attribute, not an inline script, so the CSP needs no hash. */
  config: string;
}

/** The beacon tag's attributes in a production build, or null (no tag) in the dev server. */
export function analyticsBeacon(isProd: boolean): AnalyticsBeacon | null {
  if (!isProd) return null;
  return { src: CF_BEACON_SRC, config: JSON.stringify({ token: CF_BEACON_TOKEN }) };
}
