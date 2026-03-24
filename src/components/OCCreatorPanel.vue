<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import {
  OCCreatorEngine, HAIRS, EYES, MOUTHS, OUTFITS, ACCESSORIES, PRESETS,
  type OCConfig, type OCColors,
} from '../engine/OCCreator'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'apply', config: OCConfig): void
}>()

const engine = new OCCreatorEngine()
const canvasRef = ref<HTMLCanvasElement | null>(null)
const tab = ref<'parts' | 'colors' | 'presets'>('parts')
const partCategory = ref<'hair' | 'eyes' | 'mouth' | 'outfit' | 'accessory'>('hair')

// Reactive mirrors of engine state
const hairId = ref('short')
const eyesId = ref('round')
const mouthId = ref('smile')
const outfitId = ref('hoodie')
const accessoryId = ref('none')
const colors = ref<OCColors>({ ...engine.config.colors })

// Import/export
const showImportExport = ref(false)
const jsonText = ref('')

let animFrame = 0
let animTimer = 0

onMounted(async () => {
  await engine.load()
  syncFromEngine()
  renderPreview()
  animTimer = window.setInterval(() => {
    animFrame = (animFrame + 1) % 6
    renderPreview()
  }, 400)
})

function syncFromEngine() {
  hairId.value = engine.config.hairId
  eyesId.value = engine.config.eyesId
  mouthId.value = engine.config.mouthId
  outfitId.value = engine.config.outfitId
  accessoryId.value = engine.config.accessoryId
  colors.value = { ...engine.config.colors }
}

function renderPreview() {
  const canvas = canvasRef.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const scale = 3
  canvas.width = 32 * scale
  canvas.height = 32 * scale
  ctx.imageSmoothingEnabled = false

  const grid = engine.renderPreview(animFrame)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      const c = grid[y][x]
      if (c) {
        ctx.fillStyle = c
        ctx.fillRect(x * scale, y * scale, scale, scale)
      }
    }
  }
}

function selectPart(category: string, id: string) {
  switch (category) {
    case 'hair': engine.setHair(id); hairId.value = id; break
    case 'eyes': engine.setEyes(id); eyesId.value = id; break
    case 'mouth': engine.setMouth(id); mouthId.value = id; break
    case 'outfit': engine.setOutfit(id); outfitId.value = id; break
    case 'accessory': engine.setAccessory(id); accessoryId.value = id; break
  }
  renderPreview()
}

function updateColor(key: keyof OCColors, value: string) {
  engine.setColor(key, value)
  colors.value[key] = value
  renderPreview()
}

function applyPreset(presetId: string) {
  engine.applyPreset(presetId)
  syncFromEngine()
  renderPreview()
}

async function applyAndSave() {
  await engine.save()
  emit('apply', engine.config)
}

function exportConfig() {
  jsonText.value = engine.exportJSON()
  showImportExport.value = true
}

function importConfig() {
  if (engine.importJSON(jsonText.value)) {
    syncFromEngine()
    renderPreview()
    showImportExport.value = false
  }
}

const PART_LISTS = {
  hair: HAIRS,
  eyes: EYES,
  mouth: MOUTHS,
  outfit: OUTFITS,
  accessory: ACCESSORIES,
}

function getActiveId(category: string): string {
  switch (category) {
    case 'hair': return hairId.value
    case 'eyes': return eyesId.value
    case 'mouth': return mouthId.value
    case 'outfit': return outfitId.value
    case 'accessory': return accessoryId.value
  }
  return ''
}

const COLOR_FIELDS: { key: keyof OCColors; label: string }[] = [
  { key: 'skin', label: 'Skin' },
  { key: 'skinShadow', label: 'Skin Shadow' },
  { key: 'hair', label: 'Hair' },
  { key: 'hairHighlight', label: 'Hair HL' },
  { key: 'eyes', label: 'Eyes' },
  { key: 'mouth', label: 'Mouth' },
  { key: 'body', label: 'Outfit' },
  { key: 'bodyShadow', label: 'Outfit Shadow' },
  { key: 'accessory', label: 'Accessory' },
]
</script>

