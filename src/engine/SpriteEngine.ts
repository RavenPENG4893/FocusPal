// Sprite Engine: drives the animation loop and renders to canvas
// Coordinates AnimationStateMachine + PixelArtGenerator

import { AnimationStateMachine } from './AnimationStateMachine'
import { generateFrame, renderPixelGrid } from './PixelArtGenerator'
import type { AnimationState } from './AnimationStateMachine'

export class SpriteEngine {
  private ctx: CanvasRenderingContext2D
  private stateMachine: AnimationStateMachine
  private rafId: number = 0
  private scale: number
  private running: boolean = false

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

  start() {
    if (this.running) return
    this.running = true
    let logOnce = true
    const loop = (now: number) => {
      if (!this.running) return
      this.stateMachine.update(now)
      const grid = generateFrame(this.stateMachine.state, this.stateMachine.frame)
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
