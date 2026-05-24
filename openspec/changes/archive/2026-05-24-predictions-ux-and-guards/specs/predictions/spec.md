# Predictions Spec — Delta for predictions-ux-and-guards (Slice 4)

## Overview
Delta. Two new UI requirements added: match selector card list (R-PRED-06) and MatchPredictionCard component contract (R-PRED-07). No existing R-PRED-01..05 requirements are modified.

## Requirements Summary
| Req | Title | Capability | Scenarios |
|-----|-------|-----------|-----------| 
| R-PRED-06 | Match Selector Card List Page | UI | 6 |
| R-PRED-07 | MatchPredictionCard Component Contract | UI | 5 |

---

## ADDED Requirements

### R-PRED-06: Match Selector Card List Page
**Type**: ADDED | **Source**: W-03

The `rooms/[id]/predictions.vue` page MUST load all matches from `useMatches()` and filter client-side to those with `status === 'scheduled'`. It MUST also load the user's existing predictions for the room via `predClient.getPredictions(roomId)`. Both fetches MUST be initiated in parallel on `onMounted`. The page MUST join the two arrays client-side by `match_id` and render one `<MatchPredictionCard>` per resulting entry. When the filtered+joined array is empty the page MUST render the empty-state message "No hay partidos disponibles para pronosticar" and a navigation link to the room leaderboard — it MUST NOT redirect automatically. Per-card error responses (HTTP 423, 409) MUST be displayed inline on the corresponding card and MUST NOT surface as a global page-level error. The page MUST NOT contain any `useSupabaseUser` import; authentication is guaranteed by the module-level `redirectOptions`.

#### Scenario: Scheduled matches render as cards

- GIVEN the room has matches with `status === 'scheduled'` and the user is authenticated
- WHEN `rooms/[id]/predictions.vue` mounts
- THEN one `<MatchPredictionCard>` is rendered per scheduled match, showing home team, away team, kickoff datetime (locale-formatted), and stage

#### Scenario: Existing predictions pre-fill card inputs

- GIVEN the user has an existing unlocked prediction for match M in room R
- WHEN the page finishes loading and joining data
- THEN the card for M has `predictedHome` and `predictedAway` inputs pre-filled with the saved values

#### Scenario: No eligible matches — empty state

- GIVEN there are zero matches with `status === 'scheduled'` visible to the page
- WHEN the page finishes loading
- THEN the empty-state message "No hay partidos disponibles para pronosticar" is visible
- AND a link to the room leaderboard is rendered
- AND no automatic navigation occurs

#### Scenario: Non-scheduled matches excluded

- GIVEN the match list includes matches with `status` of `finished`, `in_progress`, or `postponed`
- WHEN the page applies the client-side filter
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
**Type**: ADDED | **Source**: W-03

`app/components/MatchPredictionCard.vue` MUST accept two props: `match: MatchListItem` and `existingPrediction: Prediction | null`. It MUST own its local reactive state for `predictedHome`, `predictedAway`, `submitting`, and `error`. It MUST emit a `submitted` event after a successful upsert call. When `existingPrediction.locked_at` is not null the component MUST render score inputs as `readonly` and MUST display a lock badge. The component MUST call `predClient.upsertPrediction(roomId, { match_id, predicted_home, predicted_away })` on submit and MUST NOT accept `locked_at` in the payload.

#### Scenario: Happy path submit

- GIVEN `match.status === 'scheduled'` and `existingPrediction.locked_at === null`
- WHEN the user sets scores and clicks submit
- THEN `upsertPrediction` is called with `{ match_id: match.id, predicted_home, predicted_away }`
- AND the `submitted` event is emitted on success
- AND the card shows a success badge briefly

#### Scenario: Locked prediction renders read-only

- GIVEN `existingPrediction.locked_at` is not null
- WHEN the card renders
- THEN both score inputs have `readonly` attribute
- AND a lock badge is visible
- AND no submit button is active

#### Scenario: Submit pending state

- GIVEN the user clicks submit
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
