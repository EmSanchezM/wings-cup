# Spec: triggers

**Domain:** Database trigger functions and their bindings.
**Slice:** foundation (PR 2 of 3 — `supabase/migrations/00003_triggers.sql`)

---

## Purpose

Install the four trigger functions required by the application's domain logic: profile creation on signup, `updated_at` maintenance, prediction scoring, and prediction locking. All triggers MUST be defined in this slice so application logic in slices 2–5 can rely on them without follow-up migrations.

---

## Requirements

### General

- R-TR-01: All trigger functions and their bindings MUST be defined in `supabase/migrations/00003_triggers.sql`.
- R-TR-02: All trigger functions that write to tables MUST be created with `SECURITY DEFINER` so they execute with elevated privileges, bypassing RLS.
- R-TR-03: The migration MUST apply without errors via `supabase db push` after `00001_schema.sql` and `00002_rls.sql` have been applied.

### `handle_new_user` — profile on signup

- R-TR-04: A trigger named `on_auth_user_created` MUST fire `AFTER INSERT ON auth.users FOR EACH ROW` and call `handle_new_user()`.
- R-TR-05: `handle_new_user()` MUST insert a row into `public.profiles` with:
  - `id = NEW.id`
  - `display_name` = `NEW.raw_user_meta_data->>'display_name'` (falls back to `NEW.email` if null)
  - `avatar_url` = `NEW.raw_user_meta_data->>'avatar_url'`
  - `auth_provider` = `NEW.raw_app_meta_data->>'provider'` (falls back to `'magic_link'` if null)
  - `is_guest` = `TRUE` when `auth_provider = 'magic_link'`; `FALSE` otherwise
  - `is_super_admin` = `FALSE` (always; never set from user data)
- R-TR-06: If the `auth.users` insert corresponds to a Google OAuth user, `auth_provider` MUST be `'google'` and `is_guest` MUST be `FALSE`.
- R-TR-08: If the `auth.users` insert corresponds to a magic-link user (provider null or `'email'`), `auth_provider` MUST be `'magic_link'` and `is_guest` MUST be `TRUE`.
- R-TR-09: The trigger MUST NOT fail when `raw_user_meta_data` or `raw_app_meta_data` is NULL (defensive null-coalescing).

### `handle_updated_at` — moddatetime

- R-TR-10: A trigger named `on_profiles_updated` MUST fire `BEFORE UPDATE ON public.profiles FOR EACH ROW` and set `NEW.updated_at = NOW()`.
- R-TR-11: A trigger named `on_predictions_updated` MUST fire `BEFORE UPDATE ON public.predictions FOR EACH ROW` and set `NEW.updated_at = NOW()`.
- R-TR-12: The `moddatetime` extension from `pg_catalog` MAY be used if available on Supabase; otherwise the trigger function MUST be written inline.

### `calculate_points` — scoring

- R-TR-13: A trigger named `on_match_result` MUST fire `AFTER UPDATE OF home_score, away_score ON public.matches FOR EACH ROW WHEN (NEW.status = 'finished')`.
- R-TR-14: `calculate_points()` MUST update `predictions.points` for all predictions referencing `NEW.id` using this priority order:
  1. `exact_score` (5 pts default): `predicted_home = NEW.home_score AND predicted_away = NEW.away_score`
  2. `correct_goal_diff` (3 pts default): goal difference matches but not exact score
  3. `correct_result` (1 pt default): correct W/D/L outcome but neither of the above
  4. `0` pts: none of the above
- R-TR-15: `calculate_points()` MUST read scoring weights from `rooms.scoring_rules` JSONB for the prediction's `room_id`, not from hardcoded constants. Each room's weights apply independently.
- R-TR-16: After updating `predictions.points`, `calculate_points()` MUST update `room_members.total_points` for each affected `(room_id, user_id)` pair by summing all non-null `predictions.points` for that member.
- R-TR-17: `room_members.total_points` MUST be updated atomically within the same trigger execution (no separate job).
- R-TR-18: The CASE ordering MUST be preserved exactly: `exact_score` > `correct_goal_diff` > `correct_result`. An inline comment in SQL MUST document this priority.

### `lock_started_predictions` — locking

- R-TR-19: A function named `lock_started_predictions()` MUST be defined. It is NOT a trigger on a table — it is a standalone function called by the Vercel cron endpoint.
- R-TR-20: `lock_started_predictions()` MUST set `locked_at = NOW()` on all predictions where the related match's `kickoff_at <= NOW()` AND `predictions.locked_at IS NULL`.
- R-TR-21: The function MUST be callable from a Nitro server route using the service role client (the Vercel cron endpoint will call it via `supabase.rpc('lock_started_predictions')`).
- R-TR-22: The function MUST return the count of rows locked (for logging purposes).

---

## Scenarios

### S-TR-01: Google OAuth creates profile with correct flags

```
Given the triggers migration has been applied
When a new Google OAuth user signs up (Supabase inserts into auth.users with raw_app_meta_data->>'provider' = 'google')
Then a row is inserted into public.profiles
And auth_provider = 'google'
And is_guest = FALSE
And is_super_admin = FALSE
```

