// Procedural pixel art generator for placeholder sprites
// Generates 32x32 pixel art frames for each animation state
// Will be replaced with real sprite sheets later

import type { AnimationState } from './AnimationStateMachine'

// 16-color palette per PRD
const PALETTE = {
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

type PixelData = (string | null)[][]

function createGrid(): PixelData {
  return Array.from({ length: 32 }, () => Array(32).fill(null))
}

function drawPixel(grid: PixelData, x: number, y: number, color: string) {
  if (x >= 0 && x < 32 && y >= 0 && y < 32) {
    grid[y][x] = color
  }
}

function drawRect(grid: PixelData, x: number, y: number, w: number, h: number, color: string) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      drawPixel(grid, x + dx, y + dy, color)
    }
  }
}

// Draw basic character body (shared base)
function drawBase(grid: PixelData, bodyOffsetY: number = 0) {
  // Desk
  drawRect(grid, 2, 26 + bodyOffsetY, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28 + bodyOffsetY, 28, 2, PALETTE.deskShadow)

  // Body
  drawRect(grid, 11, 18 + bodyOffsetY, 10, 8, PALETTE.body)
  drawRect(grid, 12, 19 + bodyOffsetY, 8, 6, PALETTE.bodyShadow)

  // Head
  drawRect(grid, 10, 6 + bodyOffsetY, 12, 12, PALETTE.skin)
  drawRect(grid, 11, 7 + bodyOffsetY, 10, 10, PALETTE.skin)

  // Hair
  drawRect(grid, 10, 5 + bodyOffsetY, 12, 3, PALETTE.hair)
  drawRect(grid, 9, 6 + bodyOffsetY, 2, 4, PALETTE.hair)
  drawRect(grid, 21, 6 + bodyOffsetY, 2, 4, PALETTE.hair)

  // Eyes
  drawRect(grid, 13, 11 + bodyOffsetY, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11 + bodyOffsetY, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14, 12 + bodyOffsetY, PALETTE.eyes)
  drawPixel(grid, 19, 12 + bodyOffsetY, PALETTE.eyes)
}

// Generate frames for each state
function generateIdle(frame: number): PixelData {
  const grid = createGrid()
  const bob = frame % 2 === 0 ? 0 : -1
  drawBase(grid, bob)
  // Slight mouth
  drawRect(grid, 15, 15 + bob, 2, 1, PALETTE.mouth)
  return grid
}

function generateWorking(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Mouth focused
  drawPixel(grid, 15, 15, PALETTE.mouth)
  // Arms on keyboard - alternate position
  const armX = frame % 2 === 0 ? 8 : 9
  drawRect(grid, armX, 22, 3, 2, PALETTE.skin)
  drawRect(grid, 20 + (frame % 2), 22, 3, 2, PALETTE.skin)
  // Keyboard on desk
  drawRect(grid, 8, 24, 16, 2, '#555555')
  return grid
}

function generateResting(frame: number): PixelData {
  const grid = createGrid()
  const stretch = frame < 3 ? frame : 5 - frame
  drawBase(grid, -stretch)
  // Arms up when stretching
  if (frame >= 1 && frame <= 4) {
    drawRect(grid, 7, 12 - stretch, 3, 2, PALETTE.skin)
    drawRect(grid, 22, 12 - stretch, 3, 2, PALETTE.skin)
  }
  // Yawn mouth
  if (frame >= 2 && frame <= 3) {
    drawRect(grid, 14, 14 - stretch, 4, 3, PALETTE.mouth)
  } else {
    drawRect(grid, 15, 15 - stretch, 2, 1, PALETTE.mouth)
  }
  return grid
}

function generateHappy(frame: number): PixelData {
  const grid = createGrid()
  const jump = frame < 3 ? -frame * 2 : -(5 - frame) * 2
  drawBase(grid, jump)
  // Big smile
  drawRect(grid, 14, 14 + jump, 4, 2, PALETTE.mouth)
  // Blush
  drawRect(grid, 11, 13 + jump, 2, 1, PALETTE.blush)
  drawRect(grid, 20, 13 + jump, 2, 1, PALETTE.blush)
  // Sparkles
  if (frame >= 2 && frame <= 4) {
    drawPixel(grid, 6, 4, PALETTE.sparkle)
    drawPixel(grid, 25, 3, PALETTE.sparkle)
    drawPixel(grid, 8, 8, PALETTE.sparkle)
    drawPixel(grid, 24, 7, PALETTE.sparkle)
  }
  return grid
}

