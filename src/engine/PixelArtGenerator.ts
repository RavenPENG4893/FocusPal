// Procedural pixel art generator for placeholder sprites
// Generates 32x32 pixel art frames for each animation state
// Will be replaced with real sprite sheets later

import type { AnimationState } from './AnimationStateMachine'
import { getMergedPalette, drawSkinDeskItems } from './SkinSystem'

// 16-color palette - now dynamically resolved from active skin
// Getter function ensures skin palette overrides are always applied
function getPalette(): Record<string, string> {
  return getMergedPalette()
}

// Convenience alias used throughout (re-evaluated each frame via getter)
let PALETTE = getPalette()

/** Call at start of each frame generation to refresh palette */
export function refreshPalette() {
  PALETTE = getPalette()
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

  // Monitor back (right side, half visible on desk)
  drawRect(grid, 25, 16 + bodyOffsetY, 6, 10, '#555555')  // main panel back
  drawRect(grid, 26, 16 + bodyOffsetY, 5, 1, '#666666')   // top edge highlight
  drawRect(grid, 27, 26 + bodyOffsetY, 3, 1, '#444444')   // stand base on desk
  drawRect(grid, 28, 23 + bodyOffsetY, 1, 3, '#4A4A4A')   // stand neck
  drawPixel(grid, 25, 17 + bodyOffsetY, '#666666')         // logo dot on back

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

function generateCurious(frame: number): PixelData {
  const grid = createGrid()
  // Head tilted slightly
  const tilt = frame < 2 ? 0 : 1
  drawBase(grid)
  // Tilted head - shift eyes
  drawRect(grid, 13 + tilt, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18 + tilt, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14 + tilt, 11, PALETTE.eyes) // looking up
  drawPixel(grid, 19 + tilt, 11, PALETTE.eyes)
  // Small 'o' mouth
  drawRect(grid, 15, 15, 2, 2, PALETTE.mouth)
  // Question mark
  if (frame >= 1) {
    drawPixel(grid, 24, 3, PALETTE.sparkle)
    drawPixel(grid, 25, 2, PALETTE.sparkle)
    drawPixel(grid, 26, 3, PALETTE.sparkle)
    drawPixel(grid, 25, 4, PALETTE.sparkle)
    drawPixel(grid, 25, 6, PALETTE.sparkle)
  }
  return grid
}

function generateWakeup(frame: number): PixelData {
  const grid = createGrid()
  if (frame < 2) {
    // Startled - eyes wide
    drawBase(grid, -1)
    drawRect(grid, 12, 10, 3, 3, PALETTE.eyeWhite)
    drawRect(grid, 18, 10, 3, 3, PALETTE.eyeWhite)
    drawPixel(grid, 13, 11, PALETTE.eyes)
    drawPixel(grid, 19, 11, PALETTE.eyes)
    drawRect(grid, 14, 13, 4, 2, PALETTE.mouth)
    // Exclamation
    drawPixel(grid, 25, 2, PALETTE.sparkle)
    drawPixel(grid, 25, 3, PALETTE.sparkle)
    drawPixel(grid, 25, 5, PALETTE.sparkle)
  } else if (frame < 4) {
    // Stretching
    const stretch = frame - 2
    drawBase(grid, -stretch)
    drawRect(grid, 7, 10 - stretch, 3, 2, PALETTE.skin)
    drawRect(grid, 22, 10 - stretch, 3, 2, PALETTE.skin)
    drawRect(grid, 14, 14 - stretch, 4, 2, PALETTE.mouth) // yawn
  } else {
    // Rubs eyes, settling into idle
    drawBase(grid)
    // Closed left eye (rubbing)
    drawRect(grid, 13, 12, 3, 1, PALETTE.eyes)
    // Hand covering left eye area - use skinShadow for contrast
    drawRect(grid, 10, 10, 5, 3, PALETTE.skinShadow)
    drawRect(grid, 10, 9, 3, 1, PALETTE.skinShadow) // fingers
    // Right eye half open
    drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
    drawPixel(grid, 19, 12, PALETTE.eyes)
    // Sleepy mouth
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  }
  return grid
}

function generateHatching(frame: number): PixelData {
  const grid = createGrid()
  // Desk
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)

  if (frame < 4) {
    // Egg wobble phase
    const wobble = frame % 2 === 0 ? 0 : 1
    // Egg shape (oval)
    drawRect(grid, 12 + wobble, 10, 8, 16, PALETTE.eyeWhite)
    drawRect(grid, 11 + wobble, 12, 10, 12, PALETTE.eyeWhite)
    drawRect(grid, 10 + wobble, 14, 12, 8, PALETTE.eyeWhite)
    // Egg shadow
    drawRect(grid, 13 + wobble, 22, 6, 2, PALETTE.skinShadow)
    // Spots on egg
    drawPixel(grid, 14 + wobble, 14, PALETTE.body)
    drawPixel(grid, 17 + wobble, 17, PALETTE.body)
    drawPixel(grid, 15 + wobble, 20, PALETTE.body)
  } else if (frame < 8) {
    // Crack phase
    const crackStage = frame - 4
    // Egg with cracks
    drawRect(grid, 12, 10, 8, 16, PALETTE.eyeWhite)
    drawRect(grid, 11, 12, 10, 12, PALETTE.eyeWhite)
    drawRect(grid, 10, 14, 12, 8, PALETTE.eyeWhite)
    // Cracks (more each frame)
    drawPixel(grid, 16, 14, PALETTE.eyes)
    drawPixel(grid, 15, 15, PALETTE.eyes)
    if (crackStage >= 1) {
      drawPixel(grid, 17, 13, PALETTE.eyes)
      drawPixel(grid, 14, 16, PALETTE.eyes)
      drawPixel(grid, 18, 15, PALETTE.eyes)
    }
    if (crackStage >= 2) {
      drawPixel(grid, 13, 14, PALETTE.eyes)
      drawPixel(grid, 19, 14, PALETTE.eyes)
      drawPixel(grid, 16, 12, PALETTE.eyes)
    }
    if (crackStage >= 3) {
      // Big crack line across middle
      for (let x = 12; x <= 20; x++) {
        drawPixel(grid, x, 16 + (x % 2), PALETTE.eyes)
      }
    }
    // Egg spots
    drawPixel(grid, 14, 20, PALETTE.body)
    drawPixel(grid, 17, 22, PALETTE.body)
  } else {
    // Emerge phase - character coming out of broken shell
    const emergeStage = frame - 8
    // Bottom half of shell
    drawRect(grid, 11, 20 - emergeStage, 10, 6 + emergeStage, PALETTE.eyeWhite)
    // Jagged top edge of shell
    drawPixel(grid, 12, 19 - emergeStage, PALETTE.eyeWhite)
    drawPixel(grid, 15, 18 - emergeStage, PALETTE.eyeWhite)
    drawPixel(grid, 18, 19 - emergeStage, PALETTE.eyeWhite)
    // Character emerging
    const charY = 14 - emergeStage * 2
    if (charY > 0) {
      // Head
      drawRect(grid, 12, charY, 8, 8, PALETTE.skin)
      // Hair
      drawRect(grid, 12, charY - 1, 8, 2, PALETTE.hair)
      // Eyes
      drawRect(grid, 14, charY + 3, 2, 2, PALETTE.eyeWhite)
      drawRect(grid, 18, charY + 3, 2, 2, PALETTE.eyeWhite)
      drawPixel(grid, 15, charY + 4, PALETTE.eyes)
      drawPixel(grid, 19, charY + 4, PALETTE.eyes)
      // Happy mouth
      drawRect(grid, 15, charY + 6, 3, 1, PALETTE.mouth)
      // Sparkles
      if (emergeStage >= 2) {
        drawPixel(grid, 6, charY, PALETTE.sparkle)
        drawPixel(grid, 25, charY - 1, PALETTE.sparkle)
        drawPixel(grid, 8, charY + 5, PALETTE.sparkle)
        drawPixel(grid, 24, charY + 4, PALETTE.sparkle)
      }
    }
  }
  return grid
}

// ── Day 12: System metrics visual states ──

function generateSweating(frame: number): PixelData {
  const grid = createGrid()
  const strain = frame % 2 === 0 ? 0 : 1
  drawBase(grid, strain)
  // Strained eyes (squinting)
  drawRect(grid, 13, 12 + strain, 3, 1, PALETTE.eyes)
  drawRect(grid, 18, 12 + strain, 3, 1, PALETTE.eyes)
  // Gritting mouth
  drawRect(grid, 14, 15 + strain, 4, 1, PALETTE.mouth)
  drawPixel(grid, 15, 15 + strain, PALETTE.eyeWhite) // teeth
  drawPixel(grid, 17, 15 + strain, PALETTE.eyeWhite)
  // Blush from exertion
  drawRect(grid, 11, 14 + strain, 2, 1, PALETTE.blush)
  drawRect(grid, 20, 14 + strain, 2, 1, PALETTE.blush)
  // Sweat drops falling
  const drop1Y = 8 + (frame % 4) * 2
  const drop2Y = 6 + ((frame + 2) % 4) * 2
  drawPixel(grid, 9, drop1Y + strain, PALETTE.sweat)
  drawPixel(grid, 9, drop1Y + 1 + strain, PALETTE.sweat)
  drawPixel(grid, 22, drop2Y + strain, PALETTE.sweat)
  drawPixel(grid, 22, drop2Y + 1 + strain, PALETTE.sweat)
  // Extra drop on forehead
  drawPixel(grid, 21, 7 + strain, PALETTE.sweat)
  return grid
}

function generateOverloaded(frame: number): PixelData {
  const grid = createGrid()
  // Desk
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Millstone (big circle on desk)
  const pushX = frame % 2 === 0 ? 0 : 1
  drawRect(grid, 18 + pushX, 18, 10, 8, '#888888')
  drawRect(grid, 19 + pushX, 17, 8, 2, '#999999')
  drawRect(grid, 20 + pushX, 19, 6, 4, '#777777') // stone shadow
  drawPixel(grid, 23 + pushX, 20, '#666666') // hole in center
  drawPixel(grid, 24 + pushX, 21, '#666666')
  // Character pushing (leaning forward)
  const lean = frame % 2
  // Body leaning
  drawRect(grid, 9 + lean, 18, 9, 8, PALETTE.body)
  drawRect(grid, 10 + lean, 19, 7, 6, PALETTE.bodyShadow)
  // Head
  drawRect(grid, 8 + lean, 7, 12, 11, PALETTE.skin)
  drawRect(grid, 9 + lean, 8, 10, 9, PALETTE.skin)
  // Hair
  drawRect(grid, 8 + lean, 6, 12, 3, PALETTE.hair)
  // Strained eyes
  drawRect(grid, 11 + lean, 12, 3, 1, PALETTE.eyes)
  drawRect(grid, 16 + lean, 12, 3, 1, PALETTE.eyes)
  // Gritting mouth
  drawRect(grid, 13 + lean, 15, 3, 1, PALETTE.mouth)
  // Pushing arms
  drawRect(grid, 16 + lean, 20, 3, 3, PALETTE.skin)
  drawRect(grid, 17 + lean, 19, 2, 1, PALETTE.skin)
  // Sweat
  drawPixel(grid, 7, 8 + (frame % 3), PALETTE.sweat)
  drawPixel(grid, 7, 9 + (frame % 3), PALETTE.sweat)
  // Effort lines
  if (frame >= 2) {
    drawPixel(grid, 5, 10, PALETTE.zzz)
    drawPixel(grid, 4, 12, PALETTE.zzz)
    drawPixel(grid, 5, 14, PALETTE.zzz)
  }
  return grid
}

