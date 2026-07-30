// server/api/analytics/pageview.post.ts
// Records a client-side page navigation (SPA route change).
// Called from the client whenever Vue Router navigates to a new path.
//
// This beacon requires JS execution, so it is inherently far more
// bot-resistant than the SSR middleware — but the same filters are applied
// for defence in depth (headless browsers do run JS).

import { getStore } from '@netlify/blobs'
import {
  classifyPath,
  cleanPath,
  getClientIp,
  hashIp,
  hourKey,
  isBotUserAgent,
  isExcludedIp,
  todayKey,
  type StoredDayStats,
} from '../../utils/analyticsFilter'

export default defineEventHandler(async (event) => {
  // Only run on Netlify
  if (!process.env.NETLIFY && !process.env.NETLIFY_BLOBS_CONTEXT) {
    return { ok: false }
  }

  const body = await readBody(event).catch(() => null)
  const path = cleanPath(typeof body?.path === 'string' ? body.path : '/')

  // Only count real app routes
  if (classifyPath(path) !== 'track') return { ok: false }

  // Beacons come from our own pages; a missing/foreign origin means a
  // script is posting directly to the endpoint.
  const origin = event.headers?.get?.('origin') ?? ''
  const host = event.headers?.get?.('host') ?? ''
  if (host && origin && !origin.endsWith(host)) return { ok: false }

  if (isBotUserAgent(event.headers?.get?.('user-agent'))) return { ok: false }

  try {
    const ip = getClientIp(event)
    if (isExcludedIp(ip)) return { ok: false }

    const store = getStore('analytics')
    const dayKey = todayKey()
    const hKey = hourKey()

    const visitorId = hashIp(ip)

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

    stats.pageViews += 1
    if (!stats.uniqueVisitors.includes(visitorId)) {
      stats.uniqueVisitors.push(visitorId)
    }

    stats.topPages[path] = (stats.topPages[path] ?? 0) + 1
    stats.hourly[hKey] = (stats.hourly[hKey] ?? 0) + 1

    await store.set(dayKey, JSON.stringify(stats))
    return { ok: true }
  } catch {
    return { ok: false }
  }
})
