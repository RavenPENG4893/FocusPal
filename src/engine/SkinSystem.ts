// Skin System: JSON-driven theme framework
// Each skin defines palette overrides, desk decorations, and mumble additions

import { invoke } from '@tauri-apps/api/core'

export interface SkinPalette {
  skin?: string
  skinShadow?: string
  hair?: string
  eyes?: string
  eyeWhite?: string
  mouth?: string
  body?: string
  bodyShadow?: string
  desk?: string
  deskShadow?: string
  outline?: string
  highlight?: string
  blush?: string
  zzz?: string
  sweat?: string
  sparkle?: string
}

export interface DeskItem {
  id: string
  draw: (grid: (string | null)[][], frame: number) => void
}

export interface SkinDef {
  id: string
  name: string
  description: string
  icon: string
  palette: SkinPalette
  deskItems: DeskItem[]
  mumbles: string[]
  unlockLevel: number  // 0 = always available
}

// ── Desk item drawing helpers ──
function drawPixel(grid: (string | null)[][], x: number, y: number, color: string) {
  if (x >= 0 && x < 32 && y >= 0 && y < 32) grid[y][x] = color
}
function drawRect(grid: (string | null)[][], x: number, y: number, w: number, h: number, color: string) {
  for (let dy = 0; dy < h; dy++)
    for (let dx = 0; dx < w; dx++)
      drawPixel(grid, x + dx, y + dy, color)
}

// ══════════════════════════════════════════════
// UNIVERSAL SKIN (Default)
// ══════════════════════════════════════════════
const universalSkin: SkinDef = {
  id: 'universal',
  name: 'Universal',
  description: 'Simple desk setup with monitor and coffee cup',
  icon: '🖥️',
  palette: {}, // uses default palette
  deskItems: [
    {
      id: 'small_plant',
      draw: (grid) => {
        // Tiny plant pot on right side of desk
        drawRect(grid, 23, 24, 3, 2, '#8B4513') // pot
        drawRect(grid, 24, 23, 1, 1, '#2D8B2D') // stem
        drawRect(grid, 23, 22, 3, 1, '#3DAA3D') // leaves
        drawPixel(grid, 22, 22, '#2D8B2D')
        drawPixel(grid, 26, 22, '#2D8B2D')
      },
    },
  ],
  mumbles: [],
  unlockLevel: 0,
}

