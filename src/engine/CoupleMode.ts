// Couple Nurture Mode: partner pairing, shared XP, cheers, event sync
// Uses anonymous UUID auth, polls backend every 30s for partner events

import { invoke } from '@tauri-apps/api/core'

// ── Types ──

export interface CoupleStatus {
  coupled: boolean
  couple_id?: string
  partner_id?: string
  shared_xp?: number
}

export interface PartnerEvent {
  id: string
  event_type: string // focus_complete, level_up, cheer
  data: Record<string, unknown>
  from_user: string
  created_at: string
}

export type CoupleEventCallback = (events: PartnerEvent[]) => void

// ── Engine ──

export class CoupleEngine {
  private baseUrl = ''
  private userId = ''
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private onEventsCallback: CoupleEventCallback | null = null
  private _status: CoupleStatus = { coupled: false }

  get status(): CoupleStatus { return this._status }
  get myUserId(): string { return this.userId }

  async load() {
    // Load or generate anonymous UUID
    try {
      const saved = await invoke<string | null>('config_get', { key: 'couple_user_id' })
      if (saved) {
        this.userId = saved
      } else {
        this.userId = crypto.randomUUID()
        await invoke('config_set', { key: 'couple_user_id', value: this.userId })
      }
    } catch {
      this.userId = crypto.randomUUID()
    }

    // Load backend URL
    try {
      const url = await invoke<string | null>('config_get', { key: 'couple_backend_url' })
      if (url) this.baseUrl = url
    } catch {}

    // Load cached status
    if (this.baseUrl) {
      await this.refreshStatus()
    }
  }

  setBackendUrl(url: string) {
    this.baseUrl = url.replace(/\/+$/, '')
    invoke('config_set', { key: 'couple_backend_url', value: this.baseUrl }).catch(() => {})
  }

  onPartnerEvents(cb: CoupleEventCallback) {
    this.onEventsCallback = cb
  }

  // ── API calls ──

  private async api<T>(path: string, opts: RequestInit = {}): Promise<T> {
    if (!this.baseUrl) throw new Error('Backend URL not configured')
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...opts,
      headers: { 'Content-Type': 'application/json', ...opts.headers },
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body.detail || `HTTP ${res.status}`)
    }
    return res.json()
  }

  async createInvite(): Promise<{ code: string; expires_at: string }> {
    return this.api('/invite', {
      method: 'POST',
      body: JSON.stringify({ user_id: this.userId }),
    })
  }

  async joinCouple(inviteCode: string): Promise<{ couple_id: string; partner_id: string }> {
    const result = await this.api<{ couple_id: string; partner_id: string }>('/join', {
      method: 'POST',
      body: JSON.stringify({ user_id: this.userId, invite_code: inviteCode }),
    })
    await this.refreshStatus()
    this.startPolling()
    return result
  }

  async refreshStatus(): Promise<CoupleStatus> {
    try {
      this._status = await this.api<CoupleStatus>(`/status/${this.userId}`)
      if (this._status.coupled && !this.pollTimer) {
        this.startPolling()
      }
    } catch {
      this._status = { coupled: false }
    }
    return this._status
  }

  async sendFocusComplete(xp: number) {
    if (!this._status.coupled) return
    await this.api('/event', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        event_type: 'focus_complete',
        data: { xp },
      }),
    }).catch(() => {})
  }

  async sendLevelUp(level: number) {
    if (!this._status.coupled) return
    await this.api('/event', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        event_type: 'level_up',
        data: { level },
      }),
    }).catch(() => {})
  }

  async sendCheer(message: string) {
    if (!this._status.coupled) return
    return this.api('/cheer', {
      method: 'POST',
      body: JSON.stringify({
        user_id: this.userId,
        message: message.slice(0, 50),
      }),
    })
  }

  async unlink() {
    if (!this._status.coupled) return
    await this.api('/unlink', {
      method: 'POST',
      body: JSON.stringify({ user_id: this.userId }),
    })
    this._status = { coupled: false }
    this.stopPolling()
  }

  // ── Polling ──

  private startPolling() {
    if (this.pollTimer) return
    this.pollTimer = setInterval(() => this.pollEvents(), 30_000)
    // Also poll immediately
    this.pollEvents()
  }

  stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }

  private async pollEvents() {
    if (!this._status.coupled || !this.baseUrl) return
    try {
      const result = await this.api<{ events: PartnerEvent[] }>(`/events/${this.userId}`)
      if (result.events.length > 0 && this.onEventsCallback) {
        this.onEventsCallback(result.events)
      }
      // Also refresh shared XP
      await this.refreshStatus()
    } catch {}
  }

  get isConfigured(): boolean {
    return !!this.baseUrl
  }
}
