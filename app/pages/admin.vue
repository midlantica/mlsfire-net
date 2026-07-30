<script setup lang="ts">
  // Simple analytics admin dashboard — /admin

  interface PageCount {
    path: string
    views: number
  }

  interface DaySummary {
    date: string
    pageViews: number
    rawPageViews: number
    botViews: number
    uniqueVisitors: number
    sessions: number
    topPages: PageCount[]
    botPages: PageCount[]
    hourly: { hour: string; views: number }[]
  }

  interface AnalyticsData {
    days: DaySummary[]
    totals: {
      pageViews: number
      rawPageViews: number
      botViews: number
      uniqueVisitors: number
      sessions: number
    }
    topPages: PageCount[]
    botPages: PageCount[]
    message?: string
  }

  // All hard-coded routes in the app
  const KNOWN_ROUTES = [
    { path: '/', label: 'Home / Matches' },
    { path: '/standings', label: 'Standings' },
    { path: '/stats', label: 'Stats' },
    { path: '/team', label: 'Team Modal' },
    { path: '/game', label: 'Game Detail' },
  ]

  // The Matches tab renders at '/'. Historical hits were recorded under
  // '/scores' and direct entries now land on '/matches' — fold both into '/'
  // so the rename doesn't split or discard existing view counts.
  const PATH_ALIASES: Record<string, string> = {
    '/scores': '/',
    '/matches': '/',
  }

  function canonicalPath(path: string) {
    return PATH_ALIASES[path] ?? path
  }

  const { data, pending, error, refresh } = await useFetch<AnalyticsData>(
    '/api/analytics',
    { lazy: true }
  )

  const selectedDay = ref<DaySummary | null>(null)

  function fmtDate(iso: string) {
    return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  function fmtHour(h: string) {
    const hour = parseInt(h.slice(11, 13))
    if (hour === 0) return '12am'
    if (hour < 12) return `${hour}am`
    if (hour === 12) return '12pm'
    return `${hour - 12}pm`
  }

  function barWidth(val: number, max: number) {
    if (!max) return '0%'
    return `${Math.round((val / max) * 100)}%`
  }

  // Merge known routes into top pages so all routes always appear
  const mergedTopPages = computed(() => {
    const source = selectedDay.value
      ? selectedDay.value.topPages
      : (data.value?.topPages ?? [])

    const map = new Map<string, number>()
    // Seed with known routes at 0
    for (const r of KNOWN_ROUTES) map.set(r.path, 0)
    // Fill in actual data, folding aliased paths into their canonical route
    // so pre-rename '/scores' views are added to '/' rather than dropped.
    for (const p of source) {
      const key = canonicalPath(p.path)
      map.set(key, (map.get(key) ?? 0) + p.views)
    }

    return Array.from(map.entries())
      .map(([path, views]) => ({ path, views }))
      .sort((a, b) => b.views - a.views)
  })

  const maxTopPage = computed(() =>
    Math.max(1, ...mergedTopPages.value.map((p) => p.views))
  )

  // Full 24-hour array for the hourly chart
  const fullHourly = computed(() => {
    if (!selectedDay.value) return []
    const map = new Map<number, number>()
    for (const h of selectedDay.value.hourly) {
      map.set(parseInt(h.hour.slice(11, 13)), h.views)
    }
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      views: map.get(i) ?? 0,
    }))
  })

  const maxHourly = computed(() =>
    Math.max(1, ...fullHourly.value.map((h) => h.views))
  )

  function hourTitle(hour: number, views: number) {
    const label =
      hour === 0
        ? '12am'
        : hour === 12
          ? '12pm'
          : hour < 12
            ? `${hour}am`
            : `${hour - 12}pm`
    return `${label}: ${views} views`
  }

  // Today's stats (first day in the array = most recent)
  const todayStats = computed(() => data.value?.days[0] ?? null)

  // Yesterday for trend comparison
  const yesterdayStats = computed(() => data.value?.days[1] ?? null)

  function trend(today: number, yesterday: number | undefined) {
    if (yesterday == null || yesterday === 0) return null
    const pct = Math.round(((today - yesterday) / yesterday) * 100)
    return pct
  }

  // Avg pages per session (engagement proxy)
  const avgPagesPerSession = computed(() => {
    const t = data.value?.totals
    if (!t || !t.sessions) return '—'
    return (t.pageViews / t.sessions).toFixed(1)
  })

  // Route label helper
  function routeLabel(path: string) {
    return KNOWN_ROUTES.find((r) => r.path === path)?.label ?? path
  }

  // ── Bot traffic ──
  // Scoped to the selected day when one is open, otherwise the 30-day roll-up.
  const botScope = computed(() => {
    const day = selectedDay.value
    if (day) {
      return {
        botViews: day.botViews,
        rawPageViews: day.rawPageViews,
        pageViews: day.pageViews,
        botPages: day.botPages,
      }
    }
    const t = data.value?.totals
    return {
      botViews: t?.botViews ?? 0,
      rawPageViews: t?.rawPageViews ?? 0,
      pageViews: t?.pageViews ?? 0,
      botPages: data.value?.botPages ?? [],
    }
  })

  const botShare = computed(() => {
    const { botViews, rawPageViews } = botScope.value
    if (!rawPageViews) return 0
    return Math.round((botViews / rawPageViews) * 100)
  })

  const maxBotPage = computed(() =>
    Math.max(1, ...botScope.value.botPages.map((p) => p.views))
  )

  // Short human-readable reason each path was classified as bot traffic.
  function botReason(path: string) {
    const p = path.toLowerCase()
    if (/\.(php\d?|asp|aspx|jsp|cgi)/.test(p)) return 'PHP / CGI probe'
    if (p.includes('wp-') || p.includes('wordpress')) return 'WordPress probe'
    if (p.includes('.env') || p.includes('.git')) return 'credential scan'
    if (p.includes('sitemap') || p.includes('robots')) return 'crawler file'
    if (p.includes('admin') || p.includes('login')) return 'admin probe'
    return 'not an app route'
  }

  useHead({ title: 'Admin — MLS Analytics' })
