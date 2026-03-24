// Keyword Sentiment Engine (V2 Track B - 3.3)
// Lightweight rule-based sentiment detection: keyword matching, emoji detection, punctuation patterns
// Output: sentiment (positive/negative/neutral) + intensity (low/medium/high)
// Injected into AI system prompt for empathetic responses

export type Sentiment = 'positive' | 'negative' | 'neutral'
export type Intensity = 'low' | 'medium' | 'high'

export interface SentimentResult {
  sentiment: Sentiment
  intensity: Intensity
  score: number // raw numeric score
}

// ── Keyword dictionaries (CN + EN) ──

const POSITIVE_WORDS = new Set([
  // English
  'happy', 'great', 'good', 'excited', 'love', 'awesome', 'amazing', 'wonderful',
  'fantastic', 'excellent', 'perfect', 'brilliant', 'beautiful', 'enjoy', 'glad',
  'proud', 'accomplished', 'success', 'win', 'celebrate', 'grateful', 'thankful',
  'incredible', 'delighted', 'cheerful', 'joyful', 'pleasant', 'satisfied',
  'confident', 'motivated', 'inspired', 'energetic', 'productive', 'focused',
  'relaxed', 'calm', 'peaceful', 'comfortable', 'better', 'best', 'nice',
  'cool', 'fun', 'funny', 'laugh', 'smile', 'yay', 'yes', 'wow', 'haha',
  'lol', 'hehe', 'thanks', 'thank', 'appreciate', 'blessed', 'lucky',
  'hope', 'optimistic', 'progress', 'improved', 'done', 'finished', 'completed',
  // Chinese
  '开心', '高兴', '快乐', '幸福', '太棒了', '厉害', '棒', '好', '不错',
  '优秀', '完美', '漂亮', '喜欢', '爱', '感谢', '谢谢', '感恩',
  '加油', '努力', '成功', '进步', '赞', '哈哈', '嘻嘻', '嘿嘿',
  '开森', '美好', '舒服', '放松', '安心', '满足', '自豪', '骄傲',
  '兴奋', '期待', '惊喜', '感动', '温暖', '甜', '可爱', '有趣',
  '好玩', '酷', '牛', '绝了', '爽', '完成', '搞定', '做到了',
  '耶', '冲', '奥利给', '666', 'yyds', '真好', '太好了', '好耶',
])

const NEGATIVE_WORDS = new Set([
  // English
  'sad', 'tired', 'stressed', 'hate', 'angry', 'anxious', 'depressed',
  'frustrated', 'annoyed', 'upset', 'worried', 'scared', 'lonely', 'bored',
  'exhausted', 'overwhelmed', 'burned', 'burnout', 'stuck', 'confused',
  'disappointed', 'failed', 'failure', 'terrible', 'horrible', 'awful',
  'miserable', 'painful', 'hurt', 'broken', 'crying', 'cry', 'sick',
  'bad', 'worse', 'worst', 'ugly', 'stupid', 'dumb', 'useless',
  'hopeless', 'helpless', 'lost', 'alone', 'struggling', 'suffering',
  'nervous', 'panic', 'fear', 'dread', 'regret', 'sorry', 'guilt',
  'shame', 'embarrassed', 'insecure', 'doubt', 'ugh', 'sigh', 'meh',
  'nah', 'nope', 'whatever', 'shit', 'damn', 'fuck', 'crap',
  // Chinese
  '累', '累死了', '烦', '烦死了', '难过', '伤心', '痛苦', '焦虑',
  '压力', '压力大', '崩溃', '绝望', '无聊', '孤独', '寂寞',
  '生气', '愤怒', '讨厌', '恶心', '害怕', '恐惧', '担心',
  '失败', '失望', '沮丧', '郁闷', '抑郁', '心烦', '烦躁',
  '疲惫', '困', '困死了', '头疼', '头痛', '难受', '不舒服',
  '糟糕', '完蛋', '废了', '摸鱼', '划水', '不想', '不行',
  '好难', '太难了', '受不了', '撑不住', '想哭', '哭了',
  '唉', '呜呜', '呜', '丧', 'emo', '破防', '裂开', '寄了',
  '麻了', '无语', '服了', '吐了', '要死', '救命',
])

// ── Emoji detection ──

const POSITIVE_EMOJI_RE = /[\u{1F600}-\u{1F606}\u{1F60A}\u{1F60D}\u{1F618}\u{1F619}\u{1F61A}\u{1F970}\u{1F973}\u{1F929}\u{2764}\u{FE0F}?\u{1F496}\u{1F495}\u{1F49B}\u{1F49A}\u{1F499}\u{1F49C}\u{1F389}\u{1F388}\u{1F38A}\u{2728}\u{1F31F}\u{1F44D}\u{1F44F}\u{1F64C}\u{1F917}\u{1F60E}\u{1F60B}\u{1F914}?\u{1F525}\u{1F4AA}\u{2705}\u{1F381}]/gu