function generateCleaning(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Smile
  drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
  // Broom in hand
  const sweepX = 4 + (frame % 3) * 3 // broom sweeps left to right
  // Broom stick
  drawRect(grid, sweepX + 4, 14, 1, 12, '#8B6F4E')
  // Broom head
  drawRect(grid, sweepX, 25, 9, 2, '#C09050')
  drawRect(grid, sweepX + 1, 24, 7, 1, '#D4A060')
  // Arm holding broom
  drawRect(grid, 20, 16, 3, 2, PALETTE.skin)
  drawRect(grid, sweepX + 3, 14, 2, 3, PALETTE.skin)
  // Dust particles flying
  if (frame >= 1 && frame <= 4) {
    const dustX = sweepX - 2
    drawPixel(grid, dustX, 24, PALETTE.skinShadow)
    drawPixel(grid, dustX + 1, 23, PALETTE.skinShadow)
    drawPixel(grid, dustX - 1, 25, PALETTE.skinShadow)
  }
  // Sparkle when done
  if (frame >= 4) {
    drawPixel(grid, 5, 22, PALETTE.sparkle)
    drawPixel(grid, 27, 21, PALETTE.sparkle)
    drawPixel(grid, 6, 25, PALETTE.sparkle)
  }
  return grid
}

// ── Static desk items (drawn as overlay) ──

/** Draw coffee cup on desk */
function drawCoffeeCup(grid: PixelData, x: number, y: number) {
  drawRect(grid, x, y, 3, 3, '#B8860B')       // cup body
  drawRect(grid, x, y, 3, 1, '#D4A060')       // rim
  drawRect(grid, x + 1, y + 1, 1, 1, '#5C3317') // coffee inside
  drawPixel(grid, x + 3, y + 1, '#B8860B')    // handle
  drawPixel(grid, x, y + 3, '#8B6914')        // shadow
  drawRect(grid, x + 1, y + 3, 2, 1, '#8B6914')
}

/** Draw steam above a point */
function drawSteam(grid: PixelData, x: number, y: number, frame: number) {
  const drift = frame % 3
  drawPixel(grid, x, y - 1 - drift, 'rgba(200,200,200,0.6)')
  drawPixel(grid, x + 1, y - 2 - drift, 'rgba(200,200,200,0.4)')
}

/** Draw crumpled paper ball */
function drawPaperBall(grid: PixelData, x: number, y: number) {
  // Irregular shape
  drawPixel(grid, x + 1, y, '#E8E8E0')
  drawRect(grid, x, y + 1, 3, 1, '#E8E8E0')
  drawPixel(grid, x + 1, y + 2, '#E8E8E0')
  // Crease shadows
  drawPixel(grid, x, y + 1, '#C8C8B8')
  drawPixel(grid, x + 2, y + 1, '#D0D0C4')
}

/** Draw desk clutter overlay items (called externally by SpriteEngine) */
export function drawDeskClutter(grid: PixelData, level: number) {
  if (level >= 1) {
    drawCoffeeCup(grid, 3, 23)
    drawSteam(grid, 4, 22, 0)
  }
  if (level >= 2) {
    drawPaperBall(grid, 6, 23)
    drawPaperBall(grid, 2, 24)
  }
  if (level >= 3) {
    // More paper balls
    drawPaperBall(grid, 8, 24)
    // Stack of books (left edge)
    drawRect(grid, 1, 22, 3, 2, '#C06070')
    drawRect(grid, 1, 22, 3, 1, '#D08090')
    drawRect(grid, 1, 20, 3, 2, '#4A7AC0')
    drawRect(grid, 1, 20, 3, 1, '#6090D0')
    // Yellow sticky note
    drawRect(grid, 5, 21, 2, 2, '#FFE855')
    drawPixel(grid, 5, 21, '#E8D040')
    drawPixel(grid, 6, 22, '#333333') // "text"
  }
}

// ── Screen light adaptation overlays ──

/** Draw a small desk lamp (left side of desk) */
function drawDeskLamp(grid: PixelData, frame: number) {
  // Lamp base (on desk surface)
  drawPixel(grid, 2, 25, '#666666')
  drawPixel(grid, 3, 25, '#666666')
  // Lamp pole
  drawPixel(grid, 2, 24, '#888888')
  drawPixel(grid, 2, 23, '#888888')
  // Lamp shade
  drawPixel(grid, 1, 22, '#DDAA33')
  drawPixel(grid, 2, 22, '#EECC44')
  drawPixel(grid, 3, 22, '#DDAA33')
  // Light glow (animated flicker)
  const flicker = frame % 4 < 3
  if (flicker) {
    drawPixel(grid, 2, 23, '#FFEE88')
    drawPixel(grid, 1, 23, '#FFE86640')
    drawPixel(grid, 3, 23, '#FFE86640')
  }
}

/** Draw reading glasses on character face */
function drawReadingGlasses(grid: PixelData) {
  // Small round glasses at eye level (y=13-14, x=13-18)
  drawPixel(grid, 13, 13, '#886644')
  drawPixel(grid, 14, 13, '#886644')
  drawPixel(grid, 15, 13, '#886644') // bridge
  drawPixel(grid, 16, 13, '#886644')
  drawPixel(grid, 17, 13, '#886644')
  // Lens tint
  drawPixel(grid, 14, 14, '#CCBB9940')
  drawPixel(grid, 16, 14, '#CCBB9940')
}

/** Draw sunglasses on character face */
function drawSunglasses(grid: PixelData) {
  // Wider dark sunglasses at eye level
  drawPixel(grid, 12, 13, '#222222')
  drawPixel(grid, 13, 13, '#111111')
  drawPixel(grid, 14, 13, '#111111')
  drawPixel(grid, 15, 13, '#333333') // bridge
  drawPixel(grid, 16, 13, '#111111')
  drawPixel(grid, 17, 13, '#111111')
  drawPixel(grid, 18, 13, '#222222')
}

/** Draw light adaptation overlay based on dark mode + time period */
export function drawLightOverlay(grid: PixelData, isDark: boolean, timePeriod: string, frame: number) {
  const isNight = timePeriod === 'evening' || timePeriod === 'night' || timePeriod === 'late_night' || timePeriod === 'dusk'

  if (isDark && isNight) {
    // Dark mode + night: desk lamp with warm glow
    drawDeskLamp(grid, frame)
  } else if (isDark && !isNight) {
    // Dark mode + daytime: reading glasses + lamp
    drawDeskLamp(grid, frame)
    drawReadingGlasses(grid)
  } else if (!isDark && isNight) {
    // Light mode + night: sunglasses (squinting from brightness)
    drawSunglasses(grid)
  }
  // Light mode + daytime: normal, no overlay
}

// ── Day 12.5: Battery states ──

function generateLowBattery(frame: number): PixelData {
  const grid = createGrid()
  const droop = frame >= 2 ? 1 : 0
  drawBase(grid, droop)
  // Droopy eyes (half closed)
  drawRect(grid, 13, 12 + droop, 3, 1, PALETTE.eyes)
  drawRect(grid, 18, 12 + droop, 3, 1, PALETTE.eyes)
  // Tiny dots below = bags under eyes
  drawPixel(grid, 13, 13 + droop, PALETTE.skinShadow)
  drawPixel(grid, 19, 13 + droop, PALETTE.skinShadow)
  // Yawning mouth (alternating)
  if (frame % 4 < 2) {
    drawRect(grid, 14, 15 + droop, 4, 3, PALETTE.mouth)
  } else {
    drawRect(grid, 15, 15 + droop, 2, 1, PALETTE.mouth)
  }
  // Low battery icon floating
  drawRect(grid, 24, 3, 5, 3, PALETTE.eyes)   // battery outline
  drawRect(grid, 29, 4, 1, 1, PALETTE.eyes)   // nub
  drawRect(grid, 25, 4, 1, 1, '#E85050')      // red = low
  // Zzz starting to appear
  if (frame >= 2) {
    drawPixel(grid, 7, 6 + droop, PALETTE.zzz)
  }
  return grid
}

function generateCharging(frame: number): PixelData {
  const grid = createGrid()

  if (frame < 2) {
    // Frame 0-1: Static shock — body jolt, hair stands up, eyes wide
    const jolt = frame === 0 ? -2 : -1
    drawBase(grid, jolt)
    // Hair standing up (spiky)
    drawRect(grid, 10, 3 + jolt, 12, 2, PALETTE.hair)
    drawPixel(grid, 12, 2 + jolt, PALETTE.hair)
    drawPixel(grid, 15, 1 + jolt, PALETTE.hair)
    drawPixel(grid, 18, 2 + jolt, PALETTE.hair)
    drawPixel(grid, 20, 1 + jolt, PALETTE.hair)
    // Wide round eyes
    drawRect(grid, 12, 10 + jolt, 3, 3, PALETTE.eyeWhite)
    drawRect(grid, 18, 10 + jolt, 3, 3, PALETTE.eyeWhite)
    drawPixel(grid, 13, 11 + jolt, PALETTE.eyes)
    drawPixel(grid, 19, 11 + jolt, PALETTE.eyes)
    // Open mouth "o"
    drawRect(grid, 15, 14 + jolt, 2, 2, PALETTE.mouth)
    // Small lightning bolts around body
    drawPixel(grid, 8, 10, PALETTE.sparkle)
    drawPixel(grid, 7, 11, PALETTE.sparkle)
    drawPixel(grid, 23, 9, PALETTE.sparkle)
    drawPixel(grid, 24, 10, PALETTE.sparkle)
  } else if (frame < 4) {
    // Frame 2-3: Blush + "o" mouth → beginning to enjoy it
    drawBase(grid)
    // Eyes still wide but softening
    drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
    drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
    drawPixel(grid, 14, 12, PALETTE.eyes)
    drawPixel(grid, 19, 12, PALETTE.eyes)
    // Blush appears
    drawRect(grid, 11, 13, 2, 1, PALETTE.blush)
    drawRect(grid, 20, 13, 2, 1, PALETTE.blush)
    // "o" mouth
    drawRect(grid, 15, 15, 2, 2, PALETTE.mouth)
    // Lightning bolt icon
    drawPixel(grid, 26, 2, PALETTE.sparkle)
    drawPixel(grid, 25, 3, PALETTE.sparkle)
    drawRect(grid, 24, 4, 3, 1, PALETTE.sparkle)
    drawPixel(grid, 26, 5, PALETTE.sparkle)
    drawPixel(grid, 25, 6, PALETTE.sparkle)
  } else {
    // Frame 4-5: Comfy — squinty smile, music note, enjoying the charge
    drawBase(grid)
    // Happy squinty eyes
    drawPixel(grid, 13, 12, PALETTE.eyes)
    drawPixel(grid, 14, 11, PALETTE.eyes)
    drawPixel(grid, 15, 12, PALETTE.eyes)
    drawPixel(grid, 18, 12, PALETTE.eyes)
    drawPixel(grid, 19, 11, PALETTE.eyes)
    drawPixel(grid, 20, 12, PALETTE.eyes)
    // Cozy smile
    drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
    drawPixel(grid, 13, 13, PALETTE.mouth)
    drawPixel(grid, 18, 13, PALETTE.mouth)
    // Blush
    drawRect(grid, 11, 13, 2, 1, PALETTE.blush)
    drawRect(grid, 20, 13, 2, 1, PALETTE.blush)
    // Music note
    drawPixel(grid, 25, 3, PALETTE.zzz)
    drawPixel(grid, 26, 2, PALETTE.zzz)
    drawPixel(grid, 26, 3, PALETTE.zzz)
    drawPixel(grid, 26, 4, PALETTE.zzz)
    if (frame === 5) {
      drawPixel(grid, 7, 5, PALETTE.sparkle)
      drawPixel(grid, 24, 8, PALETTE.sparkle)
    }
  }
  return grid
}

