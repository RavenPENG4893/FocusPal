// Thompson Sampling Smart Reminders (V2 Track B - 3.2)
// Beta-Bernoulli multi-armed bandit for adaptive reminder intervals
// Each reminder type (water/stand/eyes) has an independent bandit

import { invoke } from '@tauri-apps/api/core'

export const ARMS = [15, 20, 30, 45, 60, 90] as const // minutes
export type ArmIndex = 0 | 1 | 2 | 3 | 4 | 5

export interface ArmState {
  intervalMin: number
  alpha: number // successes + 1 (prior)
  beta: number  // failures + 1 (prior)
  totalPulls: number
}

export interface BanditState {
  arms: ArmState[]
  totalInteractions: number
  explorationPhase: boolean // first 20 interactions = forced round-robin
}

/** Sample from Beta(alpha, beta) using Joehnk's method */
function sampleBeta(alpha: number, beta: number): number {
  // Use the gamma sampling approach for better numerical stability
  const gammaA = sampleGamma(alpha)
  const gammaB = sampleGamma(beta)
  return gammaA / (gammaA + gammaB)
}

/** Sample from Gamma(shape, 1) using Marsaglia and Tsang's method */
function sampleGamma(shape: number): number {
  if (shape < 1) {
    return sampleGamma(shape + 1) * Math.pow(Math.random(), 1 / shape)
  }
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  while (true) {
    let x: number, v: number
    do {
      x = randn()
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = Math.random()
    if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v
    if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v
  }
}

/** Standard normal using Box-Muller */
function randn(): number {
  const u1 = Math.random()
  const u2 = Math.random()
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
}

export type ReminderBanditType = 'water' | 'stretch' | 'eyes'

const CONFIG_KEY_PREFIX = 'thompson_'

export class ThompsonBandit {
  private bandits: Map<ReminderBanditType, BanditState> = new Map()

  constructor() {
    for (const type of ['water', 'stretch', 'eyes'] as ReminderBanditType[]) {
      this.bandits.set(type, this.createDefaultState())
    }
  }

  private createDefaultState(): BanditState {
    return {
      arms: ARMS.map(min => ({
        intervalMin: min,
        alpha: 1, // Beta(1,1) uniform prior
        beta: 1,
        totalPulls: 0,
      })),
      totalInteractions: 0,
      explorationPhase: true,
    }
  }

  /** Load bandit state from SQLite config */
  async load() {
    for (const type of ['water', 'stretch', 'eyes'] as ReminderBanditType[]) {
      try {
        const raw = await invoke<string | null>('config_get', {
          key: `${CONFIG_KEY_PREFIX}${type}`,
        })
        if (raw) {
          const parsed = JSON.parse(raw) as BanditState
          // Validate structure
          if (parsed.arms && parsed.arms.length === ARMS.length) {
            this.bandits.set(type, parsed)
          }
        }
      } catch {
        // Keep default
      }
    }
  }

  /** Save bandit state to SQLite config */
  private async save(type: ReminderBanditType) {
    const state = this.bandits.get(type)
    if (!state) return
    try {
      await invoke('config_set', {
        key: `${CONFIG_KEY_PREFIX}${type}`,
        value: JSON.stringify(state),
      })
    } catch {}
  }

  /** Select next arm using Thompson Sampling */
  selectArm(type: ReminderBanditType): { armIndex: number; intervalMin: number } {
    const state = this.bandits.get(type)!

    // Exploration phase: forced round-robin for first 20 interactions
    if (state.explorationPhase && state.totalInteractions < 20) {
      const armIndex = state.totalInteractions % ARMS.length
      return { armIndex, intervalMin: ARMS[armIndex] }
    }

    // Thompson Sampling: sample from each arm's Beta distribution, pick max
    let bestArm = 0
    let bestSample = -1
    for (let i = 0; i < state.arms.length; i++) {
      const arm = state.arms[i]
      const sample = sampleBeta(arm.alpha, arm.beta)
      if (sample > bestSample) {
        bestSample = sample
        bestArm = i
      }
    }

    return { armIndex: bestArm, intervalMin: ARMS[bestArm] }
  }

  /** Update bandit after user response */
  async update(type: ReminderBanditType, armIndex: number, accepted: boolean) {
    const state = this.bandits.get(type)!
    const arm = state.arms[armIndex]

    if (accepted) {
      arm.alpha += 1
    } else {
      arm.beta += 1
    }
    arm.totalPulls += 1
    state.totalInteractions += 1

    if (state.totalInteractions >= 20) {
      state.explorationPhase = false
    }

    await this.save(type)
  }

  /** Get state for visualization */
  getState(type: ReminderBanditType): BanditState {
    return this.bandits.get(type)!
  }

  /** Get the currently favored arm (highest acceptance rate) */
  getFavoredArm(type: ReminderBanditType): { intervalMin: number; acceptRate: number } | null {
    const state = this.bandits.get(type)!
    let bestArm = -1
    let bestRate = -1
    for (let i = 0; i < state.arms.length; i++) {
      const arm = state.arms[i]
      if (arm.totalPulls === 0) continue
      const rate = arm.alpha / (arm.alpha + arm.beta)
      if (rate > bestRate) {
        bestRate = rate
        bestArm = i
      }
    }
    if (bestArm < 0) return null
    return { intervalMin: ARMS[bestArm], acceptRate: bestRate }
  }

  /** Check if bandit has enough data to make a character commentary */
  getCommentary(type: ReminderBanditType): string | null {
    const favored = this.getFavoredArm(type)
    if (!favored) return null

    const state = this.bandits.get(type)!
    const arm = state.arms.find(a => a.intervalMin === favored.intervalMin)
    if (!arm || arm.totalPulls < 10 || favored.acceptRate < 0.7) return null

    const labels: Record<ReminderBanditType, string> = {
      water: '喝水',
      stretch: '站起来活动',
      eyes: '休息眼睛',
    }
    return `我发现你更喜欢每${favored.intervalMin}分钟${labels[type]}，我调整好了！`
  }

  /** Compute Beta PDF values for visualization (for one arm) */
  static betaPDF(alpha: number, beta: number, points = 50): { x: number; y: number }[] {
    const result: { x: number; y: number }[] = []
    // Beta function approximation using lgamma
    const lnB = lgamma(alpha) + lgamma(beta) - lgamma(alpha + beta)
    for (let i = 0; i <= points; i++) {
      const x = i / points
      if (x === 0 || x === 1) {
        result.push({ x, y: 0 })
        continue
      }
      const lnPdf = (alpha - 1) * Math.log(x) + (beta - 1) * Math.log(1 - x) - lnB
      result.push({ x, y: Math.exp(lnPdf) })
    }
    return result
  }
}

/** Log-gamma (Lanczos approximation) */
function lgamma(z: number): number {
  if (z < 0.5) {
    return Math.log(Math.PI / Math.sin(Math.PI * z)) - lgamma(1 - z)
  }
  z -= 1
  const g = 7
  const c = [
    0.99999999999980993, 676.5203681218851, -1259.1392167224028,
    771.32342877765313, -176.61502916214059, 12.507343278686905,
    -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
  ]
  let x = c[0]
  for (let i = 1; i < g + 2; i++) {
    x += c[i] / (z + i)
  }
  const t = z + g + 0.5
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(x)
}
