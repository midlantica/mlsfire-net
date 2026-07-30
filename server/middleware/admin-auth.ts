// server/middleware/admin-auth.ts
// HTTP Basic Auth gate for the analytics admin dashboard (/admin) and its
// data API (/api/analytics). The public tracking beacon at
// /api/analytics/pageview is intentionally left open since every visitor's
// browser calls it directly.

import { timingSafeEqual } from 'node:crypto'
import type { H3Event } from 'h3'

function isProtectedPath(path: string): boolean {
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/api/analytics' ||
    path === '/api/analytics/reset'
  )
}

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a)
  const bufB = Buffer.from(b)
  if (bufA.length !== bufB.length) return false
  return timingSafeEqual(bufA, bufB)
}

function unauthorized(event: H3Event): never {
  setResponseHeader(event, 'WWW-Authenticate', 'Basic realm="MLS Fire Admin"')
  throw createError({
    statusCode: 401,
    statusMessage: 'Authentication required',
  })
}

export default defineEventHandler((event) => {
  const path = (event.path ?? '/').split('?')[0] ?? '/'
  if (!isProtectedPath(path)) return

  const expected = process.env.ADMIN_PASSWORD
  if (!expected) {
    throw createError({
      statusCode: 500,
      statusMessage: 'Admin access is not configured (ADMIN_PASSWORD unset)',
    })
  }

  const header = event.headers?.get?.('authorization') ?? ''
  const [scheme, encoded] = header.split(' ')
  if (scheme !== 'Basic' || !encoded) return unauthorized(event)

  const decoded = Buffer.from(encoded, 'base64').toString('utf8')
  const password = decoded.slice(decoded.indexOf(':') + 1)

  if (!password || !safeEqual(password, expected)) return unauthorized(event)
})