<template>
  <div class="oc-panel">
    <div class="oc-header">
      <span class="oc-title">Character Creator</span>
      <div class="oc-hdr-btns">
        <button class="oc-btn-sm" @click="exportConfig">Export</button>
        <button class="oc-close" @click="emit('close')">&#10005;</button>
      </div>
    </div>

    <!-- Preview -->
    <div class="oc-preview">
      <canvas ref="canvasRef" class="oc-canvas"></canvas>
    </div>

    <!-- Tabs -->
    <div class="oc-tabs">
      <button class="oc-tab" :class="{ active: tab === 'parts' }" @click="tab = 'parts'">Parts</button>
      <button class="oc-tab" :class="{ active: tab === 'colors' }" @click="tab = 'colors'">Colors</button>
      <button class="oc-tab" :class="{ active: tab === 'presets' }" @click="tab = 'presets'">Presets</button>
    </div>

    <div class="oc-body">
      <!-- Parts -->
      <template v-if="tab === 'parts'">
        <div class="oc-cat-tabs">
          <button
            v-for="cat in ['hair', 'eyes', 'mouth', 'outfit', 'accessory']" :key="cat"
            class="oc-cat" :class="{ active: partCategory === cat }"
            @click="partCategory = cat as any"
          >{{ cat }}</button>
        </div>
        <div class="oc-parts-grid">
          <button
            v-for="part in PART_LISTS[partCategory]" :key="part.id"
            class="oc-part-btn" :class="{ active: getActiveId(partCategory) === part.id }"
            @click="selectPart(partCategory, part.id)"
          >{{ part.name }}</button>
        </div>
      </template>

      <!-- Colors -->
      <template v-if="tab === 'colors'">
        <div class="oc-color-list">
          <div v-for="f in COLOR_FIELDS" :key="f.key" class="oc-color-row">
            <span class="oc-color-label">{{ f.label }}</span>
            <input
              type="color"
              :value="colors[f.key]"
              class="oc-color-input"
              @input="updateColor(f.key, ($event.target as HTMLInputElement).value)"
            />
          </div>
        </div>
      </template>

      <!-- Presets -->
      <template v-if="tab === 'presets'">
        <div class="oc-presets">
          <button
            v-for="p in PRESETS" :key="p.id"
            class="oc-preset-btn"
            @click="applyPreset(p.id)"
          >{{ p.name }}</button>
        </div>
      </template>
    </div>

    <!-- Apply button -->
    <div class="oc-footer">
      <button class="oc-apply" @click="applyAndSave">Apply & Save</button>
    </div>

    <!-- Import/Export modal -->
    <div v-if="showImportExport" class="oc-modal">
      <div class="oc-modal-inner">
        <textarea v-model="jsonText" class="oc-json" rows="8"></textarea>
        <div class="oc-modal-btns">
          <button class="oc-btn-sm" @click="importConfig">Import</button>
          <button class="oc-btn-sm" @click="showImportExport = false">Close</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.oc-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background: rgba(15, 20, 40, 0.97);
  border-radius: 12px;
  display: flex; flex-direction: column;
  z-index: 30; overflow: hidden;
}

.oc-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 5px 8px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.oc-title { color: rgba(255,255,255,0.9); font-size: 10px; font-weight: 600; }
.oc-hdr-btns { display: flex; gap: 4px; align-items: center; }
.oc-close {
  background: none; border: none; color: rgba(255,255,255,0.5);
  font-size: 12px; cursor: pointer; padding: 0 3px;
}
.oc-close:hover { color: #fff; }

.oc-preview {
  display: flex; justify-content: center; padding: 6px 0;
  background: rgba(0,0,0,0.3);
}
.oc-canvas {
  width: 96px; height: 96px;
  image-rendering: pixelated;
}

.oc-tabs {
  display: flex; gap: 2px; padding: 3px 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.oc-tab {
  flex: 1; font-size: 8px; padding: 3px 0; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.4);
  cursor: pointer;
}
.oc-tab.active {
  background: rgba(74,144,217,0.2); border-color: rgba(74,144,217,0.35); color: #fff;
}

.oc-body {
  flex: 1; overflow-y: auto; padding: 6px 8px;
}
.oc-body::-webkit-scrollbar { width: 3px; }
.oc-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }

