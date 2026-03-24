<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { getMode, setMode, getApiKey, setApiKey, type LLMMode } from '../engine/LLMService'
import { SKINS, getActiveSkinId, setActiveSkin, getActiveSkin, loadSkinSetting } from '../engine/SkinSystem'
import { calcLevel, getTotalXP } from '../engine/GrowthSystem'
import { ThompsonBandit, ARMS, type BanditState, type ReminderBanditType } from '../engine/ThompsonSampling'
import { CountdownSystem, type UpcomingEvent } from '../engine/CountdownDays'
import { CoupleEngine, type CoupleStatus } from '../engine/CoupleMode'

const props = defineProps<{
  coupleEngine: CoupleEngine
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'skin-changed', skinId: string): void
  (e: 'name-changed', name: string): void
  (e: 'open-oc-creator'): void
}>()

const tab = ref<'general' | 'llm' | 'reminders' | 'dates' | 'couple' | 'skins' | 'data' | 'about'>('general')

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

// ── Algorithm Insight (Thompson Sampling) ──
const showAlgoInsight = ref(false)
const insightType = ref<ReminderBanditType>('water')
const banditData = ref<BanditState | null>(null)
const algoCanvasRef = ref<HTMLCanvasElement | null>(null)
const banditLoader = new ThompsonBandit()
const adaptiveEnabled = ref(true)

// ── Countdown Dates ──
const countdownSystem = new CountdownSystem()
const upcomingEvents = ref<UpcomingEvent[]>([])
const showAddEvent = ref(false)
const cdTitle = ref('')
const cdEmoji = ref('🎂')
const cdDate = ref(new Date().toISOString().slice(0, 10))
const cdYearly = ref(false)
const EMOJI_OPTS = ['🎂', '🎉', '❤️', '📅', '✈️', '🎓', '💍', '🏠', '🎁', '⭐']

// ── Couple Mode ──
const coupleStatus = ref<CoupleStatus>({ coupled: false })
const coupleBackendUrl = ref('')
const inviteCode = ref('')
const joinCode = ref('')
const cheerMessage = ref('')
const coupleLoading = ref(false)
const coupleError = ref('')

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

  // Load adaptive toggle + bandit
  const adap = await configGet('reminder_adaptive')
  if (adap !== null) adaptiveEnabled.value = adap === 'true'
  await banditLoader.load()

  // Load countdown events
  await countdownSystem.load()
  upcomingEvents.value = countdownSystem.getUpcoming(20)

  // Load couple mode state
  coupleStatus.value = props.coupleEngine.status
  coupleBackendUrl.value = (await configGet('couple_backend_url')) || ''
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

async function addCountdownEvent() {
  const title = cdTitle.value.trim()
  if (!title) return
  const dateTs = new Date(cdDate.value).getTime()
  if (isNaN(dateTs)) return
  await countdownSystem.addEvent(title, cdEmoji.value, dateTs, cdYearly.value)
  upcomingEvents.value = countdownSystem.getUpcoming(20)
  cdTitle.value = ''
  cdDate.value = new Date().toISOString().slice(0, 10)
  cdYearly.value = false
  showAddEvent.value = false
}

async function removeCountdownEvent(id: number) {
  await countdownSystem.removeEvent(id)
  upcomingEvents.value = countdownSystem.getUpcoming(20)
}

function formatDaysLeft(days: number): string {
  if (days === 0) return 'Today!'
  if (days === 1) return 'Tomorrow'
  if (days < 0) return `${-days}d ago`
  return `${days}d`
}

async function saveBackendUrl() {
  const url = coupleBackendUrl.value.trim()
  if (!url) return
  props.coupleEngine.setBackendUrl(url)
  coupleError.value = ''
}

async function createInvite() {
  coupleLoading.value = true
  coupleError.value = ''
  try {
    const result = await props.coupleEngine.createInvite()
    inviteCode.value = result.code
  } catch (e: any) {
    coupleError.value = e.message || 'Failed to create invite'
  } finally {
    coupleLoading.value = false
  }
}

async function joinCouple() {
  const code = joinCode.value.trim()
  if (!code) return
  coupleLoading.value = true
  coupleError.value = ''
  try {
    await props.coupleEngine.joinCouple(code)
    coupleStatus.value = props.coupleEngine.status
    joinCode.value = ''
  } catch (e: any) {
    coupleError.value = e.message || 'Failed to join'
  } finally {
    coupleLoading.value = false
  }
}

