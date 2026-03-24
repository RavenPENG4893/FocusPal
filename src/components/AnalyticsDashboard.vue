<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from 'vue'
import { AnalyticsEngine, type HeatmapCell, type WeeklyAggregate, type ScatterPoint } from '../engine/AnalyticsEngine'

const emit = defineEmits<{ (e: 'close'): void }>()

const engine = new AnalyticsEngine()
const loading = ref(true)
const tab = ref<'narration' | 'heatmap' | 'trend' | 'scatter'>('narration')
const narration = ref('')

// Chart data
const heatmap = ref<HeatmapCell[]>([])
const weeklyTrend = ref<WeeklyAggregate[]>([])
const scatter = ref<ScatterPoint[]>([])

// Canvas refs
const trendCanvas = ref<HTMLCanvasElement | null>(null)
const scatterCanvas = ref<HTMLCanvasElement | null>(null)

async function refresh() {
  loading.value = true
  await engine.loadYear()
  heatmap.value = engine.getHeatmapData()
  weeklyTrend.value = engine.getWeeklyTrend()
  scatter.value = engine.getScatterData()

  // Narration based on day of week
  const dow = new Date().getDay()
  narration.value = dow === 1
    ? engine.generateWeeklyNarration()
    : engine.generateMorningNarration()

  loading.value = false
}

onMounted(() => refresh())

watch(tab, async () => {
  await nextTick()
  if (tab.value === 'trend') drawTrendChart()
  if (tab.value === 'scatter') drawScatterChart()
})

// ── Heatmap colors ──
const HEATMAP_COLORS = [
  'rgba(255,255,255,0.06)',
  'rgba(74,144,217,0.3)',
  'rgba(74,144,217,0.5)',
  'rgba(74,144,217,0.7)',
  'rgba(74,144,217,0.95)',
]

// ── Weekly Trend Chart (Canvas) ──
function drawTrendChart() {
  const cvs = trendCanvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  const W = cvs.width
  const H = cvs.height
  const PAD = { top: 20, right: 15, bottom: 30, left: 35 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  ctx.clearRect(0, 0, W, H)

  const data = weeklyTrend.value
  if (data.length === 0) return
  const maxMins = Math.max(...data.map(d => d.totalMinutes), 60)

  // Grid lines
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (chartH / 4) * i
    ctx.beginPath()
    ctx.moveTo(PAD.left, y)
    ctx.lineTo(W - PAD.right, y)
    ctx.stroke()
  }

  // Y axis labels
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '9px monospace'
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (chartH / 4) * i
    const val = Math.round(maxMins - (maxMins / 4) * i)
    ctx.fillText(`${val}m`, PAD.left - 4, y + 3)
  }

  // Bars
  const barW = Math.max(4, (chartW / data.length) - 3)
  data.forEach((d, i) => {
    const x = PAD.left + (chartW / data.length) * i + (chartW / data.length - barW) / 2
    const barH = (d.totalMinutes / maxMins) * chartH
    const y = PAD.top + chartH - barH

    // Bar gradient
    ctx.fillStyle = d.totalMinutes > 0 ? 'rgba(74,144,217,0.7)' : 'rgba(255,255,255,0.05)'
    ctx.beginPath()
    ctx.roundRect(x, y, barW, barH, 2)
    ctx.fill()

    // X label
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '7px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(d.weekLabel, x + barW / 2, H - 8)
  })

  // 4-week rolling average line
  ctx.strokeStyle = 'rgba(255,210,80,0.8)'
  ctx.lineWidth = 1.5
  ctx.beginPath()
  for (let i = 0; i < data.length; i++) {
    const start = Math.max(0, i - 3)
    const window = data.slice(start, i + 1)
    const avg = window.reduce((s, w) => s + w.totalMinutes, 0) / window.length
    const x = PAD.left + (chartW / data.length) * i + (chartW / data.length) / 2
    const y = PAD.top + chartH - (avg / maxMins) * chartH
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.stroke()
}

