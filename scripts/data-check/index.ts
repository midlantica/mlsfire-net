import {
  type Category,
  type Check,
  type Finding,
  type Severity,
  createContext,
  errorMessage,
} from './espn'
import { checkAssets, checkRosters, checkSeason } from './misc'
import { siteCheck } from './site'
import {
  checkConferences,
  checkEspnTeamIdentity,
  checkStaticTeamMaps,
} from './teams'
import { checkVenues } from './venues'

export type { Category, Finding, Severity } from './espn'

export interface CheckReport {
  checkedAt: string
  findings: Finding[]
  /** Categories whose checks all completed — only these can auto-resolve issues. */
  ranCategories: Category[]
  skipped: Array<{ category: Category; check: string; reason: string }>
}

const SEVERITY_RANK: Record<Severity, number> = { error: 3, warn: 2, info: 1 }

export async function runChecks(options: {
  siteUrl: string | null
  /** Requires the repo's public/ folder, so it is off inside deployed functions. */
  includeAssets: boolean
}): Promise<CheckReport> {
  const ctx = createContext()
  const findings = new Map<string, Finding>()
  const add = (finding: Finding) => {
    const existing = findings.get(finding.key)
    if (
      !existing ||
      SEVERITY_RANK[finding.severity] > SEVERITY_RANK[existing.severity]
    ) {
      findings.set(finding.key, finding)
    }
  }

  const checks: Check[] = [
    checkStaticTeamMaps,
    checkEspnTeamIdentity,
    checkConferences,
    checkVenues,
    checkSeason,
    checkRosters,
    ...(options.includeAssets ? [checkAssets] : []),
    ...(options.siteUrl ? [siteCheck(options.siteUrl)] : []),
  ]

  const skipped: CheckReport['skipped'] = []
  const failed = new Set<Category>()
  await Promise.all(
    checks.map(async (check) => {
      try {
        await check.run(ctx, add)
      } catch (err) {
        failed.add(check.category)
        skipped.push({
          category: check.category,
          check: check.name,
          reason: errorMessage(err),
        })
      }
    })
  )

  return {
    checkedAt: new Date().toISOString(),
    findings: [...findings.values()].sort(
      (a, b) =>
        SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity] ||
        a.category.localeCompare(b.category) ||
        a.title.localeCompare(b.title)
    ),
    ranCategories: [...new Set(checks.map((c) => c.category))].filter(
      (c) => !failed.has(c)
    ),
    skipped,
  }
}

export function formatReport(report: CheckReport): string {
  const label: Record<Severity, string> = {
    error: '✖ ERROR',
    warn: '▲ WARN ',
    info: '• INFO ',
  }
  const lines = [`MLS Fire data check — ${report.checkedAt}`, '']
  for (const f of report.findings) {
    lines.push(`${label[f.severity]}  [${f.category}] ${f.title}`)
    lines.push(`         ${f.detail}`)
    if (f.fix) lines.push(`         → ${f.fix}`)
    lines.push('')
  }
  for (const s of report.skipped) {
    lines.push(
      `? SKIPPED [${s.category}] ${s.check} — could not run: ${s.reason}`
    )
  }
  const count = (sev: Severity) =>
    report.findings.filter((f) => f.severity === sev).length
  lines.push(
    `${count('error')} errors, ${count('warn')} warnings, ${count('info')} info · checked: ${report.ranCategories.join(', ')}`
  )
  if (!report.findings.length && !report.skipped.length) lines.push('All good.')
  return lines.join('\n')
}
