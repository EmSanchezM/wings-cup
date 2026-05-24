import type { Tables } from './database.types'

export type Prediction = Tables<'predictions'>

export type PredictionRow = Prediction

export type UpsertPredictionInput = {
  match_id: string
  predicted_home: number
  predicted_away: number
}
