// Scene Recognition Engine: detects what the user is doing via active window title
// Classifies into 8 scene types with distraction escalation

import { invoke } from '@tauri-apps/api/core'
import type { AnimationState } from './AnimationStateMachine'

// ── Types ──

export type SceneType =
  | 'coding'
  | 'writing'
  | 'social_media'
  | 'video'
  | 'communication'
  | 'meeting'
  | 'design'
  | 'general'

export interface ActiveWindowInfo {
  title: string
  app_name: string
  pid: number
}

export interface SceneState {
  scene: SceneType
  app_name: string
  title: string
  distractionMinutes: number  // how long in social/video scene
  escalationLevel: number     // 0-4 distraction escalation
}

// ── Scene Classification Rules ──

interface SceneRule {
  scene: SceneType
  appPatterns: RegExp[]
  titlePatterns: RegExp[]
}

const SCENE_RULES: SceneRule[] = [
  {
    scene: 'coding',
    appPatterns: [
      /code/i, /visual studio/i, /intellij/i, /pycharm/i, /webstorm/i,
      /sublime/i, /atom/i, /vim/i, /nvim/i, /neovim/i, /emacs/i,
      /rider/i, /clion/i, /goland/i, /android studio/i, /xcode/i,
      /cursor/i, /windsurf/i,
    ],
    titlePatterns: [
      /\.ts\b/i, /\.js\b/i, /\.py\b/i, /\.rs\b/i, /\.go\b/i, /\.java\b/i,
      /\.vue\b/i, /\.tsx\b/i, /\.jsx\b/i, /\.cpp\b/i, /\.c\b/i, /\.cs\b/i,
      /\.html\b/i, /\.css\b/i, /\.scss\b/i, /\.json\b/i, /\.toml\b/i,
      /\bgit\b/i, /\bnpm\b/i, /\bcargo\b/i, /\bpython\b/i, /\bnode\b/i,
      /\byarn\b/i, /\bpnpm\b/i, /\bdocker\b/i, /\bkubectl\b/i,
      /terminal/i, /powershell/i, /cmd\.exe/i, /bash/i, /wsl/i,
      /\bgithub\b/i, /\bgitlab\b/i,
    ],
  },
  {
    scene: 'writing',
    appPatterns: [
      /word/i, /wps/i, /pages/i, /obsidian/i, /notion/i, /typora/i,
      /overleaf/i, /latex/i,
    ],
    titlePatterns: [
      /google docs/i, /google 文档/i, /\.docx?\b/i, /\.tex\b/i, /\.md\b/i,
      /thesis/i, /paper/i, /draft/i, /essay/i, /dissertation/i,
      /论文/i, /草稿/i, /文档/i, /笔记/i,
    ],
  },
  {
    scene: 'meeting',
    appPatterns: [
      /zoom/i, /teams/i, /meet/i, /飞书/i, /钉钉/i, /腾讯会议/i,
      /voov/i,
    ],
    titlePatterns: [
      /meeting/i, /会议/i, /standup/i, /scrum/i, /call/i,
    ],
  },
  {
    scene: 'communication',
    appPatterns: [
      /slack/i, /discord/i, /telegram/i, /wechat/i, /微信/i, /qq/i,
      /teams/i, /outlook/i, /thunderbird/i, /mail/i, /邮件/i,
    ],
    titlePatterns: [
      /chat/i, /聊天/i, /inbox/i, /收件箱/i, /message/i, /消息/i,
    ],
  },
  {
    scene: 'social_media',
    appPatterns: [
      /twitter/i, /reddit/i, /weibo/i, /xiaohongshu/i, /instagram/i,
      /tiktok/i, /douyin/i, /抖音/i, /小红书/i, /微博/i,
    ],
    titlePatterns: [
      /twitter/i, /x\.com/i, /reddit/i, /weibo/i, /xiaohongshu/i,
      /instagram/i, /tiktok/i, /douyin/i, /facebook/i, /知乎/i,
      /zhihu/i, /贴吧/i, /tieba/i,
    ],
  },
  {
    scene: 'video',
    appPatterns: [
      /vlc/i, /potplayer/i, /mpv/i, /mpc/i,
    ],
    titlePatterns: [
      /youtube/i, /bilibili/i, /netflix/i, /disney\+/i, /twitch/i,
      /哔哩哔哩/i, /优酷/i, /youku/i, /爱奇艺/i, /iqiyi/i,
      /腾讯视频/i, /playing/i, /watching/i,
    ],
  },
  {
    scene: 'design',
    appPatterns: [
      /figma/i, /sketch/i, /photoshop/i, /illustrator/i, /canva/i,
      /blender/i, /after effects/i, /premiere/i, /davinci/i,
      /affinity/i, /gimp/i, /inkscape/i,
    ],
    titlePatterns: [
      /figma/i, /\.psd\b/i, /\.ai\b/i, /\.sketch\b/i,
      /design/i, /设计/i, /prototype/i, /原型/i,
    ],
  },
]

function classifyScene(info: ActiveWindowInfo): SceneType {
  const { title, app_name } = info
  if (!title && !app_name) return 'general'

  // Check each rule - first match wins (rules are ordered by priority)
  for (const rule of SCENE_RULES) {
    for (const pattern of rule.appPatterns) {
      if (pattern.test(app_name)) return rule.scene
    }
    for (const pattern of rule.titlePatterns) {
      if (pattern.test(title)) return rule.scene
    }
  }

  return 'general'
}

// ── Distraction Detection ──

const DISTRACTION_SCENES: SceneType[] = ['social_media', 'video']

interface DistractionEscalation {
  level: number
  message: string | null
  animation: AnimationState | null
}

