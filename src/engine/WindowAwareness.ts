// Window Hide-and-Seek Engine
// Detects nearby/overlapping windows and triggers dodge/peek/squeeze animations
// Moves the Tauri window to avoid overlap

import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow, type Window as TauriWindow } from '@tauri-apps/api/window'

export interface WindowRect {
  title: string
  x: number
  y: number
  width: number
  height: number
}

export type DodgeState =
  | 'none'        // no nearby windows
  | 'dodge'       // scooting away from approaching window
  | 'peek'        // peeking from behind a covering window
  | 'squeeze'     // squished between two windows
  | 'recover'     // returning to preferred position

export interface WindowAwarenessState {
  dodgeState: DodgeState
  nearestWindow: string | null
  overlapPercent: number
}

interface AABB {
  x: number; y: number; w: number; h: number
}

function aabbOverlap(a: AABB, b: AABB): number {
  const overlapX = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  const overlapY = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y))
  return overlapX * overlapY
}

function aabbDistance(a: AABB, b: AABB): number {
  const cx1 = a.x + a.w / 2, cy1 = a.y + a.h / 2
  const cx2 = b.x + b.w / 2, cy2 = b.y + b.h / 2
  return Math.sqrt((cx1 - cx2) ** 2 + (cy1 - cy2) ** 2)
}

const PROXIMITY_PX = 120    // start dodging at this distance
const SQUEEZE_GAP = 60      // squeezed if gap < this between two windows

export class WindowAwarenessEngine {
  private _state: WindowAwarenessState = {
    dodgeState: 'none', nearestWindow: null, overlapPercent: 0,
  }
  private _enabled: boolean = true
  private _tauriWindow: TauriWindow | null = null
  private _preferredPos: { x: number; y: number } | null = null
  private _myRect: AABB = { x: 0, y: 0, w: 200, h: 350 }
  private _recovering: boolean = false
  private _onDodgeChange?: (state: DodgeState) => void

  get state(): WindowAwarenessState { return this._state }
  get enabled(): boolean { return this._enabled }
  set enabled(v: boolean) { this._enabled = v }

  onDodgeChange(cb: (state: DodgeState) => void) { this._onDodgeChange = cb }

  /** Initialize: get Tauri window reference and preferred position */
  async init() {
    this._tauriWindow = getCurrentWindow()
    try {
      const pos = await this._tauriWindow.outerPosition()
      const size = await this._tauriWindow.outerSize()
      this._preferredPos = { x: pos.x, y: pos.y }
      this._myRect = { x: pos.x, y: pos.y, w: size.width, h: size.height }
    } catch {}
  }

  /** Poll window positions and check collisions. Call every 500ms. */
  async poll() {
    if (!this._enabled || !this._tauriWindow) return

    try {
      // Refresh our own position
      const pos = await this._tauriWindow.outerPosition()
      const size = await this._tauriWindow.outerSize()
      this._myRect = { x: pos.x, y: pos.y, w: size.width, h: size.height }

      // If we haven't set preferred yet, or user dragged manually
      if (!this._preferredPos || !this._recovering) {
        this._preferredPos = { x: pos.x, y: pos.y }
      }

      const windows = await invoke<WindowRect[]>('get_visible_windows')

      // Filter out our own window (by matching position closely)
      const others = windows.filter(w => {
        const dx = Math.abs(w.x - this._myRect.x)
        const dy = Math.abs(w.y - this._myRect.y)
        const dw = Math.abs(w.width - this._myRect.w)
        const dh = Math.abs(w.height - this._myRect.h)
        return !(dx < 5 && dy < 5 && dw < 5 && dh < 5)
      })

      if (others.length === 0) {
        this._setDodge('none')
        return
      }

      // Check for overlap / proximity
      let maxOverlap = 0
      let closestDist = Infinity
      let closestTitle = ''
      let overlapCount = 0

      for (const w of others) {
        const wBox: AABB = { x: w.x, y: w.y, w: w.width, h: w.height }
        const overlap = aabbOverlap(this._myRect, wBox)
        const dist = aabbDistance(this._myRect, wBox)

        if (overlap > 0) {
          overlapCount++
          if (overlap > maxOverlap) {
            maxOverlap = overlap
            closestTitle = w.title
          }
        }

        if (dist < closestDist) {
          closestDist = dist
          if (!closestTitle) closestTitle = w.title
        }
      }

      const myArea = this._myRect.w * this._myRect.h
      const overlapPercent = myArea > 0 ? (maxOverlap / myArea) * 100 : 0
      this._state.overlapPercent = overlapPercent
      this._state.nearestWindow = closestTitle.slice(0, 30)

      // Squeeze detection: two windows on opposite sides with small gap
      if (overlapCount >= 2) {
        this._setDodge('squeeze')
        return
      }

      // Full overlap → peek
      if (overlapPercent > 60) {
        this._setDodge('peek')
        await this._dodgeToNearestEdge(others)
        return
      }

      // Partial overlap or very close → dodge
      if (overlapPercent > 5 || closestDist < PROXIMITY_PX) {
        this._setDodge('dodge')
        await this._nudgeAway(others)
        return
      }

      // No threat → recover to preferred position
      if (this._state.dodgeState !== 'none') {
        this._setDodge('recover')
        await this._returnToPreferred()
      } else {
        this._setDodge('none')
      }
    } catch (e) {
      console.warn('[WindowAwareness] poll error:', e)
    }
  }

