// server/middleware/analytics.ts
// Tracks page views, unique visitors (by hashed IP), and sessions.
// Data is stored in Netlify Blobs under the "analytics" store.
// Only runs in production (Netlify) — skipped locally to avoid noise.
//
// Bot/scanner traffic is bucketed into botViews/botPaths rather than counted
// as human traffic: unknown paths (/wp-admin/install.php, /contact, …) and
// non-browser user agents never touch pageViews/uniqueVisitors/sessions.

import { getStore } from '@netlify/blobs'
import {
  classifyPath,
  cleanPath,
  getClientIp,
  hashIp,
  hourKey,
  isBotUserAgent,
  isExcludedIp,
  recordBotHit,
  todayKey,
  type StoredDayStats,
} from '../utils/analyticsFilter'

export default defineEventHandler(async (event) => {
  const path = event.path ?? '/'

  const kind = classifyPath(path)
  if (kind === 'ignore') return

  // Only run on Netlify (env var NETLIFY is set automatically)
  if (!process.env.NETLIFY && !process.env.NETLIFY_BLOBS_CONTEXT) return

  try {
    const ip = getClientIp(event)

    // Skip excluded IPs (e.g. the site owner's IP set via ANALYTICS_EXCLUDE_IPS)
    if (isExcludedIp(ip)) return

    const isBot =
      kind === 'bot' || isBotUserAgent(event.headers?.get?.('user-agent'))

    const store = getStore('analytics')
    const dayKey = todayKey()
    const hKey = hourKey()

    // Load today's stats
    const raw = (await store
      .get(dayKey, { type: 'json' })
      .catch(() => null)) as StoredDayStats | null
    const stats: StoredDayStats = raw ?? {
      pageViews: 0,
      uniqueVisitors: [],
      sessions: 0,
      topPages: {},
      hourly: {},
    }

    if (isBot) {
      recordBotHit(stats, cleanPath(path))
      await store.set(dayKey, JSON.stringify(stats))
      return
    }

    const visitorId = hashIp(ip)

    // Session: count requests per visitor per hour as 1 session
    const sessionKey = `session:${visitorId}:${hKey}`
    const sessionSeen = await store.get(sessionKey).catch(() => null)
    const isNewSession = !sessionSeen

    stats.pageViews += 1
    if (!stats.uniqueVisitors.includes(visitorId)) {
      stats.uniqueVisitors.push(visitorId)
    }
    if (isNewSession) {
      stats.sessions += 1
      await store.set(sessionKey, '1')
    }

    const path0 = cleanPath(path)
    stats.topPages[path0] = (stats.topPages[path0] ?? 0) + 1
    stats.hourly[hKey] = (stats.hourly[hKey] ?? 0) + 1

    await store.set(dayKey, JSON.stringify(stats))
  } catch {
    // Never let analytics errors affect the user
  }
})