function generateUnplugged(frame: number): PixelData {
  const grid = createGrid()

  if (frame < 2) {
    // Frame 0-1: Startled — lean back, "!" eyes, open mouth
    const lean = -1
    drawBase(grid, lean)
    // Surprised eyes — "!" shape
    drawRect(grid, 13, 10 + lean, 2, 3, PALETTE.eyeWhite)
    drawRect(grid, 18, 10 + lean, 2, 3, PALETTE.eyeWhite)
    drawPixel(grid, 13, 10 + lean, PALETTE.eyes)
    drawPixel(grid, 14, 10 + lean, PALETTE.eyes)
    drawPixel(grid, 18, 10 + lean, PALETTE.eyes)
    drawPixel(grid, 19, 10 + lean, PALETTE.eyes)
    // Open mouth
    drawRect(grid, 14, 14 + lean, 4, 2, PALETTE.mouth)
    // Exclamation mark
    drawPixel(grid, 25, 3, PALETTE.sparkle)
    drawPixel(grid, 25, 4, PALETTE.sparkle)
    drawPixel(grid, 25, 6, PALETTE.sparkle)
  } else if (frame < 4) {
    // Frame 2-3: Blinking + question mark floating up
    drawBase(grid)
    // Blinking eyes (one open, one closed alternating)
    if (frame === 2) {
      drawRect(grid, 13, 12, 3, 1, PALETTE.eyes) // left closed
      drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite) // right open
      drawPixel(grid, 19, 12, PALETTE.eyes)
    } else {
      drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite) // left open
      drawPixel(grid, 14, 12, PALETTE.eyes)
      drawRect(grid, 18, 12, 3, 1, PALETTE.eyes) // right closed
    }
    // Small mouth
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
    // Question mark (grey-blue)
    drawPixel(grid, 25, 2, PALETTE.zzz)
    drawPixel(grid, 26, 2, PALETTE.zzz)
    drawPixel(grid, 26, 3, PALETTE.zzz)
    drawPixel(grid, 25, 4, PALETTE.zzz)
    drawPixel(grid, 25, 6, PALETTE.zzz)
  } else {
    // Frame 4-5: Shrug + wry smile — "oh well"
    drawBase(grid)
    // Normal eyes
    drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
    drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
    drawPixel(grid, 14, 12, PALETTE.eyes)
    drawPixel(grid, 19, 12, PALETTE.eyes)
    // Wry/crooked smile
    drawPixel(grid, 14, 15, PALETTE.mouth)
    drawPixel(grid, 15, 14, PALETTE.mouth)
    drawPixel(grid, 16, 14, PALETTE.mouth)
    drawPixel(grid, 17, 15, PALETTE.mouth)
    // Shrug — shoulders/arms raised
    drawRect(grid, 7, 14, 3, 2, PALETTE.skin)
    drawPixel(grid, 7, 13, PALETTE.skin) // left hand up
    drawRect(grid, 22, 14, 3, 2, PALETTE.skin)
    drawPixel(grid, 24, 13, PALETTE.skin) // right hand up
  }
  return grid
}

function generateFullBattery(frame: number): PixelData {
  const grid = createGrid()
  // Jumping dance
  const jump = Math.abs(frame % 4 - 2) * -2
  const sway = frame % 2 === 0 ? 0 : 1
  drawBase(grid, jump)
  // Big smile
  drawRect(grid, 14 + sway, 14 + jump, 4, 2, PALETTE.mouth)
  // Happy squinted eyes
  drawPixel(grid, 13 + sway, 11 + jump, PALETTE.eyes)
  drawPixel(grid, 14 + sway, 10 + jump, PALETTE.eyes)
  drawPixel(grid, 15 + sway, 11 + jump, PALETTE.eyes)
  drawPixel(grid, 18 + sway, 11 + jump, PALETTE.eyes)
  drawPixel(grid, 19 + sway, 10 + jump, PALETTE.eyes)
  drawPixel(grid, 20 + sway, 11 + jump, PALETTE.eyes)
  // Blush
  drawRect(grid, 11 + sway, 13 + jump, 2, 1, PALETTE.blush)
  drawRect(grid, 20 + sway, 13 + jump, 2, 1, PALETTE.blush)
  // Arms waving
  const armY = 12 + jump + (frame % 2 === 0 ? -1 : 1)
  drawRect(grid, 7, armY, 3, 2, PALETTE.skin)
  drawRect(grid, 22, armY - (frame % 2), 3, 2, PALETTE.skin)
  // Full battery icon
  drawRect(grid, 24, 2, 5, 3, PALETTE.eyes)   // battery outline
  drawRect(grid, 29, 3, 1, 1, PALETTE.eyes)   // nub
  drawRect(grid, 25, 3, 3, 1, '#50E850')      // green = full
  // Confetti sparkles
  const sp = frame % 8
  drawPixel(grid, 4 + sp, 2 + (sp % 3), PALETTE.sparkle)
  drawPixel(grid, 28 - sp, 1 + (sp % 2), PALETTE.sparkle)
  drawPixel(grid, 6 + (sp * 2 % 7), 5, PALETTE.body)
  return grid
}

// ── Memory interactive states ──

function generateSipping(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)

  // Cup is on the desk except when held (frames 2-4)
  const cupOnDesk = frame <= 1 || frame >= 5

  if (cupOnDesk) {
    drawCoffeeCup(grid, 3, 23)
  }

  if (frame === 0) {
    // Sitting, cup on desk with steam
    drawSteam(grid, 4, 22, 0)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame === 1) {
    // Reach for the cup
    drawRect(grid, 9, 20, 2, 2, PALETTE.skin)
    drawRect(grid, 6, 22, 2, 2, PALETTE.skin)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
    drawPixel(grid, 13, 12, PALETTE.eyes)
    drawPixel(grid, 18, 12, PALETTE.eyes)
  } else if (frame === 2) {
    // Lift cup mid-air
    drawRect(grid, 6, 19, 2, 2, PALETTE.skin)
    drawRect(grid, 5, 17, 3, 3, '#B8860B')
    drawRect(grid, 5, 17, 3, 1, '#D4A060')
    drawPixel(grid, 6, 18, '#5C3317')
    drawPixel(grid, 8, 18, '#B8860B')
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame === 3) {
    // Cup at mouth, drinking
    drawRect(grid, 8, 15, 2, 2, PALETTE.skin)
    drawRect(grid, 9, 13, 3, 3, '#B8860B')
    drawRect(grid, 9, 13, 3, 1, '#D4A060')
    drawPixel(grid, 10, 14, '#5C3317')
    drawPixel(grid, 12, 14, '#B8860B')
    drawRect(grid, 12, 14, 2, 2, PALETTE.mouth)
    drawPixel(grid, 14, 12, PALETTE.eyes)
    drawPixel(grid, 19, 12, PALETTE.eyes)
  } else if (frame === 4) {
    // Lowering cup back
    drawRect(grid, 6, 19, 2, 2, PALETTE.skin)
    drawRect(grid, 5, 17, 3, 3, '#B8860B')
    drawRect(grid, 5, 17, 3, 1, '#D4A060')
    drawPixel(grid, 6, 18, '#5C3317')
    drawPixel(grid, 8, 18, '#B8860B')
    // Savoring expression
    drawPixel(grid, 13, 12, PALETTE.eyes)
    drawPixel(grid, 14, 11, PALETTE.eyes)
    drawPixel(grid, 15, 12, PALETTE.eyes)
    drawPixel(grid, 18, 12, PALETTE.eyes)
    drawPixel(grid, 19, 11, PALETTE.eyes)
    drawPixel(grid, 20, 12, PALETTE.eyes)
    drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
    drawPixel(grid, 13, 13, PALETTE.mouth)
    drawPixel(grid, 18, 13, PALETTE.mouth)
    drawRect(grid, 11, 13, 2, 1, PALETTE.blush)
    drawRect(grid, 20, 13, 2, 1, PALETTE.blush)
  } else if (frame === 5) {
    // Cup back on desk, still savoring
    drawPixel(grid, 13, 12, PALETTE.eyes)
    drawPixel(grid, 14, 11, PALETTE.eyes)
    drawPixel(grid, 15, 12, PALETTE.eyes)
    drawPixel(grid, 18, 12, PALETTE.eyes)
    drawPixel(grid, 19, 11, PALETTE.eyes)
    drawPixel(grid, 20, 12, PALETTE.eyes)
    drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
    drawPixel(grid, 13, 13, PALETTE.mouth)
    drawPixel(grid, 18, 13, PALETTE.mouth)
    drawRect(grid, 11, 13, 2, 1, PALETTE.blush)
    drawRect(grid, 20, 13, 2, 1, PALETTE.blush)
  } else {
    // Frames 6-7: idle wait with cup on desk, steam rising
    drawSteam(grid, 4, 22, frame)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  }
  return grid
}