### S-TR-03: Magic-link user creates profile with is_guest = true

```
Given the triggers migration has been applied
When a new magic-link user signs up (raw_app_meta_data->>'provider' is NULL or 'email')
Then a row is inserted into public.profiles
And auth_provider = 'magic_link'
And is_guest = TRUE
And is_super_admin = FALSE
```

### S-TR-04: handle_new_user survives null metadata

```
Given the triggers migration has been applied
When an auth.users INSERT occurs with raw_user_meta_data = NULL and raw_app_meta_data = NULL
Then handle_new_user() executes without raising an exception
And a profiles row is inserted with auth_provider = 'magic_link', is_guest = TRUE
```

### S-TR-05: updated_at is refreshed on profiles UPDATE

```
Given a profiles row exists with updated_at = T0
When an UPDATE is performed on that profiles row (changing display_name)
Then updated_at is set to a timestamp >= T0 + 1 second
```

### S-TR-06: updated_at is refreshed on predictions UPDATE

```
Given a predictions row exists with updated_at = T0
When the prediction is updated (changing predicted_home)
Then predictions.updated_at is set to a timestamp >= T0 + 1 second
```

### S-TR-07: calculate_points — exact score awards room's exact_score weight

```
Given a match with home_score = 2 and away_score = 1
And a prediction in room R with predicted_home = 2, predicted_away = 1
And room R has scoring_rules = {"exact_score": 5, "correct_goal_diff": 3, "correct_result": 1}
When the match status is set to 'finished'
Then predictions.points = 5 for that prediction
And room_members.total_points is incremented by 5 for the predicting user in room R
```

### S-TR-08: calculate_points — correct goal diff (not exact)

```
Given a match with home_score = 3 and away_score = 1 (goal diff = 2)
And a prediction with predicted_home = 2, predicted_away = 0 (goal diff = 2, not exact)
And room scoring_rules = {"exact_score": 5, "correct_goal_diff": 3, "correct_result": 1}
When the match status is set to 'finished'
Then predictions.points = 3
```

### S-TR-09: calculate_points — correct result only

```
Given a match with home_score = 2 and away_score = 0 (home win)
And a prediction with predicted_home = 1, predicted_away = 0 (home win, wrong diff)
And room scoring_rules = {"exact_score": 5, "correct_goal_diff": 3, "correct_result": 1}
When the match status is set to 'finished'
Then predictions.points = 1
```

### S-TR-10: calculate_points — wrong prediction scores 0

```
Given a match with home_score = 1, away_score = 0 (home win)
And a prediction with predicted_home = 0, predicted_away = 1 (away win)
When the match status is set to 'finished'
Then predictions.points = 0
```

### S-TR-11: calculate_points uses per-room weights

```
Given room R1 has scoring_rules = {"exact_score": 10, "correct_goal_diff": 5, "correct_result": 2}
And room R2 has the default scoring_rules
And both rooms have a prediction on the same match with exact score predicted correctly
When the match status is set to 'finished'
Then the prediction in R1 has points = 10
And the prediction in R2 has points = 5 (default exact_score weight)
```

### S-TR-12: lock_started_predictions locks eligible predictions

```
Given a match with kickoff_at = NOW() - 5 minutes
And predictions exist for that match with locked_at IS NULL
When lock_started_predictions() is called (via service role RPC)
Then all those predictions have locked_at set to a non-null timestamp
And the function returns the count of locked rows (>= 1)
```

### S-TR-13: lock_started_predictions does not lock future predictions

```
Given a match with kickoff_at = NOW() + 30 minutes
And a prediction exists for that match with locked_at IS NULL
When lock_started_predictions() is called
Then that prediction's locked_at remains NULL
```

---

## Acceptance criteria

- [ ] `on_auth_user_created` trigger bound to `auth.users AFTER INSERT`
- [ ] Google OAuth signup creates profile with `is_guest = FALSE`, `auth_provider = 'google'`
- [ ] Magic-link signup creates profile with `is_guest = TRUE`, `auth_provider = 'magic_link'`
- [ ] `handle_new_user` does not throw when metadata is NULL
- [ ] `on_profiles_updated` updates `profiles.updated_at` on UPDATE
- [ ] `on_predictions_updated` updates `predictions.updated_at` on UPDATE
- [ ] `on_match_result` fires when match status changes to 'finished'
- [ ] `calculate_points` awards 5/3/1/0 using per-room weights in correct priority order
- [ ] `room_members.total_points` is updated atomically in the same trigger call
- [ ] `lock_started_predictions()` function exists and is callable via service role RPC
- [ ] `lock_started_predictions()` locks only past-kickoff predictions with `locked_at IS NULL`
- [ ] `lock_started_predictions()` returns locked row count

---

## Out of scope (this slice)

- Vercel cron endpoint that calls `lock_started_predictions` (slice 3)
- Match score sync from external API (slice 3)
- Scoring rule UI for room configuration (slice 2)
- `tournament_predictions` scoring (roadmap)
