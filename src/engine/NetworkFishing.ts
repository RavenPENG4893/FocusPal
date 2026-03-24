// Network Fishing Visualization Engine
// Maps network throughput to fishing rod animation

import { invoke } from '@tauri-apps/api/core'
import type { AnimationState } from './AnimationStateMachine'

export interface NetworkStats {
  download_bytes_sec: number
  upload_bytes_sec: number
  is_connected: boolean
}

export type FishingState =
  | 'idle'        // 0 bytes/s - dozing off
  | 'light'       // 1-100 KB/s - gentle bobbing
  | 'moderate'    // 100KB-1MB/s - alert
  | 'active'      // 1-10 MB/s - excited pulling
  | 'heavy'       // 10-50 MB/s - frantic reeling
  | 'trophy'      // >50 MB/s sustained - big catch!
  | 'disconnect'  // no connection
  | 'upload'      // upload > download*2 - sending package

export interface FishingInfo {
  state: FishingState
  downloadSpeed: number
  uploadSpeed: number
  speedLabel: string  // human-readable
  isConnected: boolean
}

const KB = 1024
const MB = 1024 * 1024

function formatSpeed(bytes: number): string {
  if (bytes < KB) return `${bytes} B/s`
  if (bytes < MB) return `${(bytes / KB).toFixed(1)} KB/s`
  return `${(bytes / MB).toFixed(1)} MB/s`
}

function classifySpeed(dl: number, ul: number, connected: boolean): FishingState {
  if (!connected) return 'disconnect'
  // Upload dominant (upload > download * 2 for meaningful traffic)
  if (ul > dl * 2 && ul > 10 * KB) return 'upload'
  const speed = Math.max(dl, ul)
  if (speed > 50 * MB) return 'trophy'
  if (speed > 10 * MB) return 'heavy'
  if (speed > MB) return 'active'
  if (speed > 100 * KB) return 'moderate'
  if (speed > KB) return 'light'
  return 'idle'
}

// Map fishing state to animation state
export const FISHING_ANIM_MAP: Record<FishingState, AnimationState> = {
  idle: 'fishing_idle',
  light: 'fishing_light',
  moderate: 'fishing_moderate',
  active: 'fishing_active',
  heavy: 'fishing_heavy',
  trophy: 'fishing_trophy',
  disconnect: 'fishing_disconnect',
  upload: 'fishing_upload',
}

export class NetworkFishingEngine {
  private _info: FishingInfo = {
    state: 'idle',
    downloadSpeed: 0,
    uploadSpeed: 0,
    speedLabel: '0 B/s',
    isConnected: true,
  }
  private _enabled: boolean = false  // disabled by default, user activates via radial menu
  private _trophyTimer: number = 0   // sustained high speed counter
  private _prevConnected: boolean = true
  private _onStateChange?: (info: FishingInfo) => void
  private _onTrophy?: () => void
  private _onDisconnect?: (disconnected: boolean) => void

  get info(): FishingInfo { return this._info }
  get enabled(): boolean { return this._enabled }
  set enabled(v: boolean) { this._enabled = v }

  onStateChange(cb: (info: FishingInfo) => void) { this._onStateChange = cb }
  onTrophy(cb: () => void) { this._onTrophy = cb }
  onDisconnect(cb: (disconnected: boolean) => void) { this._onDisconnect = cb }

  /** Poll network stats. Call every 2 seconds. */
  async poll() {
    if (!this._enabled) return

    try {
      const stats = await invoke<NetworkStats>('get_network_stats')
      const state = classifySpeed(stats.download_bytes_sec, stats.upload_bytes_sec, stats.is_connected)

      // Trophy detection: >50MB/s sustained for 5 seconds (≈3 polls)
      if (state === 'trophy' || (state === 'heavy' && Math.max(stats.download_bytes_sec, stats.upload_bytes_sec) > 50 * MB)) {
        this._trophyTimer++
        if (this._trophyTimer >= 3) {
          this._onTrophy?.()
          this._trophyTimer = 0
        }
      } else {
        this._trophyTimer = 0
      }

      // Disconnect/reconnect detection
      if (stats.is_connected !== this._prevConnected) {
        this._onDisconnect?.(!stats.is_connected)
        this._prevConnected = stats.is_connected
      }

      const prevState = this._info.state
      this._info = {
        state,
        downloadSpeed: stats.download_bytes_sec,
        uploadSpeed: stats.upload_bytes_sec,
        speedLabel: `↓${formatSpeed(stats.download_bytes_sec)} ↑${formatSpeed(stats.upload_bytes_sec)}`,
        isConnected: stats.is_connected,
      }

      if (state !== prevState) {
        this._onStateChange?.(this._info)
      }
    } catch (e) {
      console.warn('[NetworkFishing] poll error:', e)
    }
  }
}