function generateCrumpling(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)

  // Existing paper balls on desk (accumulated mess)
  drawPaperBall(grid, 2, 24)
  drawCoffeeCup(grid, 3, 22)

  if (frame === 0) {
    // Looking down at paper on desk, writing
    drawRect(grid, 8, 24, 3, 2, PALETTE.eyeWhite) // paper
    drawPixel(grid, 9, 24, '#333333') // "writing"
    drawPixel(grid, 10, 25, '#333333')
    drawRect(grid, 11, 23, 2, 2, PALETTE.skin) // hand with pen
    drawPixel(grid, 12, 22, '#333333') // pen tip
    // Eyes looking down
    drawPixel(grid, 14, 13, PALETTE.eyes)
    drawPixel(grid, 19, 13, PALETTE.eyes)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame === 1) {
    // Still writing
    drawRect(grid, 8, 24, 3, 2, PALETTE.eyeWhite)
    drawPixel(grid, 9, 25, '#333333')
    drawPixel(grid, 10, 24, '#333333')
    drawRect(grid, 11, 23, 2, 2, PALETTE.skin)
    drawPixel(grid, 13, 22, '#333333')
    drawPixel(grid, 14, 13, PALETTE.eyes)
    drawPixel(grid, 19, 13, PALETTE.eyes)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame === 2) {
    // Stops, looks at it, frowns
    drawRect(grid, 8, 24, 3, 2, PALETTE.eyeWhite)
    drawPixel(grid, 9, 24, '#333333')
    drawPixel(grid, 10, 25, '#333333')
    // Frown
    drawPixel(grid, 14, 15, PALETTE.mouth)
    drawPixel(grid, 15, 16, PALETTE.mouth)
    drawPixel(grid, 16, 16, PALETTE.mouth)
    drawPixel(grid, 17, 15, PALETTE.mouth)
    // Eyebrows furrowed
    drawRect(grid, 13, 10, 3, 1, PALETTE.hair)
    drawRect(grid, 18, 10, 3, 1, PALETTE.hair)
  } else if (frame === 3) {
    // Both hands grab paper, crumpling
    drawRect(grid, 9, 22, 2, 2, PALETTE.skin) // left hand
    drawRect(grid, 12, 22, 2, 2, PALETTE.skin) // right hand
    // Paper getting smaller/irregular
    drawPixel(grid, 10, 23, PALETTE.eyeWhite)
    drawRect(grid, 11, 22, 1, 2, PALETTE.eyeWhite)
    drawPixel(grid, 12, 23, '#C8C8B8')
    // Mouth determined
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame === 4) {
    // Arm swings — tossing the paper ball
    drawRect(grid, 7, 18, 3, 2, PALETTE.skin) // arm extended left
    // Paper ball in mid-air
    drawPaperBall(grid, 4, 20)
    // Mouth: effort
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else {
    // Sigh, new paper ball landed on desk
    drawPaperBall(grid, 6, 24) // new ball
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
    // Small sigh — open mouth
    drawRect(grid, 15, 15, 2, 2, PALETTE.mouth)
    // Exasperated eyes look up
    drawPixel(grid, 14, 11, PALETTE.eyes)
    drawPixel(grid, 19, 11, PALETTE.eyes)
  }
  return grid
}

function generateRummaging(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)

  // Full messy desk
  drawCoffeeCup(grid, 3, 22)
  drawPaperBall(grid, 2, 24)
  drawPaperBall(grid, 6, 24)
  drawPaperBall(grid, 8, 23)
  // Books
  drawRect(grid, 1, 21, 3, 2, '#C06070')
  drawRect(grid, 1, 21, 3, 1, '#D08090')
  // Sticky note
  drawRect(grid, 5, 21, 2, 2, '#FFE855')

  if (frame === 0) {
    // Eyes scanning left
    drawPixel(grid, 13, 12, PALETTE.eyes)
    drawPixel(grid, 18, 12, PALETTE.eyes)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame === 1) {
    // Eyes scanning right
    drawPixel(grid, 15, 12, PALETTE.eyes)
    drawPixel(grid, 20, 12, PALETTE.eyes)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame === 2) {
    // Left hand flipping through stuff, body leans forward
    drawRect(grid, 7, 21, 3, 2, PALETTE.skin) // hand digging
    drawPixel(grid, 14, 12, PALETTE.eyes)
    drawPixel(grid, 19, 12, PALETTE.eyes)
    // Furrowed brows
    drawRect(grid, 13, 10, 3, 1, PALETTE.hair)
    drawRect(grid, 18, 10, 3, 1, PALETTE.hair)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame === 3) {
    // Right hand scratching head, confused
    drawRect(grid, 21, 7, 3, 3, PALETTE.skin)  // hand on head
    drawRect(grid, 22, 6, 1, 1, PALETTE.skin)  // fingers
    // Confused mouth
    drawPixel(grid, 15, 15, PALETTE.mouth)
    drawPixel(grid, 16, 16, PALETTE.mouth)
    // Spiral above head (confusion)
    drawPixel(grid, 15, 2, PALETTE.zzz)
    drawPixel(grid, 16, 1, PALETTE.zzz)
    drawPixel(grid, 17, 2, PALETTE.zzz)
    drawPixel(grid, 17, 3, PALETTE.zzz)
    drawPixel(grid, 16, 4, PALETTE.zzz)
    drawPixel(grid, 15, 3, PALETTE.zzz)
  } else if (frame === 4) {
    // Both hands pushing stuff aside
    drawRect(grid, 7, 22, 3, 2, PALETTE.skin) // left arm
    drawRect(grid, 20, 22, 3, 2, PALETTE.skin) // right arm
    // Eyes wide, frustrated
    drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
    drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
    drawPixel(grid, 13, 12, PALETTE.eyes)
    drawPixel(grid, 18, 12, PALETTE.eyes)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
    // Spiral still there
    drawPixel(grid, 14, 2, PALETTE.zzz)
    drawPixel(grid, 15, 1, PALETTE.zzz)
    drawPixel(grid, 16, 2, PALETTE.zzz)
    drawPixel(grid, 16, 3, PALETTE.zzz)
  } else {
    // Slumps, hands on desk, head down slightly, sigh
    drawRect(grid, 8, 23, 3, 2, PALETTE.skin) // left hand on desk
    drawRect(grid, 19, 23, 3, 2, PALETTE.skin) // right hand on desk
    // Head droops
    drawPixel(grid, 14, 13, PALETTE.eyes)
    drawPixel(grid, 19, 13, PALETTE.eyes)
    // Open mouth sigh
    drawRect(grid, 15, 16, 2, 1, PALETTE.mouth)
    // Spiral
    drawPixel(grid, 15, 2, PALETTE.zzz)
    drawPixel(grid, 16, 1, PALETTE.zzz)
    drawPixel(grid, 17, 2, PALETTE.zzz)
    drawPixel(grid, 17, 3, PALETTE.zzz)
    drawPixel(grid, 16, 4, PALETTE.zzz)
    drawPixel(grid, 15, 3, PALETTE.zzz)
  }
  return grid
}

// ── Reminder animations ──

function generateDrinking(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Water cup: light blue
  const cupColor = '#60B0E0'
  const waterColor = '#80D0FF'

  if (frame < 2) {
    // Cup on desk, hand reaching
    drawRect(grid, 6, 23, 3, 3, cupColor)
    drawRect(grid, 7, 24, 1, 1, waterColor)
    drawRect(grid, 8, 22 - frame, 3, 2, PALETTE.skin) // hand reaching
  } else if (frame < 4) {
    // Lifting cup
    const liftY = 20 - (frame - 2) * 4
    drawRect(grid, 8, liftY, 3, 3, cupColor)
    drawRect(grid, 9, liftY + 1, 1, 1, waterColor)
    drawRect(grid, 8, liftY + 3, 3, 1, PALETTE.skin) // hand holding
  } else if (frame < 6) {
    // Drinking - cup at mouth
    drawRect(grid, 12, 13, 3, 3, cupColor)
    drawRect(grid, 13, 14, 1, 1, waterColor)
    drawRect(grid, 12, 16, 3, 1, PALETTE.skin)
    // Closed happy eyes
    drawRect(grid, 13, 11, 2, 1, PALETTE.eyes)
    drawRect(grid, 18, 11, 2, 1, PALETTE.eyes)
    // Sparkle (refreshed)
    if (frame === 5) {
      drawPixel(grid, 24, 5, PALETTE.sparkle)
      drawPixel(grid, 25, 4, PALETTE.sparkle)
      drawPixel(grid, 26, 5, PALETTE.sparkle)
    }
  } else {
    // Lowering cup back, satisfied face
    const lowerY = 16 + (frame - 6) * 4
    drawRect(grid, 8, lowerY, 3, 3, cupColor)
    drawRect(grid, 9, lowerY + 1, 1, 1, waterColor)
    drawRect(grid, 8, lowerY + 3, 3, 1, PALETTE.skin)
    // Smile
    drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
    drawPixel(grid, 13, 13, PALETTE.mouth)
    drawPixel(grid, 18, 13, PALETTE.mouth)
  }
  // Mouth (when not drinking)
  if (frame < 4 || frame >= 6) {
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  }
  return grid
}

function generateStretching(frame: number): PixelData {
  const grid = createGrid()
  if (frame < 2) {
    // Still seated, about to stand
    drawBase(grid)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame < 5) {
    // Standing up - no desk items, body rises
    const riseY = 2 - (frame - 2)
    // Desk remains
    drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
    drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
    // Body standing (taller)
    drawRect(grid, 12, 16 + riseY, 8, 10, PALETTE.body)
    drawRect(grid, 13, 17 + riseY, 6, 8, PALETTE.bodyShadow)
    // Head
    drawRect(grid, 10, 4 + riseY, 12, 12, PALETTE.skin)
    drawRect(grid, 11, 5 + riseY, 10, 10, PALETTE.skin)
    // Hair
    drawRect(grid, 10, 3 + riseY, 12, 3, PALETTE.hair)
    drawRect(grid, 9, 4 + riseY, 2, 4, PALETTE.hair)
    drawRect(grid, 21, 4 + riseY, 2, 4, PALETTE.hair)
    // Eyes
    drawRect(grid, 13, 9 + riseY, 2, 2, PALETTE.eyeWhite)
    drawRect(grid, 18, 9 + riseY, 2, 2, PALETTE.eyeWhite)
    drawPixel(grid, 14, 10 + riseY, PALETTE.eyes)
    drawPixel(grid, 19, 10 + riseY, PALETTE.eyes)
    // Arms stretching up
    const armUp = frame - 2
    drawRect(grid, 7, 10 + riseY - armUp * 2, 3, 2, PALETTE.skin)
    drawRect(grid, 22, 10 + riseY - armUp * 2, 3, 2, PALETTE.skin)
    drawRect(grid, 15, 13 + riseY, 2, 1, PALETTE.mouth)
  } else {
    // Arms fully up, stretch hold
    drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
    drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
    drawRect(grid, 12, 14, 8, 12, PALETTE.body)
    drawRect(grid, 13, 15, 6, 10, PALETTE.bodyShadow)
    drawRect(grid, 10, 2, 12, 12, PALETTE.skin)
    drawRect(grid, 11, 3, 10, 10, PALETTE.skin)
    drawRect(grid, 10, 1, 12, 3, PALETTE.hair)
    drawRect(grid, 9, 2, 2, 4, PALETTE.hair)
    drawRect(grid, 21, 2, 2, 4, PALETTE.hair)
    // Happy closed eyes
    drawRect(grid, 13, 7, 2, 1, PALETTE.eyes)
    drawRect(grid, 18, 7, 2, 1, PALETTE.eyes)
    // Arms way up
    const wave = frame % 2 === 0 ? 0 : 1
    drawRect(grid, 6, 4 + wave, 4, 2, PALETTE.skin)
    drawRect(grid, 22, 4 - wave, 4, 2, PALETTE.skin)
    // Smile
    drawRect(grid, 14, 11, 4, 1, PALETTE.mouth)
    drawPixel(grid, 13, 10, PALETTE.mouth)
    drawPixel(grid, 18, 10, PALETTE.mouth)
    // Sparkles
    drawPixel(grid, 4, 2, PALETTE.sparkle)
    drawPixel(grid, 27, 1, PALETTE.sparkle)
  }
  return grid
}

