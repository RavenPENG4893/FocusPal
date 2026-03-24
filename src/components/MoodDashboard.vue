<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch } from 'vue'
import { invoke } from '@tauri-apps/api/core'

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'moodRecorded', score: number): void
}>()

// ── Types ──
interface MoodRecord {
  id: number
  score: number
  timestamp: number
  tags: string
}

interface MoodStats {
  avg_7d: number
  avg_prev_7d: number
  checkins_7d: number
  most_common_score: number
  best_streak: number
}

const EMOJIS: Record<number, string> = { 1: '😢', 2: '😔', 3: '😐', 4: '🙂', 5: '😄' }
const EMOJI_LABELS: Record<number, string> = { 1: 'Bad', 2: 'Low', 3: 'Neutral', 4: 'Good', 5: 'Great' }

const TAGS = ['work', 'social', 'health', 'weather', 'rest', 'exercise']

// ── State ──
const showEmojiPicker = ref(false)
const selectedTags = ref<string[]>([])
const lastRecord = ref<MoodRecord | null>(null)
const chartTab = ref<'today' | '7days'>('today')
const records = ref<MoodRecord[]>([])
const stats = ref<MoodStats | null>(null)
const showStats = ref(false)
const chartCanvas = ref<HTMLCanvasElement | null>(null)

// ── Computed ──
const lastRecordAgo = computed(() => {
  if (!lastRecord.value) return ''
  const diff = Date.now() - lastRecord.value.timestamp
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const hr = Math.floor(min / 60)
  return `${hr}h ago`
})

const trendArrow = computed(() => {
  if (!stats.value) return '→'
  const diff = stats.value.avg_7d - stats.value.avg_prev_7d
  if (diff > 0.5) return '↑'
  if (diff > 0.2) return '↗'
  if (diff > -0.2) return '→'
  if (diff > -0.5) return '↘'
  return '↓'
})

const summaryText = computed(() => {
  if (!stats.value) return 'No data yet'
  return `Avg ${stats.value.avg_7d.toFixed(1)} · ${stats.value.checkins_7d} check-ins this week`
})

// ── Actions ──
async function recordMood(score: number) {
  const tags = selectedTags.value.join(',')
  try {
    await invoke('insert_mood', { score, tags })
  } catch (e) {
    console.error('[Mood] insert error:', e)
  }
  showEmojiPicker.value = false
  selectedTags.value = []
  emit('moodRecorded', score)
  await refresh()
}

function toggleTag(tag: string) {
  const i = selectedTags.value.indexOf(tag)
  if (i >= 0) selectedTags.value.splice(i, 1)
  else selectedTags.value.push(tag)
}

async function refresh() {
  const now = Date.now()
  const dayMs = 86400000

  // Load records for chart
  const fromTs = chartTab.value === 'today'
    ? now - dayMs
    : now - 7 * dayMs

  try {
    records.value = await invoke<MoodRecord[]>('query_moods', { fromTs, toTs: now })
    stats.value = await invoke<MoodStats>('get_mood_stats')
  } catch (e) {
    console.error('[Mood] query error:', e)
  }

  // Find last record
  if (records.value.length > 0) {
    lastRecord.value = records.value[records.value.length - 1]
  }

  await nextTick()
  drawChart()
}

