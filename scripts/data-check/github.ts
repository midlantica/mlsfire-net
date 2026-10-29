import type { CheckReport, Finding } from './index'

export const LABEL = 'data-check'
const IGNORE_LABEL = 'wontfix'
const MARKER = /<!-- data-check-key: (.+?) -->/
const CATEGORY = /· `(\w+)`/

export interface Issue {
  number: number
  title: string
  body: string | null
  html_url: string
  pull_request?: unknown
}

export interface SyncResult {
  opened: Array<{ finding: Finding; url: string }>
  closed: Issue[]
  stillOpen: number
}

function client(token: string, repo: string) {
  return async function gh<T>(
    path: string,
    init: RequestInit = {}
  ): Promise<T> {
    const res = await fetch(`https://api.github.com/repos/${repo}${path}`, {
      ...init,
      headers: {
        accept: 'application/vnd.github+json',
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        'x-github-api-version': '2022-11-28',
      },
    })
    if (!res.ok) {
      throw new Error(
        `GitHub ${init.method ?? 'GET'} ${path}: HTTP ${res.status} ${await res.text()}`
      )
    }
    return (res.status === 204 ? null : await res.json()) as T
  }
}

const keyOf = (issue: Issue) => issue.body?.match(MARKER)?.[1] ?? null

function issueBody(f: Finding, checkedAt: string): string {
  return [
    `**${f.severity.toUpperCase()}** · \`${f.category}\``,
    '',
    f.detail,
    '',
    f.fix ? `**Suggested fix:** ${f.fix}` : '',
    '',
    `_Last seen by the daily data check: ${checkedAt}. Closes automatically once the check passes. Close it with the \`${IGNORE_LABEL}\` label to silence it permanently._`,
    '',
    `<!-- data-check-key: ${f.key} -->`,
  ].join('\n')
}

/**
 * One open issue per error/warn finding (matched by a hidden key marker).
 * Issues close automatically when their finding disappears, but only if that
 * category actually ran, so an ESPN outage never mass-closes issues.
 */
export async function syncIssues(
  report: CheckReport,
  token: string,
  repo: string
): Promise<SyncResult> {
  const gh = client(token, repo)
  const listIssues = async (state: 'open' | 'closed', labels: string) => {
    const all: Issue[] = []
    for (let page = 1; ; page++) {
      const batch = await gh<Issue[]>(
        `/issues?state=${state}&labels=${encodeURIComponent(labels)}&per_page=100&page=${page}`
      )
      all.push(...batch.filter((i) => !i.pull_request))
      if (batch.length < 100) return all
    }
  }

  try {
    await gh(`/labels/${LABEL}`)
  } catch {
    await gh('/labels', {
      method: 'POST',
      body: JSON.stringify({
        name: LABEL,
        color: 'f97316',
        description: 'Opened automatically by the daily data check',
      }),
    })
  }

  const open = await listIssues('open', LABEL)
  const ignored = new Set(
    (await listIssues('closed', `${LABEL},${IGNORE_LABEL}`)).map(keyOf)
  )
  const openByKey = new Map(open.map((i) => [keyOf(i), i]))
  const currentKeys = new Set(report.findings.map((f) => f.key))
  const ranCategories = new Set<string>(report.ranCategories)
  const result: SyncResult = { opened: [], closed: [], stillOpen: 0 }

  for (const finding of report.findings) {
    if (finding.severity === 'info' || ignored.has(finding.key)) continue
    const title = `[data] ${finding.title}`
    const body = issueBody(finding, report.checkedAt)
    const existing = openByKey.get(finding.key)
    if (existing) {
      // Edits don't notify, so details stay current without daily noise.
      await gh(`/issues/${existing.number}`, {
        method: 'PATCH',
        body: JSON.stringify({ title, body }),
      })
      continue
    }
    const issue = await gh<Issue>('/issues', {
      method: 'POST',
      body: JSON.stringify({ title, body, labels: [LABEL] }),
    })
    result.opened.push({ finding, url: issue.html_url })
  }

  for (const issue of open) {
    const key = keyOf(issue)
    const category = issue.body?.match(CATEGORY)?.[1]
    if (!key || currentKeys.has(key) || !category) continue
    if (!ranCategories.has(category)) continue
    await gh(`/issues/${issue.number}/comments`, {
      method: 'POST',
      body: JSON.stringify({
        body: `✅ Resolved — the data check passed on ${report.checkedAt}.`,
      }),
    })
    await gh(`/issues/${issue.number}`, {
      method: 'PATCH',
      body: JSON.stringify({ state: 'closed', state_reason: 'completed' }),
    })
    result.closed.push(issue)
  }

  result.stillOpen = open.length - result.closed.length
  return result
}