function generateEyerest(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  if (frame < 2) {
    // Hands rising to cover eyes
    const handY = 16 - frame * 3
    drawRect(grid, 10, handY, 4, 3, PALETTE.skin)
    drawRect(grid, 18, handY, 4, 3, PALETTE.skin)
    drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  } else if (frame < 5) {
    // Eyes covered by hands
    drawRect(grid, 10, 10, 5, 4, PALETTE.skin)
    drawRect(grid, 17, 10, 5, 4, PALETTE.skin)
    // Peaceful mouth
    drawRect(grid, 14, 15, 4, 1, PALETTE.mouth)
    drawPixel(grid, 13, 14, PALETTE.mouth)
    drawPixel(grid, 18, 14, PALETTE.mouth)
    // Z particles for rest
    if (frame >= 3) {
      drawPixel(grid, 24, 4, PALETTE.zzz)
      drawPixel(grid, 25, 3, PALETTE.zzz)
      drawPixel(grid, 26, 4, PALETTE.zzz)
    }
    if (frame >= 4) {
      drawPixel(grid, 26, 2, PALETTE.zzz)
      drawPixel(grid, 27, 1, PALETTE.zzz)
    }
  } else {
    // Hands lowering, refreshed eyes
    drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
    drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
    drawPixel(grid, 13, 11, PALETTE.eyes)
    drawPixel(grid, 18, 11, PALETTE.eyes)
    // Sparkle eyes (refreshed!)
    drawPixel(grid, 12, 10, PALETTE.sparkle)
    drawPixel(grid, 21, 10, PALETTE.sparkle)
    // Smile
    drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
    drawPixel(grid, 13, 13, PALETTE.mouth)
    drawPixel(grid, 18, 13, PALETTE.mouth)
  }
  return grid
}

// ── Autonomous life animations ──

function generateReading(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Book on desk
  const bookColor = '#C05050'
  const pageColor = '#FFF8E0'
  drawRect(grid, 7, 22, 8, 4, bookColor)
  drawRect(grid, 8, 22, 6, 3, pageColor)
  // Hands holding book
  drawRect(grid, 7, 23, 2, 2, PALETTE.skin)
  drawRect(grid, 14, 23, 2, 2, PALETTE.skin)
  // Eyes looking down at book
  drawRect(grid, 13, 12, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 12, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14, 13, PALETTE.eyes)
  drawPixel(grid, 19, 13, PALETTE.eyes)
  // Calm mouth
  drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  // Page turn animation
  if (frame % 4 === 2) {
    drawRect(grid, 11, 21, 1, 3, pageColor) // flipping page
  }
  return grid
}

function generateTidying(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Arm with cloth wiping desk
  const wipeX = 6 + (frame % 6) * 3
  drawRect(grid, wipeX, 24, 4, 2, PALETTE.skin)
  drawRect(grid, wipeX + 1, 25, 2, 1, '#E0E0E0') // cloth
  // Focused expression
  drawRect(grid, 15, 15, 2, 1, PALETTE.mouth)
  // Sparkle when clean
  if (frame >= 4) {
    drawPixel(grid, 8, 22, PALETTE.sparkle)
    drawPixel(grid, 20, 23, PALETTE.sparkle)
  }
  return grid
}

function generateDaydreaming(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Hand on chin
  drawRect(grid, 20, 14, 3, 3, PALETTE.skin)
  // Eyes looking up and to the side
  drawRect(grid, 13, 10, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 10, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 13, 10, PALETTE.eyes) // looking up-left
  drawPixel(grid, 18, 10, PALETTE.eyes)
  // Dreamy smile
  drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
  drawPixel(grid, 13, 13, PALETTE.mouth)
  drawPixel(grid, 18, 13, PALETTE.mouth)
  // Thought bubbles
  const bubbleY = frame % 2 === 0 ? 0 : -1
  drawPixel(grid, 24, 6 + bubbleY, '#FFFFFF')
  drawPixel(grid, 26, 4 + bubbleY, '#FFFFFF')
  drawRect(grid, 25, 1 + bubbleY, 3, 2, '#FFFFFF')
  return grid
}

function generateNapping(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Head resting on arms on desk
  drawRect(grid, 10, 18, 12, 3, PALETTE.skin) // arms flat
  drawRect(grid, 11, 15, 10, 4, PALETTE.skin) // head sideways on arms
  drawRect(grid, 11, 14, 10, 2, PALETTE.hair) // hair
  // Closed eyes (lines)
  drawRect(grid, 13, 17, 2, 1, PALETTE.eyes)
  drawRect(grid, 18, 17, 2, 1, PALETTE.eyes)
  // Blush
  drawRect(grid, 11, 18, 2, 1, PALETTE.blush)
  drawRect(grid, 20, 18, 2, 1, PALETTE.blush)
  // Zzz
  const zOff = frame % 4
  drawPixel(grid, 24, 10 - zOff, PALETTE.zzz)
  if (zOff > 0) drawPixel(grid, 25, 8 - zOff, PALETTE.zzz)
  if (zOff > 1) drawPixel(grid, 26, 6 - zOff, PALETTE.zzz)
  return grid
}

function generateSlacking(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Phone in hand (small bright rectangle)
  const phoneColor = '#333333'
  const screenColor = '#60D0FF'
  drawRect(grid, 8, 16, 4, 6, phoneColor)
  drawRect(grid, 9, 17, 2, 4, screenColor)
  // Hand holding phone
  drawRect(grid, 7, 18, 2, 3, PALETTE.skin)
  drawRect(grid, 12, 18, 2, 3, PALETTE.skin)
  // Sneaky grin
  drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
  drawPixel(grid, 18, 13, PALETTE.mouth)
  // Eyes on phone (looking down-left)
  drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 13, 12, PALETTE.eyes)
  drawPixel(grid, 18, 12, PALETTE.eyes)
  // Screen flicker
  if (frame % 2 === 0) {
    drawPixel(grid, 9, 17, '#80E0FF')
  }
  return grid
}

function generateGaming(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Headphones on head
  const hpColor = '#444444'
  drawRect(grid, 8, 5, 16, 2, hpColor) // band
  drawRect(grid, 8, 7, 3, 4, hpColor)  // left ear cup
  drawRect(grid, 21, 7, 3, 4, hpColor) // right ear cup
  drawPixel(grid, 9, 8, '#666666')     // left cushion
  drawPixel(grid, 22, 8, '#666666')    // right cushion
  // Keyboard - hands mashing
  drawRect(grid, 8, 24, 16, 2, '#555555')
  const armL = frame % 2 === 0 ? 9 : 10
  const armR = frame % 2 === 0 ? 20 : 19
  drawRect(grid, armL, 22, 3, 2, PALETTE.skin)
  drawRect(grid, armR, 22, 3, 2, PALETTE.skin)
  // Excited expression
  drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
  // Eyes focused on screen
  drawPixel(grid, 14, 12, PALETTE.eyes)
  drawPixel(grid, 19, 12, PALETTE.eyes)
  // Open mouth excited
  if (frame % 4 < 2) {
    drawRect(grid, 15, 14, 2, 2, PALETTE.mouth)
  } else {
    drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
    drawPixel(grid, 13, 13, PALETTE.mouth)
    drawPixel(grid, 18, 13, PALETTE.mouth)
  }
  // Monitor glow (game screen)
  const glowColors = ['#40FF40', '#FF4040', '#4040FF', '#FFFF40']
  const glow = glowColors[frame % 4]
  drawPixel(grid, 26, 17, glow)
  drawPixel(grid, 27, 18, glow)
  return grid
}

function generateDancing(frame: number): PixelData {
  const grid = createGrid()
  // Desk stays
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Standing body, bouncing
  const bounce = frame % 2 === 0 ? 0 : -1
  const sway = (frame % 4 < 2) ? -1 : 1
  // Body
  drawRect(grid, 12 + sway, 14 + bounce, 8, 12, PALETTE.body)
  drawRect(grid, 13 + sway, 15 + bounce, 6, 10, PALETTE.bodyShadow)
  // Head
  drawRect(grid, 10 + sway, 2 + bounce, 12, 12, PALETTE.skin)
  drawRect(grid, 11 + sway, 3 + bounce, 10, 10, PALETTE.skin)
  // Hair
  drawRect(grid, 10 + sway, 1 + bounce, 12, 3, PALETTE.hair)
  drawRect(grid, 9 + sway, 2 + bounce, 2, 4, PALETTE.hair)
  drawRect(grid, 21 + sway, 2 + bounce, 2, 4, PALETTE.hair)
  // Happy closed eyes
  drawRect(grid, 13 + sway, 7 + bounce, 2, 1, PALETTE.eyes)
  drawRect(grid, 18 + sway, 7 + bounce, 2, 1, PALETTE.eyes)
  // Big smile
  drawRect(grid, 14 + sway, 10 + bounce, 4, 1, PALETTE.mouth)
  drawPixel(grid, 13 + sway, 9 + bounce, PALETTE.mouth)
  drawPixel(grid, 18 + sway, 9 + bounce, PALETTE.mouth)
  // Arms waving
  const armPhase = frame % 4
  const armLY = armPhase < 2 ? 6 : 10
  const armRY = armPhase < 2 ? 10 : 6
  drawRect(grid, 5 + sway, armLY + bounce, 4, 2, PALETTE.skin)
  drawRect(grid, 23 + sway, armRY + bounce, 4, 2, PALETTE.skin)
  // Music notes
  drawPixel(grid, 3, 4 - (frame % 3), PALETTE.sparkle)
  drawPixel(grid, 28, 3 - (frame % 3), PALETTE.sparkle)
  drawPixel(grid, 5, 2 - (frame % 2), '#FF80C0')
  return grid
}

