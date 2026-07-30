// netlify/edge-functions/block-scanners.ts
// Rejects exploit scanners and abusive crawlers at the CDN edge, before the
// Nuxt SSR function is invoked. This is cheaper and broader than netlify.toml
// redirects, which cannot express extension patterns like "*.php at any depth".
//
// SAFETY: this runs on every request, so it fails open — any unexpected error
// (or any request that doesn't clearly match a scanner signature) is passed
// straight through to the normal request chain.

// Netlify supplies the real Context at runtime (Deno). Typed locally rather
// than importing @netlify/edge-functions, whose Deno globals override the
// Node/Nitro types used everywhere else in this repo.
interface EdgeContext {
  next: () => Promise<Response>
}

// Paths that have no counterpart in this app and only ever come from
// automated vulnerability scanners.
const SCANNER_PATH =
  /(?:\.(?:php\d?|asp|aspx|jsp|cgi|sql|bak|old|swp)$|\/wp-|\/wordpress|xmlrpc|phpmyadmin|phpinfo|\/\.env|\/\.git|\/\.aws|\/\.ssh|\/\.svn|\/\.hg|\/\.vscode|\/\.idea|\/vendor\/|\/cgi-bin\/|eval-stdin|\/administrator|\/autodiscover|\/owa\/|\/telescope\/|\/actuator|\/solr\/|\/jenkins\/|\/struts|\/shell|\/backup)/i

// Aggressive scrapers, security scanners, and SEO crawlers that provide no
// value to this site. Well-behaved search engines are deliberately absent.
const SCANNER_UA =
  /(?:zgrab|masscan|nmap|censys|nuclei|sqlmap|dirbuster|gobuster|wpscan|nikto|acunetix|semrush|ahrefs|mj12|dotbot|blexbot|dataforseo|bytespider|petalbot|serpstat|seekport|zoominfo|internet-measurement)/i

// Generic scripted HTTP clients and headless browser automation — no
// legitimate visitor's browser sends these. Deliberately excludes anything
// that could be a wanted crawler: search engines (bot|crawl|spider), social
// link-preview fetchers (facebookexternalhit, preview, feed, rss), uptime
// monitors (monitor|uptime|pingdom), and our own lighthouse audits.
const SCRIPTED_CLIENT_UA =
  /(?:^curl\/|^wget\/|python-requests|python-urllib|^python\/|java\/|go-http-client|okhttp|libwww-perl|^ruby|axios\/|node-fetch|headlesschrome|phantomjs|puppeteer|playwright|selenium)/i

export default async function handler(request: Request, context: EdgeContext) {
  try {
    const { pathname } = new URL(request.url)
    const ua = request.headers.get('user-agent') ?? ''

    if (
      SCANNER_PATH.test(pathname) ||
      SCANNER_UA.test(ua) ||
      SCRIPTED_CLIENT_UA.test(ua)
    ) {
      // 410 (rather than 404) tells well-built crawlers to stop retrying.
      // Cached at the edge so repeat probes cost nothing.
      return new Response('410 Gone\n', {
        status: 410,
        headers: {
          'content-type': 'text/plain; charset=utf-8',
          'cache-control': 'public, max-age=86400',
          'x-robots-tag': 'noindex, nofollow',
        },
      })
    }
  } catch {
    // Never let this function break the site — fall through on any error.
  }

  return context.next()
}

export const config = {
  path: '/*',
  excludedPath: [
    '/_nuxt/*',
    '/MLS-logos/*',
    '/venues/*',
    '/player-headshots/*',
  ],
}