async function sendCheer() {
  const msg = cheerMessage.value.trim()
  if (!msg) return
  coupleLoading.value = true
  try {
    await props.coupleEngine.sendCheer(msg)
    cheerMessage.value = ''
  } catch (e: any) {
    coupleError.value = e.message || 'Failed to send cheer'
  } finally {
    coupleLoading.value = false
  }
}

async function unlinkCouple() {
  coupleLoading.value = true
  coupleError.value = ''
  try {
    await props.coupleEngine.unlink()
    coupleStatus.value = { coupled: false }
    inviteCode.value = ''
  } catch (e: any) {
    coupleError.value = e.message || 'Failed to unlink'
  } finally {
    coupleLoading.value = false
  }
}

async function refreshCoupleStatus() {
  coupleLoading.value = true
  try {
    coupleStatus.value = await props.coupleEngine.refreshStatus()
  } catch {} finally {
    coupleLoading.value = false
  }
}

async function toggleAdaptive() {
  adaptiveEnabled.value = !adaptiveEnabled.value
  await configSet('reminder_adaptive', String(adaptiveEnabled.value))
}

async function openAlgoInsight(type: ReminderBanditType) {
  insightType.value = type
  banditData.value = banditLoader.getState(type)
  showAlgoInsight.value = true
  await nextTick()
  drawBetaCurves()
}