function generateDoodling(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Paper on desk
  drawRect(grid, 6, 22, 10, 4, '#FFFFFF')
  drawRect(grid, 7, 23, 8, 2, '#F0F0F0')
  // Pen in hand
  const penX = 8 + (frame % 6)
  drawRect(grid, penX, 22, 1, 3, '#333333')
  drawPixel(grid, penX, 22, '#FF4040') // pen tip
  drawRect(grid, penX - 1, 23, 3, 2, PALETTE.skin) // hand
  // Drawing lines appear progressively
  if (frame > 0) drawPixel(grid, 9, 23, '#4A90D9')
  if (frame > 1) drawPixel(grid, 10, 24, '#4A90D9')
  if (frame > 2) drawPixel(grid, 11, 23, '#FF6060')
  if (frame > 3) drawPixel(grid, 12, 24, '#60C060')
  if (frame > 4) drawPixel(grid, 13, 23, '#FFD93D')
  // Focused happy expression
  drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 13, 12, PALETTE.eyes)
  drawPixel(grid, 18, 12, PALETTE.eyes)
  drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
  drawPixel(grid, 13, 13, PALETTE.mouth)
  drawPixel(grid, 18, 13, PALETTE.mouth)
  return grid
}

// ── Scene Awareness Animations (V2) ──

/** Coding scene: typing intensely with rubber duck on desk */
function generateSceneCoding(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Intense typing - arms alternate fast
  const armX = frame % 2 === 0 ? 8 : 10
  drawRect(grid, armX, 22, 3, 2, PALETTE.skin)
  drawRect(grid, 19 + (frame % 2), 22, 3, 2, PALETTE.skin)
  // Keyboard
  drawRect(grid, 8, 24, 16, 2, '#555555')
  // Rubber duck on desk (right)
  drawRect(grid, 4, 23, 3, 3, '#FFD93D') // body
  drawRect(grid, 4, 22, 2, 1, '#FFD93D') // head
  drawPixel(grid, 4, 22, '#333333')       // eye
  drawPixel(grid, 3, 23, '#FF8C00')       // beak
  // Monitor with green code text
  drawRect(grid, 25, 16, 6, 10, '#1E1E1E')
  drawPixel(grid, 26, 17, '#4EC9B0')
  drawPixel(grid, 27, 17, '#4EC9B0')
  drawPixel(grid, 29, 17, '#DCDCAA')
  drawPixel(grid, 26, 19, '#569CD6')
  drawPixel(grid, 27, 19, '#569CD6')
  drawPixel(grid, 28, 19, '#9CDCFE')
  drawPixel(grid, 26, 21, '#CE9178')
  drawPixel(grid, 27, 21, '#CE9178')
  // Focused eyes
  drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14, 12, PALETTE.eyes)
  drawPixel(grid, 19, 12, PALETTE.eyes)
  drawPixel(grid, 15, 15, PALETTE.mouth)
  return grid
}

/** Writing scene: reading/typing thoughtfully, papers on desk */
function generateSceneWriting(frame: number): PixelData {
  const grid = createGrid()
  const headTilt = frame >= 2 ? 1 : 0
  drawBase(grid, headTilt)
  // Papers on desk
  drawRect(grid, 3, 23, 6, 3, '#FFFFFF')
  drawRect(grid, 4, 24, 4, 1, '#CCCCCC')
  drawRect(grid, 5, 22, 5, 3, '#F8F8F0')
  drawRect(grid, 6, 23, 3, 1, '#CCCCCC')
  // Reference book
  drawRect(grid, 22, 22, 4, 4, '#8B4513')
  drawRect(grid, 23, 23, 2, 2, '#D2B48C')
  // Glasses on face
  drawRect(grid, 12, 10 + headTilt, 3, 3, 'rgba(100,100,100,0.4)')
  drawRect(grid, 17, 10 + headTilt, 3, 3, 'rgba(100,100,100,0.4)')
  drawPixel(grid, 15, 11 + headTilt, '#888888') // bridge
  drawPixel(grid, 16, 11 + headTilt, '#888888')
  // Eyes behind glasses
  drawRect(grid, 13, 11 + headTilt, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11 + headTilt, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14, 12 + headTilt, PALETTE.eyes)
  drawPixel(grid, 19, 12 + headTilt, PALETTE.eyes)
  // Thoughtful mouth
  drawRect(grid, 15, 15 + headTilt, 2, 1, PALETTE.mouth)
  return grid
}

/** Design scene: painting on tiny easel */
function generateSceneDesign(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Easel on desk
  drawRect(grid, 3, 19, 7, 7, '#D2B48C') // canvas
  drawRect(grid, 4, 20, 5, 5, '#FFFFFF')
  drawPixel(grid, 3, 26, '#8B4513') // leg
  drawPixel(grid, 9, 26, '#8B4513')
  // Color swatches on canvas (progress by frame)
  const colors = ['#FF4040', '#4A90D9', '#60C060', '#FFD93D']
  for (let i = 0; i <= Math.min(frame, 3); i++) {
    drawRect(grid, 5 + i, 21 + (i % 2), 1, 2, colors[i])
  }
  // Paint brush in hand
  drawRect(grid, 8, 22, 1, 3, '#8B4513')
  drawPixel(grid, 8, 22, colors[frame % 4])
  drawRect(grid, 7, 23, 3, 2, PALETTE.skin) // hand
  // Squinting eyes
  drawRect(grid, 13, 12, 3, 1, PALETTE.eyes)
  drawRect(grid, 18, 12, 3, 1, PALETTE.eyes)
  drawPixel(grid, 15, 15, PALETTE.mouth)
  return grid
}

/** Meeting scene: sitting up straight, taking notes */
function generateSceneMeeting(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid, -1) // sitting up straighter
  // Notepad on desk
  drawRect(grid, 4, 22, 5, 4, '#FFFFCC')
  // Pen marks appear
  if (frame >= 1) drawPixel(grid, 5, 23, '#333333')
  if (frame >= 2) { drawPixel(grid, 6, 24, '#333333'); drawPixel(grid, 7, 23, '#333333') }
  if (frame >= 3) drawPixel(grid, 5, 24, '#333333')
  // Pen in hand
  drawRect(grid, 8, 22, 1, 3, '#333333')
  drawRect(grid, 7, 23, 3, 2, PALETTE.skin)
  // Monitor showing meeting
  drawRect(grid, 25, 16, 6, 10, '#2C2C2C')
  drawRect(grid, 26, 18, 2, 2, '#4A90D9') // person icon 1
  drawRect(grid, 29, 18, 2, 2, '#60C060') // person icon 2
  drawRect(grid, 26, 21, 2, 2, '#FFD93D') // person icon 3
  // Attentive eyes
  drawRect(grid, 13, 10, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 10, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14, 11, PALETTE.eyes)
  drawPixel(grid, 19, 11, PALETTE.eyes)
  drawRect(grid, 15, 14, 2, 1, PALETTE.mouth)
  return grid
}

/** Distraction fidget: tapping foot, glancing around */
function generateSceneFidget(frame: number): PixelData {
  const grid = createGrid()
  const sway = frame % 2 === 0 ? 0 : 1
  drawBase(grid, sway)
  // Worried eyes (glancing left/right)
  drawRect(grid, 13, 11 + sway, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11 + sway, 2, 2, PALETTE.eyeWhite)
  const eyeShift = frame % 4 < 2 ? 0 : 1
  drawPixel(grid, 13 + eyeShift, 12 + sway, PALETTE.eyes)
  drawPixel(grid, 18 + eyeShift, 12 + sway, PALETTE.eyes)
  // Worried mouth
  drawRect(grid, 14, 15 + sway, 3, 1, PALETTE.mouth)
  drawPixel(grid, 14, 14 + sway, PALETTE.mouth)
  drawPixel(grid, 16, 14 + sway, PALETTE.mouth) // wavy worry line
  // Tapping foot
  if (frame % 2 === 0) {
    drawPixel(grid, 14, 27, PALETTE.body)
  }
  // Sweat drop
  if (frame >= 2) {
    drawPixel(grid, 22, 8 + sway, '#88CCFF')
  }
  return grid
}

/** Give up: lying down with a book, chill */
function generateSceneGiveup(frame: number): PixelData {
  const grid = createGrid()
  // Desk
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Character lying on desk
  drawRect(grid, 6, 20, 20, 6, PALETTE.body)
  drawRect(grid, 7, 21, 18, 4, PALETTE.bodyShadow)
  // Head resting on arms
  drawRect(grid, 5, 17, 10, 5, PALETTE.skin)
  drawRect(grid, 6, 18, 8, 3, PALETTE.skin)
  // Hair
  drawRect(grid, 5, 16, 10, 2, PALETTE.hair)
  // Closed content eyes
  drawRect(grid, 7, 19, 2, 1, PALETTE.eyes)
  drawRect(grid, 11, 19, 2, 1, PALETTE.eyes)
  // Tiny smile
  drawPixel(grid, 9, 20, PALETTE.mouth)
  drawPixel(grid, 10, 20, PALETTE.mouth)
  // Book propped up
  const bookBob = frame % 2
  drawRect(grid, 18, 18 + bookBob, 6, 5, '#8B4513')
  drawRect(grid, 19, 19 + bookBob, 4, 3, '#F5DEB3')
  drawPixel(grid, 20, 20 + bookBob, '#333333')
  drawPixel(grid, 21, 20 + bookBob, '#333333')
  return grid
}

/** Build success celebration: fireworks */
function generateCelebrate(frame: number): PixelData {
  const grid = createGrid()
  const jump = frame < 4 ? -frame * 2 : -(7 - frame) * 2
  drawBase(grid, Math.min(jump, 0))
  const off = Math.min(jump, 0)
  // Big grin
  drawRect(grid, 13, 14 + off, 6, 2, PALETTE.mouth)
  // Blush
  drawRect(grid, 11, 13 + off, 2, 1, PALETTE.blush)
  drawRect(grid, 20, 13 + off, 2, 1, PALETTE.blush)
  // Fireworks/sparkles
  const sparkleColors = ['#FF4040', '#FFD93D', '#4A90D9', '#60C060', '#FF69B4']
  if (frame >= 1) {
    for (let i = 0; i < 5; i++) {
      const sx = 3 + (i * 6) + ((frame * 3 + i) % 4)
      const sy = 2 + ((frame + i) % 3)
      drawPixel(grid, sx, sy, sparkleColors[i])
      drawPixel(grid, sx + 1, sy + 1, sparkleColors[(i + 2) % 5])
    }
  }
  // Raised arms
  if (frame >= 2 && frame <= 6) {
    drawRect(grid, 7, 10 + off, 3, 2, PALETTE.skin)
    drawRect(grid, 22, 10 + off, 3, 2, PALETTE.skin)
  }
  return grid
}

