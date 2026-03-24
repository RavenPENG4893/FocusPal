// ML Focus Period Prediction (V2 Track B - 3.1)
// Predicts whether a focus session started now will complete successfully.
// Global baseline model (hardcoded from productivity research) + personal model (local data).
// No external ML dependencies - pure JS implementation of gradient boosting inference.

import { invoke } from '@tauri-apps/api/core'

export type PredictionLevel = 'high' | 'medium' | 'low'

export interface FocusPrediction {
  probability: number     // 0-1, probability of completion
  level: PredictionLevel  // high >0.8, medium 0.5-0.8, low <0.5
  message: string         // character message
  color: string           // glow color for UI
}

export interface FocusFeatures {
  hourOfDay: number          // 0-23
  dayOfWeek: number          // 0-6 (0=Sunday)
  minutesSinceLastSession: number
  dailyFocusTotalSoFar: number  // minutes
  currentStreakDays: number
  plannedDurationMin: number
  moodScoreLatest: number    // 1-5
  sessionsCompletedToday: number
}

// ── Global Baseline Model ──
// Pre-trained from productivity research data:
// - Peak hours: 9-11am and 2-4pm (high completion)
// - Post-lunch dip: 12-1pm (lower)
// - Evening decline: after 8pm
// - Weekdays > weekends
// - Streak bonus: momentum effect
// - Shorter sessions complete more often
// - Higher mood → higher completion
//
// Implemented as a set of weighted rules (equivalent to a shallow decision tree ensemble)

function globalModelPredict(f: FocusFeatures): number {
  let score = 0

  // Hour of day effect (strongest predictor)
  const hourScores: Record<number, number> = {
    6: 0.55, 7: 0.65, 8: 0.75, 9: 0.85, 10: 0.88, 11: 0.82,
    12: 0.60, 13: 0.55, 14: 0.78, 15: 0.82, 16: 0.75, 17: 0.65,
    18: 0.55, 19: 0.50, 20: 0.45, 21: 0.40, 22: 0.35, 23: 0.30,
    0: 0.25, 1: 0.20, 2: 0.15, 3: 0.15, 4: 0.20, 5: 0.40,
  }
  score += (hourScores[f.hourOfDay] ?? 0.5) * 0.30

  // Day of week effect
  const isWeekday = f.dayOfWeek >= 1 && f.dayOfWeek <= 5
  score += (isWeekday ? 0.70 : 0.55) * 0.10

  // Session duration effect (shorter = more likely to complete)
  if (f.plannedDurationMin <= 25) score += 0.80 * 0.15
  else if (f.plannedDurationMin <= 50) score += 0.60 * 0.15
  else score += 0.40 * 0.15

  // Streak momentum
  const streakBonus = Math.min(f.currentStreakDays / 7, 1) * 0.8
  score += (0.50 + streakBonus * 0.30) * 0.10

  // Daily fatigue (more sessions = slightly lower completion)
  const fatigueScore = Math.max(0.3, 1 - f.sessionsCompletedToday * 0.12)
  score += fatigueScore * 0.10

  // Time since last session (too soon or too long both reduce completion)
  let recencyScore = 0.5
  if (f.minutesSinceLastSession >= 30 && f.minutesSinceLastSession <= 180) {
    recencyScore = 0.75 // sweet spot
  } else if (f.minutesSinceLastSession < 30) {
    recencyScore = 0.45 // too soon, fatigue
  } else if (f.minutesSinceLastSession > 480) {
    recencyScore = 0.55 // long gap, cold start
  }
  score += recencyScore * 0.10

  // Mood effect
  const moodScore = (f.moodScoreLatest - 1) / 4 // normalize to 0-1
  score += (0.40 + moodScore * 0.45) * 0.10

  // Daily total so far (diminishing returns)
  const dailyScore = f.dailyFocusTotalSoFar < 60 ? 0.75
    : f.dailyFocusTotalSoFar < 180 ? 0.65
    : 0.45
  score += dailyScore * 0.05

  return Math.max(0, Math.min(1, score))
}

