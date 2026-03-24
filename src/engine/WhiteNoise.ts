// White Noise / Ambient Sound Engine
// Uses Web Audio API to generate procedural ambient sounds
// No external audio files needed — all synthesized

export type SoundType = 'rain' | 'cafe' | 'forest' | 'ocean' | 'fireplace'

export interface SoundChannel {
  type: SoundType
  label: string
  icon: string
  volume: number   // 0-1
  active: boolean
}

const SOUND_DEFS: Record<SoundType, { label: string; icon: string }> = {
  rain:      { label: 'Rain',      icon: '🌧️' },
  cafe:      { label: 'Café',      icon: '☕' },
  forest:    { label: 'Forest',    icon: '🌲' },
  ocean:     { label: 'Ocean',     icon: '🌊' },
  fireplace: { label: 'Fireplace', icon: '🔥' },
}

interface ActiveSound {
  source: AudioBufferSourceNode | OscillatorNode
  gain: GainNode
  filter?: BiquadFilterNode
  lfo?: OscillatorNode
  lfoGain?: GainNode
  extraSources?: (AudioBufferSourceNode | OscillatorNode)[]
}

export class WhiteNoiseEngine {
  private ctx: AudioContext | null = null
  private masterGain: GainNode | null = null
  private activeSounds: Map<SoundType, ActiveSound> = new Map()
  private channels: Map<SoundType, SoundChannel> = new Map()
  private noiseBuffer: AudioBuffer | null = null

  constructor() {
    for (const [type, def] of Object.entries(SOUND_DEFS)) {
      this.channels.set(type as SoundType, {
        type: type as SoundType,
        label: def.label,
        icon: def.icon,
        volume: 0.5,
        active: false,
      })
    }
  }

  private ensureContext() {
    if (!this.ctx) {
      this.ctx = new AudioContext()
      this.masterGain = this.ctx.createGain()
      this.masterGain.gain.value = 0.6
      this.masterGain.connect(this.ctx.destination)
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume()
    }
    return this.ctx
  }

  private getNoiseBuffer(): AudioBuffer {
    if (this.noiseBuffer) return this.noiseBuffer
    const ctx = this.ensureContext()
    const sampleRate = ctx.sampleRate
    const length = sampleRate * 4 // 4 seconds of noise
    const buffer = ctx.createBuffer(1, length, sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1
    }
    this.noiseBuffer = buffer
    return buffer
  }

  getChannels(): SoundChannel[] {
    return Array.from(this.channels.values())
  }

  getChannel(type: SoundType): SoundChannel | undefined {
    return this.channels.get(type)
  }

  getActiveSoundTypes(): SoundType[] {
    return Array.from(this.channels.values())
      .filter(c => c.active)
      .map(c => c.type)
  }

  get masterVolume(): number {
    return this.masterGain?.gain.value ?? 0.6
  }

