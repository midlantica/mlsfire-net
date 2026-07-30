// server/api/analytics.ts
// Returns analytics data for the admin dashboard.
//
// Historical days were recorded before bot filtering existed, so stored
// topPages are re-classified here at read time: page views are recomputed
// from the human-only paths, and probe traffic is reported separately as
// botViews. This cleans past data without mutating the blobs.

import { getStore } from '@netlify/blobs'
import { classifyPath, type StoredDayStats } from '../utils/analyticsFilter'

interface DaySummary {
  date: string
  pageViews: number
  rawPageViews: number
  botViews: number
  uniqueVisitors: number
  sessions: number
  topPages: { path: string; views: number }[]
  botPages: { path: string; views: number }[]
  hourly: { hour: string; views: number }[]
}

export default defineEventHandler(async (_event) => {
  // Only works on Netlify
  if (!process.env.NETLIFY && !process.env.NETLIFY_BLOBS_CONTEXT) {
    return { days: [], message: 'Analytics only available in production.' }
  }

  try {
    const store = getStore('analytics')

    // Fetch last 30 days
    const days: DaySummary[] = []
    const today = new Date()

    for (let i = 0; i < 30; i++) {
      const d = new Date(today)
      d.setDate(today.getDate() - i)
      const dateKey = d.toISOString().slice(0, 10)

      const raw = (await store
        .get(dateKey, { type: 'json' })
        .catch(() => null)) as StoredDayStats | null

      if (!raw) continue

      const entries = Object.entries(raw.topPages ?? {})
      const humanEntries = entries.filter(
        ([path]) => classifyPath(path) === 'track'
      )
      const legacyBotEntries = entries.filter(
        ([path]) => classifyPath(path) !== 'track'
      )

      const humanViews = humanEntries.reduce((sum, [, v]) => sum + v, 0)
      const rawPageViews = raw.pageViews ?? 0

      // Days recorded before topPages existed can't be decomposed — fall
      // back to the stored total rather than reporting zero.
      const pageViews = entries.length > 0 ? humanViews : rawPageViews

      const botViews =
        legacyBotEntries.reduce((sum, [, v]) => sum + v, 0) +
        (raw.botViews ?? 0)

      const botPages = [
        ...legacyBotEntries,
        ...Object.entries(raw.botPaths ?? {}),
      ]
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([path, views]) => ({ path, views }))

      const topPages = humanEntries
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([path, views]) => ({ path, views }))

      const hourly = Object.entries(raw.hourly ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([hour, views]) => ({ hour, views }))

      days.push({
        date: dateKey,
        pageViews,
        rawPageViews,
        botViews,
        uniqueVisitors: (raw.uniqueVisitors ?? []).length,
        sessions: raw.sessions ?? 0,
        topPages,
        botPages,
        hourly,
      })
    }

    // Totals across all days
    const totals = days.reduce(
      (acc, d) => ({
        pageViews: acc.pageViews + d.pageViews,
        rawPageViews: acc.rawPageViews + d.rawPageViews,
        botViews: acc.botViews + d.botViews,
        uniqueVisitors: acc.uniqueVisitors + d.uniqueVisitors,
        sessions: acc.sessions + d.sessions,
      }),
      {
        pageViews: 0,
        rawPageViews: 0,
        botViews: 0,
        uniqueVisitors: 0,
        sessions: 0,
      }
    )

    // Aggregate top pages across all days
    const allPages: Record<string, number> = {}
    for (const day of days) {
      for (const { path, views } of day.topPages) {
        allPages[path] = (allPages[path] ?? 0) + views
      }
    }
    const topPagesAll = Object.entries(allPages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }))

    const allBotPages: Record<string, number> = {}
    for (const day of days) {
      for (const { path, views } of day.botPages) {
        allBotPages[path] = (allBotPages[path] ?? 0) + views
      }
    }
    const botPagesAll = Object.entries(allBotPages)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([path, views]) => ({ path, views }))

    return { days, totals, topPages: topPagesAll, botPages: botPagesAll }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to load analytics',
    })
  }
})
