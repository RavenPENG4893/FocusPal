// Sprite Engine: drives the animation loop and renders to canvas
// Coordinates AnimationStateMachine + PixelArtGenerator

import { AnimationStateMachine } from './AnimationStateMachine'
import { generateFrame, renderPixelGrid, drawDeskClutter, drawLightOverlay } from './PixelArtGenerator'
import { drawSkinDeskItems } from './SkinSystem'
import type { AnimationState } from './AnimationStateMachine'

export class SpriteEngine {
  private ctx: CanvasRenderingContext2D
  private stateMachine: AnimationStateMachine
  private rafId: number = 0
  private scale: number
  private running: boolean = false
  private _clutterLevel: number = 0
  private _isDarkMode: boolean = false
  private _timePeriod: string = 'morning'

  constructor(canvas: HTMLCanvasElement, scale: number = 3) {
    this.scale = scale
    canvas.width = 32 * scale
    canvas.height = 32 * scale
    // Disable image smoothing for crisp pixel art
    const ctx = canvas.getContext('2d')!
    ctx.imageSmoothingEnabled = false
    this.ctx = ctx
    this.stateMachine = new AnimationStateMachine()
  }

  get state(): AnimationState {
    return this.stateMachine.state
  }

  get animationStateMachine(): AnimationStateMachine {
    return this.stateMachine
  }

  setState(state: AnimationState) {
    this.stateMachine.setState(state)
  }

  onStateChange(cb: (state: AnimationState) => void) {
    this.stateMachine.onStateChange(cb)
  }

  setClutterLevel(level: number) {
    this._clutterLevel = level
  }

  setDarkMode(v: boolean) {
    this._isDarkMode = v
  }

  setTimePeriod(v: string) {
    this._timePeriod = v
  }

  start() {
    if (this.running) return
    this.running = true
    let logOnce = true
    const loop = (now: number) => {
      if (!this.running) return
      this.stateMachine.update(now)
      const state = this.stateMachine.state
      const grid = generateFrame(state, this.stateMachine.frame)
      // Skip clutter overlay during interactive memory states (they draw their own props)
      const memAnimStates = ['sipping', 'crumpling', 'rummaging', 'drinking', 'stretching', 'eyerest',
        'reading', 'tidying', 'napping', 'slacking', 'gaming', 'dancing', 'doodling',
        'scene_coding', 'scene_writing', 'scene_design', 'scene_meeting',
        'scene_fidget', 'scene_giveup', 'celebrate', 'comforting', 'catch_orb',
        'fishing_idle', 'fishing_light', 'fishing_moderate', 'fishing_active',
        'fishing_heavy', 'fishing_trophy', 'fishing_disconnect', 'fishing_upload',
        'dodge', 'peek', 'squeeze']
      if (!memAnimStates.includes(state)) {
        // Draw skin-specific desk decorations
        drawSkinDeskItems(grid, this.stateMachine.frame)
        // Draw memory-based clutter on top
        if (this._clutterLevel > 0) {
          drawDeskClutter(grid, this._clutterLevel)
        }
        // Screen light adaptation overlay (lamp, glasses)
        drawLightOverlay(grid, this._isDarkMode, this._timePeriod, this.stateMachine.frame)
      }
      if (logOnce) {
        // Count non-null pixels to verify sprite data
        let pixelCount = 0
        for (const row of grid) {
          for (const px of row) {
            if (px) pixelCount++
          }
        }
        console.log('[SpriteEngine] first frame:', this.stateMachine.state, 'frame:', this.stateMachine.frame, 'pixels:', pixelCount, 'canvas:', this.ctx.canvas.width, 'x', this.ctx.canvas.height)
        logOnce = false
      }
      renderPixelGrid(this.ctx, grid, this.scale)
      this.rafId = requestAnimationFrame(loop)
    }
    this.rafId = requestAnimationFrame(loop)
  }

  stop() {
    this.running = false
    cancelAnimationFrame(this.rafId)
  }

  destroy() {
    this.stop()
  }
}
