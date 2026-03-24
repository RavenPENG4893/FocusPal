<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { getCelestialPosition, initSunTimes, type CelestialPosition } from '../engine/TimeOfDay'

const pos = ref<CelestialPosition>(getCelestialPosition())
const ready = ref(false)
const canvasRef = ref<HTMLCanvasElement | null>(null)

const PX = 2 // pixel size

// 7x7 pixel art sun
const SUN_SPRITE = [
  '  0 0  ',
  ' 00000 ',
  '0011100',
  ' 01110 ',
  '0011100',
  ' 00000 ',
  '  0 0  ',
]
const SUN_COLORS: Record<string, string> = {
  '0': '#FFD93D',
  '1': '#FFF7AA',
}

// 7x7 pixel art crescent moon
const MOON_SPRITE = [
  '  000  ',
  ' 0011  ',
  '00011  ',
  '00011  ',
  '00011  ',
  ' 0011  ',
  '  000  ',
]
const MOON_COLORS: Record<string, string> = {
  '0': '#D0D8F0',
  '1': '#F0F4FF',
}

function drawSprite(canvas: HTMLCanvasElement, sprite: string[], colors: Record<string, string>) {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const w = sprite[0].length
  const h = sprite.length
  canvas.width = w * PX
  canvas.height = h * PX
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (let row = 0; row < h; row++) {
    for (let col = 0; col < w; col++) {
      const ch = sprite[row][col]
      if (ch !== ' ') {
        ctx.fillStyle = colors[ch] || '#fff'
        ctx.fillRect(col * PX, row * PX, PX, PX)
      }
    }
  }
}

function renderSprite() {
  if (!canvasRef.value) return
  if (pos.value.type === 'sun') {
    drawSprite(canvasRef.value, SUN_SPRITE, SUN_COLORS)
  } else {
    drawSprite(canvasRef.value, MOON_SPRITE, MOON_COLORS)
  }
}

let timer: number = 0

onMounted(async () => {
  await initSunTimes()
  pos.value = getCelestialPosition()
  ready.value = true
  await nextTick()
  renderSprite()

  timer = window.setInterval(() => {
    const prev = pos.value.type
    pos.value = getCelestialPosition()
    if (pos.value.type !== prev) renderSprite()
  }, 60 * 1000)
})

onUnmounted(() => {
  clearInterval(timer)
})

watch(() => pos.value.type, () => {
  nextTick(() => renderSprite())
})
</script>

<template>
  <div class="celestial-container" v-if="ready">
    <canvas
      ref="canvasRef"
      class="celestial-body"
      :style="{
        left: `${15 + pos.x * 70}%`,
        bottom: `${(1 - pos.y) * 80}%`,
      }"
    />
  </div>
</template>

<style scoped>
.celestial-container {
  position: absolute;
  top: 30%;
  left: 0;
  right: 0;
  height: 80px;
  pointer-events: none;
  z-index: 5;
}

.celestial-body {
  position: absolute;
  transform: translateX(-50%);
  transition: left 60s linear, bottom 60s linear;
  image-rendering: pixelated;
}
</style>
