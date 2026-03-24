// OC Character Creator: modular pixel art customization
// Hair(6) x Eyes(4) x Mouth(4) x Outfit(6) x Accessory(4) = 2304 combos
// HSL palette swap, 5 presets, JSON import/export

import { invoke } from '@tauri-apps/api/core'

// ── Part Definitions ──

export interface OCPart {
  id: string
  name: string
  // Draw function: receives grid, palette, frame, bodyOffsetY
  draw: (grid: (string | null)[][], colors: OCColors, frame: number, oy: number) => void
}

export interface OCColors {
  skin: string
  skinShadow: string
  hair: string
  hairHighlight: string
  eyes: string
  eyeWhite: string
  mouth: string
  body: string
  bodyShadow: string
  accessory: string
}

export interface OCConfig {
  hairId: string
  eyesId: string
  mouthId: string
  outfitId: string
  accessoryId: string
  colors: OCColors
}

// ── Drawing helpers ──

function px(grid: (string | null)[][], x: number, y: number, c: string) {
  if (x >= 0 && x < 32 && y >= 0 && y < 32) grid[y][x] = c
}
function rect(grid: (string | null)[][], x: number, y: number, w: number, h: number, c: string) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      px(grid, x + dx, y + dy, c)
}

// ── Hair styles ──

export const HAIRS: OCPart[] = [
  {
    id: 'short',
    name: 'Short',
    draw: (g, c, _f, oy) => {
      rect(g, 10, 5 + oy, 12, 3, c.hair)
      rect(g, 9, 6 + oy, 2, 4, c.hair)
      rect(g, 21, 6 + oy, 2, 4, c.hair)
    },
  },
  {
    id: 'spiky',
    name: 'Spiky',
    draw: (g, c, _f, oy) => {
      rect(g, 10, 5 + oy, 12, 3, c.hair)
      rect(g, 9, 6 + oy, 2, 3, c.hair)
      rect(g, 21, 6 + oy, 2, 3, c.hair)
      // Spikes
      px(g, 11, 4 + oy, c.hair)
      px(g, 14, 3 + oy, c.hair)
      px(g, 14, 4 + oy, c.hair)
      px(g, 17, 3 + oy, c.hair)
      px(g, 17, 4 + oy, c.hair)
      px(g, 20, 4 + oy, c.hair)
    },
  },
  {
    id: 'long',
    name: 'Long',
    draw: (g, c, _f, oy) => {
      rect(g, 10, 5 + oy, 12, 3, c.hair)
      rect(g, 9, 6 + oy, 2, 10, c.hair) // long left
      rect(g, 21, 6 + oy, 2, 10, c.hair) // long right
      px(g, 8, 10 + oy, c.hair)
      px(g, 23, 10 + oy, c.hair)
    },
  },
  {
    id: 'curly',
    name: 'Curly',
    draw: (g, c, _f, oy) => {
      rect(g, 10, 5 + oy, 12, 3, c.hair)
      rect(g, 9, 6 + oy, 2, 5, c.hair)
      rect(g, 21, 6 + oy, 2, 5, c.hair)
      // Curly bits
      px(g, 8, 7 + oy, c.hairHighlight)
      px(g, 8, 9 + oy, c.hairHighlight)
      px(g, 23, 7 + oy, c.hairHighlight)
      px(g, 23, 9 + oy, c.hairHighlight)
      px(g, 11, 4 + oy, c.hairHighlight)
      px(g, 15, 4 + oy, c.hairHighlight)
      px(g, 19, 4 + oy, c.hairHighlight)
    },
  },
  {
    id: 'ponytail',
    name: 'Ponytail',
    draw: (g, c, _f, oy) => {
      rect(g, 10, 5 + oy, 12, 3, c.hair)
      rect(g, 9, 6 + oy, 2, 4, c.hair)
      rect(g, 21, 6 + oy, 2, 4, c.hair)
      // Ponytail hanging right
      rect(g, 22, 8 + oy, 2, 8, c.hair)
      px(g, 23, 16 + oy, c.hairHighlight)
      px(g, 22, 7 + oy, c.hairHighlight) // tie
    },
  },
  {
    id: 'bald',
    name: 'Bald',
    draw: (g, c, _f, oy) => {
      // Just a slight shine on head
      px(g, 13, 6 + oy, c.hairHighlight)
      px(g, 14, 5 + oy, c.hairHighlight)
    },
  },
]

// ── Eye styles ──

