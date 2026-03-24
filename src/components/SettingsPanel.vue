<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getMode, setMode, getApiKey, setApiKey, type LLMMode } from '../engine/LLMService'
import { SKINS, getActiveSkinId, setActiveSkin, getActiveSkin, loadSkinSetting } from '../engine/SkinSystem'
import { calcLevel, getTotalXP } from '../engine/GrowthSystem'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'skin-changed', skinId: string): void
  (e: 'name-changed', name: string): void
}>()

const tab = ref<'general' | 'llm' | 'reminders' | 'skins' | 'data' | 'about'>('general')

// ── General ──
const companionName = ref('')
const nameEditing = ref(false)
const nameInput = ref('')

// ── LLM ──
const llmMode = ref<LLMMode>(getMode())
const apiKey = ref(getApiKey())
const apiKeyVisible = ref(false)

// ── Reminders ──
const waterEnabled = ref(true)
const waterInterval = ref(45)
const stretchEnabled = ref(true)
const stretchInterval = ref(60)
const eyesEnabled = ref(true)
const eyesInterval = ref(30)

// ── Focus ──
const focusAutoSound = ref('none')

// ── Skins ──
const activeSkinId = ref(getActiveSkinId())
const playerLevel = ref(1)

async function configGet(key: string): Promise<string | null> {
  try { return await invoke<string | null>('config_get', { key }) } catch { return null }
}
async function configSet(key: string, value: string) {
  try { await invoke('config_set', { key, value }) } catch {}
}

onMounted(async () => {
  // Load current values
  companionName.value = (await configGet('companion_name')) || 'FocusPal'
  nameInput.value = companionName.value

  // Reminder settings
  const we = await configGet('reminder_water_enabled')
  if (we !== null) waterEnabled.value = we === 'true'
  const wi = await configGet('reminder_water_interval')
  if (wi !== null) waterInterval.value = Math.round(parseInt(wi) / 60000)

  const se = await configGet('reminder_stretch_enabled')
  if (se !== null) stretchEnabled.value = se === 'true'
  const si = await configGet('reminder_stretch_interval')
  if (si !== null) stretchInterval.value = Math.round(parseInt(si) / 60000)

  const ee = await configGet('reminder_eyes_enabled')
  if (ee !== null) eyesEnabled.value = ee === 'true'
  const ei = await configGet('reminder_eyes_interval')
  if (ei !== null) eyesInterval.value = Math.round(parseInt(ei) / 60000)

  const fas = await configGet('focus_auto_sound')
  if (fas !== null) focusAutoSound.value = fas

  // Player level for skin unlocks
  const xp = await getTotalXP()
  playerLevel.value = calcLevel(xp).level
})

// ── Handlers ──

async function saveName() {
  const name = nameInput.value.trim() || 'FocusPal'
  companionName.value = name
  nameEditing.value = false
  await configSet('companion_name', name)
  localStorage.setItem('companion_name', name)
  emit('name-changed', name)
}

function toggleLLMMode() {
  llmMode.value = llmMode.value === 'cloud' ? 'local' : 'cloud'
  setMode(llmMode.value)
}

function saveApiKey() {
  setApiKey(apiKey.value.trim())
}

async function saveReminderSetting(type: string, enabled: boolean, intervalMin: number) {
  await configSet(`reminder_${type}_enabled`, String(enabled))
  await configSet(`reminder_${type}_interval`, String(intervalMin * 60000))
}

async function saveFocusAutoSound() {
  await configSet('focus_auto_sound', focusAutoSound.value)
}

function selectSkin(id: string) {
  setActiveSkin(id)
  activeSkinId.value = id
  emit('skin-changed', id)
}

async function exportMoods() {
  try {
    const records = await invoke<any[]>('export_moods')
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `focuspal-moods-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[Settings] export moods error:', e)
  }
}

async function exportActivities() {
  try {
    const records = await invoke<any[]>('query_activities', { limit: 1000 })
    const blob = new Blob([JSON.stringify(records, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `focuspal-activities-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[Settings] export activities error:', e)
  }
}
</script>

