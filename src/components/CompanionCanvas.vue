<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { PhysicalPosition } from '@tauri-apps/api/dpi'
import { SpriteEngine } from '../engine/SpriteEngine'
import type { AnimationState } from '../engine/AnimationStateMachine'

const props = defineProps<{
  state: AnimationState
  clutterLevel?: number
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'rightclick'): void
  (e: 'stateChange', state: AnimationState): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let engine: SpriteEngine | null = null

// ── Drag vs Click detection ──
let isDragging = false
let dragStartX = 0
let dragStartY = 0
let hasMoved = false
const DRAG_THRESHOLD = 3 // px moved before it counts as drag

function onMouseDown(e: MouseEvent) {
  if (e.button !== 0) return
  isDragging = true
  hasMoved = false
  dragStartX = e.screenX
  dragStartY = e.screenY
  e.preventDefault()
}

async function onMouseMove(e: MouseEvent) {
  if (!isDragging) return
  const dx = e.screenX - dragStartX
  const dy = e.screenY - dragStartY
  if (Math.abs(dx) < DRAG_THRESHOLD && Math.abs(dy) < DRAG_THRESHOLD && !hasMoved) return
  hasMoved = true
  dragStartX = e.screenX
  dragStartY = e.screenY
  try {
    const win = getCurrentWindow()
    const pos = await win.outerPosition()
    await win.setPosition(new PhysicalPosition(pos.x + dx, pos.y + dy))
  } catch {}
}

function onMouseUp(e: MouseEvent) {
  if (!isDragging) return
  isDragging = false
  // If barely moved, treat as click
  if (!hasMoved && e.button === 0) {
    emit('click')
  }
}

function onRightClick(e: MouseEvent) {
  e.preventDefault()
  emit('rightclick')
}

onMounted(() => {
  if (!canvasRef.value) return
  engine = new SpriteEngine(canvasRef.value, 3)
  engine.onStateChange((s) => emit('stateChange', s))
  engine.setState(props.state)
  engine.start()

  window.addEventListener('mousemove', onMouseMove)
  window.addEventListener('mouseup', onMouseUp)
})

onUnmounted(() => {
  engine?.destroy()
  window.removeEventListener('mousemove', onMouseMove)
  window.removeEventListener('mouseup', onMouseUp)
})

watch(() => props.state, (newState) => {
  engine?.setState(newState)
})

watch(() => props.clutterLevel, (level) => {
  engine?.setClutterLevel(level ?? 0)
})
</script>

<template>
  <canvas
    ref="canvasRef"
    class="companion-canvas"
    @mousedown="onMouseDown"
    @contextmenu="onRightClick"
  />
</template>

<style scoped>
.companion-canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  cursor: grab;
}

.companion-canvas:active {
  cursor: grabbing;
}
</style>
