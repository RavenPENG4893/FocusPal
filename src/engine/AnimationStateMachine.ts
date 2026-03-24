// Animation State Machine for FocusPal companion character
// Manages animation states with frame timing, transitions, and gradual chains

export type AnimationState =
  | 'idle'
  | 'working'
  | 'resting'
  | 'happy'
  | 'sleepy'
  | 'chatting'
  | 'stressed'
  | 'caring'
  | 'curious'    // transition state: idle → curious → sleepy
  | 'wakeup'     // transition state: sleepy → wakeup → idle
  | 'hatching'   // first launch: egg → crack → emerge
  | 'sweating'   // high CPU: sweating with exertion
  | 'overloaded' // CPU overload: pushing millstone
  | 'cleaning'   // memory cleanup: broom sweep animation
  | 'sipping'    // mem 60-75%: sip coffee
  | 'crumpling'  // mem 75-90%: write + crumple paper
  | 'rummaging'  // mem 90%+: searching through mess
  | 'lowbattery' // low battery: drowsy, yawning
  | 'charging'   // plugged in: static shock → comfy
  | 'unplugged'  // unplugged: startled → shrug → accept
  | 'fullbattery' // 100% charged: celebration dance
  | 'drinking'    // reminder: drinking water
  | 'stretching'  // reminder: stand & stretch
  | 'eyerest'     // reminder: eye rest (20-20-20)
  // Autonomous life activities
  | 'reading'     // away: reading a book
  | 'tidying'     // away: tidying desk
  | 'daydreaming' // away: staring into space
  | 'napping'     // away: taking a nap
  | 'slacking'    // away: browsing phone (摸鱼)
  | 'gaming'      // away: gaming with headphones
  | 'dancing'     // rare: spontaneous dance
  | 'doodling'    // rare: drawing/doodling

export interface StateConfig {
  frames: number
  frameInterval: number // ms per frame
  loop: boolean
  nextState?: AnimationState // auto-transition after non-looping animation ends
}

export const STATE_CONFIGS: Record<AnimationState, StateConfig> = {
  idle:     { frames: 4, frameInterval: 300, loop: true },
  working:  { frames: 4, frameInterval: 150, loop: true },
  resting:  { frames: 6, frameInterval: 200, loop: false, nextState: 'idle' },
  happy:    { frames: 6, frameInterval: 200, loop: false, nextState: 'idle' },
  sleepy:   { frames: 4, frameInterval: 500, loop: true },
  chatting: { frames: 4, frameInterval: 200, loop: true },
  stressed: { frames: 4, frameInterval: 200, loop: false, nextState: 'idle' },
  caring:   { frames: 4, frameInterval: 300, loop: true },
  curious:  { frames: 4, frameInterval: 400, loop: false, nextState: 'sleepy' },
  wakeup:   { frames: 6, frameInterval: 150, loop: false, nextState: 'idle' },
  hatching:   { frames: 12, frameInterval: 400, loop: false, nextState: 'happy' },
  sweating:   { frames: 4, frameInterval: 250, loop: true },
  overloaded: { frames: 4, frameInterval: 300, loop: true },
  cleaning:   { frames: 6, frameInterval: 200, loop: false, nextState: 'happy' },
  sipping:    { frames: 8, frameInterval: 400, loop: false, nextState: 'idle' },
  crumpling:  { frames: 8, frameInterval: 350, loop: false, nextState: 'idle' },
  rummaging:  { frames: 8, frameInterval: 320, loop: false, nextState: 'idle' },
  lowbattery:  { frames: 4, frameInterval: 500, loop: true },
  charging:    { frames: 6, frameInterval: 220, loop: false, nextState: 'idle' },
  unplugged:   { frames: 6, frameInterval: 220, loop: false, nextState: 'idle' },
  fullbattery: { frames: 8, frameInterval: 180, loop: false, nextState: 'happy' },
  drinking:    { frames: 8, frameInterval: 350, loop: false, nextState: 'idle' },
  stretching:  { frames: 8, frameInterval: 400, loop: false, nextState: 'idle' },
  eyerest:     { frames: 6, frameInterval: 500, loop: false, nextState: 'idle' },
  // Autonomous life
  reading:     { frames: 4, frameInterval: 600, loop: true },
  tidying:     { frames: 6, frameInterval: 300, loop: false, nextState: 'idle' },
  daydreaming: { frames: 4, frameInterval: 800, loop: true },
  napping:     { frames: 4, frameInterval: 700, loop: true },
  slacking:    { frames: 4, frameInterval: 400, loop: true },
  gaming:      { frames: 4, frameInterval: 250, loop: true },
  dancing:     { frames: 8, frameInterval: 200, loop: false, nextState: 'happy' },
  doodling:    { frames: 6, frameInterval: 450, loop: true },
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
          this._frame = config.frames - 1
          if (config.nextState) {
            this.setState(config.nextState)
          }
        }
      }
    }
  }
}