/** Build error: comforting animation */
function generateComforting(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Caring eyes (looking at screen sympathetically)
  drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14, 12, PALETTE.eyes)
  drawPixel(grid, 19, 12, PALETTE.eyes)
  // Worried eyebrows
  drawPixel(grid, 12, 10, PALETTE.hair)
  drawPixel(grid, 13, 9, PALETTE.hair)
  drawPixel(grid, 20, 10, PALETTE.hair)
  drawPixel(grid, 19, 9, PALETTE.hair)
  // Concerned mouth
  drawRect(grid, 14, 15, 4, 1, PALETTE.mouth)
  // Pat animation: hand reaching toward screen
  const pat = frame % 6
  if (pat < 3) {
    drawRect(grid, 22 + pat, 18, 3, 2, PALETTE.skin) // hand reaching
  }
  // Heart above head (comfort)
  if (frame >= 3) {
    drawPixel(grid, 7, 3, '#FF6B8A')
    drawPixel(grid, 8, 2, '#FF6B8A')
    drawPixel(grid, 9, 3, '#FF6B8A')
    drawPixel(grid, 8, 4, '#FF6B8A')
  }
  // Monitor showing red error
  drawRect(grid, 25, 16, 6, 10, '#1E1E1E')
  drawPixel(grid, 26, 18, '#FF4040')
  drawPixel(grid, 27, 18, '#FF4040')
  drawPixel(grid, 28, 18, '#FF4040')
  drawPixel(grid, 26, 20, '#FF4040')
  return grid
}

/** Clipboard catch orb: character catches a glowing orb and stores it */
function generateCatchOrb(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Orb descends from top, character catches it
  const orbY = Math.min(2 + frame * 4, 16)
  const orbX = 16
  const caught = frame >= 3
  // Glowing orb
  if (!caught || frame === 3) {
    const orbColor = frame % 2 === 0 ? '#88DDFF' : '#AAEEFF'
    drawPixel(grid, orbX - 1, orbY, orbColor)
    drawPixel(grid, orbX, orbY - 1, orbColor)
    drawPixel(grid, orbX, orbY, '#FFFFFF')
    drawPixel(grid, orbX, orbY + 1, orbColor)
    drawPixel(grid, orbX + 1, orbY, orbColor)
  }
  // Arms reaching up (frames 0-2), then holding (frame 3), then tossing to desk (4-5)
  if (frame <= 2) {
    // Arms reaching up
    drawRect(grid, 9, 10 + frame * 2, 3, 2, PALETTE.skin)
    drawRect(grid, 20, 10 + frame * 2, 3, 2, PALETTE.skin)
  } else if (frame === 3) {
    // Holding orb
    drawRect(grid, 13, 14, 6, 3, PALETTE.skin)
  } else {
    // Tossing toward backpack on desk (right side)
    const tossX = 16 + (frame - 3) * 4
    const tossY = 18 + (frame - 3) * 2
    drawPixel(grid, tossX, tossY, '#88DDFF')
    drawPixel(grid, tossX + 1, tossY, '#AAEEFF')
    // Backpack on desk
    drawRect(grid, 22, 22, 4, 4, '#8B6914')
    drawRect(grid, 23, 23, 2, 2, '#A0822A')
    drawPixel(grid, 24, 22, '#C0A040') // clasp
  }
  // Happy surprised expression
  drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14, 11, PALETTE.eyes)
  drawPixel(grid, 19, 11, PALETTE.eyes)
  if (frame <= 3) {
    drawRect(grid, 15, 14, 2, 2, PALETTE.mouth) // surprised O
  } else {
    drawRect(grid, 14, 14, 4, 1, PALETTE.mouth) // satisfied smile
  }
  return grid
}

// ── Network Fishing Animations (V2) ──

/** Helper: draw fishing base (character sitting at desk edge with rod) */
function drawFishingBase(grid: PixelData, rodBend: number = 0, eyeState: 'open' | 'half' | 'alert' = 'open') {
  // Desk (character sits at right edge)
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Body (sitting at edge, legs dangling)
  drawRect(grid, 8, 18, 10, 8, PALETTE.body)
  drawRect(grid, 9, 19, 8, 6, PALETTE.bodyShadow)
  // Legs dangling off desk
  drawRect(grid, 10, 26, 3, 3, PALETTE.body)
  drawRect(grid, 15, 26, 3, 3, PALETTE.body)
  // Head
  drawRect(grid, 7, 6, 12, 12, PALETTE.skin)
  drawRect(grid, 8, 7, 10, 10, PALETTE.skin)
  // Hair
  drawRect(grid, 7, 5, 12, 3, PALETTE.hair)
  drawRect(grid, 6, 6, 2, 4, PALETTE.hair)
  drawRect(grid, 18, 6, 2, 4, PALETTE.hair)
  // Eyes
  if (eyeState === 'half') {
    drawRect(grid, 10, 12, 3, 1, PALETTE.eyes)
    drawRect(grid, 15, 12, 3, 1, PALETTE.eyes)
  } else if (eyeState === 'alert') {
    drawRect(grid, 10, 11, 2, 2, PALETTE.eyeWhite)
    drawRect(grid, 15, 11, 2, 2, PALETTE.eyeWhite)
    drawPixel(grid, 11, 11, PALETTE.eyes) // looking right at rod
    drawPixel(grid, 16, 11, PALETTE.eyes)
  } else {
    drawRect(grid, 10, 11, 2, 2, PALETTE.eyeWhite)
    drawRect(grid, 15, 11, 2, 2, PALETTE.eyeWhite)
    drawPixel(grid, 11, 12, PALETTE.eyes)
    drawPixel(grid, 16, 12, PALETTE.eyes)
  }
  // Fishing rod (arm holding it)
  drawRect(grid, 17, 16, 3, 2, PALETTE.skin) // hand
  // Rod shaft
  const rodTipY = 4 - rodBend
  drawPixel(grid, 19, 16, '#8B6914')
  drawPixel(grid, 20, 14, '#8B6914')
  drawPixel(grid, 21, 12, '#8B6914')
  drawPixel(grid, 22, 10, '#8B6914')
  drawPixel(grid, 23, 8, '#8B6914')
  drawPixel(grid, 24, 6 + rodBend, '#8B6914')
  drawPixel(grid, 25, rodTipY + rodBend, '#8B6914')
  // Fishing line
  for (let y = rodTipY + rodBend + 1; y < 30; y++) {
    drawPixel(grid, 26, y, '#AAAAAA')
  }
}

/** Fishing idle: dozing off */
function generateFishingIdle(frame: number): PixelData {
  const grid = createGrid()
  const nod = frame >= 2 ? 1 : 0
  drawFishingBase(grid, 0, 'half')
  // Mouth
  drawPixel(grid, 13, 15 + nod, PALETTE.mouth)
  // Zzz
  if (frame % 4 >= 2) {
    drawPixel(grid, 5, 4, PALETTE.zzz)
    drawPixel(grid, 4, 3, PALETTE.zzz)
  }
  return grid
}

/** Fishing light: gentle bobbing */
function generateFishingLight(frame: number): PixelData {
  const grid = createGrid()
  const bob = frame % 2
  drawFishingBase(grid, bob, 'open')
  drawRect(grid, 12, 15, 2, 1, PALETTE.mouth) // relaxed
  // Small ripple at line end
  if (frame % 2 === 0) {
    drawPixel(grid, 25, 29, '#6699CC')
    drawPixel(grid, 27, 29, '#6699CC')
  }
  return grid
}

/** Fishing moderate: alert, eyes on rod */
function generateFishingModerate(frame: number): PixelData {
  const grid = createGrid()
  drawFishingBase(grid, 1 + (frame % 2), 'alert')
  drawRect(grid, 12, 14, 3, 1, PALETTE.mouth) // focused
  // Bigger ripple
  drawPixel(grid, 24, 28 + (frame % 2), '#6699CC')
  drawPixel(grid, 26, 29, '#6699CC')
  drawPixel(grid, 28, 28 + (frame % 2), '#6699CC')
  return grid
}

/** Fishing active: excited pulling, feet braced */
function generateFishingActive(frame: number): PixelData {
  const grid = createGrid()
  drawFishingBase(grid, 2 + (frame % 2), 'alert')
  // Excited mouth
  drawRect(grid, 12, 14, 3, 2, PALETTE.mouth)
  // Feet braced
  drawRect(grid, 10, 26, 3, 2, PALETTE.body)
  drawRect(grid, 15, 26, 3, 2, PALETTE.body)
  // Splash effects
  const splashY = 27 + (frame % 2)
  drawPixel(grid, 24, splashY, '#88CCFF')
  drawPixel(grid, 26, splashY - 1, '#AADDFF')
  drawPixel(grid, 28, splashY, '#88CCFF')
  // Sweat
  if (frame >= 2) {
    drawPixel(grid, 6, 8, '#88CCFF')
  }
  return grid
}

/** Fishing heavy: frantic reeling, sweat drops */
function generateFishingHeavy(frame: number): PixelData {
  const grid = createGrid()
  const shake = frame % 2 === 0 ? 0 : 1
  drawFishingBase(grid, 3 + shake, 'alert')
  // Open mouth excited
  drawRect(grid, 11, 13, 4, 3, PALETTE.mouth)
  // Big splashes
  for (let i = 0; i < 3; i++) {
    const sx = 23 + i * 2 + (frame % 2)
    const sy = 26 + ((frame + i) % 3)
    drawPixel(grid, sx, sy, '#88CCFF')
    drawPixel(grid, sx + 1, sy - 1, '#AADDFF')
  }
  // Multiple sweat drops
  drawPixel(grid, 5, 7 + shake, '#88CCFF')
  drawPixel(grid, 19, 7 + shake, '#88CCFF')
  // Blush from effort
  drawRect(grid, 8, 13, 2, 1, PALETTE.blush)
  drawRect(grid, 17, 13, 2, 1, PALETTE.blush)
  return grid
}

/** Fishing trophy: giant fish pulled out, celebration */
function generateFishingTrophy(frame: number): PixelData {
  const grid = createGrid()
  // Desk
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Character standing, holding up fish
  drawRect(grid, 8, 14, 10, 12, PALETTE.body)
  drawRect(grid, 9, 15, 8, 10, PALETTE.bodyShadow)
  drawRect(grid, 7, 2, 12, 12, PALETTE.skin)
  drawRect(grid, 7, 1, 12, 3, PALETTE.hair)
  // Big happy eyes
  drawRect(grid, 10, 7, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 15, 7, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 11, 8, PALETTE.eyes)
  drawPixel(grid, 16, 8, PALETTE.eyes)
  drawRect(grid, 11, 10, 4, 2, PALETTE.mouth) // huge grin
  // Giant fish held up
  const fishY = 2 + Math.abs(2 - (frame % 4))
  drawRect(grid, 20, fishY, 8, 4, '#4A90D9')     // body
  drawRect(grid, 21, fishY + 1, 6, 2, '#6BB5FF')  // belly
  drawPixel(grid, 27, fishY + 1, '#FFD93D')        // eye
  drawRect(grid, 19, fishY + 1, 2, 2, '#3670A0')   // tail
  // Sparkles
  if (frame >= 2) {
    const sparkleColors = ['#FFD93D', '#FF69B4', '#88DDFF']
    for (let i = 0; i < 3; i++) {
      drawPixel(grid, 3 + i * 8 + (frame % 3), 1 + ((frame + i) % 2), sparkleColors[i])
    }
  }
  return grid
}