const NEGATIVE_EMOJI_RE = /[\u{1F622}\u{1F62D}\u{1F629}\u{1F62B}\u{1F625}\u{1F630}\u{1F628}\u{1F631}\u{1F624}\u{1F621}\u{1F620}\u{1F92C}\u{1F494}\u{1F480}\u{1F4A2}\u{1F614}\u{1F61E}\u{1F623}\u{1F616}\u{1F633}\u{1F626}\u{1F627}\u{1F641}\u{2639}\u{FE0F}?\u{1F915}\u{1F922}\u{1F92E}\u{1F971}\u{1F62A}\u{1F634}]/gu

// ── Analysis ──

function tokenize(text: string): string[] {
  // Split by whitespace and punctuation for English, keep Chinese characters
  return text.toLowerCase()
    .replace(/[.,;:'"!?()[\]{}]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 0)
}

export function analyzeSentiment(text: string): SentimentResult {
  if (!text || text.trim().length === 0) {
    return { sentiment: 'neutral', intensity: 'low', score: 0 }
  }

  let score = 0

  // 1. Keyword matching
  const tokens = tokenize(text)
  for (const token of tokens) {
    if (POSITIVE_WORDS.has(token)) score += 1
    if (NEGATIVE_WORDS.has(token)) score -= 1
  }

  // Also check multi-char Chinese phrases within the raw text
  const lowerText = text.toLowerCase()
  for (const word of POSITIVE_WORDS) {
    if (word.length >= 2 && /[\u4e00-\u9fff]/.test(word) && lowerText.includes(word)) {
      score += 1
    }
  }
  for (const word of NEGATIVE_WORDS) {
    if (word.length >= 2 && /[\u4e00-\u9fff]/.test(word) && lowerText.includes(word)) {
      score -= 1
    }
  }

  // 2. Emoji detection
  const posEmojis = text.match(POSITIVE_EMOJI_RE)
  const negEmojis = text.match(NEGATIVE_EMOJI_RE)
  if (posEmojis) score += posEmojis.length * 2
  if (negEmojis) score -= negEmojis.length * 2

  // 3. Punctuation amplifiers
  const exclamations = (text.match(/!/g) || []).length
  if (exclamations > 0) {
    // Amplify existing sentiment direction
    score += Math.sign(score) * exclamations * 0.5
  }

  // 4. Determine sentiment and intensity
  let sentiment: Sentiment
  if (score > 0.5) sentiment = 'positive'
  else if (score < -0.5) sentiment = 'negative'
  else sentiment = 'neutral'

  const absScore = Math.abs(score)
  let intensity: Intensity
  // Short negative messages have higher intensity
  const isShortNeg = sentiment === 'negative' && text.length < 10
  if (absScore >= 4 || isShortNeg && absScore >= 2) intensity = 'high'
  else if (absScore >= 2) intensity = 'medium'
  else intensity = 'low'

  return { sentiment, intensity, score }
}

// ── Consecutive tracking ──

export class SentimentTracker {
  private history: SentimentResult[] = []
  private maxHistory = 10

  /** Record a new message's sentiment */
  record(text: string): SentimentResult {
    const result = analyzeSentiment(text)
    this.history.push(result)
    if (this.history.length > this.maxHistory) {
      this.history.shift()
    }
    return result
  }

  /** Check if last N messages are all negative */
  isConsecutiveNegative(n = 3): boolean {
    if (this.history.length < n) return false
    const recent = this.history.slice(-n)
    return recent.every(r => r.sentiment === 'negative')
  }

  /** Get latest result */
  get latest(): SentimentResult | null {
    return this.history.length > 0 ? this.history[this.history.length - 1] : null
  }

  /** Build system prompt addition based on current sentiment state */
  buildPromptAddition(): string {
    const result = this.latest
    if (!result || result.sentiment === 'neutral') return ''

    if (this.isConsecutiveNegative()) {
      return '\n[Sentiment] User has been consistently upset. Proactively offer support. Acknowledge their feelings explicitly.'
    }

    const { sentiment, intensity } = result
    if (sentiment === 'positive' && intensity === 'high') {
      return '\n[Sentiment] User is in a great mood! Be playful and match their energy.'
    }
    if (sentiment === 'positive') {
      return '\n[Sentiment] User seems in a decent mood. Be warm and encouraging.'
    }
    if (sentiment === 'negative' && intensity === 'high') {
      return "\n[Sentiment] User is upset. Offer empathy first, practical help second. Ask if they want to talk or just need quiet company."
    }
    if (sentiment === 'negative') {
      return '\n[Sentiment] User seems a bit down. Be gentle and supportive.'
    }
    return ''
  }

  /** Get animation hint based on sentiment */
  getAnimationHint(): string | null {
    const result = this.latest
    if (!result) return null

    if (this.isConsecutiveNegative()) return 'caring'
    if (result.sentiment === 'positive' && result.intensity === 'high') return 'happy'
    if (result.sentiment === 'negative' && result.intensity === 'high') return 'caring'
    return null
  }
}
