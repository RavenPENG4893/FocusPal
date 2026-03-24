// Smart Reminder Engine
// Manages water, stretch, and eye rest timers with DND support

import { invoke } from '@tauri-apps/api/core'

export type ReminderType = 'water' | 'stretch' | 'eyes'
export type ReminderResponse = 'ok' | 'later' | 'skip'

export interface ReminderConfig {
  type: ReminderType
  intervalMs: number
  enabled: boolean
}

export interface ActiveReminder {
  type: ReminderType
  triggeredAt: number
}

const DEFAULT_INTERVALS: Record<ReminderType, number> = {
  water: 45 * 60 * 1000,   // 45 min
  stretch: 60 * 60 * 1000, // 60 min
  eyes: 30 * 60 * 1000,    // 30 min (20-20-20 rule)
}

const LATER_DELAY = 10 * 60 * 1000 // "Later" snoozes 10 minutes

export class ReminderEngine {
  private timers: Map<ReminderType, number> = new Map()
  private lastTriggered: Map<ReminderType, number> = new Map()
  private configs: Map<ReminderType, ReminderConfig> = new Map()
  private _dnd = false
  private _onReminder?: (type: ReminderType) => void

  constructor() {
    // Initialize default configs
    for (const type of ['water', 'stretch', 'eyes'] as ReminderType[]) {
      this.configs.set(type, {
        type,
        intervalMs: DEFAULT_INTERVALS[type],
        enabled: true,
      })
    }
  }

  onReminder(cb: (type: ReminderType) => void) {
    this._onReminder = cb
  }

  get dnd() { return this._dnd }

  setDND(enabled: boolean) {
    this._dnd = enabled
  }

  setEnabled(type: ReminderType, enabled: boolean) {
    const config = this.configs.get(type)
    if (config) {
      config.enabled = enabled
      if (!enabled) {
        this.clearTimer(type)
      } else {
        this.scheduleNext(type)
      }
    }
  }

  setInterval(type: ReminderType, ms: number) {
    const config = this.configs.get(type)
    if (config) {
      config.intervalMs = ms
      if (config.enabled) {
        this.scheduleNext(type)
      }
    }
  }

  getConfig(type: ReminderType): ReminderConfig | undefined {
    return this.configs.get(type)
  }

  /** Start all enabled reminder timers */
  start() {
    for (const [type, config] of this.configs) {
      if (config.enabled) {
        this.scheduleNext(type)
      }
    }
  }

  /** Stop all timers */
  stop() {
    for (const type of this.timers.keys()) {
      this.clearTimer(type)
    }
  }

  /** Handle user response to a reminder */
  async respond(type: ReminderType, response: ReminderResponse) {
    // Record to SQLite
    try {
      await invoke('insert_reminder_response', {
        reminderType: type,
        response,
      })
    } catch (e) {
      console.error('[Reminder] save error:', e)
    }

    if (response === 'later') {
      // Snooze: reschedule after shorter delay
      this.scheduleNext(type, LATER_DELAY)
    } else {
      // ok or skip: schedule next at normal interval
      this.scheduleNext(type)
    }
  }

  /** Load settings from SQLite config */
  async loadSettings() {
    for (const type of ['water', 'stretch', 'eyes'] as ReminderType[]) {
      try {
        const enabled = await invoke<string | null>('config_get', { key: `reminder_${type}_enabled` })
        if (enabled !== null) {
          this.setEnabled(type, enabled === 'true')
        }
        const interval = await invoke<string | null>('config_get', { key: `reminder_${type}_interval` })
        if (interval !== null) {
          const ms = parseInt(interval)
          if (!isNaN(ms) && ms >= 60000) {
            this.setInterval(type, ms)
          }
        }
      } catch {}
    }
  }

  /** Save a setting to SQLite */
  async saveSetting(key: string, value: string) {
    try {
      await invoke('config_set', { key, value })
    } catch {}
  }

  private scheduleNext(type: ReminderType, overrideMs?: number) {
    this.clearTimer(type)
    const config = this.configs.get(type)
    if (!config || !config.enabled) return

    const delay = overrideMs ?? config.intervalMs
    const timer = window.setTimeout(() => {
      if (!this._dnd && config.enabled) {
        this.lastTriggered.set(type, Date.now())
        this._onReminder?.(type)
      }
      // Re-schedule regardless (if DND was on, it'll fire after next interval)
      this.scheduleNext(type)
    }, delay)

    this.timers.set(type, timer)
  }

  private clearTimer(type: ReminderType) {
    const timer = this.timers.get(type)
    if (timer) {
      clearTimeout(timer)
      this.timers.delete(type)
    }
  }
}