// ══════════════════════════════════════════════
// GRADUATE STUDENT SKIN
// ══════════════════════════════════════════════
const graduateSkin: SkinDef = {
  id: 'graduate',
  name: 'Graduate Student',
  description: 'Papers, coffee cups, whiteboard equations, thesis stress',
  icon: '🎓',
  palette: {
    body: '#2C5F2D',       // dark green hoodie
    bodyShadow: '#1E4620',
    desk: '#6B5030',       // darker worn desk
    deskShadow: '#4A3520',
    hair: '#2C2C2C',       // dark messy hair
  },
  deskItems: [
    {
      id: 'paper_stack',
      draw: (grid) => {
        // Tall paper stack on left
        drawRect(grid, 1, 20, 4, 6, '#F5F5F0')
        drawRect(grid, 1, 20, 4, 1, '#E8E8E0')
        drawRect(grid, 1, 22, 4, 1, '#E8E8E0')
        drawRect(grid, 1, 24, 4, 1, '#E8E8E0')
        // Text lines on top paper
        drawRect(grid, 2, 21, 2, 0, '#666666')
        drawPixel(grid, 2, 21, '#666666')
        drawPixel(grid, 3, 21, '#666666')
      },
    },
    {
      id: 'coffee_cups',
      draw: (grid) => {
        // Multiple coffee cups scattered
        // Cup 1
        drawRect(grid, 5, 24, 2, 2, '#FFFFFF')
        drawPixel(grid, 5, 24, '#E0E0E0')
        drawPixel(grid, 6, 23, '#8B6540') // coffee stain
        // Cup 2 (empty, tipped)
        drawRect(grid, 22, 25, 2, 1, '#F0F0F0')
        drawPixel(grid, 21, 25, '#E0E0E0')
      },
    },
    {
      id: 'whiteboard',
      draw: (grid) => {
        // Small whiteboard/poster on the "wall" (top area)
        drawRect(grid, 0, 1, 8, 6, '#F8F8F8')
        drawRect(grid, 0, 1, 8, 1, '#CCCCCC') // frame top
        // Equations
        drawPixel(grid, 1, 3, '#333333')
        drawPixel(grid, 2, 3, '#333333')
        drawPixel(grid, 4, 3, '#E85050') // important variable
        drawPixel(grid, 1, 4, '#333333')
        drawPixel(grid, 3, 4, '#333333')
        drawPixel(grid, 5, 4, '#333333')
        drawPixel(grid, 2, 5, '#4A90D9') // integral sign
        drawPixel(grid, 3, 5, '#4A90D9')
      },
    },
    {
      id: 'thesis_screen',
      draw: (grid) => {
        // Monitor shows thesis text instead of blank
        drawPixel(grid, 26, 18, '#40FF40') // cursor blink
        drawPixel(grid, 26, 19, '#AAAAAA')
        drawPixel(grid, 27, 19, '#AAAAAA')
        drawPixel(grid, 26, 20, '#AAAAAA')
      },
    },
  ],
  mumbles: [
    'Advisor gave positive feedback!',
    'Found a key reference!',
    'Simulation converged!',
    'Just one more paragraph...',
    'This regression looks promising!',
    'Why won\'t LaTeX compile...',
    'Need more coffee for this proof.',
    'Deadline is approaching...',
    'Finally finished the lit review!',
    'R² = 0.99... wait, overfitting?',
    'The p-value is significant!',
    'Time to defend the thesis someday...',
    'Another citation needed here.',
    'My advisor will love this chart!',
    'Sleep is for after graduation.',
  ],
  unlockLevel: 15, // Lv.15 in growth system
}

// ── All skins registry ──
export const SKINS: SkinDef[] = [universalSkin, graduateSkin]

let _activeSkinId = 'universal'

export function getActiveSkin(): SkinDef {
  return SKINS.find(s => s.id === _activeSkinId) || universalSkin
}

export function getActiveSkinId(): string {
  return _activeSkinId
}

export function setActiveSkin(id: string) {
  if (SKINS.find(s => s.id === id)) {
    _activeSkinId = id
    // Persist
    invoke('config_set', { key: 'active_skin', value: id }).catch(() => {})
  }
}

export async function loadSkinSetting() {
  try {
    const saved = await invoke<string | null>('config_get', { key: 'active_skin' })
    if (saved && SKINS.find(s => s.id === saved)) {
      _activeSkinId = saved
    }
  } catch {}
}

/** Get the merged palette (defaults + skin overrides) */
export function getMergedPalette(): Record<string, string> {
  const defaults: Record<string, string> = {
    skin:       '#FFD5A0',
    skinShadow: '#E8B878',
    hair:       '#4A3728',
    eyes:       '#2C2C2C',
    eyeWhite:   '#FFFFFF',
    mouth:      '#E85050',
    body:       '#4A90D9',
    bodyShadow: '#3570B0',
    desk:       '#8B6F4E',
    deskShadow: '#6B5030',
    outline:    '#2C2C2C',
    highlight:  '#FFF8E0',
    blush:      '#FF9090',
    zzz:        '#90B0D0',
    sweat:      '#80C0FF',
    sparkle:    '#FFE040',
  }
  const skin = getActiveSkin()
  return { ...defaults, ...skin.palette }
}

/** Draw skin-specific desk decorations onto the grid */
export function drawSkinDeskItems(grid: (string | null)[][], frame: number) {
  const skin = getActiveSkin()
  for (const item of skin.deskItems) {
    item.draw(grid, frame)
  }
}