function getEscalation(minutes: number): DistractionEscalation {
  if (minutes < 5) {
    return { level: 0, message: null, animation: null }
  }
  if (minutes < 10) {
    // Fidgeting, no speech
    return { level: 1, message: null, animation: 'stressed' }
  }
  if (minutes < 15) {
    return { level: 2, message: '好像已经刷了一会了呢...', animation: 'stressed' }
  }
  if (minutes < 20) {
    return { level: 3, message: '要不要休息下，回来继续干活？', animation: 'caring' }
  }
  // >20 min: gives up, reads a book
  return { level: 4, message: '好吧，那我先看我的书了~', animation: 'reading' }
}

// ── Scene Reaction Mapping ──

export interface SceneReaction {
  animation: AnimationState
  deskLabel: string
}

const SCENE_REACTIONS: Record<SceneType, SceneReaction> = {
  coding:        { animation: 'working',  deskLabel: 'coding' },
  writing:       { animation: 'working',  deskLabel: 'writing' },
  social_media:  { animation: 'idle',     deskLabel: 'social' },
  video:         { animation: 'idle',     deskLabel: 'video' },
  communication: { animation: 'chatting', deskLabel: 'chat' },
  meeting:       { animation: 'chatting', deskLabel: 'meeting' },
  design:        { animation: 'working',  deskLabel: 'design' },
  general:       { animation: 'idle',     deskLabel: '' },
}

// ── Scene Labels (for UI display) ──

export const SCENE_LABELS: Record<SceneType, string> = {
  coding:        '💻 Coding',
  writing:       '📝 Writing',
  social_media:  '📱 Social Media',
  video:         '🎬 Video',
  communication: '💬 Chatting',
  meeting:       '🎤 Meeting',
  design:        '🎨 Design',
  general:       '🖥️ Desktop',
}

// ── Productivity success/error detection ──

const BUILD_SUCCESS_PATTERNS = [
  /build success/i, /compiled successfully/i, /build complete/i,
  /✓ compiled/i, /done in \d/i, /passed/i, /0 errors/i,
]

const BUILD_ERROR_PATTERNS = [
  /error/i, /failed/i, /exception/i, /fatal/i,
  /build failed/i, /compilation error/i,
]

export type TitleEvent = 'build_success' | 'build_error' | null

function detectTitleEvent(title: string, scene: SceneType): TitleEvent {
  if (scene !== 'coding') return null
  for (const p of BUILD_SUCCESS_PATTERNS) {
    if (p.test(title)) return 'build_success'
  }
  for (const p of BUILD_ERROR_PATTERNS) {
    if (p.test(title)) return 'build_error'
  }
  return null
}

// ── Main Engine ──

export class SceneRecognitionEngine {
  private _state: SceneState = {
    scene: 'general',
    app_name: '',
    title: '',
    distractionMinutes: 0,
    escalationLevel: 0,
  }
  private _lastScene: SceneType = 'general'
  private _sceneStartTime: number = Date.now()
  private _lastLogTime: number = 0
  private _enabled: boolean = true
  private _onSceneChange?: (state: SceneState) => void
  private _onDistraction?: (escalation: DistractionEscalation) => void
  private _onTitleEvent?: (event: TitleEvent) => void

  get state(): SceneState { return this._state }
  get enabled(): boolean { return this._enabled }
  set enabled(v: boolean) { this._enabled = v }

  onSceneChange(cb: (state: SceneState) => void) { this._onSceneChange = cb }
  onDistraction(cb: (escalation: DistractionEscalation) => void) { this._onDistraction = cb }
  onTitleEvent(cb: (event: TitleEvent) => void) { this._onTitleEvent = cb }

  getReaction(): SceneReaction {
    return SCENE_REACTIONS[this._state.scene]
  }

  /** Poll active window and classify scene. Call every 3 seconds. */
  async poll() {
    if (!this._enabled) return

    try {
      const info = await invoke<ActiveWindowInfo>('get_active_window')
      const scene = classifyScene(info)
      const now = Date.now()

      // Update state
      this._state.title = info.title
      this._state.app_name = info.app_name

      // Scene changed?
      if (scene !== this._lastScene) {
        // Log previous scene duration to DB
        await this._logScene(now)

        this._lastScene = scene
        this._sceneStartTime = now
        this._state.scene = scene
        this._state.distractionMinutes = 0
        this._state.escalationLevel = 0

        this._onSceneChange?.(this._state)
      }

      // Update distraction timer for social/video scenes
      if (DISTRACTION_SCENES.includes(scene)) {
        this._state.distractionMinutes = (now - this._sceneStartTime) / 60000
        const escalation = getEscalation(this._state.distractionMinutes)
        if (escalation.level !== this._state.escalationLevel) {
          this._state.escalationLevel = escalation.level
          this._onDistraction?.(escalation)
        }
      }

      // Check for build success/error in title
      const titleEvent = detectTitleEvent(info.title, scene)
      if (titleEvent) {
        this._onTitleEvent?.(titleEvent)
      }

      // Periodic scene logging (every 60s for long sessions)
      if (now - this._lastLogTime > 60000) {
        await this._logScene(now)
      }
    } catch (e) {
      console.warn('[SceneRecognition] poll error:', e)
    }
  }

  private async _logScene(now: number) {
    if (!this._lastScene || this._lastLogTime === 0) {
      this._lastLogTime = now
      return
    }
    const durationSec = Math.round((now - this._lastLogTime) / 1000)
    if (durationSec < 3) return
    this._lastLogTime = now

    try {
      await invoke('insert_scene_log', {
        appName: this._state.app_name || 'unknown',
        sceneType: this._lastScene,
        durationSec: durationSec,
      })
    } catch {}
  }
}
