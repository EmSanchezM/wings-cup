# Predictions Spec — Delta for realtime-match-and-leaderboard (Slice 6)

## Overview
Delta. Two existing UI requirements modified: R-PRED-06 (filter widened to include `live`/`finished`) and R-PRED-07 (card gains read-only mode and final-score display based on match status). No change to R-PRED-01..05 server-side requirements.

## Requirements Summary

| Req | Title | Type | Scenarios |
|-----|-------|------|-----------:|
| R-PRED-06 | Match Selector Card List Page | MODIFIED | 7 |
| R-PRED-07 | MatchPredictionCard Component Contract | MODIFIED | 8 |

---

## MODIFIED Requirements

### R-PRED-06: Match Selector Card List Page

**Type**: MODIFIED | **Source**: W-03 + Proposal §3.4 / decisions 1, 2
**Files**: `app/pages/rooms/[id]/predictions.vue`

(Previously: filter restricted to `status === 'scheduled'` AND `kickoff_at > now`. New: filter is `status ∈ ['scheduled', 'live', 'finished']`; the `kickoff_at > now` client-side time check is removed because the server-side kickoff gate in `upsert-prediction` handler remains the authoritative guard. The local variable `scheduledEntries` MUST be renamed to `eligibleEntries`.)

The `rooms/[id]/predictions.vue` page MUST load all matches from `useMatches()` and filter client-side to those with `status ∈ ['scheduled', 'live', 'finished']`, stored in a computed ref named `eligibleEntries`. It MUST also load the user's existing predictions for the room via `predClient.getPredictions(roomId)`. Both fetches MUST be initiated in parallel on `onMounted`. The page MUST join the two arrays client-side by `match_id` and render one `<MatchPredictionCard>` per resulting entry. When `eligibleEntries` is empty the page MUST render the empty-state message "No hay partidos disponibles para pronosticar" and a navigation link to the room leaderboard — it MUST NOT redirect automatically. Per-card error responses (HTTP 423, 409) MUST be displayed inline on the corresponding card and MUST NOT surface as a global page-level error. The page MUST NOT contain any `useSupabaseUser` import; authentication is guaranteed by the module-level `redirectOptions`.

#### Scenario: Scheduled matches render as cards

- GIVEN the room has matches with `status === 'scheduled'` and the user is authenticated
- WHEN `rooms/[id]/predictions.vue` mounts
- THEN one `<MatchPredictionCard>` is rendered per scheduled match, showing home team, away team, kickoff datetime (locale-formatted), and stage

#### Scenario: Live and finished matches render as cards

- GIVEN the room has matches with `status === 'live'` or `status === 'finished'`
- WHEN the page computes `eligibleEntries`
- THEN cards are rendered for those matches
- AND the cards display in read-only mode (per R-PRED-07)

#### Scenario: Existing predictions pre-fill card inputs

- GIVEN the user has an existing unlocked prediction for match M in room R
- WHEN the page finishes loading and joining data
- THEN the card for M has `predictedHome` and `predictedAway` inputs pre-filled with the saved values

#### Scenario: No eligible matches — empty state

- GIVEN there are zero matches with `status ∈ ['scheduled', 'live', 'finished']` visible to the page
- WHEN the page finishes loading
- THEN the empty-state message "No hay partidos disponibles para pronosticar" is visible
- AND a link to the room leaderboard is rendered
- AND no automatic navigation occurs

#### Scenario: Non-eligible matches excluded

- GIVEN the match list includes matches with `status` of `postponed` or `cancelled`
- WHEN the page applies the client-side filter via `eligibleEntries`
- THEN no card is rendered for those matches

#### Scenario: 423 response displayed per card, not globally

- GIVEN the user submits a prediction for a match whose prediction has `locked_at IS NOT NULL`
- WHEN the server returns HTTP 423
- THEN the error is displayed on that specific card only
- AND all other cards remain in their current state, unaffected

#### Scenario: 409 response displayed per card, not globally

- GIVEN the user submits a prediction for a match whose `kickoff_at <= now()`
- WHEN the server returns HTTP 409 `{ error: "match_already_started" }`
- THEN the error is displayed on that specific card only
- AND all other cards remain in their current state

