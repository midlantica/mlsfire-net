/**
 * pnpm check:data [--site=https://mlsfire.net | --no-site] [--json[=path]]
 *
 * Compares the app's hand-maintained data (stadiums, team maps, season year,
 * image assets) against ESPN, and smoke-tests the deployed API routes.
 * Exit code: 1 if any error-level finding, otherwise 0.
 */
import { writeFileSync } from 'node:fs'
import { formatReport, runChecks } from './data-check/index'

const args = process.argv.slice(2)
const flag = (name: string) =>
  args.find((a) => a === `--${name}` || a.startsWith(`--${name}=`))
const value = (name: string) => flag(name)?.split('=').slice(1).join('=')

const siteUrl = flag('no-site')
  ? null
  : (value('site') ?? process.env.SITE_URL ?? 'https://mlsfire.net').replace(
      /\/$/,
      ''
    )

const report = await runChecks({ siteUrl, includeAssets: true })

const jsonFlag = flag('json')
if (jsonFlag) {
  const out = JSON.stringify(report, null, 2)
  const path = value('json')
  if (path) writeFileSync(path, out)
  else console.log(out)
}
if (!jsonFlag || value('json')) console.log(formatReport(report))

process.exitCode = report.findings.some((f) => f.severity === 'error') ? 1 : 0