export const EYES: OCPart[] = [
  {
    id: 'round',
    name: 'Round',
    draw: (g, c, _f, oy) => {
      rect(g, 13, 11 + oy, 2, 2, c.eyeWhite)
      rect(g, 18, 11 + oy, 2, 2, c.eyeWhite)
      px(g, 14, 12 + oy, c.eyes)
      px(g, 19, 12 + oy, c.eyes)
    },
  },
  {
    id: 'narrow',
    name: 'Narrow',
    draw: (g, c, _f, oy) => {
      rect(g, 13, 11 + oy, 3, 1, c.eyeWhite)
      rect(g, 18, 11 + oy, 3, 1, c.eyeWhite)
      px(g, 14, 11 + oy, c.eyes)
      px(g, 19, 11 + oy, c.eyes)
    },
  },
  {
    id: 'big',
    name: 'Big',
    draw: (g, c, _f, oy) => {
      rect(g, 12, 10 + oy, 3, 3, c.eyeWhite)
      rect(g, 18, 10 + oy, 3, 3, c.eyeWhite)
      px(g, 13, 11 + oy, c.eyes)
      px(g, 14, 11 + oy, c.eyes)
      px(g, 19, 11 + oy, c.eyes)
      px(g, 20, 11 + oy, c.eyes)
      // Highlight
      px(g, 12, 10 + oy, '#FFFFFF')
      px(g, 18, 10 + oy, '#FFFFFF')
    },
  },
  {
    id: 'dot',
    name: 'Dot',
    draw: (g, c, _f, oy) => {
      px(g, 14, 11 + oy, c.eyes)
      px(g, 19, 11 + oy, c.eyes)
    },
  },
]

// ── Mouth styles ──

export const MOUTHS: OCPart[] = [
  {
    id: 'smile',
    name: 'Smile',
    draw: (g, c, _f, oy) => {
      rect(g, 15, 15 + oy, 2, 1, c.mouth)
    },
  },
  {
    id: 'grin',
    name: 'Grin',
    draw: (g, c, _f, oy) => {
      rect(g, 14, 15 + oy, 4, 1, c.mouth)
      px(g, 14, 14 + oy, c.mouth)
      px(g, 17, 14 + oy, c.mouth)
    },
  },
  {
    id: 'cat',
    name: 'Cat',
    draw: (g, c, _f, oy) => {
      px(g, 15, 15 + oy, c.mouth)
      px(g, 16, 15 + oy, c.mouth)
      px(g, 14, 14 + oy, c.mouth)
      px(g, 17, 14 + oy, c.mouth)
    },
  },
  {
    id: 'neutral',
    name: 'Neutral',
    draw: (g, c, _f, oy) => {
      rect(g, 15, 15 + oy, 3, 1, c.skin) // no mouth visible
      px(g, 15, 15 + oy, c.mouth)
    },
  },
]

// ── Outfit styles ──

export const OUTFITS: OCPart[] = [
  {
    id: 'hoodie',
    name: 'Hoodie',
    draw: (g, c, _f, oy) => {
      rect(g, 11, 18 + oy, 10, 8, c.body)
      rect(g, 12, 19 + oy, 8, 6, c.bodyShadow)
    },
  },
  {
    id: 'tshirt',
    name: 'T-Shirt',
    draw: (g, c, _f, oy) => {
      rect(g, 11, 18 + oy, 10, 8, c.body)
      rect(g, 12, 19 + oy, 8, 6, c.bodyShadow)
      // Collar
      rect(g, 14, 18 + oy, 4, 1, c.skin)
    },
  },
  {
    id: 'suit',
    name: 'Suit',
    draw: (g, c, _f, oy) => {
      rect(g, 11, 18 + oy, 10, 8, c.body)
      rect(g, 12, 19 + oy, 8, 6, c.bodyShadow)
      // Lapels
      px(g, 13, 18 + oy, c.bodyShadow)
      px(g, 18, 18 + oy, c.bodyShadow)
      // Tie
      px(g, 16, 19 + oy, '#CC3333')
      px(g, 16, 20 + oy, '#CC3333')
      px(g, 16, 21 + oy, '#AA2222')
    },
  },
  {
    id: 'sweater',
    name: 'Sweater',
    draw: (g, c, _f, oy) => {
      rect(g, 11, 18 + oy, 10, 8, c.body)
      rect(g, 12, 19 + oy, 8, 6, c.bodyShadow)
      // Stripe pattern
      rect(g, 11, 21 + oy, 10, 1, c.bodyShadow)
      rect(g, 11, 23 + oy, 10, 1, c.bodyShadow)
    },
  },
  {
    id: 'overalls',
    name: 'Overalls',
    draw: (g, c, _f, oy) => {
      rect(g, 11, 18 + oy, 10, 8, c.body)
      rect(g, 12, 19 + oy, 8, 6, c.bodyShadow)
      // Strap lines
      px(g, 13, 18 + oy, c.bodyShadow)
      px(g, 13, 19 + oy, c.bodyShadow)
      px(g, 18, 18 + oy, c.bodyShadow)
      px(g, 18, 19 + oy, c.bodyShadow)
      // Pocket
      rect(g, 14, 22 + oy, 4, 2, c.bodyShadow)
    },
  },
  {
    id: 'tank',
    name: 'Tank Top',
    draw: (g, c, _f, oy) => {
      rect(g, 12, 18 + oy, 8, 8, c.body)
      rect(g, 13, 19 + oy, 6, 6, c.bodyShadow)
      // Exposed arms/shoulders
      rect(g, 11, 18 + oy, 1, 4, c.skin)
      rect(g, 20, 18 + oy, 1, 4, c.skin)
    },
  },
]

