// Autonomous Life System
// When user is away, the character lives its own life:
// cycling through activities, logging what it did, and greeting the user on return.

import { invoke } from '@tauri-apps/api/core'
import type { AnimationState } from './AnimationStateMachine'

export interface Activity {
  state: AnimationState
  label: string
  caption: string
  durationMs: number  // how long this activity lasts
  weight: number      // probability weight (higher = more common)
  rare?: boolean
}

const ACTIVITIES: Activity[] = [
  { state: 'reading',     label: 'Reading',       caption: 'Read a book for a while',             durationMs: 120_000, weight: 20 },
  { state: 'tidying',     label: 'Tidying',       caption: 'Tidied up the desk a bit',            durationMs: 60_000,  weight: 15 },
  { state: 'daydreaming', label: 'Daydreaming',   caption: 'Stared out the window and daydreamed', durationMs: 90_000,  weight: 20 },
  { state: 'napping',     label: 'Napping',       caption: 'Took a little nap',                   durationMs: 180_000, weight: 15 },
  { state: 'slacking',    label: 'Slacking',      caption: 'Scrolled through phone (shh!)',       durationMs: 90_000,  weight: 12 },
  { state: 'gaming',      label: 'Gaming',        caption: 'Put on headphones and played games',  durationMs: 120_000, weight: 10 },
  { state: 'idle',        label: 'Chilling',      caption: 'Just sat around doing nothing',       durationMs: 60_000,  weight: 10 },
  // Rare events
  { state: 'dancing',     label: 'Dancing',       caption: 'Had a spontaneous dance party!',      durationMs: 40_000,  weight: 3, rare: true },
  { state: 'doodling',    label: 'Doodling',      caption: 'Drew some doodles on paper',          durationMs: 90_000,  weight: 5, rare: true },
]

export interface ActivityLogEntry {
  activity: string
  caption: string
  durationSec: number
  timestamp: number
}

export class AutonomousLife {
  private _isAway = false
  private _awayStart = 0
  private _currentActivity: Activity | null = null
  private _activityStart = 0
  private _activityTimer = 0
  private _log: ActivityLogEntry[] = []
  private _onActivity?: (state: AnimationState) => void

  // Away threshold: 5 minutes of no input
  readonly AWAY_THRESHOLD_MS = 5 * 60 * 1000
  private _lastInputTime = Date.now()

  get isAway() { return this._isAway }
  get awayStart() { return this._awayStart }
  get currentActivity() { return this._currentActivity }
  get log() { return this._log }

  onActivity(cb: (state: AnimationState) => void) {
    this._onActivity = cb
  }

  /** Call this whenever user input is detected */
  reportInput() {
    this._lastInputTime = Date.now()

    if (this._isAway) {
      this.returnFromAway()
    }
  }

  /** Check if user has been idle long enough to go away. Call periodically. */
  checkAway() {
    if (this._isAway) return
    const idleMs = Date.now() - this._lastInputTime
    if (idleMs >= this.AWAY_THRESHOLD_MS) {
      this.goAway()
    }
  }

  private goAway() {
    this._isAway = true
    this._awayStart = Date.now()
    this._log = []
    this.nextActivity()
  }

  private returnFromAway() {
    this._isAway = false
    clearTimeout(this._activityTimer)

    // Save final activity
    if (this._currentActivity) {
      this.logCurrentActivity()
    }

    // Persist all activities to SQLite
    this.persistLog()
    this._currentActivity = null
  }

  private nextActivity() {
    if (!this._isAway) return

    // Log previous activity
    if (this._currentActivity) {
      this.logCurrentActivity()
    }

    // Pick next activity (weighted random)
    const activity = this.pickActivity()
    this._currentActivity = activity
    this._activityStart = Date.now()
    this._onActivity?.(activity.state)

    // Schedule next activity
    this._activityTimer = window.setTimeout(() => {
      this.nextActivity()
    }, activity.durationMs)
  }

  private pickActivity(): Activity {
    const totalWeight = ACTIVITIES.reduce((sum, a) => sum + a.weight, 0)
    let rand = Math.random() * totalWeight
    for (const a of ACTIVITIES) {
      rand -= a.weight
      if (rand <= 0) return a
    }
    return ACTIVITIES[0]
  }

  private logCurrentActivity() {
    if (!this._currentActivity) return
    const durationSec = Math.round((Date.now() - this._activityStart) / 1000)
    if (durationSec < 5) return // skip very short activities

    this._log.push({
      activity: this._currentActivity.state,
      caption: this._currentActivity.caption,
      durationSec,
      timestamp: this._activityStart,
    })
  }

  private async persistLog() {
    for (const entry of this._log) {
      try {
        await invoke('insert_activity', {
          activity: entry.activity,
          caption: entry.caption,
          durationSec: entry.durationSec,
        })
      } catch (e) {
        console.error('[AutonomousLife] log error:', e)
      }
    }
  }

  /** Build a summary of what happened while away */
  getReturnSummary(): string {
    if (this._log.length === 0) return ''

    const totalMin = Math.round(
      this._log.reduce((sum, e) => sum + e.durationSec, 0) / 60
    )

    const activities = this._log.map(e => e.caption)
    const rare = this._log.find(e => {
      const def = ACTIVITIES.find(a => a.state === e.activity)
      return def?.rare
    })

    let summary = `While you were away (~${totalMin}min), I `
    if (activities.length === 1) {
      summary += activities[0].toLowerCase()
    } else {
      summary += activities.slice(0, 3).map(a => a.toLowerCase()).join(', ')
      if (activities.length > 3) summary += '...'
    }

    if (rare) {
      summary += ' ✨'
    }

    return summary
  }

  stop() {
    clearTimeout(this._activityTimer)
    this._isAway = false
    this._currentActivity = null
  }
}
