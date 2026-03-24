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

// ══════════════════════════════════════════════
// PROGRAMMER SKIN (3rd Skin)
// ══════════════════════════════════════════════
const programmerSkin: SkinDef = {
  id: 'programmer',
  name: 'Programmer',
  description: 'Dual monitors, mechanical keyboard, energy drinks, rubber duck',
  icon: '💻',
  palette: {
    body: '#1E1E1E',       // dark hoodie (developer black)
    bodyShadow: '#141414',
    desk: '#3C3C3C',       // dark standing desk
    deskShadow: '#2A2A2A',
    hair: '#5C4033',       // brown messy hair
    highlight: '#00FF41',  // matrix green highlight
  },
  deskItems: [
    {
      id: 'dual_monitors',
      draw: (grid) => {
        // Left monitor (dark code)
        drawRect(grid, 0, 1, 7, 5, '#1E1E1E')   // screen bg
        drawRect(grid, 0, 1, 7, 1, '#333333')    // bezel top
        drawRect(grid, 0, 6, 7, 1, '#333333')    // bezel bottom
        // Code lines
        drawPixel(grid, 1, 2, '#569CD6')  // blue keyword
        drawPixel(grid, 2, 2, '#569CD6')
        drawPixel(grid, 4, 2, '#CE9178')  // string
        drawPixel(grid, 5, 2, '#CE9178')
        drawPixel(grid, 1, 3, '#DCDCAA')  // function
        drawPixel(grid, 2, 3, '#DCDCAA')
        drawPixel(grid, 3, 3, '#DCDCAA')
        drawPixel(grid, 1, 4, '#6A9955')  // comment
        drawPixel(grid, 2, 4, '#6A9955')
        drawPixel(grid, 3, 4, '#6A9955')
        drawPixel(grid, 4, 4, '#6A9955')
        drawPixel(grid, 1, 5, '#9CDCFE')  // variable
        drawPixel(grid, 2, 5, '#D4D4D4')
        drawPixel(grid, 3, 5, '#4EC9B0')  // type

        // Right monitor (terminal)
        drawRect(grid, 24, 1, 7, 5, '#0C0C0C')   // terminal bg
        drawRect(grid, 24, 1, 7, 1, '#333333')    // bezel top
        drawRect(grid, 24, 6, 7, 1, '#333333')    // bezel bottom
        drawPixel(grid, 25, 2, '#00FF41') // green terminal text
        drawPixel(grid, 26, 2, '#00FF41')
        drawPixel(grid, 27, 2, '#00FF41')
        drawPixel(grid, 25, 3, '#00FF41')
        drawPixel(grid, 26, 3, '#FFFFFF') // $ prompt
        drawPixel(grid, 25, 4, '#CCCCCC')
        drawPixel(grid, 26, 4, '#CCCCCC')
        drawPixel(grid, 29, 5, '#00FF41') // cursor blink
      },
    },
    {
      id: 'mech_keyboard',
      draw: (grid) => {
        // Mechanical keyboard (wide, between monitors)
        drawRect(grid, 8, 24, 14, 2, '#404040')
        drawRect(grid, 9, 24, 12, 1, '#505050') // keys row 1
        drawRect(grid, 9, 25, 12, 1, '#484848') // keys row 2
        // Key highlights
        drawPixel(grid, 10, 24, '#606060')
        drawPixel(grid, 12, 24, '#606060')
        drawPixel(grid, 14, 24, '#606060')
        drawPixel(grid, 16, 24, '#606060')
        drawPixel(grid, 18, 24, '#606060')
        // RGB underglow hint
        drawPixel(grid, 9, 25, '#FF4444')
        drawPixel(grid, 11, 25, '#44FF44')
        drawPixel(grid, 13, 25, '#4444FF')
        drawPixel(grid, 15, 25, '#FF44FF')
        drawPixel(grid, 17, 25, '#44FFFF')
        drawPixel(grid, 19, 25, '#FFFF44')
      },
    },
    {
      id: 'energy_drinks',
      draw: (grid) => {
        // Energy drink can
        drawRect(grid, 22, 22, 2, 4, '#1B5E20')
        drawPixel(grid, 22, 22, '#4CAF50') // lid
        drawPixel(grid, 23, 22, '#4CAF50')
        drawPixel(grid, 22, 23, '#FFEB3B') // lightning bolt
        drawPixel(grid, 23, 24, '#FFEB3B')
        // Second can (tipped)
        drawRect(grid, 7, 25, 3, 1, '#0D47A1')
        drawPixel(grid, 7, 25, '#2196F3')
      },
    },
    {
      id: 'rubber_duck',
      draw: (grid, frame) => {
        // Rubber duck debug companion (on desk right)
        const bob = frame % 4 < 2 ? 0 : -1 // gentle bob
        drawPixel(grid, 26, 22 + bob, '#FFD700') // head
        drawPixel(grid, 27, 22 + bob, '#FFD700')
        drawPixel(grid, 26, 23 + bob, '#FFC107') // body
        drawPixel(grid, 27, 23 + bob, '#FFC107')
        drawPixel(grid, 28, 23 + bob, '#FFC107')
        drawPixel(grid, 28, 22 + bob, '#FF8F00') // beak
        drawPixel(grid, 26, 22 + bob, '#000000') // eye (1px)
      },
    },
    {
      id: 'server_rack',
      draw: (grid) => {
        // Mini server rack decoration (right edge)
        drawRect(grid, 29, 18, 2, 7, '#37474F')
        drawPixel(grid, 29, 19, '#4CAF50') // green LED
        drawPixel(grid, 29, 21, '#4CAF50')
        drawPixel(grid, 29, 23, '#FF5722') // orange LED
        drawPixel(grid, 30, 20, '#263238') // ventilation
        drawPixel(grid, 30, 22, '#263238')
      },
    },
  ],
  mumbles: [
    'Tabs or spaces? Don\'t make me choose.',
    'It works on my machine...',
    'Just one more commit before bed.',
    'Time to mass-refactor? No, not today.',
    'This bug makes no sense...',
    'git push --force... just kidding.',
    'Stack Overflow to the rescue again.',
    'Why did I write this code last week?',
    'LGTM (Let\'s Get Tacos, Maybe).',
    'The rubber duck says it\'s a null pointer.',
    'npm install... 2000 packages later.',
    'Successfully explained regex to someone!',
    'Deploying on a Friday. Living dangerously.',
    'The tests pass. Ship it!',
    'Just found a 10x performance improvement!',
    'My PR got approved on first try!',
    'Segfault at 3am. Classic.',
    'README driven development today.',
    'That\'s not a bug, it\'s a feature.',
    'rm -rf node_modules && npm install. The ancient ritual.',
  ],
  unlockLevel: 8, // Lv.8 in growth system
}

// ── All skins registry ──
export const SKINS: SkinDef[] = [universalSkin, graduateSkin, programmerSkin]

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