// ── Accessory styles ──

export const ACCESSORIES: OCPart[] = [
  {
    id: 'none',
    name: 'None',
    draw: () => {},
  },
  {
    id: 'glasses',
    name: 'Glasses',
    draw: (g, c, _f, oy) => {
      // Frames
      rect(g, 12, 10 + oy, 4, 1, c.accessory)
      rect(g, 17, 10 + oy, 4, 1, c.accessory)
      rect(g, 12, 13 + oy, 4, 1, c.accessory)
      rect(g, 17, 13 + oy, 4, 1, c.accessory)
      px(g, 12, 11 + oy, c.accessory)
      px(g, 15, 11 + oy, c.accessory)
      px(g, 17, 11 + oy, c.accessory)
      px(g, 20, 11 + oy, c.accessory)
      // Bridge
      px(g, 16, 11 + oy, c.accessory)
    },
  },
  {
    id: 'headband',
    name: 'Headband',
    draw: (g, c, _f, oy) => {
      rect(g, 9, 7 + oy, 14, 1, c.accessory)
    },
  },
  {
    id: 'hat',
    name: 'Hat',
    draw: (g, c, _f, oy) => {
      rect(g, 9, 4 + oy, 14, 2, c.accessory)
      rect(g, 11, 3 + oy, 10, 1, c.accessory)
    },
  },
]

// ── Default Colors ──

export const DEFAULT_COLORS: OCColors = {
  skin: '#FFD5A0',
  skinShadow: '#E8B878',
  hair: '#4A3728',
  hairHighlight: '#6B5540',
  eyes: '#2C2C2C',
  eyeWhite: '#FFFFFF',
  mouth: '#E85050',
  body: '#4A90D9',
  bodyShadow: '#3570B0',
  accessory: '#333333',
}

// ── Presets ──

export interface OCPreset {
  id: string
  name: string
  config: OCConfig
}

export const PRESETS: OCPreset[] = [
  {
    id: 'default',
    name: 'Classic',
    config: {
      hairId: 'short', eyesId: 'round', mouthId: 'smile', outfitId: 'hoodie', accessoryId: 'none',
      colors: { ...DEFAULT_COLORS },
    },
  },
  {
    id: 'studious',
    name: 'Studious',
    config: {
      hairId: 'long', eyesId: 'big', mouthId: 'neutral', outfitId: 'sweater', accessoryId: 'glasses',
      colors: { ...DEFAULT_COLORS, hair: '#2C2C2C', body: '#2C5F2D', bodyShadow: '#1E4620', accessory: '#8B6914' },
    },
  },
  {
    id: 'punk',
    name: 'Punk',
    config: {
      hairId: 'spiky', eyesId: 'narrow', mouthId: 'grin', outfitId: 'tank', accessoryId: 'headband',
      colors: { ...DEFAULT_COLORS, hair: '#FF4081', hairHighlight: '#FF80AB', body: '#1E1E1E', bodyShadow: '#111111', accessory: '#FF4081' },
    },
  },
  {
    id: 'corporate',
    name: 'Corporate',
    config: {
      hairId: 'short', eyesId: 'narrow', mouthId: 'smile', outfitId: 'suit', accessoryId: 'glasses',
      colors: { ...DEFAULT_COLORS, hair: '#1A1A1A', body: '#2C3E50', bodyShadow: '#1A252F', accessory: '#222222' },
    },
  },
  {
    id: 'cozy',
    name: 'Cozy',
    config: {
      hairId: 'curly', eyesId: 'big', mouthId: 'cat', outfitId: 'overalls', accessoryId: 'none',
      colors: { ...DEFAULT_COLORS, hair: '#C0392B', hairHighlight: '#E74C3C', body: '#F39C12', bodyShadow: '#D68910' },
    },
  },
]

