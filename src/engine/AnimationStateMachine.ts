// Animation State Machine for FocusPal companion character
// Manages 8 core animation states with frame timing and transitions

export type AnimationState =
  | 'idle'
  | 'working'
  | 'resting'
  | 'happy'
  | 'sleepy'
  | 'chatting'
  | 'stressed'
  | 'caring'

export interface StateConfig {
  frames: number
  frameInterval: number // ms per frame
  loop: boolean
  nextState?: AnimationState // state to transition to after non-looping animation
}

export const STATE_CONFIGS: Record<AnimationState, StateConfig> = {
  idle:     { frames: 4, frameInterval: 300, loop: true },
  working:  { frames: 4, frameInterval: 150, loop: true },
  resting:  { frames: 6, frameInterval: 200, loop: false, nextState: 'idle' },
  happy:    { frames: 6, frameInterval: 200, loop: false, nextState: 'idle' },
  sleepy:   { frames: 4, frameInterval: 500, loop: true },
  chatting: { frames: 4, frameInterval: 200, loop: true },
  stressed: { frames: 4, frameInterval: 200, loop: false, nextState: 'working' },
  caring:   { frames: 4, frameInterval: 300, loop: true },
}

export class AnimationStateMachine {
  private _state: AnimationState = 'idle'
  private _frame: number = 0
  private _lastFrameTime: number = 0
  private _onStateChange?: (state: AnimationState) => void

  get state(): AnimationState {
    return this._state
  }

  get frame(): number {
    return this._frame
  }

  get config(): StateConfig {
    return STATE_CONFIGS[this._state]
  }

  onStateChange(cb: (state: AnimationState) => void) {
    this._onStateChange = cb
  }

  setState(newState: AnimationState) {
    if (newState === this._state) return
    this._state = newState
    this._frame = 0
    this._lastFrameTime = performance.now()
    this._onStateChange?.(newState)
  }

  update(now: number) {
    if (this._lastFrameTime === 0) {
      this._lastFrameTime = now
    }

    const elapsed = now - this._lastFrameTime
    const config = this.config

    if (elapsed >= config.frameInterval) {
      this._lastFrameTime = now
      this._frame++

      if (this._frame >= config.frames) {
        if (config.loop) {
          this._frame = 0
        } else {
          // Non-looping: transition to next state
          this._frame = config.frames - 1
          if (config.nextState) {
            this.setState(config.nextState)
          }
        }
      }
    }
  }
}