<template>
  <div class="settings-panel">
    <div class="settings-header">
      <span class="settings-title">Settings</span>
      <button class="settings-close" @click="emit('close')">✕</button>
    </div>

    <!-- Tabs -->
    <div class="settings-tabs">
      <button class="stab" :class="{ active: tab === 'general' }" @click="tab = 'general'">General</button>
      <button class="stab" :class="{ active: tab === 'llm' }" @click="tab = 'llm'">LLM</button>
      <button class="stab" :class="{ active: tab === 'reminders' }" @click="tab = 'reminders'">Remind</button>
      <button class="stab" :class="{ active: tab === 'skins' }" @click="tab = 'skins'">Skins</button>
      <button class="stab" :class="{ active: tab === 'data' }" @click="tab = 'data'">Data</button>
      <button class="stab" :class="{ active: tab === 'about' }" @click="tab = 'about'">About</button>
    </div>

    <div class="settings-body">

      <!-- General -->
      <div v-if="tab === 'general'" class="tab-content">
        <div class="section-title">Companion Name</div>
        <div class="row">
          <template v-if="!nameEditing">
            <span class="row-value">{{ companionName }}</span>
            <button class="mini-btn" @click="nameEditing = true">Edit</button>
          </template>
          <template v-else>
            <input v-model="nameInput" class="text-input" maxlength="12" @keyup.enter="saveName" />
            <button class="mini-btn primary" @click="saveName">Save</button>
          </template>
        </div>

        <div class="section-title">Focus Auto Sound</div>
        <div class="row">
          <select v-model="focusAutoSound" class="select-input" @change="saveFocusAutoSound">
            <option value="none">None</option>
            <option value="rain">Rain</option>
            <option value="cafe">Cafe</option>
            <option value="forest">Forest</option>
            <option value="ocean">Ocean</option>
            <option value="fireplace">Fireplace</option>
          </select>
        </div>
      </div>

      <!-- LLM -->
      <div v-if="tab === 'llm'" class="tab-content">
        <div class="section-title">Mode</div>
        <div class="row">
          <button class="toggle-btn" :class="{ cloud: llmMode === 'cloud' }" @click="toggleLLMMode">
            {{ llmMode === 'cloud' ? '☁ Cloud (DeepSeek)' : '💻 Local (SLM)' }}
          </button>
        </div>

        <template v-if="llmMode === 'cloud'">
          <div class="section-title">API Key (SiliconFlow)</div>
          <div class="row">
            <input
              v-model="apiKey"
              :type="apiKeyVisible ? 'text' : 'password'"
              class="text-input api-input"
              placeholder="sk-..."
              @blur="saveApiKey"
            />
            <button class="mini-btn" @click="apiKeyVisible = !apiKeyVisible">
              {{ apiKeyVisible ? '🙈' : '👁' }}
            </button>
          </div>
        </template>

        <div v-if="llmMode === 'local'" class="hint">
          Local mode requires llama-server sidecar with Qwen2.5-1.5B model.
        </div>
      </div>

      <!-- Reminders -->
      <div v-if="tab === 'reminders'" class="tab-content">
        <div class="reminder-row">
          <label class="toggle-label">
            <input type="checkbox" v-model="waterEnabled"
              @change="saveReminderSetting('water', waterEnabled, waterInterval)" />
            💧 Drink Water
          </label>
          <div class="interval-row">
            Every <input type="number" v-model.number="waterInterval" min="5" max="120" class="num-input"
              @change="saveReminderSetting('water', waterEnabled, waterInterval)" /> min
          </div>
        </div>

        <div class="reminder-row">
          <label class="toggle-label">
            <input type="checkbox" v-model="stretchEnabled"
              @change="saveReminderSetting('stretch', stretchEnabled, stretchInterval)" />
            🧘 Stand & Stretch
          </label>
          <div class="interval-row">
            Every <input type="number" v-model.number="stretchInterval" min="10" max="180" class="num-input"
              @change="saveReminderSetting('stretch', stretchEnabled, stretchInterval)" /> min
          </div>
        </div>

        <div class="reminder-row">
          <label class="toggle-label">
            <input type="checkbox" v-model="eyesEnabled"
              @change="saveReminderSetting('eyes', eyesEnabled, eyesInterval)" />
            👀 Eye Rest (20-20-20)
          </label>
          <div class="interval-row">
            Every <input type="number" v-model.number="eyesInterval" min="10" max="120" class="num-input"
              @change="saveReminderSetting('eyes', eyesEnabled, eyesInterval)" /> min
          </div>
        </div>

        <div class="hint">Reminders auto-pause during Focus sessions (DND).</div>
      </div>

      <!-- Skins -->
      <div v-if="tab === 'skins'" class="tab-content">
        <div
          v-for="skin in SKINS"
          :key="skin.id"
          class="skin-card"
          :class="{ active: skin.id === activeSkinId, locked: skin.unlockLevel > playerLevel }"
          @click="skin.unlockLevel <= playerLevel && selectSkin(skin.id)"
        >
          <span class="skin-icon">{{ skin.icon }}</span>
          <div class="skin-info">
            <div class="skin-name">
              {{ skin.name }}
              <span v-if="skin.id === activeSkinId" class="badge">Active</span>
            </div>
            <div class="skin-desc">{{ skin.description }}</div>
            <div v-if="skin.unlockLevel > playerLevel" class="skin-lock">
              🔒 Lv.{{ skin.unlockLevel }}
            </div>
          </div>
        </div>
      </div>

      <!-- Data -->
      <div v-if="tab === 'data'" class="tab-content">
        <div class="section-title">Export Data</div>
        <div class="export-btns">
          <button class="export-btn" @click="exportMoods">📊 Export Moods (JSON)</button>
          <button class="export-btn" @click="exportActivities">📋 Export Activities (JSON)</button>
        </div>
        <div class="hint">Data is stored locally in SQLite. Nothing is sent to the cloud.</div>
      </div>

      <!-- About -->
      <div v-if="tab === 'about'" class="tab-content about-content">
        <div class="about-icon">🐣</div>
        <div class="about-name">FocusPal</div>
        <div class="about-ver">v1.0.0</div>
        <div class="about-desc">
          Your desktop companion that lives in your OS,
          watches your system metrics, and keeps you focused and happy.
        </div>
        <div class="about-tech">
          Built with Tauri 2.0 + Vue 3 + Rust + SQLite
        </div>
        <div class="about-copy">Made with ❤</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.settings-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background: rgba(15, 20, 40, 0.97);
  border-radius: 12px;
  display: flex; flex-direction: column;
  z-index: 30; overflow: hidden;
}