/* Part category tabs */
.oc-cat-tabs {
  display: flex; gap: 2px; margin-bottom: 6px;
}
.oc-cat {
  flex: 1; font-size: 7px; padding: 2px 0; border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.06);
  background: rgba(255,255,255,0.02); color: rgba(255,255,255,0.35);
  cursor: pointer; text-transform: capitalize;
}
.oc-cat.active {
  background: rgba(255,215,0,0.1); border-color: rgba(255,215,0,0.25); color: rgba(255,215,0,0.8);
}

.oc-parts-grid {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 3px;
}
.oc-part-btn {
  font-size: 8px; padding: 5px 4px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.6);
  cursor: pointer; transition: all 0.12s;
}
.oc-part-btn:hover { background: rgba(255,255,255,0.08); }
.oc-part-btn.active {
  background: rgba(74,144,217,0.15); border-color: rgba(74,144,217,0.3); color: #fff;
}

/* Colors */
.oc-color-list {
  display: flex; flex-direction: column; gap: 3px;
}
.oc-color-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 3px 4px; border-radius: 4px;
  background: rgba(255,255,255,0.02);
}
.oc-color-label { font-size: 8px; color: rgba(255,255,255,0.5); }
.oc-color-input {
  width: 22px; height: 16px; border: none; border-radius: 3px;
  background: none; cursor: pointer; padding: 0;
}
.oc-color-input::-webkit-color-swatch-wrapper { padding: 0; }
.oc-color-input::-webkit-color-swatch { border: 1px solid rgba(255,255,255,0.15); border-radius: 2px; }

/* Presets */
.oc-presets {
  display: grid; grid-template-columns: repeat(2, 1fr); gap: 4px;
}
.oc-preset-btn {
  font-size: 9px; padding: 8px 6px; border-radius: 5px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.7);
  cursor: pointer; transition: all 0.12s;
}
.oc-preset-btn:hover { background: rgba(74,144,217,0.12); border-color: rgba(74,144,217,0.25); }

/* Footer */
.oc-footer {
  padding: 5px 8px;
  border-top: 1px solid rgba(255,255,255,0.06);
}
.oc-apply {
  width: 100%; font-size: 10px; padding: 6px; border-radius: 5px;
  border: none; background: rgba(74,144,217,0.4); color: #fff;
  cursor: pointer; font-weight: 600;
}
.oc-apply:hover { background: rgba(74,144,217,0.6); }

/* Buttons */
.oc-btn-sm {
  font-size: 7px; padding: 2px 6px; border-radius: 3px;
  border: 1px solid rgba(255,255,255,0.12); background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5); cursor: pointer;
}
.oc-btn-sm:hover { background: rgba(255,255,255,0.1); }

/* Modal */
.oc-modal {
  position: absolute; inset: 0;
  background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center;
  z-index: 40;
}
.oc-modal-inner {
  background: rgba(20,25,45,0.98); border-radius: 8px; padding: 8px;
  border: 1px solid rgba(255,255,255,0.1); width: 85%;
}
.oc-json {
  width: 100%; font-size: 7px; font-family: monospace;
  background: rgba(0,0,0,0.4); color: rgba(255,255,255,0.7);
  border: 1px solid rgba(255,255,255,0.1); border-radius: 4px;
  padding: 4px; resize: none;
}
.oc-modal-btns { display: flex; gap: 4px; margin-top: 4px; justify-content: flex-end; }
</style>