// ── Scatter Chart (Canvas) ──
function drawScatterChart() {
  const cvs = scatterCanvas.value
  if (!cvs) return
  const ctx = cvs.getContext('2d')
  if (!ctx) return

  const W = cvs.width
  const H = cvs.height
  const PAD = { top: 15, right: 15, bottom: 30, left: 35 }
  const chartW = W - PAD.left - PAD.right
  const chartH = H - PAD.top - PAD.bottom

  ctx.clearRect(0, 0, W, H)

  const data = scatter.value
  if (data.length === 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    ctx.font = '11px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText('Need both focus & mood data', W / 2, H / 2)
    return
  }

  const maxH = Math.max(...data.map(d => d.focusHours), 2)

  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (chartH / 4) * i
    ctx.beginPath()
    ctx.moveTo(PAD.left, y)
    ctx.lineTo(W - PAD.right, y)
    ctx.stroke()
  }

  // Axes labels
  ctx.fillStyle = 'rgba(255,255,255,0.4)'
  ctx.font = '8px monospace'
  // Y axis (focus hours)
  ctx.textAlign = 'right'
  for (let i = 0; i <= 4; i++) {
    const y = PAD.top + (chartH / 4) * i
    const val = (maxH - (maxH / 4) * i).toFixed(1)
    ctx.fillText(`${val}h`, PAD.left - 4, y + 3)
  }
  // X axis (mood 1-5)
  ctx.textAlign = 'center'
  for (let s = 1; s <= 5; s++) {
    const x = PAD.left + ((s - 1) / 4) * chartW
    ctx.fillText(`${s}`, x, H - 8)
  }

  // Axis titles
  ctx.fillStyle = 'rgba(255,255,255,0.3)'
  ctx.font = '7px sans-serif'
  ctx.fillText('Mood Score', PAD.left + chartW / 2, H - 1)

  // Points
  for (const p of data) {
    const x = PAD.left + ((p.moodScore - 1) / 4) * chartW
    const y = PAD.top + chartH - (p.focusHours / maxH) * chartH
    ctx.beginPath()
    ctx.arc(x, y, 3, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(74,200,170,0.6)'
    ctx.fill()
    ctx.strokeStyle = 'rgba(74,200,170,0.9)'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }
}
</script>

<template>
  <div class="analytics-overlay">
    <div class="analytics-panel">
      <div class="panel-header">
        <span class="panel-title">Analytics</span>
        <button class="close-btn" @click="emit('close')">×</button>
      </div>

      <div class="tabs">
        <button class="tab-btn" :class="{ active: tab === 'narration' }" @click="tab = 'narration'">Story</button>
        <button class="tab-btn" :class="{ active: tab === 'heatmap' }" @click="tab = 'heatmap'">Heatmap</button>
        <button class="tab-btn" :class="{ active: tab === 'trend' }" @click="tab = 'trend'">Trend</button>
        <button class="tab-btn" :class="{ active: tab === 'scatter' }" @click="tab = 'scatter'">Focus×Mood</button>
      </div>

      <div class="panel-body" v-if="!loading">
        <!-- Narration -->
        <div v-if="tab === 'narration'" class="narration-section">
          <div class="narration-card">
            <div class="narration-icon">💬</div>
            <div class="narration-text">{{ narration }}</div>
          </div>
          <div class="quick-stats">
            <div class="stat-item">
              <div class="stat-value">{{ weeklyTrend.length > 0 ? weeklyTrend[weeklyTrend.length - 1].totalMinutes : 0 }}m</div>
              <div class="stat-label">This Week</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ weeklyTrend.length > 0 ? weeklyTrend[weeklyTrend.length - 1].sessions : 0 }}</div>
              <div class="stat-label">Sessions</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ scatter.length }}</div>
              <div class="stat-label">Data Days</div>
            </div>
          </div>
        </div>

        <!-- Heatmap -->
        <div v-if="tab === 'heatmap'" class="heatmap-section">
          <div class="heatmap-grid">
            <div
              v-for="(cell, i) in heatmap"
              :key="i"
              class="heatmap-cell"
              :style="{ background: HEATMAP_COLORS[cell.level] }"
              :title="`${cell.date}: ${cell.minutes}min`"
            />
          </div>
          <div class="heatmap-legend">
            <span class="legend-label">Less</span>
            <div v-for="(c, i) in HEATMAP_COLORS" :key="i" class="legend-cell" :style="{ background: c }" />
            <span class="legend-label">More</span>
          </div>
        </div>

        <!-- Trend chart -->
        <div v-if="tab === 'trend'" class="chart-section">
          <div class="chart-title">Weekly Focus (12 weeks)</div>
          <canvas ref="trendCanvas" width="340" height="180" class="chart-canvas" />
          <div class="chart-hint">Yellow line = 4-week rolling average</div>
        </div>

        <!-- Scatter -->
        <div v-if="tab === 'scatter'" class="chart-section">
          <div class="chart-title">Focus Hours vs Mood Score</div>
          <canvas ref="scatterCanvas" width="340" height="180" class="chart-canvas" />
          <div class="chart-hint">Each dot = one day with both focus & mood data</div>
        </div>
      </div>

      <div v-else class="loading">Loading analytics...</div>
    </div>
  </div>