.settings-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.settings-title { color: rgba(255,255,255,0.9); font-size: 11px; font-weight: 600; }
.settings-close { background: none; border: none; color: rgba(255,255,255,0.6); font-size: 13px; cursor: pointer; padding: 0 4px; }
.settings-close:hover { color: #fff; }

.settings-tabs {
  display: flex; gap: 2px; padding: 4px 4px;
  border-bottom: 1px solid rgba(255,255,255,0.06);
}
.stab {
  flex: 1; font-size: 8px; padding: 3px 0; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03); color: rgba(255,255,255,0.4);
  cursor: pointer; transition: all 0.15s;
}
.stab.active {
  background: rgba(74,144,217,0.2); border-color: rgba(74,144,217,0.35); color: #fff;
}

.settings-body {
  flex: 1; overflow-y: auto;
}

.tab-content {
  padding: 8px 10px;
  display: flex; flex-direction: column; gap: 8px;
}

.section-title {
  font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.5);
  text-transform: uppercase; letter-spacing: 0.5px;
}

.row {
  display: flex; align-items: center; gap: 6px;
}

.row-value {
  font-size: 11px; color: rgba(255,255,255,0.8); flex: 1;
}

.text-input {
  flex: 1; font-size: 10px; padding: 4px 6px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06);
  color: #fff; outline: none;
}
.text-input:focus { border-color: rgba(74,144,217,0.5); }