function drawBetaCurves() {
  const canvas = algoCanvasRef.value
  if (!canvas || !banditData.value) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const w = canvas.width = canvas.offsetWidth * 2
  const h = canvas.height = canvas.offsetHeight * 2
  ctx.clearRect(0, 0, w, h)
  ctx.scale(2, 2)
  const cw = w / 2
  const ch = h / 2

  const colors = ['#FF6B6B', '#FFA07A', '#FFD93D', '#6BCB77', '#4A90D9', '#9B59B6']
  const arms = banditData.value.arms

  // Find max y for normalization
  let maxY = 0
  const allCurves: { x: number; y: number }[][] = []
  for (const arm of arms) {
    const curve = ThompsonBandit.betaPDF(arm.alpha, arm.beta, 50)
    allCurves.push(curve)
    for (const p of curve) {
      if (p.y > maxY) maxY = p.y
    }
  }
  if (maxY === 0) maxY = 1

  const pad = { left: 4, right: 4, top: 4, bottom: 14 }
  const plotW = cw - pad.left - pad.right
  const plotH = ch - pad.top - pad.bottom

  // Draw curves
  for (let i = 0; i < allCurves.length; i++) {
    const curve = allCurves[i]
    ctx.beginPath()
    ctx.strokeStyle = colors[i]
    ctx.lineWidth = 1.2
    ctx.globalAlpha = 0.8
    for (let j = 0; j < curve.length; j++) {
      const x = pad.left + (curve[j].x * plotW)
      const y = pad.top + plotH - (curve[j].y / maxY * plotH)
      if (j === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.stroke()
    ctx.globalAlpha = 1
  }

  // X-axis label
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '5px sans-serif'
  ctx.fillText('0', pad.left, ch - 2)
  ctx.fillText('1', cw - pad.right - 4, ch - 2)
  ctx.fillText('P(accept)', cw / 2 - 12, ch - 2)
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
      <button class="stab" :class="{ active: tab === 'dates' }" @click="tab = 'dates'">Dates</button>
      <button class="stab" :class="{ active: tab === 'couple' }" @click="tab = 'couple'">Couple</button>
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
          Local mode requires llama-server sidecar with Qwen3-4B model.
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

        <div class="section-title">Smart Intervals</div>
        <div class="reminder-row">
          <label class="toggle-label">
            <input type="checkbox" v-model="adaptiveEnabled" @change="toggleAdaptive" />
            Thompson Sampling (auto-learn)
          </label>
          <div class="hint" style="padding-left:20px">
            {{ adaptiveEnabled ? 'Bandit auto-learns your preferred intervals' : 'Using fixed intervals above' }}
          </div>
        </div>

        <div v-if="adaptiveEnabled" class="algo-btns">
          <button class="mini-btn" @click="openAlgoInsight('water')">💧 Insight</button>
          <button class="mini-btn" @click="openAlgoInsight('stretch')">🧘 Insight</button>
          <button class="mini-btn" @click="openAlgoInsight('eyes')">👀 Insight</button>
        </div>

        <!-- Algorithm Insight Panel -->
        <div v-if="showAlgoInsight && banditData" class="algo-panel">
          <div class="algo-header">
            <span class="algo-title">Algorithm Insight: {{ insightType }}</span>
            <button class="mini-btn" @click="showAlgoInsight = false">✕</button>
          </div>
          <canvas ref="algoCanvasRef" class="algo-canvas"></canvas>
          <div class="algo-legend">
            <div v-for="(arm, i) in banditData.arms" :key="i" class="legend-item">
              <span class="legend-dot" :style="{ background: ['#FF6B6B','#FFA07A','#FFD93D','#6BCB77','#4A90D9','#9B59B6'][i] }"></span>
              <span class="legend-label">{{ arm.intervalMin }}min</span>
              <span class="legend-stat">
                {{ arm.totalPulls > 0 ? Math.round((arm.alpha - 1) / arm.totalPulls * 100) : 0 }}%
                ({{ arm.totalPulls }})
              </span>
            </div>
          </div>
          <div class="algo-status">
            {{ banditData.explorationPhase ? 'Exploring...' : 'Exploiting' }}
            | Total: {{ banditData.totalInteractions }} interactions
          </div>
        </div>

        <div class="hint">Reminders auto-pause during Focus sessions (DND).</div>
      </div>

      <!-- Dates / Countdown -->
      <div v-if="tab === 'dates'" class="tab-content">
        <div class="section-title">
          Important Dates
          <button class="mini-btn" style="margin-left:auto" @click="showAddEvent = !showAddEvent">
            {{ showAddEvent ? '✕' : '+ Add' }}
          </button>
        </div>

        <div v-if="showAddEvent" class="cd-form">
          <div class="row" style="flex-wrap:wrap;gap:2px">
            <button
              v-for="em in EMOJI_OPTS" :key="em"
              class="emoji-opt" :class="{ active: cdEmoji === em }"
              @click="cdEmoji = em"
            >{{ em }}</button>
          </div>
          <div class="row">
            <input v-model="cdTitle" class="text-input" placeholder="Event name" maxlength="20" @keyup.enter="addCountdownEvent" />
          </div>
          <div class="row">
            <input v-model="cdDate" type="date" class="text-input" style="width:100px;flex:none" />
            <label class="toggle-label" style="font-size:8px">
              <input type="checkbox" v-model="cdYearly" /> Yearly
            </label>
            <button class="mini-btn primary" @click="addCountdownEvent">Add</button>
          </div>
        </div>

        <div v-if="upcomingEvents.length === 0" class="hint" style="text-align:center;margin-top:16px">
          No events yet. Add one to get reminders!
        </div>

        <div
          v-for="u in upcomingEvents" :key="u.event.id"
          class="cd-item" :class="{ 'cd-today': u.isToday }"
        >
          <span class="cd-emoji">{{ u.event.emoji }}</span>
          <div class="cd-info">
            <div class="cd-name">{{ u.event.title }}</div>
            <div class="cd-meta">
              {{ new Date(u.effectiveDateTs).toLocaleDateString() }}
              <span v-if="u.event.yearly" style="color:rgba(74,144,217,0.6)">↻</span>
            </div>
          </div>
          <div class="cd-days" :class="{ 'cd-days-today': u.isToday, 'cd-days-soon': u.daysLeft > 0 && u.daysLeft <= 7 }">
            {{ formatDaysLeft(u.daysLeft) }}
          </div>
          <button class="cd-del" @click="removeCountdownEvent(u.event.id)">×</button>
        </div>
      </div>

      <!-- Couple Mode -->
      <div v-if="tab === 'couple'" class="tab-content">
        <!-- Backend URL config -->
        <div class="section-title">Server URL</div>
        <div class="row">
          <input v-model="coupleBackendUrl" class="text-input api-input" placeholder="https://your-server.up.railway.app" @blur="saveBackendUrl" />
        </div>

        <template v-if="coupleBackendUrl">
          <!-- Not coupled: show invite/join -->
          <template v-if="!coupleStatus.coupled">
            <div class="section-title">Create Invite</div>
            <div class="row">
              <button class="mini-btn primary" :disabled="coupleLoading" @click="createInvite">Generate Code</button>
              <span v-if="inviteCode" class="couple-code">{{ inviteCode }}</span>
            </div>

            <div class="section-title">Join Partner</div>
            <div class="row">
              <input v-model="joinCode" class="text-input" placeholder="Enter 6-digit code" maxlength="6" style="text-transform:uppercase" @keyup.enter="joinCouple" />
              <button class="mini-btn primary" :disabled="coupleLoading" @click="joinCouple">Join</button>
            </div>
          </template>

          <!-- Coupled: show status + cheer + unlink -->
          <template v-else>
            <div class="couple-status-card">
              <div class="couple-connected">Connected</div>
              <div class="couple-xp">Shared XP: {{ coupleStatus.shared_xp || 0 }}</div>
              <div class="couple-partner">Partner: {{ (coupleStatus.partner_id || '').slice(0, 8) }}...</div>
            </div>

            <div class="section-title">Send Cheer</div>
            <div class="row">
              <input v-model="cheerMessage" class="text-input" placeholder="Go go go!" maxlength="50" @keyup.enter="sendCheer" />
              <button class="mini-btn primary" :disabled="coupleLoading" @click="sendCheer">Send</button>
            </div>

            <div class="row" style="margin-top:8px">
              <button class="mini-btn" @click="refreshCoupleStatus">Refresh</button>
              <button class="mini-btn" style="color:rgba(255,100,100,0.7)" @click="unlinkCouple">Unlink</button>
            </div>
          </template>

          <div v-if="coupleError" class="couple-error">{{ coupleError }}</div>
        </template>

        <div v-else class="hint" style="margin-top:8px">
          Deploy the backend (Railway/Fly.io), then enter the URL above to enable couple mode.
        </div>

        <div class="hint" style="margin-top:4px">
          ID: {{ coupleEngine.myUserId.slice(0, 8) }}...
        </div>
      </div>

      <!-- Skins -->
      <div v-if="tab === 'skins'" class="tab-content">
        <button class="export-btn" style="margin-bottom:6px" @click="emit('open-oc-creator')">
          &#9998; OC Character Creator
        </button>
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

/* Countdown dates */
.cd-form { display: flex; flex-direction: column; gap: 4px; padding: 6px; background: rgba(0,0,0,0.2); border-radius: 6px; }
.emoji-opt { font-size: 12px; padding: 2px 3px; border-radius: 4px; border: 1px solid transparent; background: none; cursor: pointer; }
.emoji-opt.active { border-color: rgba(74,144,217,0.5); background: rgba(74,144,217,0.15); }
.cd-item {
  display: flex; align-items: center; gap: 6px;
  padding: 4px 6px; border-radius: 5px;
  background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.04);
}
.cd-item.cd-today { background: rgba(255,215,0,0.06); border-color: rgba(255,215,0,0.15); }
.cd-emoji { font-size: 13px; flex-shrink: 0; }
.cd-info { flex: 1; min-width: 0; }
.cd-name { font-size: 9px; color: rgba(255,255,255,0.8); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.cd-meta { font-size: 7px; color: rgba(255,255,255,0.25); }
.cd-days { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.45); flex-shrink: 0; }
.cd-days-today { color: #FFD93D; }
.cd-days-soon { color: #FFA07A; }
.cd-del { background: none; border: none; color: rgba(255,255,255,0.12); font-size: 11px; cursor: pointer; padding: 0 2px; }
.cd-del:hover { color: rgba(255,100,100,0.6); }

/* Algorithm Insight */
.algo-btns { display: flex; gap: 4px; }
.algo-panel {
  background: rgba(0,0,0,0.4); border-radius: 6px;
  padding: 6px; border: 1px solid rgba(255,255,255,0.08);
}
.algo-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; }
.algo-title { font-size: 9px; font-weight: 600; color: rgba(255,255,255,0.7); }
.algo-canvas { width: 100%; height: 60px; display: block; }
.algo-legend { display: flex; flex-wrap: wrap; gap: 2px 6px; margin-top: 4px; }
.legend-item { display: flex; align-items: center; gap: 2px; font-size: 7px; color: rgba(255,255,255,0.5); }
.legend-dot { width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0; }
.legend-label { color: rgba(255,255,255,0.6); }
.legend-stat { color: rgba(255,255,255,0.35); }
.algo-status { font-size: 7px; color: rgba(255,255,255,0.25); margin-top: 4px; text-align: center; }

/* Couple Mode */
.couple-code {
  font-family: monospace; font-size: 14px; font-weight: 700;
  color: #FFD93D; letter-spacing: 2px; padding: 2px 6px;
  background: rgba(255,215,0,0.08); border-radius: 4px;
}
.couple-status-card {
  padding: 8px 10px; border-radius: 6px;
  background: rgba(74,217,144,0.08); border: 1px solid rgba(74,217,144,0.2);
}
.couple-connected { font-size: 10px; font-weight: 600; color: #6BCB77; }
.couple-xp { font-size: 11px; color: rgba(255,255,255,0.7); margin-top: 2px; }
.couple-partner { font-size: 8px; color: rgba(255,255,255,0.3); margin-top: 2px; font-family: monospace; }
.couple-error { font-size: 8px; color: rgba(255,100,100,0.7); margin-top: 4px; }

.settings-body::-webkit-scrollbar { width: 3px; }
.settings-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 3px; }
</style>