</template>

<style scoped>
.analytics-overlay {
  position: absolute;
  top: 0; bottom: 0; left: 0; right: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 35;
}

.analytics-panel {
  width: 380px;
  max-height: 420px;
  background: rgba(15, 20, 40, 0.96);
  border-radius: 14px;
  border: 1px solid rgba(74, 144, 217, 0.25);
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}

.panel-title {
  color: rgba(255,255,255,0.9);
  font-size: 14px;
  font-weight: 700;
}

.close-btn {
  background: none;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 18px;
  cursor: pointer;
  line-height: 1;
}

.tabs {
  display: flex;
  padding: 6px 10px 0;
  gap: 2px;
}

.tab-btn {
  flex: 1;
  padding: 5px 4px;
  border: none;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5);
  font-size: 10px;
  cursor: pointer;
  border-radius: 6px 6px 0 0;
  transition: all 0.2s;
}
.tab-btn.active {
  background: rgba(74,144,217,0.2);
  color: rgba(255,255,255,0.9);
}

.panel-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 14px;
}

.loading {
  padding: 30px;
  text-align: center;
  color: rgba(255,255,255,0.4);
  font-size: 12px;
}

/* Narration */
.narration-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.narration-card {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  background: rgba(74,144,217,0.1);
  border-radius: 10px;
  padding: 12px;
  border: 1px solid rgba(74,144,217,0.15);
}

.narration-icon {
  font-size: 20px;
  flex-shrink: 0;
}

.narration-text {
  color: rgba(255,255,255,0.85);
  font-size: 12px;
  line-height: 1.6;
}

.quick-stats {
  display: flex;
  gap: 8px;
}

.stat-item {
  flex: 1;
  text-align: center;
  background: rgba(255,255,255,0.04);
  border-radius: 8px;
  padding: 8px 4px;
}

.stat-value {
  color: rgba(74,144,217,0.9);
  font-size: 16px;
  font-weight: 700;
}

.stat-label {
  color: rgba(255,255,255,0.4);
  font-size: 9px;
  margin-top: 2px;
}

/* Heatmap */
.heatmap-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.heatmap-grid {
  display: grid;
  grid-template-columns: repeat(53, 1fr);
  grid-template-rows: repeat(7, 1fr);
  gap: 1px;
  grid-auto-flow: column;
}

.heatmap-cell {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 1.5px;
  min-width: 4px;
  min-height: 4px;
}

.heatmap-legend {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 3px;
}

.legend-label {
  color: rgba(255,255,255,0.3);
  font-size: 8px;
}

.legend-cell {
  width: 10px;
  height: 10px;
  border-radius: 2px;
}

/* Charts */
.chart-section {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.chart-title {
  color: rgba(255,255,255,0.6);
  font-size: 10px;
  font-weight: 600;
}

.chart-canvas {
  width: 100%;
  height: auto;
  border-radius: 6px;
  background: rgba(0,0,0,0.2);
}

.chart-hint {
  color: rgba(255,255,255,0.25);
  font-size: 8px;
  text-align: center;
}
</style>