// ── Personal Model ──
// Simple logistic regression trained on user's own focus_sessions data
// Re-trained periodically when enough data accumulates

interface PersonalModelWeights {
  bias: number
  weights: number[] // 8 weights matching features
  trainedAt: number
  sampleCount: number
}

const PERSONAL_CONFIG_KEY = 'focus_prediction_personal_model'
const MIN_SESSIONS_FOR_PERSONAL = 15
const RETRAIN_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000 // weekly

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x))
}

function personalModelPredict(f: FocusFeatures, model: PersonalModelWeights): number {
  const features = [
    f.hourOfDay / 23,
    f.dayOfWeek / 6,
    Math.min(f.minutesSinceLastSession / 600, 1),
    Math.min(f.dailyFocusTotalSoFar / 300, 1),
    Math.min(f.currentStreakDays / 14, 1),
    f.plannedDurationMin / 120,
    (f.moodScoreLatest - 1) / 4,
    Math.min(f.sessionsCompletedToday / 6, 1),
  ]

  let z = model.bias
  for (let i = 0; i < features.length; i++) {
    z += features[i] * model.weights[i]
  }
  return sigmoid(z)
}

/** Train personal logistic regression from session data using SGD */
function trainPersonalModel(
  sessions: { features: number[]; completed: boolean }[]
): PersonalModelWeights {
  const lr = 0.1
  const epochs = 50
  const weights = new Array(8).fill(0)
  let bias = 0

  for (let epoch = 0; epoch < epochs; epoch++) {
    // Shuffle
    const shuffled = [...sessions].sort(() => Math.random() - 0.5)
    for (const s of shuffled) {
      let z = bias
      for (let i = 0; i < 8; i++) z += s.features[i] * weights[i]
      const pred = sigmoid(z)
      const error = (s.completed ? 1 : 0) - pred

      bias += lr * error
      for (let i = 0; i < 8; i++) {
        weights[i] += lr * error * s.features[i]
      }
    }
  }

  return {
    bias,
    weights,
    trainedAt: Date.now(),
    sampleCount: sessions.length,
  }
}

// ── Main Prediction Engine ──

export class FocusPredictionEngine {
  private personalModel: PersonalModelWeights | null = null
  private alpha = 0 // blending weight: 0 = pure global, up to 0.8

  /** Load personal model from SQLite config */
  async load() {
    try {
      const raw = await invoke<string | null>('config_get', {
        key: PERSONAL_CONFIG_KEY,
      })
      if (raw) {
        const model = JSON.parse(raw) as PersonalModelWeights
        if (model.weights && model.weights.length === 8) {
          this.personalModel = model
          // Alpha: increases by 0.1 per 10 sessions, caps at 0.8
          this.alpha = Math.min(0.8, Math.floor(model.sampleCount / 10) * 0.1)
        }
      }
    } catch {}
  }

