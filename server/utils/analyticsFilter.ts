// server/utils/analyticsFilter.ts
// Shared bot/noise filtering + key helpers for the analytics pipeline.
// Used by server/middleware/analytics.ts, server/api/analytics/pageview.post.ts,
// and server/api/analytics.ts (to retroactively clean historical data).

import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'

export interface StoredDayStats {
  pageViews: number
  uniqueVisitors: string[]
  sessions: number
  topPages: Record<string, number>
  hourly: Record<string, number>
  botViews?: number
  botPaths?: Record<string, number>
}

// Real app routes. Anything else is a probe/scanner (/wp-admin/install.php,
// /wp-login.php, /contact, /.env, …) and must never count as a page view.
const TRACKED_PATHS = new Set([
  '/',
  '/matches',
  '/scores',
  '/standings',
  '/stats',
  '/team',
  '/game',
  '/preview',
])

// Infrastructure paths — neither human traffic nor worth flagging as a bot.
const IGNORE_PREFIXES = ['/api/', '/_nuxt/', '/__nuxt', '/favicon', '/admin']

const ASSET_EXT =
  /\.(svg|png|jpe?g|gif|webp|avif|ico|css|js|mjs|map|woff2?|ttf|webmanifest)$/i

// Matches non-browser clients: crawlers, scrapers, HTTP libraries, scanners,
// headless browsers, and uptime monitors.
const BOT_UA =
  /bot|crawl|spider|slurp|scrape|curl|wget|python|java|go-http|okhttp|libwww|perl|ruby|axios|node-fetch|headless|phantom|puppeteer|playwright|selenium|lighthouse|monitor|uptime|pingdom|semrush|ahrefs|mj12|dotbot|petal|bytedance|bytespider|censys|masscan|zgrab|nmap|expanse|internet-measurement|facebookexternalhit|preview|feed|rss/i

export function cleanPath(path: string): string {
  const base = path.split('?')[0] || '/'
  return base.length > 1 ? base.replace(/\/+$/, '') || '/' : base
}

export type PathKind = 'track' | 'ignore' | 'bot'

export function classifyPath(path: string): PathKind {
  const clean = cleanPath(path)
  if (IGNORE_PREFIXES.some((p) => clean.startsWith(p))) return 'ignore'
  if (ASSET_EXT.test(clean)) return 'ignore'
  if (TRACKED_PATHS.has(clean)) return 'track'
  return 'bot'
}

export function isBotUserAgent(ua: string | null | undefined): boolean {
  const value = (ua ?? '').trim()
  // Every real browser sends a long, Mozilla-prefixed UA string.
  if (value.length < 20) return true
  return BOT_UA.test(value)
}

export function getClientIp(event: H3Event): string {
  const forwarded = event.headers?.get?.('x-forwarded-for') ?? ''
  return (
    forwarded.split(',')[0]?.trim() ||
    event.node?.req?.socket?.remoteAddress ||
    'unknown'
  )
}

export function isExcludedIp(ip: string): boolean {
  return (process.env.ANALYTICS_EXCLUDE_IPS ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(ip)
}

export function hashIp(ip: string): string {
  return createHash('sha256')
    .update(ip + 'mls-salt-2026')
    .digest('hex')
    .slice(0, 16)
}

export function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

export function hourKey(): string {
  const d = new Date()
  return `${d.toISOString().slice(0, 13)}:00`
}

// Bot hits are bucketed separately so they stay visible in the dashboard
// without polluting the human numbers. The key count is capped so a
// randomised scanner can't grow the blob unbounded.
const MAX_BOT_PATHS = 40

export function recordBotHit(stats: StoredDayStats, path: string): void {
  stats.botViews = (stats.botViews ?? 0) + 1
  stats.botPaths ??= {}
  if (
    stats.botPaths[path] !== undefined ||
    Object.keys(stats.botPaths).length < MAX_BOT_PATHS
  ) {
    stats.botPaths[path] = (stats.botPaths[path] ?? 0) + 1
  }
}
