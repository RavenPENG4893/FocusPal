<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { SpriteEngine } from '../engine/SpriteEngine'
import type { AnimationState } from '../engine/AnimationStateMachine'

const props = defineProps<{
  state: AnimationState
}>()

const emit = defineEmits<{
  (e: 'click'): void
  (e: 'rightclick'): void
  (e: 'stateChange', state: AnimationState): void
}>()

const canvasRef = ref<HTMLCanvasElement | null>(null)
let engine: SpriteEngine | null = null

onMounted(() => {
  console.log('[CompanionCanvas] onMounted, canvasRef:', canvasRef.value)
  if (!canvasRef.value) {
    console.error('[CompanionCanvas] canvas ref is null!')
    return
  }
  engine = new SpriteEngine(canvasRef.value, 3)
  console.log('[CompanionCanvas] canvas size:', canvasRef.value.width, canvasRef.value.height)
  engine.onStateChange((s) => emit('stateChange', s))
  engine.setState(props.state)
  engine.start()
  console.log('[CompanionCanvas] engine started')
})

onUnmounted(() => {
  engine?.destroy()
})

watch(() => props.state, (newState) => {
  engine?.setState(newState)
})

function onClick() {
  emit('click')
}

function onRightClick(e: MouseEvent) {
  e.preventDefault()
  emit('rightclick')
}
</script>

<template>
  <canvas
    ref="canvasRef"
    class="companion-canvas"
    @click="onClick"
    @contextmenu="onRightClick"
  />
</template>

<style scoped>
.companion-canvas {
  image-rendering: pixelated;
  image-rendering: crisp-edges;
  cursor: grab;
  transition: filter 0.3s;
}

.companion-canvas:hover {
  filter: brightness(1.1);
}

.companion-canvas:active {
  cursor: grabbing;
}
</style>
