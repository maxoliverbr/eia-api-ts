/**
 * examples/agents/00-read-the-guide.ts
 *
 * Demonstrates the /guide endpoint — the single best place for an agent to
 * start. Fetches the full playbook, prints the philosophy + workflow, and
 * then fetches a domain-specific slice (coal) to show per-domain recipes
 * and agent hints.
 *
 * Run:  bun dev
 *       bun run examples/agents/00-read-the-guide.ts
 */
import { fetchJson, log, header, subheader, dump, runExample } from '../shared'

type Step = { step: number; name: string; method: string; path: string; whatYouLearn: string }
type AntiPattern = { pattern: string; why: string; instead: string }
type Recipe = { name: string; description: string; method: string; path: string }
type GuideSummary = {
  version: string
  summary: string
  philosophy: string[]
  workflow: { title: string; description: string; steps: Step[] }
  antiPatterns: AntiPattern[]
  commonRecipes: Recipe[]
  domains: { id: string; name: string; hasPlaybook: boolean; hasCommonQueries: boolean; hasAgentHints: boolean }[]
  endpoints: Record<string, string>
}

type DomainGuideSummary = {
  id: string
  name: string
  playbook?: { steps: { goal: string; route: string; why: string }[] }
  commonQueries?: { name: string; description: string }[]
  agentHints?: { warnings: string[]; gotchas: string[]; seeAlso?: string[] }
  taskToRoute?: Record<string, string>
  subRoutes: { id: string; summary: string; agentGuidance?: string }[]
}

async function main(): Promise<void> {
  header('GET /guide  — full agent playbook')

  // 1. Fetch the full guide
  const guide = await fetchJson<GuideSummary>('/guide')
  log(`Version: ${guide.version}`)
  log(`\nSummary:\n  ${guide.summary}`)

  subheader('Philosophy (the rules)')
  for (const p of guide.philosophy) log(`  • ${p}`)

  subheader(`Workflow: ${guide.workflow.title}`)
  log(guide.workflow.description)
  for (const step of guide.workflow.steps) {
    log(`\n  ${step.step}. ${step.name}  (${step.method} ${step.path})`)
    log(`     What you learn: ${step.whatYouLearn}`)
  }

  subheader('Anti-patterns (what NOT to do)')
  for (const a of guide.antiPatterns) {
    log(`\n  ✗ ${a.pattern}`)
    log(`    Why:   ${a.why}`)
    log(`    Do:    ${a.instead}`)
  }

  subheader('Common recipes (copy-pasteable)')
  for (const r of guide.commonRecipes) {
    log(`  • [${r.method} ${r.path}]  ${r.name} — ${r.description}`)
  }

  subheader('Domain inventory (which domains have rich agent context)')
  const withContext = guide.domains.filter((d) => d.hasPlaybook)
  log(`${withContext.length} / ${guide.domains.length} domains ship a playbook:`)
  for (const d of withContext) {
    const flags = [
      d.hasPlaybook ? 'playbook' : null,
      d.hasCommonQueries ? 'recipes' : null,
      d.hasAgentHints ? 'hints' : null,
    ]
      .filter(Boolean)
      .join(', ')
    log(`  • ${d.id.padEnd(28)} ${d.name}  (${flags})`)
  }

  // 2. Fetch a domain-specific slice
  header('GET /guide/coal  — domain-specific guide')
  const coal = await fetchJson<DomainGuideSummary>('/guide/coal')
  log(`Domain: ${coal.id}  (${coal.name})`)

  if (coal.playbook) {
    subheader(`Playbook (${coal.playbook.steps.length} steps)`)
    for (let i = 0; i < coal.playbook.steps.length; i++) {
      const s = coal.playbook.steps[i]!
      log(`  ${i + 1}. ${s.goal}`)
      log(`     ${s.route}`)
      log(`     (${s.why})`)
    }
  }

  if (coal.commonQueries) {
    subheader(`Common queries (${coal.commonQueries.length})`)
    for (const q of coal.commonQueries) log(`  • ${q.name} — ${q.description}`)
  }

  if (coal.agentHints) {
    subheader('Agent hints')
    log('  Warnings:')
    for (const w of coal.agentHints.warnings) log(`    - ${w}`)
    log('  Gotchas:')
    for (const g of coal.agentHints.gotchas) log(`    - ${g}`)
    if (coal.agentHints.seeAlso) {
      log('  See also:')
      for (const s of coal.agentHints.seeAlso) log(`    - ${s}`)
    }
  }

  if (coal.taskToRoute) {
    subheader('Task → route (intent dispatch table)')
    dump(coal.taskToRoute, 1200)
  }

  subheader('Per-sub-route agent guidance (first 3)')
  for (const s of coal.subRoutes.filter((s) => s.agentGuidance).slice(0, 3)) {
    log(`\n  ${s.id}  (${s.summary})`)
    log(`    ${s.agentGuidance}`)
  }

  header('Done')
  log('An agent would now use this guide to drive the next /search, /domains,')
  log('/facet, and /query calls — no other documentation needed.')
}

runExample(main)
