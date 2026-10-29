/**
 * tsx scripts/data-check/notify.mts <report.json>
 *
 * Run by .github/workflows/data-check.yml after `pnpm check:data --json=…`.
 * Syncs findings to GitHub issues, then emails a summary through Resend, but
 * only when something was opened or resolved, so quiet days send nothing.
 */
import { readFileSync } from 'node:fs'
import { LABEL, type SyncResult, syncIssues } from './github'
import type { CheckReport } from './index'

const { GITHUB_TOKEN, GITHUB_REPOSITORY } = process.env
if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
  throw new Error('GITHUB_TOKEN and GITHUB_REPOSITORY are required')
}

const report = JSON.parse(
  readFileSync(process.argv[2] ?? 'data-check-report.json', 'utf8')
) as CheckReport

const result = await syncIssues(report, GITHUB_TOKEN, GITHUB_REPOSITORY)
console.log(
  `Issues: ${result.opened.length} opened, ${result.closed.length} closed, ${result.stillOpen} still open.`
)
for (const s of report.skipped) {
  console.log(`Skipped ${s.category} (${s.check}): ${s.reason}`)
}

function emailText(r: SyncResult): string {
  const lines = [`MLS Fire daily data check — ${report.checkedAt}`, '']
  if (r.opened.length) {
    lines.push('NEW PROBLEMS', '')
    for (const { finding: f, url } of r.opened) {
      lines.push(`• [${f.severity}] ${f.title}`, `  ${f.detail}`)
      if (f.fix) lines.push(`  Fix: ${f.fix}`)
      lines.push(`  ${url}`, '')
    }
  }
  if (r.closed.length) {
    lines.push('RESOLVED', '')
    for (const i of r.closed) {
      lines.push(`• ${i.title.replace(/^\[data\] /, '')} — ${i.html_url}`)
    }
    lines.push('')
  }
  lines.push(
    `All open data issues: https://github.com/${GITHUB_REPOSITORY}/issues?q=is%3Aopen+label%3A${LABEL}`
  )
  return lines.join('\n')
}

const { RESEND_API_KEY, ALERT_EMAIL_FROM, ALERT_EMAIL_TO } = process.env
if (!result.opened.length && !result.closed.length) {
  console.log('Nothing changed — no email sent.')
} else if (!RESEND_API_KEY || !ALERT_EMAIL_FROM || !ALERT_EMAIL_TO) {
  console.log(
    'Resend secrets not set — skipping email (GitHub still notifies repo watchers of new issues).'
  )
} else {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${RESEND_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: ALERT_EMAIL_FROM,
      to: ALERT_EMAIL_TO.split(',').map((a) => a.trim()),
      subject: `[MLS Fire] Data check: ${result.opened.length} new, ${result.closed.length} resolved`,
      text: emailText(result),
    }),
  })
  if (!res.ok) {
    throw new Error(`Resend returned HTTP ${res.status}: ${await res.text()}`)
  }
  console.log('Summary email sent.')
}
