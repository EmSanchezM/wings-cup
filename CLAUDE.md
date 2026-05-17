# Wings-cup — Project Instructions

Supplements the user's global `~/.claude/CLAUDE.md`. Project-specific rules that override or extend the global defaults.

## Project context

Nuxt 4 + Supabase (cloud, `wings-cup-dev` ref `rhmrnffsqdqhzedutnri`) World-Cup betting app for friend groups. Spec-Driven Development is the workflow: every substantial change goes through `sdd-explore` → `sdd-propose` → `sdd-spec` + `sdd-design` → `sdd-tasks` → `sdd-apply` → `sdd-verify` → `sdd-archive`. Persistence backend is **engram**.

Stack and conventions:
- TypeScript everywhere; Vitest v4 with two projects: `unit` (Node env) and `nuxt` (`@nuxt/test-utils`).
- Strict TDD: RED → GREEN → REFACTOR for every implementation task.
- Clean Architecture: business logic in `server/handlers/<name>.ts` + `app/utils/<name>.ts` (pure, unit-tested); Nitro routes / Vue pages / composables are thin wrappers.
- Migrations live in `supabase/migrations/`; hand-applied rollbacks in `supabase/rollbacks/`.
- `.env*` files are permission-gated for Edit/Write/Bash — surface as manual follow-up if changes are needed.

## SDD Gates (mandatory, project-specific)

These two gates were added on 2026-05-17 after slice 2 retrospective. The slice 2 review surfaced 5 spec/design conflicts AND 3 foundation bugs that the prior SDD flow let through. Both gates target those failure modes.

### Gate P1 — Spec ↔ Design cross-check (before `sdd-tasks`)

BEFORE the orchestrator delegates to `sdd-tasks`, it MUST verify spec and design agree.

Protocol:
1. Read every domain spec under `sdd/<change>/spec/*` (or `openspec/changes/<change>/specs/*/spec.md`) AND read `sdd/<change>/design` (or `design.md`).
2. For every requirement, every named field, every contract, every validation rule: confirm the spec value and the design value MATCH exactly.
3. Examples that previously slipped through:
   - `name` max length: spec said 100, design said 80 — divergent.
   - `display_name` max length: spec said 50, design said 60 — divergent.
   - Join endpoint body: spec required `inviteCode` in body, design used URL param — divergent.
   - Join response: spec returned `{roomId}`, design returned `{room:{id,name}}` — divergent.
   - `useRoom` composable: design listed 5 functions, tasks listed 3 functions + 2 refs — divergent.
4. If ANY disagreement is found: STOP. Surface the disagreements to the user. Ask which artifact wins. Update the loser BEFORE calling `sdd-tasks`.
5. Log the cross-check result as a brief observation in the orchestrator response so the human can see the gate ran.

### Gate P2 — Known Gotchas review (during `sdd-design` and `sdd-verify`)

BEFORE delegating to `sdd-design`:
1. Search engram for `gotchas/index` and read it (via `mem_search` → `mem_get_observation`).
2. Read every applicable per-topic gotcha that touches the change area:
   - New trigger on `auth.users` or new auth flow → `gotchas/supabase-auth`
   - New/changed RLS policy → `gotchas/postgres-rls`
   - New use of `@nuxtjs/supabase` helpers or env vars → `gotchas/nuxt-supabase-v2`
   - New tests → `gotchas/nuxt-4-testing`
   - New env vars or secret handling → `gotchas/env-vars-wings-cup`
3. Inject the gotcha CONTENT into the `sdd-design` sub-agent prompt as `## Known Gotchas to Address (auto-resolved)`.
4. Require the sub-agent to add a `## Known Gotchas Addressed` section to `design.md` enumerating which gotchas apply and how the design handles each.

BEFORE delegating to `sdd-verify`:
5. Pass the same gotchas list to the verify sub-agent.
6. Require the verifier to confirm each gotcha listed in design was actually addressed in implementation. A known applicable gotcha NOT addressed = CRITICAL.

When a NEW pitfall surfaces during apply or smoke:
7. `mem_save` (or `mem_update`) under topic_key `gotchas/<area>` with content following the same template (Symptom / Pattern / Where).
8. Add a row to `gotchas/index` if it's a new area.

## Known Gotchas Topics (engram registry)

| Topic | topic_key | Apply when |
|-------|-----------|------------|
| Supabase Auth | `gotchas/supabase-auth` | Trigger on auth.users, signup flow, JWT claims, PKCE redirect |
| Postgres RLS | `gotchas/postgres-rls` | Any new policy, RLS subquery, mutation with `auth.uid()`, INSERT+RETURNING |
| @nuxtjs/supabase v2 | `gotchas/nuxt-supabase-v2` | Server helpers, env vars, cookieRedirect, route-guard config |
| Nuxt 4 / Vitest v4 | `gotchas/nuxt-4-testing` | New tests (unit or nuxt), composable testing, `$fetch` typing |
| Env vars | `gotchas/env-vars-wings-cup` | New env vars, secret handling, `.env*` files |
| Index | `gotchas/index` | Master list — start here in `sdd-design` |

## Skill resolution

`.atl/skill-registry.md` lists the user-skills (branch-pr, chained-pr, work-unit-commits, etc) with their compact rules. The orchestrator MUST inject relevant skill compact rules into sub-agent prompts as `## Project Standards (auto-resolved)` per the existing skill-resolver protocol.

The two gates above (P1, P2) are ENFORCEMENT additions specific to this project's SDD process — they are NOT user-skills, they are orchestrator gates. Both are mandatory.