  set masterVolume(v: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, v))
    }
  }

  toggle(type: SoundType) {
    const ch = this.channels.get(type)
    if (!ch) return
    if (ch.active) {
      this.stopSound(type)
    } else {
      this.startSound(type)
    }
  }

  setVolume(type: SoundType, volume: number) {
    const ch = this.channels.get(type)
    if (!ch) return
    ch.volume = Math.max(0, Math.min(1, volume))
    const active = this.activeSounds.get(type)
    if (active) {
      active.gain.gain.setTargetAtTime(ch.volume, this.ctx!.currentTime, 0.1)
    }
  }

  startSound(type: SoundType) {
    const ch = this.channels.get(type)
    if (!ch || ch.active) return
    ch.active = true

    const ctx = this.ensureContext()

    switch (type) {
      case 'rain':      this.createRain(ctx, ch.volume); break
      case 'cafe':      this.createCafe(ctx, ch.volume); break
      case 'forest':    this.createForest(ctx, ch.volume); break
      case 'ocean':     this.createOcean(ctx, ch.volume); break
      case 'fireplace': this.createFireplace(ctx, ch.volume); break
    }
  }

  stopSound(type: SoundType) {
    const ch = this.channels.get(type)
    if (ch) ch.active = false

    const active = this.activeSounds.get(type)
    if (active) {
      // Fade out
      active.gain.gain.setTargetAtTime(0, this.ctx!.currentTime, 0.3)
      setTimeout(() => {
        try {
          active.source.stop()
          active.lfo?.stop()
          active.extraSources?.forEach(s => { try { s.stop() } catch {} })
        } catch {}
        active.source.disconnect()
        active.gain.disconnect()
        active.filter?.disconnect()
        active.lfo?.disconnect()
        active.lfoGain?.disconnect()
        active.extraSources?.forEach(s => s.disconnect())
      }, 500)
      this.activeSounds.delete(type)
    }
  }

  stopAll() {
    for (const type of Array.from(this.activeSounds.keys())) {
      this.stopSound(type)
    }
  }

  /** Rain: band-passed noise with slight modulation */
  private createRain(ctx: AudioContext, vol: number) {
    const source = ctx.createBufferSource()
    source.buffer = this.getNoiseBuffer()
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 2000
    filter.Q.value = 0.5

    // Subtle LFO for wind variation
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.15
    lfoGain.gain.value = 400
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    const gain = ctx.createGain()
    gain.gain.value = vol

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain!)
    source.start()

    this.activeSounds.set('rain', { source, gain, filter, lfo, lfoGain })
  }

  /** Café: brown noise (low-passed) with subtle warmth */
  private createCafe(ctx: AudioContext, vol: number) {
    const source = ctx.createBufferSource()
    source.buffer = this.getNoiseBuffer()
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 800
    filter.Q.value = 0.3

    const filter2 = ctx.createBiquadFilter()
    filter2.type = 'highpass'
    filter2.frequency.value = 100

    const gain = ctx.createGain()
    gain.gain.value = vol * 0.8

    source.connect(filter)
    filter.connect(filter2)
    filter2.connect(gain)
    gain.connect(this.masterGain!)
    source.start()

    this.activeSounds.set('cafe', { source, gain, filter })
  }

  /** Forest: high-passed noise for wind + gentle oscillation for birds */
  private createForest(ctx: AudioContext, vol: number) {
    const source = ctx.createBufferSource()
    source.buffer = this.getNoiseBuffer()
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 3000
    filter.Q.value = 1.2

    // Slow modulation for rustling
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.08
    lfoGain.gain.value = 1500
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    const gain = ctx.createGain()
    gain.gain.value = vol * 0.6

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain!)
    source.start()

    this.activeSounds.set('forest', { source, gain, filter, lfo, lfoGain })
  }

  /** Ocean: heavily low-passed noise with slow wave-like modulation */
  private createOcean(ctx: AudioContext, vol: number) {
    const source = ctx.createBufferSource()
    source.buffer = this.getNoiseBuffer()
    source.loop = true

    const filter = ctx.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = 500
    filter.Q.value = 0.8

    // Wave LFO: slow sweep
    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.06 // ~one wave every 16s
    lfoGain.gain.value = 300
    lfo.connect(lfoGain)
    lfoGain.connect(filter.frequency)
    lfo.start()

    // Volume LFO for wave crests
    const volLfo = ctx.createOscillator()
    const volLfoGain = ctx.createGain()
    volLfo.frequency.value = 0.08
    volLfoGain.gain.value = vol * 0.3
    volLfo.connect(volLfoGain)

    const gain = ctx.createGain()
    gain.gain.value = vol * 0.7
    volLfoGain.connect(gain.gain)

    source.connect(filter)
    filter.connect(gain)
    gain.connect(this.masterGain!)
    source.start()
    volLfo.start()

    this.activeSounds.set('ocean', { source, gain, filter, lfo: volLfo, lfoGain: volLfoGain })
  }

  /** Fireplace: brown noise with crackle-like high frequency bursts */
  private createFireplace(ctx: AudioContext, vol: number) {
    const source = ctx.createBufferSource()
    source.buffer = this.getNoiseBuffer()
    source.loop = true

    // Low rumble
    const lowFilter = ctx.createBiquadFilter()
    lowFilter.type = 'lowpass'
    lowFilter.frequency.value = 400

    // Crackle layer
    const crackleFilter = ctx.createBiquadFilter()
    crackleFilter.type = 'highpass'
    crackleFilter.frequency.value = 4000

    const lfo = ctx.createOscillator()
    const lfoGain = ctx.createGain()
    lfo.frequency.value = 0.3
    lfoGain.gain.value = 3000
    lfo.connect(lfoGain)
    lfoGain.connect(crackleFilter.frequency)
    lfo.start()

    const crackleGain = ctx.createGain()
    crackleGain.gain.value = vol * 0.15

    const baseGain = ctx.createGain()
    baseGain.gain.value = vol * 0.7

    const gain = ctx.createGain()
    gain.gain.value = 1

    source.connect(lowFilter)
    lowFilter.connect(baseGain)
    baseGain.connect(gain)

    // Second noise source for crackle
    const crackleSource = ctx.createBufferSource()
    crackleSource.buffer = this.getNoiseBuffer()
    crackleSource.loop = true
    crackleSource.connect(crackleFilter)
    crackleFilter.connect(crackleGain)
    crackleGain.connect(gain)
    crackleSource.start()

    gain.connect(this.masterGain!)
    source.start()

    this.activeSounds.set('fireplace', { source, gain, filter: lowFilter, lfo, lfoGain, extraSources: [crackleSource] })
  }

  destroy() {
    this.stopAll()
    if (this.ctx) {
      this.ctx.close()
      this.ctx = null
    }
  }
}
