// URLs the e2e tests never let reach the network (tests/e2e/fixtures.ts). Its own file, without Playwright, so
// tests/e2e-fixtures.test.ts (node:test) can check the patterns.

/**
 * Cloudflare Web Analytics: the beacon script (static.cloudflareinsights.com) and the report endpoint
 * (cloudflareinsights.com/cdn-cgi/rum). CDP Fetch.enable URL patterns: * matches any run of characters.
 */
export const BLOCKED_URL_PATTERNS = ['*://cloudflareinsights.com/*', '*://*.cloudflareinsights.com/*'];
