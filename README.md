# Wings Cup

World Cup betting app for friend groups — place predictions, compete on leaderboards, and settle who really knows football.

Built with Nuxt 4.4 + Supabase.

## Stack

| Layer | Tech |
|-------|------|
| Framework | Nuxt 4.4 (SSR, `app/` srcDir) |
| Database & Auth | Supabase (PostgreSQL, RLS, Auth) |
| Styling | Tailwind v4 + shadcn-vue |
| State | Pinia |
| Validation | Zod |
| Testing | Vitest v4 + @nuxt/test-utils v4 + Playwright |
| Deploy | Vercel (cron jobs for match sync and prediction locking) |

---

## Boot from scratch

Follow these steps on a clean checkout to get the project running locally.

1. **Clone the repo**
   ```bash
   git clone https://github.com/EmSanchezM/wings-cup.git
   cd wings-cup
   ```

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Copy the env template and fill in values**
   ```bash
   cp .env.example .env.local
   # Open .env.local and set NUXT_PUBLIC_SUPABASE_URL, NUXT_PUBLIC_SUPABASE_KEY,
   # NUXT_SUPABASE_SERVICE_KEY. Leave NUXT_CRON_SECRET and NUXT_API_FOOTBALL_KEY
   # empty for now -- they are used by slice 3 (matches + predictions).
   ```
   Get your Supabase URL and keys from **Project Settings -> API** in the Supabase dashboard.

4. **Link the Supabase project**
   ```bash
   pnpm exec supabase link --project-ref <your-project-ref>
   ```
   No Docker required. This connects the CLI to your cloud Supabase dev project.

   > Optional alternative: `pnpm exec supabase start` runs a full local Supabase stack via Docker.
   > See [Supabase local dev docs](https://supabase.com/docs/guides/local-development) for setup.

5. **Apply migrations**
   ```bash
   pnpm db:push
   # Creates all 7 tables, RLS policies, and triggers in your Supabase project.
   ```

6. **Generate TypeScript types**
   ```bash
   pnpm gen-types
   # Outputs shared/types/database.types.ts -- re-run this after every migration.
   ```

7. **Start the dev server**
   ```bash
   pnpm dev
   # App runs on http://localhost:3000
   # /rooms and /admin require authentication; / and /auth/* are public.
   ```

---

## Scripts

| Script | What it does |
|--------|-------------|
| `pnpm dev` | Start Nuxt dev server with HMR |
| `pnpm build` | Production build (Vercel-compatible output) |
| `pnpm lint` | Run ESLint flat config |
| `pnpm lint:fix` | Run ESLint with auto-fix |
| `pnpm test:unit` | Run Vitest unit tests (`tests/unit/`) |
| `pnpm test:nuxt` | Run Vitest Nuxt component tests (`tests/nuxt/`) |
| `pnpm test:e2e` | Run Playwright e2e tests |
| `pnpm gen-types` | Regenerate `shared/types/database.types.ts` from Supabase schema |
| `pnpm db:push` | Apply pending migrations to the linked Supabase project |
| `pnpm db:reset` | Reset the linked Supabase project to the migration baseline |
| `pnpm db:diff` | Show schema diff between local migrations and remote |
| `pnpm db:pull` | Pull remote schema changes into a new migration file |

---

## Notes

### After every migration

Re-run `pnpm gen-types` to keep `shared/types/database.types.ts` in sync with the schema.
```bash
pnpm gen-types
git add shared/types/database.types.ts
git commit -m "chore(types): regenerate database types after migration"
```

### Super-admin bootstrap

Log in once via the app to create your `profiles` row, then run the following in the Supabase SQL editor (use the service role or the dashboard SQL editor -- not the JS client):

```sql
UPDATE profiles
SET is_super_admin = TRUE
WHERE id = '<your-auth-user-id>';
```

Your auth user ID is in **Authentication -> Users** in the Supabase dashboard.

### Vitest v4 + @nuxt/test-utils v4 -- composable gotcha

Composables (like `useSupabaseClient`) and dynamic imports of Vue components **must be called inside `beforeAll`**, not at the top level of a `describe` block. This is a **Vitest v4 breaking change** -- the Nuxt environment is only initialized after the test suite begins.

```ts
// CORRECT (v4 pattern)
describe('MyComponent', () => {
  let wrapper: VueWrapper
  beforeAll(async () => {
    const { default: MyComponent } = await import('~/components/MyComponent.vue')
    wrapper = await mountSuspended(MyComponent)
  })
  it('renders', () => expect(wrapper.html()).toBeTruthy())
})

// WRONG (v3 pattern -- will throw in v4)
import MyComponent from '~/components/MyComponent.vue'
describe('MyComponent', () => {
  it('renders', async () => {
    const wrapper = await mountSuspended(MyComponent) // may crash
  })
})
```

---

## License

Personal project -- all rights reserved.