async function exportData() {
  try {
    const all = await invoke<MoodRecord[]>('export_moods')
    const json = JSON.stringify(all, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `focuspal_moods_${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error('[Mood] export error:', e)
  }
}

// ── Chart drawing ──
function drawChart() {
  const canvas = chartCanvas.value
  if (!canvas) return
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const W = canvas.width
  const H = canvas.height
  const PAD_L = 20
  const PAD_R = 8
  const PAD_T = 12
  const PAD_B = 16
  const chartW = W - PAD_L - PAD_R
  const chartH = H - PAD_T - PAD_B

  ctx.clearRect(0, 0, W, H)

  // Grid lines (y = 1-5)
  ctx.strokeStyle = 'rgba(255,255,255,0.06)'
  ctx.lineWidth = 1
  for (let i = 1; i <= 5; i++) {
    const y = PAD_T + chartH - ((i - 1) / 4) * chartH
    ctx.beginPath()
    ctx.moveTo(PAD_L, y)
    ctx.lineTo(W - PAD_R, y)
    ctx.stroke()
  }

  // Y labels
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = '7px monospace'
  ctx.textAlign = 'right'
  for (let i = 1; i <= 5; i++) {
    const y = PAD_T + chartH - ((i - 1) / 4) * chartH
    ctx.fillText(String(i), PAD_L - 3, y + 3)
  }

  if (chartTab.value === 'today') {
    drawTodayChart(ctx, chartW, chartH, PAD_L, PAD_T, PAD_B, W)
  } else {
    draw7DaysChart(ctx, chartW, chartH, PAD_L, PAD_T, PAD_B, W)
  }
}

function drawTodayChart(
  ctx: CanvasRenderingContext2D,
  chartW: number, chartH: number,
  padL: number, padT: number, padB: number, W: number,
) {
  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()

  // X labels (hours)
  ctx.fillStyle = 'rgba(255,255,255,0.2)'
  ctx.font = '6px monospace'
  ctx.textAlign = 'center'
  for (let h = 0; h <= 24; h += 4) {
    const x = padL + (h / 24) * chartW
    ctx.fillText(`${h}:00`, x, padT + chartH + 10)
  }

  // Current time vertical line
  const nowHour = (now.getHours() + now.getMinutes() / 60) / 24
  const nowX = padL + nowHour * chartW
  ctx.strokeStyle = 'rgba(74,144,217,0.3)'
  ctx.setLineDash([2, 2])
  ctx.beginPath()
  ctx.moveTo(nowX, padT)
  ctx.lineTo(nowX, padT + chartH)
  ctx.stroke()
  ctx.setLineDash([])

  // Filter today's records
  const todayRecords = records.value.filter(r => r.timestamp >= todayStart)
  if (todayRecords.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.2)'
    ctx.font = '9px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('No records today', padL + chartW / 2, padT + chartH / 2)
    return
  }

  // Points
  const points = todayRecords.map(r => {
    const d = new Date(r.timestamp)
    const hourFrac = (d.getHours() + d.getMinutes() / 60) / 24
    const x = padL + hourFrac * chartW
    const y = padT + chartH - ((r.score - 1) / 4) * chartH
    return { x, y, score: r.score }
  })

  // Lines (pixel-style: no smoothing)
  ctx.strokeStyle = 'rgba(74,144,217,0.7)'
  ctx.lineWidth = 2
  ctx.beginPath()
  points.forEach((p, i) => {
    if (i === 0) ctx.moveTo(p.x, p.y)
    else ctx.lineTo(p.x, p.y)
  })
  ctx.stroke()

  // Emoji dots
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  points.forEach(p => {
    ctx.fillText(EMOJIS[p.score] || '?', p.x, p.y + 4)
  })
}

function draw7DaysChart(
  ctx: CanvasRenderingContext2D,
  chartW: number, chartH: number,
  padL: number, padT: number, padB: number, W: number,
) {
  const now = new Date()
  const dayMs = 86400000
  const days: { label: string; start: number; end: number }[] = []

  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getTime() - i * dayMs)
    const start = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]
    days.push({ label: weekday, start, end: start + dayMs })
  }

  // X labels
  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = '7px monospace'
  ctx.textAlign = 'center'
  days.forEach((d, i) => {
    const x = padL + ((i + 0.5) / 7) * chartW
    ctx.fillText(d.label, x, padT + chartH + 11)
  })

  // Per-day stats
  const dayStats = days.map(d => {
    const dayRecs = records.value.filter(r => r.timestamp >= d.start && r.timestamp < d.end)
    if (dayRecs.length === 0) return null
    const scores = dayRecs.map(r => r.score)
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length
    const min = Math.min(...scores)
    const max = Math.max(...scores)
    return { avg, min, max }
  })

  // Range bands (min-max)
  ctx.fillStyle = 'rgba(74,144,217,0.12)'
  dayStats.forEach((ds, i) => {
    if (!ds) return
    const x = padL + ((i + 0.5) / 7) * chartW
    const yMin = padT + chartH - ((ds.min - 1) / 4) * chartH
    const yMax = padT + chartH - ((ds.max - 1) / 4) * chartH
    ctx.fillRect(x - 6, yMax, 12, yMin - yMax || 2)
  })

  // Line connecting averages
  const avgPoints: { x: number; y: number; avg: number }[] = []
  dayStats.forEach((ds, i) => {
    if (!ds) return
    const x = padL + ((i + 0.5) / 7) * chartW
    const y = padT + chartH - ((ds.avg - 1) / 4) * chartH
    avgPoints.push({ x, y, avg: ds.avg })
  })

  if (avgPoints.length > 1) {
    ctx.strokeStyle = 'rgba(74,144,217,0.7)'
    ctx.lineWidth = 2
    ctx.beginPath()
    avgPoints.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p.x, p.y)
      else ctx.lineTo(p.x, p.y)
    })
    ctx.stroke()
  }

  // Emoji dots at avg
  ctx.font = '10px sans-serif'
  ctx.textAlign = 'center'
  avgPoints.forEach(p => {
    const rounded = Math.round(p.avg)
    ctx.fillText(EMOJIS[rounded] || '?', p.x, p.y + 4)
  })

  // Gray dashes for missing days
  dayStats.forEach((ds, i) => {
    if (ds) return
    const x = padL + ((i + 0.5) / 7) * chartW
    const y = padT + chartH / 2
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fillText('·', x, y)
  })
}

// ── Lifecycle ──
watch(chartTab, () => refresh())

onMounted(() => {
  refresh()
})
</script>

<template>
  <div class="mood-panel">
    <div class="mood-header">
      <span class="mood-title">Mood</span>
      <div class="mood-header-actions">
        <button class="export-btn" title="Export all data" @click="exportData">⬇</button>
        <button class="mood-close" @click="emit('close')">✕</button>
      </div>
    </div>

    <!-- Top: Check-in button -->
    <div class="checkin-section">
      <button
        v-if="!showEmojiPicker"
        class="checkin-btn"
        @click="showEmojiPicker = true"
      >
        <template v-if="lastRecord">
          <span>{{ EMOJIS[lastRecord.score] }} {{ lastRecordAgo }}</span>
          <span class="checkin-sub">tap to record again</span>
        </template>
        <template v-else>
          Record how I feel
        </template>
      </button>

      <div v-else class="emoji-picker">
        <div class="emoji-row">
          <button
            v-for="s in [5, 4, 3, 2, 1]"
            :key="s"
            class="emoji-btn"
            @click="recordMood(s)"
          >
            <span class="emoji-icon">{{ EMOJIS[s] }}</span>
            <span class="emoji-label">{{ EMOJI_LABELS[s] }}</span>
          </button>
        </div>
        <div class="tag-row">
          <button
            v-for="tag in TAGS"
            :key="tag"
            class="tag-btn"
            :class="{ active: selectedTags.includes(tag) }"
            @click="toggleTag(tag)"
          >
            {{ tag }}
          </button>
        </div>
        <button class="picker-cancel" @click="showEmojiPicker = false">cancel</button>
      </div>
    </div>

    <!-- Middle: Chart -->
    <div class="chart-section">
      <div class="chart-tabs">
        <button
          class="tab-btn"
          :class="{ active: chartTab === 'today' }"
          @click="chartTab = 'today'"
        >Today</button>
        <button
          class="tab-btn"
          :class="{ active: chartTab === '7days' }"
          @click="chartTab = '7days'"
        >7 Days</button>
      </div>
      <canvas ref="chartCanvas" width="260" height="120" class="chart-canvas"></canvas>
    </div>

    <!-- Bottom: Stats -->
    <div class="stats-section">
      <button class="stats-summary" @click="showStats = !showStats">
        {{ summaryText }}
        <span class="stats-arrow">{{ showStats ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showStats && stats" class="stats-detail">
        <div class="stat-row">
          <span>7-day avg</span>
          <span>{{ stats.avg_7d.toFixed(1) }} {{ trendArrow }}</span>
        </div>
        <div class="stat-row">
          <span>Check-ins</span>
          <span>{{ stats.checkins_7d }} this week</span>
        </div>
        <div class="stat-row">
          <span>Most common</span>
          <span>{{ EMOJIS[stats.most_common_score] }} {{ EMOJI_LABELS[stats.most_common_score] }}</span>
        </div>
        <div class="stat-row">
          <span>Best streak</span>
          <span>{{ stats.best_streak }} days</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mood-panel {
  position: absolute;
  bottom: 0; left: 0; right: 0; top: 0;
  background: rgba(15, 20, 40, 0.95);
  border-radius: 12px;
  display: flex;
  flex-direction: column;
  z-index: 30;
  overflow: hidden;
  user-select: text;
}

.mood-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 10px;
  background: rgba(74, 144, 217, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.mood-title {
  color: rgba(255, 255, 255, 0.9);
  font-size: 11px;
  font-weight: 600;
}

.mood-header-actions {
  display: flex; gap: 4px; align-items: center;
}

.export-btn, .mood-close {
  background: none; border: none;
  color: rgba(255, 255, 255, 0.6);
  font-size: 12px; cursor: pointer; padding: 0 3px;
}
.export-btn:hover, .mood-close:hover { color: #fff; }

/* Check-in */
.checkin-section {
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.checkin-btn {
  width: 100%;
  background: rgba(74, 144, 217, 0.2);
  border: 1px solid rgba(74, 144, 217, 0.3);
  border-radius: 8px;
  color: #fff;
  font-size: 11px;
  padding: 6px 10px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  transition: background 0.15s;
}
.checkin-btn:hover { background: rgba(74, 144, 217, 0.35); }
.checkin-sub { font-size: 8px; color: rgba(255,255,255,0.35); }

.emoji-picker {
  display: flex; flex-direction: column; gap: 5px; align-items: center;
}

.emoji-row {
  display: flex; gap: 2px; justify-content: center;
}

.emoji-btn {
  display: flex; flex-direction: column; align-items: center; gap: 1px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 6px;
  padding: 3px 5px;
  cursor: pointer;
  transition: background 0.15s, transform 0.15s;
}
.emoji-btn:hover { background: rgba(74,144,217,0.3); transform: scale(1.1); }
.emoji-icon { font-size: 15px; line-height: 1; }
.emoji-label { font-size: 7px; color: rgba(255,255,255,0.5); }

.tag-row {
  display: flex; flex-wrap: wrap; gap: 3px; justify-content: center;
}

.tag-btn {
  font-size: 8px;
  padding: 2px 6px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.12);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.45);
  cursor: pointer;
  transition: all 0.15s;
}
.tag-btn.active {
  background: rgba(74,144,217,0.3);
  border-color: rgba(74,144,217,0.5);
  color: #fff;
}
.tag-btn:hover { border-color: rgba(255,255,255,0.3); }

.picker-cancel {
  font-size: 8px; color: rgba(255,255,255,0.3);
  background: none; border: none; cursor: pointer;
}
.picker-cancel:hover { color: rgba(255,255,255,0.6); }

/* Chart */
.chart-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 4px 8px;
  min-height: 0;
}

.chart-tabs {
  display: flex; gap: 4px; margin-bottom: 4px;
}

.tab-btn {
  flex: 1;
  font-size: 9px;
  padding: 3px 0;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.04);
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  transition: all 0.15s;
}
.tab-btn.active {
  background: rgba(74,144,217,0.25);
  border-color: rgba(74,144,217,0.4);
  color: #fff;
}

.chart-canvas {
  width: 100%;
  height: 100%;
  border-radius: 6px;
  background: rgba(0,0,0,0.15);
}

/* Stats */
.stats-section {
  padding: 4px 8px 6px;
  border-top: 1px solid rgba(255,255,255,0.06);
}

.stats-summary {
  width: 100%;
  background: none;
  border: none;
  color: rgba(255,255,255,0.4);
  font-size: 9px;
  cursor: pointer;
  padding: 4px 0;
  display: flex;
  justify-content: space-between;
}
.stats-summary:hover { color: rgba(255,255,255,0.6); }
.stats-arrow { font-size: 7px; }

.stats-detail {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-top: 4px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  font-size: 9px;
  color: rgba(255,255,255,0.5);
}

.stat-row span:last-child {
  color: rgba(255,255,255,0.75);
}
</style>
