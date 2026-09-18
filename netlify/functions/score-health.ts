import { getStore } from '@netlify/blobs'

const REPEAT_ALERT_MS = 6 * 60 * 60_000
const BROWSER_USER_AGENT =
  'Mozilla/5.0 (compatible; MLSFireHealthMonitor/1.0; +https://mlsfire.net)'

interface HealthState {
  consecutiveFailures: number
  firstFailedAt: string | null
  lastEmailAt: number | null
  lastError: string | null
}

interface ScorePayload {
  events?: unknown[]
  _error?: boolean
}

const initialState = (): HealthState => ({
  consecutiveFailures: 0,
  firstFailedAt: null,
  lastEmailAt: null,
  lastError: null,
})

function siteUrl(): string {
  const value = process.env.SITE_URL ?? process.env.URL
  if (!value) throw new Error('SITE_URL or URL must be configured')
  return value.replace(/\/$/, '')
}

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function nextStep(error: string): string {
  if (error.includes('Scores API returned HTTP')) {
    return 'Check Netlify deploy and Function logs, then open /api/scores?week=this in a browser.'
  }
  if (error.includes('upstream ESPN') || error.includes('events array')) {
    return 'Check server/api/scores.ts and the ESPN scoreboard response for the affected dates.'
  }
  if (error.includes('SITE_URL')) {
    return 'Set SITE_URL to the public production origin in Netlify environment variables.'
  }
  if (error.includes('Resend email')) {
    return 'Set RESEND_API_KEY, ALERT_EMAIL_FROM, and ALERT_EMAIL_TO in Netlify environment variables.'
  }
  if (error.includes('Resend returned HTTP')) {
    return 'Check the Resend API key and that ALERT_EMAIL_FROM uses a verified Resend domain.'
  }
  return 'Check the Netlify Function logs and test /api/scores?week=this on the deployed site.'
}

async function checkScores(): Promise<void> {
  const response = await fetch(
    `${siteUrl()}/api/scores?week=this&_t=${Date.now()}`,
    {
      headers: {
        accept: 'application/json',
        'user-agent': BROWSER_USER_AGENT,
      },
      signal: AbortSignal.timeout(30_000),
    }
  )

  if (!response.ok) {
    throw new Error(`Scores API returned HTTP ${response.status}`)
  }

  const data = (await response.json()) as ScorePayload
  if (!Array.isArray(data.events)) {
    throw new Error('Scores API response did not include an events array')
  }
  if (data._error) {
    throw new Error('Scores API reported an upstream ESPN failure')
  }
}

async function sendEmail(subject: string, text: string): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY
  const from = process.env.ALERT_EMAIL_FROM
  const to = process.env.ALERT_EMAIL_TO
  if (!apiKey || !from || !to) {
    throw new Error(
      'Resend email alert environment variables are not configured'
    )
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: to.split(',').map((address) => address.trim()),
      subject,
      text,
    }),
  })
  if (!response.ok) throw new Error(`Resend returned HTTP ${response.status}`)
}

async function notifyFailure(state: HealthState, now: number): Promise<void> {
  const error = state.lastError ?? 'Unknown failure'
  const subject = `[MLS Fire] Scores API failure (${state.consecutiveFailures} checks)`
  const detail = [
    'MLS Fire score health check failed.',
    `Consecutive failed checks: ${state.consecutiveFailures}`,
    `First failure: ${state.firstFailedAt ?? 'unknown'}`,
    `Latest error: ${error}`,
    `Checked URL: ${siteUrl()}/api/scores?week=this`,
    `Next step: ${nextStep(error)}`,
  ].join('\n')

  if (!state.lastEmailAt || now - state.lastEmailAt >= REPEAT_ALERT_MS) {
    await sendEmail(subject, detail)
    state.lastEmailAt = now
  }
}

async function notifyRecovery(state: HealthState): Promise<void> {
  const detail = [
    'MLS Fire score health check has recovered.',
    `Failed checks before recovery: ${state.consecutiveFailures}`,
    `First failure: ${state.firstFailedAt ?? 'unknown'}`,
    `Last failure: ${state.lastError ?? 'unknown'}`,
    `Recovered: ${new Date().toISOString()}`,
  ].join('\n')

  await sendEmail('[MLS Fire] Scores API recovered', detail)
}

export default async function handler(): Promise<Response> {
  const store = getStore('score-health')
  const state =
    ((await store
      .get('state', { type: 'json' })
      .catch(() => null)) as HealthState | null) ?? initialState()
  const now = Date.now()

  try {
    await checkScores()
    const recovered = state.consecutiveFailures > 0
    if (recovered) await notifyRecovery(state)
    await store.setJSON('state', initialState())
    console.info(
      `[score-health] healthy${recovered ? '; recovery email sent' : ''}. Checked ${siteUrl()}/api/scores?week=this.`
    )
    return Response.json({ ok: true, recovered })
  } catch (error) {
    state.consecutiveFailures += 1
    state.firstFailedAt ??= new Date(now).toISOString()
    state.lastError = formatError(error)
    console.error(
      `[score-health] failure ${state.consecutiveFailures}: ${state.lastError} NEXT STEP: ${nextStep(state.lastError)}`
    )

    try {
      await notifyFailure(state, now)
    } catch (notificationError) {
      const deliveryError = formatError(notificationError)
      state.lastError += `; alert delivery failed: ${deliveryError}`
      console.error(
        `[score-health] email alert could not be sent: ${deliveryError} NEXT STEP: ${nextStep(deliveryError)}`
      )
    }

    await store.setJSON('state', state)
    return Response.json({ ok: false, ...state }, { status: 500 })
  }
}

export const config = {
  schedule: '*/10 * * * *',
}
