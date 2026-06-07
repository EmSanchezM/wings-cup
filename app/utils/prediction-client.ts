import type { UpsertPredictionInput, Prediction } from '#shared/types/predictions'

export function makePredictionClient(fetchImpl: typeof $fetch) {
  return {
    async upsertPrediction(
      roomId: string,
      payload: UpsertPredictionInput,
    ): Promise<{ prediction: Prediction }> {
      return fetchImpl<{ prediction: Prediction }>(
        `/api/rooms/${roomId}/predictions`,
        { method: 'POST', body: payload },
      )
    },

    async getPredictions(roomId: string): Promise<{ predictions: Prediction[] }> {
      return fetchImpl<{ predictions: Prediction[] }>(
        `/api/rooms/${roomId}/predictions`,
      )
    },
  }
}