/** Fishing disconnect: confused with broken cable */
function generateFishingDisconnect(frame: number): PixelData {
  const grid = createGrid()
  // Desk
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Body
  drawRect(grid, 11, 18, 10, 8, PALETTE.body)
  drawRect(grid, 12, 19, 8, 6, PALETTE.bodyShadow)
  // Head
  drawRect(grid, 10, 6, 12, 12, PALETTE.skin)
  drawRect(grid, 10, 5, 12, 3, PALETTE.hair)
  drawRect(grid, 9, 6, 2, 4, PALETTE.hair)
  drawRect(grid, 21, 6, 2, 4, PALETTE.hair)
  // Confused eyes (spirals)
  drawPixel(grid, 13, 11, PALETTE.eyes)
  drawPixel(grid, 14, 12, PALETTE.eyes)
  drawPixel(grid, 13, 13, PALETTE.eyes)
  drawPixel(grid, 18, 11, PALETTE.eyes)
  drawPixel(grid, 19, 12, PALETTE.eyes)
  drawPixel(grid, 18, 13, PALETTE.eyes)
  // Wavy confused mouth
  drawPixel(grid, 14, 15, PALETTE.mouth)
  drawPixel(grid, 15, 16, PALETTE.mouth)
  drawPixel(grid, 16, 15, PALETTE.mouth)
  drawPixel(grid, 17, 16, PALETTE.mouth)
  // Holding broken cable
  drawRect(grid, 20, 16, 3, 2, PALETTE.skin) // hand
  drawRect(grid, 22, 14, 1, 3, '#666666') // cable
  drawRect(grid, 23, 13, 2, 1, '#666666')
  // Broken end sparks
  if (frame % 2 === 0) {
    drawPixel(grid, 24, 12, '#FFD93D')
    drawPixel(grid, 25, 13, '#FF4040')
  }
  // Question mark
  drawPixel(grid, 24, 5, '#FFFFFF')
  drawPixel(grid, 25, 4, '#FFFFFF')
  drawPixel(grid, 25, 3, '#FFFFFF')
  drawPixel(grid, 24, 3, '#FFFFFF')
  drawPixel(grid, 24, 7, '#FFFFFF')
  return grid
}

/** Fishing upload: tying letter to a bird */
function generateFishingUpload(frame: number): PixelData {
  const grid = createGrid()
  drawBase(grid)
  // Arms tying
  drawRect(grid, 8, 20, 3, 2, PALETTE.skin)
  drawRect(grid, 20, 20, 3, 2, PALETTE.skin)
  // Letter/package on desk
  drawRect(grid, 10, 22, 6, 3, '#F5DEB3') // envelope
  drawRect(grid, 11, 23, 4, 1, '#D2B48C')
  drawPixel(grid, 13, 22, '#CC4444') // wax seal
  // Bird
  const birdY = frame < 2 ? 18 : 18 - (frame - 1) * 2
  const birdX = frame < 2 ? 18 : 18 + (frame - 1) * 2
  drawRect(grid, birdX, birdY, 3, 2, '#87CEEB') // body
  drawPixel(grid, birdX + 2, birdY, '#FFD93D')   // beak
  drawPixel(grid, birdX, birdY, '#333333')        // eye
  // Wings flap
  if (frame % 2 === 0) {
    drawPixel(grid, birdX + 1, birdY - 1, '#87CEEB')
  } else {
    drawPixel(grid, birdX + 1, birdY + 2, '#87CEEB')
  }
  // Carry letter when flying
  if (frame >= 2) {
    drawRect(grid, birdX, birdY + 2, 2, 1, '#F5DEB3')
  }
  // Happy expression
  drawRect(grid, 13, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 14, 12, PALETTE.eyes)
  drawPixel(grid, 19, 12, PALETTE.eyes)
  drawRect(grid, 14, 14, 4, 1, PALETTE.mouth)
  return grid
}

// ── Window Awareness Animations (V2) ──

/** Dodge: character scooting sideways away from window */
function generateDodge(frame: number): PixelData {
  const grid = createGrid()
  const sway = frame % 2 === 0 ? -2 : 0
  // Desk
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Body shifted
  drawRect(grid, 11 + sway, 18, 10, 8, PALETTE.body)
  drawRect(grid, 12 + sway, 19, 8, 6, PALETTE.bodyShadow)
  // Head looking to the side
  drawRect(grid, 10 + sway, 6, 12, 12, PALETTE.skin)
  drawRect(grid, 10 + sway, 5, 12, 3, PALETTE.hair)
  drawRect(grid, 9 + sway, 6, 2, 4, PALETTE.hair)
  drawRect(grid, 21 + sway, 6, 2, 4, PALETTE.hair)
  // Worried eyes looking sideways
  drawRect(grid, 13 + sway, 11, 2, 2, PALETTE.eyeWhite)
  drawRect(grid, 18 + sway, 11, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, 13 + sway, 12, PALETTE.eyes) // looking left
  drawPixel(grid, 18 + sway, 12, PALETTE.eyes)
  // Worried mouth
  drawRect(grid, 14 + sway, 15, 3, 1, PALETTE.mouth)
  // Motion lines
  const lineX = 24 + sway
  if (frame % 2 === 0) {
    drawPixel(grid, lineX, 10, '#AAAAAA')
    drawPixel(grid, lineX, 14, '#AAAAAA')
    drawPixel(grid, lineX + 1, 12, '#AAAAAA')
  }
  return grid
}

/** Peek: half body visible, curious expression peeking from edge */
function generatePeek(frame: number): PixelData {
  const grid = createGrid()
  // Desk
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Half body peeking from right edge
  const peekX = 22 + (frame % 2)
  // Body (half visible)
  drawRect(grid, peekX, 18, 10, 8, PALETTE.body)
  drawRect(grid, peekX + 1, 19, 8, 6, PALETTE.bodyShadow)
  // Head peeking
  drawRect(grid, peekX - 2, 8, 10, 10, PALETTE.skin)
  // Hair
  drawRect(grid, peekX - 2, 7, 10, 3, PALETTE.hair)
  // One eye visible (curious)
  drawRect(grid, peekX, 12, 2, 2, PALETTE.eyeWhite)
  drawPixel(grid, peekX, 13, PALETTE.eyes) // looking out
  // Tiny nervous smile
  drawPixel(grid, peekX + 1, 16, PALETTE.mouth)
  // Hand gripping edge
  drawRect(grid, peekX - 1, 16, 2, 3, PALETTE.skin)
  return grid
}

/** Squeeze: flattened character between windows, bug-eyed */
function generateSqueeze(frame: number): PixelData {
  const grid = createGrid()
  // Desk
  drawRect(grid, 2, 26, 28, 4, PALETTE.desk)
  drawRect(grid, 2, 28, 28, 2, PALETTE.deskShadow)
  // Squished body (narrow)
  const squish = frame % 2
  drawRect(grid, 14 - squish, 16, 4 + squish * 2, 10, PALETTE.body)
  drawRect(grid, 14, 17, 3, 8, PALETTE.bodyShadow)
  // Squished head (tall and narrow)
  drawRect(grid, 13 - squish, 4, 6 + squish * 2, 12, PALETTE.skin)
  // Hair
  drawRect(grid, 13 - squish, 3, 6 + squish * 2, 3, PALETTE.hair)
  // Bug eyes (wide, panicked)
  drawRect(grid, 13, 8, 3, 3, PALETTE.eyeWhite)
  drawRect(grid, 17, 8, 3, 3, PALETTE.eyeWhite)
  drawPixel(grid, 14, 9, PALETTE.eyes)
  drawPixel(grid, 18, 9, PALETTE.eyes)
  // Small pupils (panic)
  drawPixel(grid, 14, 10, PALETTE.eyes)
  drawPixel(grid, 18, 10, PALETTE.eyes)
  // Open panicked mouth
  drawRect(grid, 14, 13, 4, 2, PALETTE.mouth)
  // Sweat drops
  drawPixel(grid, 11, 6 + squish, '#88CCFF')
  drawPixel(grid, 21, 7 + squish, '#88CCFF')
  // "Wall" indicators on sides
  drawRect(grid, 0, 4, 2, 22, '#666666')
  drawRect(grid, 30, 4, 2, 22, '#666666')
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
  curious: generateCurious,
  wakeup: generateWakeup,
  hatching: generateHatching,
  sweating: generateSweating,
  overloaded: generateOverloaded,
  cleaning: generateCleaning,
  lowbattery: generateLowBattery,
  charging: generateCharging,
  unplugged: generateUnplugged,
  fullbattery: generateFullBattery,
  sipping: generateSipping,
  crumpling: generateCrumpling,
  rummaging: generateRummaging,
  drinking: generateDrinking,
  stretching: generateStretching,
  eyerest: generateEyerest,
  reading: generateReading,
  tidying: generateTidying,
  daydreaming: generateDaydreaming,
  napping: generateNapping,
  slacking: generateSlacking,
  gaming: generateGaming,
  dancing: generateDancing,
  doodling: generateDoodling,
  // Scene awareness (V2)
  scene_coding: generateSceneCoding,
  scene_writing: generateSceneWriting,
  scene_design: generateSceneDesign,
  scene_meeting: generateSceneMeeting,
  scene_fidget: generateSceneFidget,
  scene_giveup: generateSceneGiveup,
  celebrate: generateCelebrate,
  comforting: generateComforting,
  catch_orb: generateCatchOrb,
  // Network fishing
  fishing_idle: generateFishingIdle,
  fishing_light: generateFishingLight,
  fishing_moderate: generateFishingModerate,
  fishing_active: generateFishingActive,
  fishing_heavy: generateFishingHeavy,
  fishing_trophy: generateFishingTrophy,
  fishing_disconnect: generateFishingDisconnect,
  fishing_upload: generateFishingUpload,
  // Window awareness
  dodge: generateDodge,
  peek: generatePeek,
  squeeze: generateSqueeze,
}

// Render a pixel grid to an offscreen canvas and return ImageData
export function generateFrame(state: AnimationState, frame: number): PixelData {
  refreshPalette() // apply skin palette each frame
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