.api-input { font-family: monospace; font-size: 9px; }

.select-input {
  font-size: 10px; padding: 4px 6px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(30,30,50,0.9);
  color: #fff; outline: none; cursor: pointer;
}

.num-input {
  width: 40px; font-size: 10px; padding: 3px 4px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06);
  color: #fff; outline: none; text-align: center;
}

.mini-btn {
  font-size: 8px; padding: 3px 8px; border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7); cursor: pointer;
}
.mini-btn:hover { background: rgba(255,255,255,0.12); }
.mini-btn.primary { background: rgba(74,144,217,0.3); border-color: rgba(74,144,217,0.4); color: #fff; }

.toggle-btn {
  font-size: 10px; padding: 5px 10px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.06);
  color: rgba(255,255,255,0.7); cursor: pointer; transition: all 0.15s;
}
.toggle-btn.cloud { background: rgba(74,144,217,0.2); border-color: rgba(74,144,217,0.35); color: #fff; }

.reminder-row {
  padding: 6px 8px; border-radius: 6px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.05);
}

.toggle-label {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; color: rgba(255,255,255,0.8); cursor: pointer;
}
.toggle-label input[type="checkbox"] {
  width: 12px; height: 12px; accent-color: #4A90D9;
}

.interval-row {
  margin-top: 4px; font-size: 9px; color: rgba(255,255,255,0.4);
  display: flex; align-items: center; gap: 4px; padding-left: 20px;
}

.hint {
  font-size: 8px; color: rgba(255,255,255,0.25); font-style: italic;
}

/* Skins */
.skin-card {
  display: flex; align-items: center; gap: 8px;
  padding: 6px 8px; border-radius: 6px;
  background: rgba(255,255,255,0.03);
  border: 1px solid rgba(255,255,255,0.06);
  cursor: pointer; transition: all 0.15s;
}
.skin-card:hover:not(.locked) { background: rgba(255,255,255,0.07); }
.skin-card.active { background: rgba(74,144,217,0.12); border-color: rgba(74,144,217,0.3); }
.skin-card.locked { opacity: 0.45; cursor: not-allowed; }
.skin-icon { font-size: 18px; }
.skin-info { flex: 1; }
.skin-name { font-size: 10px; font-weight: 600; color: rgba(255,255,255,0.85); display: flex; align-items: center; gap: 4px; }
.skin-desc { font-size: 8px; color: rgba(255,255,255,0.4); margin-top: 1px; }
.skin-lock { font-size: 8px; color: rgba(255,200,60,0.7); margin-top: 1px; }
.badge {
  font-size: 7px; background: rgba(74,144,217,0.4); color: #fff;
  padding: 1px 4px; border-radius: 3px;
}

/* Data */
.export-btns { display: flex; flex-direction: column; gap: 4px; }
.export-btn {
  font-size: 10px; padding: 6px 10px; border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.1); background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.7); cursor: pointer; text-align: left;
}
.export-btn:hover { background: rgba(255,255,255,0.08); }

/* About */
.about-content { align-items: center; text-align: center; padding-top: 16px; }
.about-icon { font-size: 32px; }
.about-name { font-size: 16px; font-weight: 700; color: #fff; margin-top: 4px; }
.about-ver { font-size: 10px; color: rgba(255,255,255,0.4); }
.about-desc { font-size: 9px; color: rgba(255,255,255,0.5); margin-top: 8px; max-width: 160px; line-height: 1.4; }
.about-tech { font-size: 8px; color: rgba(255,255,255,0.3); margin-top: 8px; }
.about-copy { font-size: 8px; color: rgba(255,255,255,0.2); margin-top: 12px; }

.settings-body::-webkit-scrollbar { width: 3px; }
.settings-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
</style>
