// server/api/analytics/reset.post.ts
// Deletes all stored analytics data (daily stats + session dedupe keys) from
// the "analytics" Netlify Blobs store. Protected by server/middleware/admin-auth.ts
// (same gate as /admin and /api/analytics). Intended as a one-off "start
// fresh" action from the admin dashboard, not something called routinely.

import { getStore } from '@netlify/blobs'

export default defineEventHandler(async (_event) => {
  if (!process.env.NETLIFY && !process.env.NETLIFY_BLOBS_CONTEXT) {
    return { ok: false, message: 'Analytics only available in production.' }
  }

  try {
    const store = getStore('analytics')
    const { blobs } = await store.list()
    await Promise.all(blobs.map(({ key }) => store.delete(key)))
    return { ok: true, deleted: blobs.length }
  } catch {
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reset analytics data',
    })
  }
})