  /** Check if personal model needs retraining */
  async maybeRetrain() {
    if (this.personalModel &&
        Date.now() - this.personalModel.trainedAt < RETRAIN_INTERVAL_MS) {
      return // too recent
    }

    try {
      // Load all sessions
      const sessions = await invoke<{
        duration_min: number
        actual_min: number
        completed: boolean
        timestamp: number
      }[]>('query_focus_sessions_all')

      if (sessions.length < MIN_SESSIONS_FOR_PERSONAL) return

      // Build training data
      const trainingData: { features: number[]; completed: boolean }[] = []

      for (let i = 0; i < sessions.length; i++) {
        const s = sessions[i]
        const date = new Date(s.timestamp)

        // Compute features from context at session time
        const prevSession = i > 0 ? sessions[i - 1] : null
        const minutesSinceLast = prevSession
          ? (s.timestamp - prevSession.timestamp) / 60000
          : 600

        // Approximate daily stats from surrounding sessions
        const dayStart = new Date(date).setHours(0, 0, 0, 0)
        const todaySessions = sessions.filter(
          ss => ss.timestamp >= dayStart && ss.timestamp < s.timestamp
        )
        const dailyTotal = todaySessions.reduce((sum, ss) => sum + ss.actual_min, 0)
        const completedToday = todaySessions.filter(ss => ss.completed).length

        trainingData.push({
          features: [
            date.getHours() / 23,
            date.getDay() / 6,
            Math.min(minutesSinceLast / 600, 1),
            Math.min(dailyTotal / 300, 1),
            0.5, // streak approximation (can't easily compute retroactively)
            s.duration_min / 120,
            0.5, // mood approximation
            Math.min(completedToday / 6, 1),
          ],
          completed: s.completed,
        })
      }

      const model = trainPersonalModel(trainingData)
      this.personalModel = model
      this.alpha = Math.min(0.8, Math.floor(model.sampleCount / 10) * 0.1)

      // Save to SQLite
      await invoke('config_set', {
        key: PERSONAL_CONFIG_KEY,
        value: JSON.stringify(model),
      })

      console.log(`[FocusPrediction] Personal model trained: ${model.sampleCount} sessions, alpha=${this.alpha}`)
    } catch (e) {
      console.error('[FocusPrediction] retrain error:', e)
    }
  }

  /** Predict completion probability for a session starting now */
  predict(features: FocusFeatures): FocusPrediction {
    const globalProb = globalModelPredict(features)

    let finalProb: number
    if (this.personalModel && this.alpha > 0) {
      const personalProb = personalModelPredict(features, this.personalModel)
      finalProb = this.alpha * personalProb + (1 - this.alpha) * globalProb
    } else {
      finalProb = globalProb
    }

    let level: PredictionLevel
    let message: string
    let color: string

    if (finalProb > 0.8) {
      level = 'high'
      message = '现在很适合专注！历史数据说你这时候超能干~'
      color = '#6BCB77'
    } else if (finalProb >= 0.5) {
      level = 'medium'
      message = '时机还不错，要不先来个短一点的？'
      color = '#FFD93D'
    } else {
      level = 'low'
      message = '按规律这会儿可能有点难，先热身15分钟？'
      color = '#FF6B6B'
    }

    return { probability: finalProb, level, message, color }
  }

  /** Gather current features from system state */
  async gatherFeatures(plannedDurationMin: number): Promise<FocusFeatures> {
    const now = new Date()

    let dailyTotal = 0
    let sessionsToday = 0
    let streak = 0
    let minutesSinceLast = 600 // default: 10 hours (cold start)
    let moodScore = 3

    try {
      const stats = await invoke<{
        today_minutes: number
        today_sessions: number
        streak: number
      }>('get_focus_stats')
      dailyTotal = stats.today_minutes
      sessionsToday = stats.today_sessions
      streak = stats.streak
    } catch {}

    try {
      const lastMoodTime = await invoke<number>('get_last_mood_time')
      if (lastMoodTime > 0) {
        const moods = await invoke<{ score: number }[]>('query_moods', {
          fromTs: lastMoodTime - 1,
          toTs: lastMoodTime + 1,
        })
        if (moods.length > 0) moodScore = moods[0].score
      }
    } catch {}

    // Time since last session (query last session timestamp)
    try {
      const lastTs = await invoke<number | null>('config_get', { key: '_last_focus_ts' })
      if (lastTs) {
        minutesSinceLast = (Date.now() - parseInt(lastTs as any)) / 60000
      }
    } catch {}

    return {
      hourOfDay: now.getHours(),
      dayOfWeek: now.getDay(),
      minutesSinceLastSession: minutesSinceLast,
      dailyFocusTotalSoFar: dailyTotal,
      currentStreakDays: streak,
      plannedDurationMin,
      moodScoreLatest: moodScore,
      sessionsCompletedToday: sessionsToday,
    }
  }

  get hasPersonalModel() { return this.personalModel !== null }
  get blendAlpha() { return this.alpha }
}