</script>

<template>
  <div class="admin-wrap">
    <div class="admin-header">
      <h1 class="admin-title">📊 MLS Analytics</h1>
      <button class="refresh-btn" @click="refresh()">↻ Refresh</button>
    </div>

    <div v-if="error" class="admin-error">
      <p>Error loading analytics: {{ error.message }}</p>
    </div>

    <div v-else-if="pending" class="admin-loading">Loading…</div>

    <div v-else-if="data?.message" class="admin-note">{{ data.message }}</div>

    <template v-else-if="data">
      <!-- ── Totals (30-day) ── -->
      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Page Views</div>
          <div class="stat-value">
            {{ data.totals.pageViews.toLocaleString() }}
          </div>
          <div class="stat-sub">humans · last 30 days</div>
        </div>
        <div class="stat-card stat-card--bot">
          <div class="stat-label">Bots Filtered</div>
          <div class="stat-value">
            {{ data.totals.botViews.toLocaleString() }}
          </div>
          <div class="stat-sub">
            {{ botShare }}% of {{ data.totals.rawPageViews.toLocaleString() }}
            raw hits
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Unique Visitors</div>
          <div class="stat-value">
            {{ data.totals.uniqueVisitors.toLocaleString() }}
          </div>
          <div class="stat-sub">last 30 days</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Sessions</div>
          <div class="stat-value">
            {{ data.totals.sessions.toLocaleString() }}
          </div>
          <div class="stat-sub">last 30 days</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Pages / Session</div>
          <div class="stat-value">{{ avgPagesPerSession }}</div>
          <div class="stat-sub">engagement · 30 days</div>
        </div>
      </div>

      <!-- ── Today so far ── -->
      <div v-if="todayStats" class="today-strip">
        <div class="today-label">Today so far</div>
        <div class="today-stats">
          <div class="today-stat">
            <span class="today-num">{{ todayStats.pageViews }}</span>
            <span class="today-key">views</span>
            <span
              v-if="
                trend(todayStats.pageViews, yesterdayStats?.pageViews) !== null
              "
              class="today-trend"
              :class="
                trend(todayStats.pageViews, yesterdayStats?.pageViews)! >= 0
                  ? 'up'
                  : 'down'
              "
            >
              {{
                trend(todayStats.pageViews, yesterdayStats?.pageViews)! >= 0
                  ? '▲'
                  : '▼'
              }}
              {{
                Math.abs(
                  trend(todayStats.pageViews, yesterdayStats?.pageViews)!
                )
              }}%
            </span>
          </div>
          <div class="today-divider" />
          <div class="today-stat">
            <span class="today-num">{{ todayStats.uniqueVisitors }}</span>
            <span class="today-key">visitors</span>
          </div>
          <div class="today-divider" />
          <div class="today-stat">
            <span class="today-num">{{ todayStats.sessions }}</span>
            <span class="today-key">sessions</span>
          </div>
          <template v-if="todayStats.botViews > 0">
            <div class="today-divider" />
            <div class="today-stat today-stat--bot">
              <span class="today-num">{{ todayStats.botViews }}</span>
              <span class="today-key">bots filtered</span>
            </div>
          </template>
        </div>
      </div>

      <div class="admin-cols">
        <!-- ── Daily breakdown ── -->
        <div class="admin-section">
          <h2 class="section-title">Daily Breakdown</h2>
          <div class="table-wrap">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Views</th>
                  <th>Visitors</th>
                  <th>Sessions</th>
                  <th class="th-bot">Bots</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                <tr
                  v-for="day in data.days"
                  :key="day.date"
                  :class="{ 'row-selected': selectedDay?.date === day.date }"
                  @click="
                    selectedDay = selectedDay?.date === day.date ? null : day
                  "
                  style="cursor: pointer"
                >
                  <td>{{ fmtDate(day.date) }}</td>
                  <td>{{ day.pageViews.toLocaleString() }}</td>
                  <td>{{ day.uniqueVisitors.toLocaleString() }}</td>
                  <td>{{ day.sessions.toLocaleString() }}</td>
                  <td class="td-bot">
                    {{ day.botViews ? day.botViews.toLocaleString() : '—' }}
                  </td>
                  <td class="td-arrow">
                    {{ selectedDay?.date === day.date ? '▲' : '▼' }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- ── Top Pages ── -->
        <div class="admin-section">
          <h2 class="section-title">
            Top Pages
            <span v-if="selectedDay" class="section-sub"
              >— {{ fmtDate(selectedDay.date) }}</span
            >
            <span v-else class="section-sub">— 30 days</span>
          </h2>
          <div class="bar-list">
            <div
              v-for="page in mergedTopPages"
              :key="page.path"
              class="bar-row"
            >
              <div class="bar-label-wrap">
                <span class="bar-path">{{ page.path || '/' }}</span>
                <span class="bar-route-label">{{ routeLabel(page.path) }}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill"
                  :class="{ 'bar-fill--zero': page.views === 0 }"
                  :style="{ width: barWidth(page.views, maxTopPage) }"
                />
              </div>
              <div
                class="bar-val"
                :class="{ 'bar-val--zero': page.views === 0 }"
              >
                {{ page.views }}
              </div>
            </div>
          </div>

          <!-- ── Site Routes Reference ── -->
          <div class="routes-divider" />
          <h3 class="routes-title">All App Routes</h3>
          <div class="routes-list">
            <div v-for="r in KNOWN_ROUTES" :key="r.path" class="route-row">
              <code class="route-path">{{ r.path }}</code>
              <span class="route-desc">{{ r.label }}</span>
            </div>
            <div class="route-row route-row--admin">
              <code class="route-path">/admin</code>
              <span class="route-desc">Analytics Dashboard</span>
            </div>
          </div>
          <p class="routes-note">
            <code>/matches</code> and the legacy <code>/scores</code> both fold
            into <code>/</code> above, so the rename preserves all prior counts.
          </p>
        </div>
      </div>

      <!-- ── Bot traffic filtered ── -->
      <div class="admin-section admin-section--bot">
        <h2 class="section-title">
          🤖 Bot Traffic Filtered
          <span v-if="selectedDay" class="section-sub"
            >— {{ fmtDate(selectedDay.date) }}</span
          >
          <span v-else class="section-sub">— 30 days</span>
        </h2>

        <div class="bot-summary">
          <div class="bot-summary-stat">
            <span class="bot-num bot-num--bad">{{
              botScope.botViews.toLocaleString()
            }}</span>
            <span class="bot-key">bot hits</span>
          </div>
          <div class="bot-summary-stat">
            <span class="bot-num bot-num--good">{{
              botScope.pageViews.toLocaleString()
            }}</span>
            <span class="bot-key">human views</span>
          </div>
          <div class="bot-summary-stat">
            <span class="bot-num">{{ botShare }}%</span>
            <span class="bot-key">of raw traffic</span>
          </div>
        </div>

        <div class="bot-ratio" :title="`${botShare}% bot traffic`">
          <div class="bot-ratio-bot" :style="{ width: `${botShare}%` }" />
        </div>

        <template v-if="botScope.botPages.length">
          <h3 class="routes-title">Top Filtered Paths</h3>
          <div class="bar-list">
            <div
              v-for="page in botScope.botPages"
              :key="page.path"
              class="bar-row"
            >
              <div class="bar-label-wrap">
                <span class="bar-path bar-path--bot">{{ page.path }}</span>
                <span class="bar-route-label">{{ botReason(page.path) }}</span>
              </div>
              <div class="bar-track">
                <div
                  class="bar-fill bar-fill--bot"
                  :style="{ width: barWidth(page.views, maxBotPage) }"
                />
              </div>
              <div class="bar-val">{{ page.views }}</div>
            </div>
          </div>
        </template>
        <p v-else class="routes-note">
          No bot traffic recorded for this range.
        </p>

        <p class="routes-note">
          These hits are excluded from every other number on this page. Scanner
          paths now return <code>410 Gone</code> at the CDN edge, so their
          counts stop growing — historical totals stay frozen here for
          reference. <strong>Unique visitors</strong> and
          <strong>sessions</strong> from before filtering existed are still
          inflated: they're keyed by hashed IP with no path attached, so they
          can't be separated retroactively.
        </p>
      </div>

      <!-- ── Hourly breakdown for selected day ── -->
      <div v-if="selectedDay" class="admin-section">
        <h2 class="section-title">
          Hourly — {{ fmtDate(selectedDay.date) }}
          <span class="section-sub">· click a day row to view</span>
        </h2>
        <div class="hourly-chart">
          <div v-for="h in fullHourly" :key="h.hour" class="hour-col">
            <div class="hour-bar-wrap">
              <div
                class="hour-bar"
                :class="{ 'hour-bar--active': h.views > 0 }"
                :style="{ height: barWidth(h.views, maxHourly) }"
                :title="hourTitle(h.hour, h.views)"
              />
            </div>
            <div class="hour-label">
              {{
                h.hour === 0
                  ? '12a'
                  : h.hour === 12
                    ? '12p'
                    : h.hour < 12
                      ? `${h.hour}a`
                      : `${h.hour - 12}p`
              }}
            </div>
          </div>
        </div>
      </div>

      <div v-else class="admin-section admin-section--hint">
        <span class="hint-text"
          >💡 Click any day row to see hourly breakdown &amp; per-day top
          pages</span
        >
      </div>
    </template>
  </div>
</template>

<style scoped>
  .admin-wrap {
    max-width: 64rem;
    margin: 0 auto;
    padding: 1.5rem 1rem 4rem;
    font-family: var(--font-condensed);
    color: #e2e8f0;
    min-height: 100dvh;
  }

  .admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 1.5rem;
  }

  .admin-title {
    font-size: 1.75rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: white;
  }

  .refresh-btn {
    background: #1e293b;
    border: 1px solid #334155;
    color: #94a3b8;
    padding: 0.35rem 0.75rem;
    border-radius: 0.375rem;
    cursor: pointer;
    font-size: 0.875rem;
    transition: color 0.15s;
  }
  .refresh-btn:hover {
    color: white;
  }

  .admin-error,
  .admin-loading,
  .admin-note {
    padding: 1.5rem;
    background: #1e293b;
    border-radius: 0.5rem;
    color: #94a3b8;
    font-size: 1rem;
  }

  /* ── Stat cards ── */
  .stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
    gap: 1rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 640px) {
    .stats-grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (max-width: 360px) {
    .stats-grid {
      grid-template-columns: 1fr;
    }
  }

  .stat-card {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
  }

  .stat-label {
    font-size: 0.75rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 0.25rem;
  }

  .stat-value {
    font-size: 2rem;
    font-weight: 600;
    color: white;
    line-height: 1.1;
  }

  .stat-sub {
    font-size: 0.75rem;
    color: #475569;
    margin-top: 0.2rem;
  }

  .stat-card--bot {
    border-color: oklch(0.42 0.07 72);
    background: oklch(0.28 0.03 72 / 0.55);
  }

  .stat-card--bot .stat-value {
    color: oklch(0.78 0.14 72);
  }

  .stat-card--bot .stat-label,
  .stat-card--bot .stat-sub {
    color: oklch(0.62 0.06 72);
  }

  /* ── Today strip ── */
  .today-strip {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 0.75rem 1.25rem;
    margin-bottom: 1rem;
    display: flex;
    align-items: center;
    gap: 1.5rem;
    flex-wrap: wrap;
  }

  .today-label {
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
    white-space: nowrap;
  }

  .today-stats {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .today-stat {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }

  .today-num {
    font-size: 1.25rem;
    font-weight: 600;
    color: white;
  }

  .today-key {
    font-size: 0.75rem;
    color: #64748b;
  }

  .today-trend {
    font-size: 0.7rem;
    font-weight: 600;
    padding: 0.1rem 0.3rem;
    border-radius: 0.25rem;
  }

  .today-trend.up {
    color: #4ade80;
    background: rgba(74, 222, 128, 0.1);
  }

  .today-trend.down {
    color: #f87171;
    background: rgba(248, 113, 113, 0.1);
  }

  .today-stat--bot .today-num {
    color: oklch(0.78 0.14 72);
  }

  .today-stat--bot .today-key {
    color: oklch(0.6 0.06 72);
  }

  .today-divider {
    width: 1px;
    height: 1.25rem;
    background: #334155;
  }

  /* ── Two-column layout ── */
  .admin-cols {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  @media (max-width: 640px) {
    .admin-cols {
      grid-template-columns: 1fr;
    }
  }

  /* ── Section ── */
  .admin-section {
    background: #1e293b;
    border: 1px solid #334155;
    border-radius: 0.5rem;
    padding: 1rem 1.25rem;
    margin-bottom: 1rem;
  }

  .admin-section--hint {
    padding: 0.75rem 1.25rem;
    border-style: dashed;
    border-color: #1e3a5f;
    background: transparent;
  }

  .hint-text {
    font-size: 0.8rem;
    color: #475569;
  }

  .section-title {
    font-size: 0.8rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #64748b;
    margin-bottom: 0.75rem;
  }

  .section-sub {
    font-weight: 400;
    color: #475569;
    text-transform: none;
    letter-spacing: 0;
  }

  /* ── Table ── */
  .table-wrap {
    overflow-x: auto;
  }

  .data-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 0.875rem;
  }

  .data-table th {
    text-align: left;
    padding: 0.4rem 0.5rem;
    color: #475569;
    font-size: 0.75rem;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    border-bottom: 1px solid #334155;
  }

  .data-table td {
    padding: 0.45rem 0.5rem;
    border-bottom: 1px solid #1e293b;
    color: #cbd5e1;
  }

  .data-table tbody tr:hover td {
    background: #0f172a;
    color: white;
  }

  .row-selected td {
    background: #0f172a;
    color: white;
  }

  .td-arrow {
    color: #475569;
    font-size: 0.65rem;
    text-align: right;
  }

  .th-bot,
  .td-bot {
    color: oklch(0.62 0.07 72);
  }

  .data-table tbody tr:hover .td-bot {
    color: oklch(0.78 0.14 72);
  }

  /* ── Bar chart ── */
  .bar-list {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .bar-row {
    display: grid;
    grid-template-columns: 7.5rem 1fr 2.5rem;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8rem;
  }

  .bar-label-wrap {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .bar-path {
    color: #94a3b8;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 0.75rem;
    font-family: ui-monospace, monospace;
  }

  .bar-route-label {
    font-size: 0.6rem;
    color: #475569;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .bar-track {
    background: #0f172a;
    border-radius: 2px;
    height: 0.5rem;
    overflow: hidden;
  }

  .bar-fill {
    height: 100%;
    background: #3b82f6;
    border-radius: 2px;
    transition: width 0.3s ease;
  }

  .bar-fill--zero {
    background: #1e3a5f;
    width: 2px !important;
  }

  .bar-val {
    color: #64748b;
    text-align: right;
    font-size: 0.75rem;
  }

  .bar-val--zero {
    color: #334155;
  }

  /* ── Bot traffic ── */
  .admin-section--bot {
    border-color: oklch(0.38 0.06 72);
  }

  .bar-path--bot {
    color: oklch(0.74 0.1 72);
  }

  .bar-fill--bot {
    background: oklch(0.68 0.15 62);
  }

  .bot-summary {
    display: flex;
    align-items: baseline;
    gap: 1.5rem;
    flex-wrap: wrap;
    margin-bottom: 0.6rem;
  }

  .bot-summary-stat {
    display: flex;
    align-items: baseline;
    gap: 0.35rem;
  }

  .bot-num {
    font-size: 1.5rem;
    font-weight: 600;
    color: white;
    line-height: 1;
  }

  .bot-num--bad {
    color: oklch(0.78 0.14 72);
  }

  .bot-num--good {
    color: oklch(0.82 0.17 145);
  }

  .bot-key {
    font-size: 0.75rem;
    color: #64748b;
  }

  .bot-ratio {
    display: flex;
    height: 0.5rem;
    border-radius: 2px;
    overflow: hidden;
    background: oklch(0.82 0.17 145);
    margin-bottom: 1rem;
  }

  .bot-ratio-bot {
    height: 100%;
    background: oklch(0.68 0.15 62);
    transition: width 0.3s ease;
  }

  /* ── Routes reference ── */
  .routes-divider {
    border: none;
    border-top: 1px solid #334155;
    margin: 1rem 0 0.75rem;
  }

  .routes-title {
    font-size: 0.7rem;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #475569;
    margin-bottom: 0.5rem;
  }

  .routes-list {
    display: flex;
    flex-direction: column;
    gap: 0.3rem;
  }

  .route-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    font-size: 0.75rem;
  }

  .route-row--admin {
    opacity: 0.5;
  }

  .route-path {
    font-family: ui-monospace, monospace;
    font-size: 0.7rem;
    color: #60a5fa;
    background: #0f172a;
    padding: 0.1rem 0.35rem;
    border-radius: 0.2rem;
    min-width: 5rem;
    display: inline-block;
  }

  .route-desc {
    color: #64748b;
    font-size: 0.72rem;
  }

  .routes-note {
    margin-top: 0.6rem;
    font-size: 0.68rem;
    line-height: 1.5;
    color: #475569;
  }

  .routes-note code {
    font-family: ui-monospace, monospace;
    color: #60a5fa;
  }

  /* ── Hourly chart ── */
  .hourly-chart {
    display: flex;
    align-items: flex-end;
    gap: 0.2rem;
    height: 7rem;
    padding-bottom: 1.5rem;
    position: relative;
  }

  .hour-col {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
  }

  .hour-bar-wrap {
    flex: 1;
    width: 100%;
    display: flex;
    align-items: flex-end;
  }

  .hour-bar {
    width: 100%;
    background: #1e3a5f;
    border-radius: 2px 2px 0 0;
    min-height: 2px;
    transition: height 0.3s ease;
  }

  .hour-bar--active {
    background: #3b82f6;
  }

  .hour-label {
    font-size: 0.5rem;
    color: #334155;
    margin-top: 0.25rem;
    white-space: nowrap;
  }

  /* Show every 3rd label to avoid crowding */
  .hour-col:nth-child(3n + 1) .hour-label {
    color: #475569;
  }
</style>