function generateSleepy(frame: number): PixelData {
  const grid = createGrid()
  const nod = frame >= 2 ? 1 : 0
  drawBase(grid, nod)
  // Closed eyes (lines)
  drawRect(grid, 13, 12 + nod, 3, 1, PALETTE.eyes)
  drawRect(grid, 18, 12 + nod, 3, 1, PALETTE.eyes)
  // Small mouth
  drawPixel(grid, 16, 15 + nod, PALETTE.mouth)
  // Zzz bubbles
  const zOffset = frame % 4
  drawPixel(grid, 24 + zOffset, 4 - zOffset, PALETTE.zzz)
  drawPixel(grid, 26 + zOffset, 2 - Math.min(zOffset, 2), PALETTE.zzz)
  return grid
}

function generateChatting(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Mouth open/close
  if (frame % 2 === 0) {
    drawRect(grid, 14, 14, 4, 3, PALETTE.mouth)
  } else {
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  }
  // Speech bubble
  drawRect(grid, 24, 2, 7, 5, PALETTE.eyeWhite)
  drawPixel(grid, 23, 6, PALETTE.eyeWhite)
  // Dots in bubble
  drawPixel(grid, 25, 4, PALETTE.eyes)
  drawPixel(grid, 27, 4, PALETTE.eyes)
  drawPixel(grid, 29, 4, PALETTE.eyes)
  return grid
}

function generateStressed(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Worried eyes
  drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 13, 12, PALETTE.eyes)
  drawPixel(grid, 18, 12, PALETTE.eyes)
  // Wavy mouth
  drawPixel(grid, 14, 15, PALETTE.mouth)
  drawPixel(grid, 16, 16, PALETTE.mouth)
  drawPixel(grid, 18, 15, PALETTE.mouth)
  // Sweat drops
  const sweatY = 8 + (frame % 3)
  drawPixel(grid, 22, sweatY, PALETTE.sweat)
  drawPixel(grid, 23, sweatY + 1, PALETTE.sweat)
  // Scratch hand
  const scratchX = 8 + (frame % 2)
  drawRect(grid, scratchX, 8, 2, 3, PALETTE.skin)
  return grid
}

function generateCaring(frame: number): PixelData {
  const grid = createGrid()
  const wave = frame % 2 === 0 ? 0 : -1
  drawBase(grid)
  // Gentle smile
  drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
  drawPixel(grid, 13, 13, PALETTE.mouth)
  drawPixel(grid, 18, 13, PALETTE.mouth)
  // Blush
  drawRect(grid, 11, 13, 2, 1, PALETTE.blush)
  drawRect(grid, 20, 13, 2, 1, PALETTE.blush)
  // Waving hand
  drawRect(grid, 24, 12 + wave, 3, 3, PALETTE.skin)
  drawRect(grid, 25, 11 + wave, 1, 1, PALETTE.skin)
  return grid
}

const GENERATORS: Record<string, (frame: number) => PixelData> = {
  idle: generateIdle,
  working: generateWorking,
  resting: generateResting,
  happy: generateHappy,
  sleepy: generateSleepy,
  chatting: generateChatting,
  stressed: generateStressed,
  caring: generateCaring,
}

// Render a pixel grid to an offscreen canvas and return ImageData
export function generateFrame(state: AnimationState, frame: number): PixelData {
  const generator = GENERATORS[state]
  if (!generator) return createGrid()
  return generator(frame)
}

export function renderPixelGrid(
  ctx: CanvasRenderingContext2D,
  grid: PixelData,
  scale: number = 3
) {
  ctx.clearRect(0, 0, 32 * scale, 32 * scale)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const color = grid[y][x]
      if (color) {
        ctx.fillStyle = color
        ctx.fillRect(x * scale, y * scale, scale, scale)
      }
    }
  }
}