---

### R-PRED-07: MatchPredictionCard Component Contract

**Type**: MODIFIED | **Source**: W-03 + Proposal §3.5 / decision 2
**Files**: `app/components/MatchPredictionCard.vue`, `tests/unit/MatchPredictionCard.spec.ts`

(Previously: read-only mode driven solely by `existingPrediction.locked_at`. New: a second independent read-only mode is added for `match.status !== 'scheduled'`. Additionally, when `match.status === 'finished'`, the card MUST display the final score. The `locked_at`-based lock badge remains independent.)

`app/components/MatchPredictionCard.vue` MUST accept two props: `match: MatchListItem` and `existingPrediction: Prediction | null`. It MUST own its local reactive state for `predictedHome`, `predictedAway`, `submitting`, and `error`. It MUST emit a `submitted` event after a successful upsert call.

**Status-based read-only mode**: A computed `isReadonly` MUST be `true` when `match.status !== 'scheduled'`. When `isReadonly` is `true`, score inputs MUST be `readonly` and the submit button MUST NOT be rendered.

**Lock-based read-only mode**: When `existingPrediction.locked_at` is not null, the component MUST render score inputs as `readonly` and MUST display a lock badge. This behaviour is INDEPENDENT of `isReadonly` — both conditions can be true simultaneously.

**Final score display**: When `match.status === 'finished'`, the card MUST render a final score block showing `{match.home_score} - {match.away_score}` below the prediction inputs.

The component MUST call `predClient.upsertPrediction(roomId, { match_id, predicted_home, predicted_away })` on submit and MUST NOT accept `locked_at` in the payload.

#### Scenario: Happy path submit (scheduled, unlocked)

- GIVEN `match.status === 'scheduled'` and `existingPrediction.locked_at === null`
- WHEN the user sets scores and clicks submit
- THEN `upsertPrediction` is called with `{ match_id: match.id, predicted_home, predicted_away }`
- AND the `submitted` event is emitted on success
- AND the card shows a success badge briefly

#### Scenario: Locked prediction renders read-only (lock badge)

- GIVEN `existingPrediction.locked_at` is not null
- WHEN the card renders
- THEN both score inputs have `readonly` attribute
- AND a lock badge is visible
- AND no submit button is active

#### Scenario: Live match renders read-only (no submit button)

- GIVEN `match.status === 'live'` and `existingPrediction.locked_at === null`
- WHEN the card renders
- THEN `isReadonly` is `true`
- AND score inputs have `readonly` attribute
- AND the submit button is NOT rendered
- AND no lock badge is displayed (lock badge is driven by `locked_at`, not status)

#### Scenario: Finished match renders read-only with final score

- GIVEN `match.status === 'finished'` and `match.home_score = 2`, `match.away_score = 1`
- WHEN the card renders
- THEN `isReadonly` is `true`
- AND score inputs have `readonly` attribute
- AND the submit button is NOT rendered
- AND a final score block displaying "2 - 1" is visible below the inputs

#### Scenario: Status transition from scheduled to finished via realtime

- GIVEN the card was rendered with `match.status === 'scheduled'` (submit button visible)
- WHEN the `match` prop is updated to `{ status: 'finished', home_score: 3, away_score: 0 }`
- THEN the submit button disappears
- AND the final score block "3 - 0" becomes visible
- AND score inputs become `readonly`

#### Scenario: Submit pending state

- GIVEN `match.status === 'scheduled'` and the user clicks submit
- WHEN the upsert call is in flight
- THEN `submitting` is true and the submit button is disabled

#### Scenario: Submit error state

- GIVEN `upsertPrediction` rejects or returns an error status
- WHEN the error is received
- THEN `error` is set to the error message
- AND the error is rendered on the card
- AND `submitting` is false

#### Scenario: Pre-filled inputs from existing prediction

- GIVEN `existingPrediction` is non-null and has `predicted_home: 2, predicted_away: 1`
- WHEN the card initialises its local state
- THEN `predictedHome` is initialised to 2 and `predictedAway` to 1
