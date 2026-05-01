export interface AnalysisData {
  best_move: string
  is_drop: boolean
  score_cp: number | null
  score_mate: number | null
  legal_drops?: any[]
  debug?: {
    depth: number
    time: number
  }
}

export function calculateEvaluation(data: AnalysisData): {
  evalBarPercent: number
  scoreText: string
} {
  // Handle mate scores
  if (data.score_mate !== null) {
    const mateIn = data.score_mate
    const evalBarPercent = mateIn > 0 ? 100 : 0
    const scoreText = `M${Math.abs(mateIn)}`
    return { evalBarPercent, scoreText }
  }

  // Handle centipawn scores
  if (data.score_cp !== null) {
    const centipawns = data.score_cp
    const pawns = centipawns / 100
    const evalBarPercent =
      50 + 50 * (2 / (1 + Math.exp(-0.002 * centipawns)) - 1)
    const clampedPercent = Math.max(0, Math.min(100, evalBarPercent))
    const scoreText = pawns >= 0 ? `+${pawns.toFixed(2)}` : pawns.toFixed(2)

    return { evalBarPercent: clampedPercent, scoreText }
  }

  return { evalBarPercent: 50, scoreText: "0.00" }
}