// ── OC Creator Engine ──

export class OCCreatorEngine {
  private _config: OCConfig = { ...PRESETS[0].config, colors: { ...DEFAULT_COLORS } }

  get config(): OCConfig { return this._config }

  async load() {
    try {
      const saved = await invoke<string | null>('config_get', { key: 'oc_config' })
      if (saved) {
        const parsed = JSON.parse(saved) as OCConfig
        this._config = parsed
      }
    } catch {}
  }

  async save() {
    try {
      await invoke('config_set', { key: 'oc_config', value: JSON.stringify(this._config) })
    } catch {}
  }

  setHair(id: string) { if (HAIRS.find(h => h.id === id)) this._config.hairId = id }
  setEyes(id: string) { if (EYES.find(e => e.id === id)) this._config.eyesId = id }
  setMouth(id: string) { if (MOUTHS.find(m => m.id === id)) this._config.mouthId = id }
  setOutfit(id: string) { if (OUTFITS.find(o => o.id === id)) this._config.outfitId = id }
  setAccessory(id: string) { if (ACCESSORIES.find(a => a.id === id)) this._config.accessoryId = id }
  setColor<K extends keyof OCColors>(key: K, value: string) { this._config.colors[key] = value }

  applyPreset(presetId: string) {
    const preset = PRESETS.find(p => p.id === presetId)
    if (preset) {
      this._config = { ...preset.config, colors: { ...preset.config.colors } }
    }
  }

  exportJSON(): string {
    return JSON.stringify(this._config, null, 2)
  }

  importJSON(json: string): boolean {
    try {
      const parsed = JSON.parse(json) as OCConfig
      if (parsed.hairId && parsed.eyesId && parsed.colors) {
        this._config = parsed
        return true
      }
    } catch {}
    return false
  }

  /** Render preview frame to a 32x32 grid */
  renderPreview(frame: number = 0): (string | null)[][] {
    const grid: (string | null)[][] = Array.from({ length: 32 }, () => Array(32).fill(null))
    const c = this._config.colors
    const oy = frame % 2 === 0 ? 0 : -1 // idle bob

    // Desk
    rect(grid, 2, 26 + oy, 28, 4, '#8B6F4E')
    rect(grid, 2, 28 + oy, 28, 2, '#6B5030')

    // Monitor
    rect(grid, 25, 16 + oy, 6, 10, '#555555')
    rect(grid, 27, 26 + oy, 3, 1, '#444444')
    rect(grid, 28, 23 + oy, 1, 3, '#4A4A4A')

    // Head (skin)
    rect(grid, 10, 6 + oy, 12, 12, c.skin)
    rect(grid, 11, 7 + oy, 10, 10, c.skin)

    // Draw parts in order: hair, outfit, eyes, mouth, accessory
    const hair = HAIRS.find(h => h.id === this._config.hairId) || HAIRS[0]
    const eyes = EYES.find(e => e.id === this._config.eyesId) || EYES[0]
    const mouth = MOUTHS.find(m => m.id === this._config.mouthId) || MOUTHS[0]
    const outfit = OUTFITS.find(o => o.id === this._config.outfitId) || OUTFITS[0]
    const accessory = ACCESSORIES.find(a => a.id === this._config.accessoryId) || ACCESSORIES[0]

    hair.draw(grid, c, frame, oy)
    outfit.draw(grid, c, frame, oy)
    eyes.draw(grid, c, frame, oy)
    mouth.draw(grid, c, frame, oy)
    accessory.draw(grid, c, frame, oy)

    return grid
  }

  /** Apply OC colors to the skin system palette override */
  getAsPalette(): Record<string, string> {
    const c = this._config.colors
    return {
      skin: c.skin,
      skinShadow: c.skinShadow,
      hair: c.hair,
      eyes: c.eyes,
      eyeWhite: c.eyeWhite,
      mouth: c.mouth,
      body: c.body,
      bodyShadow: c.bodyShadow,
    }
  }
}