  private _setDodge(state: DodgeState) {
    if (state !== this._state.dodgeState) {
      this._state.dodgeState = state
      this._recovering = state === 'recover'
      this._onDodgeChange?.(state)
    }
  }

  /** Nudge the window slightly away from the closest overlapping window */
  private async _nudgeAway(windows: WindowRect[]) {
    if (!this._tauriWindow) return

    // Find the closest window
    let bestDx = 0, bestDy = 0
    let minDist = Infinity

    for (const w of windows) {
      const wBox: AABB = { x: w.x, y: w.y, w: w.width, h: w.height }
      const dist = aabbDistance(this._myRect, wBox)
      if (dist < minDist) {
        minDist = dist
        // Move away from this window
        const myCx = this._myRect.x + this._myRect.w / 2
        const myCy = this._myRect.y + this._myRect.h / 2
        const wCx = w.x + w.width / 2
        const wCy = w.y + w.height / 2
        const dx = myCx - wCx
        const dy = myCy - wCy
        const len = Math.sqrt(dx * dx + dy * dy) || 1
        bestDx = (dx / len) * 30 // nudge 30px
        bestDy = (dy / len) * 30
      }
    }

    const newX = Math.round(this._myRect.x + bestDx)
    const newY = Math.round(this._myRect.y + bestDy)
    try {
      const { LogicalPosition } = await import('@tauri-apps/api/dpi')
      await this._tauriWindow.setPosition(new LogicalPosition(newX, newY))
    } catch {}
  }

  /** Move to the nearest screen edge when fully covered */
  private async _dodgeToNearestEdge(windows: WindowRect[]) {
    if (!this._tauriWindow) return
    // Simple: move to right edge of screen
    try {
      const { LogicalPosition } = await import('@tauri-apps/api/dpi')
      // Get screen dimensions (approximate)
      const screenW = window.screen.availWidth
      const screenH = window.screen.availHeight
      const newX = screenW - this._myRect.w - 10
      const newY = Math.min(this._myRect.y, screenH - this._myRect.h - 10)
      await this._tauriWindow.setPosition(new LogicalPosition(newX, newY))
    } catch {}
  }

  /** Smoothly return to preferred position */
  private async _returnToPreferred() {
    if (!this._tauriWindow || !this._preferredPos) return
    try {
      const { LogicalPosition } = await import('@tauri-apps/api/dpi')
      // Ease back (move 50% of remaining distance per poll)
      const dx = this._preferredPos.x - this._myRect.x
      const dy = this._preferredPos.y - this._myRect.y
      if (Math.abs(dx) < 5 && Math.abs(dy) < 5) {
        this._setDodge('none')
        this._recovering = false
        return
      }
      const newX = Math.round(this._myRect.x + dx * 0.5)
      const newY = Math.round(this._myRect.y + dy * 0.5)
      await this._tauriWindow.setPosition(new LogicalPosition(newX, newY))
    } catch {}
  }

  /** Update preferred position (e.g., after user drag) */
  setPreferredPosition(x: number, y: number) {
    this._preferredPos = { x, y }
  }
}
