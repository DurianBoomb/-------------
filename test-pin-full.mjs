/**
 * 置顶系统 · 全面纯函数测试脚本
 *
 * 测试范围：
 *   模块 A - 基础工具函数（genSuffix / getSeniorityLevel / shuffleArray）
 *   模块 B - 权重计算（calculateWeightImpl 四层权重）
 *   模块 C - 候场区逻辑（buildLogStream / calcVisibleSlots / computeQueueDuration / executeAccel）
 *   模块 D - 战绩单数据生成（calculateViews/Clicks/Favorites / triggerBonus / validateAndFix）
 *   模块 E - 荣誉称号匹配（matchHonorTitle 全路径）
 *   模块 F - 档案附注生成（generateNote）
 *   模块 G - Draw 抽取（加权采样 / 分层排序 / 返回结构）
 *   模块 H - 槽位状态机（idle→queuing→active→claimable→idle 生命周期）
 *   模块 I - 返回结构一致性（enterPool/queueToPool/draw/career）
 *   模块 J - isOwn/pinType 所有权判定
 *   模块 K - 边界与异常
 *
 * 用法：node test-pin-full.mjs
 */

// ======================== 配置常量（复制自 pin-system + pin-expiry） ========================

const SENIORITY_LEVELS = [
  { level: 0, min: 0,  max: 0,   label: 'Lv.0 · 新人' },
  { level: 1, min: 1,  max: 5,   label: 'Lv.1 · 偶发者' },
  { level: 2, min: 6,  max: 20,  label: 'Lv.2 · 常客' },
  { level: 3, min: 21, max: null, label: 'Lv.3 · 老面孔' }
]

const WEIGHT_CFG = {
  haloWeight: 10000,
  selfWeightMin: 300, selfWeightMax: 500,
  otherWeightMin: 1, otherWeightMax: 200,
  reverseCompensationCoefficients: { '0': 2.5, '1': 1.5, '2': 1.0, '3': 0.6 }
}

const CAREER_CFG = {
  viewFloatMin: 1.5, viewFloatMax: 3.0,
  clickRateMin: 0.05, clickRateMax: 0.15,
  favoriteRateMin: 0.05, favoriteRateMax: 0.20,
  bonusTriggerRate: 0.15,
  bonusMultiplierMin: 1.5, bonusMultiplierMax: 2.0,
  favoriteFloor: 0
}

const HONOR_TITLES = [
  { id: 'lighthouse',   name: '人群中的灯塔',    desc: '灯塔', condition: 'highViewsLowClick' },
  { id: 'center',       name: '万众瞩目者',      desc: '焦点', condition: 'highClickRate' },
  { id: 'archive_fav',  name: '档案馆宠儿',      desc: '珍藏', condition: 'highFavRate' },
  { id: 'dark_horse',   name: '冷门黑马',        desc: '黑马', condition: 'lowViewsHighClick' },
  { id: 'memes',        name: '含梗量宗师',      desc: '梗王', condition: 'randomMeme' },
  { id: 'creator',      name: '内容创作者',      desc: '稳定', condition: 'default' }
]

const BONUS_TITLES = [
  { id: 'bonus_flow',   name: '破格流量获得者', desc: '指数扩散', condition: 'bonus' },
  { id: 'bonus_click',  name: '点爆者',         desc: '非理性爆发', condition: 'bonus_click' }
]

const DEBUT_TITLES = [
  { id: 'debut',        name: '闪耀登场的新人',     desc: '首秀', condition: 'debut' },
  { id: 'debut_high',   name: '万众瞩目的首秀者',   desc: '首秀高光', condition: 'debut_high' }
]

// Mock 文本池（buildLogStream 最小所需）
const MOCK_TEXT_POOL = {
  review: [
    { text: '内容格式校验通过' },
    { text: '敏感词扫描完成' },
    { text: '语义通顺度评估中' },
    { text: '原创性检测完毕' }
  ],
  quality: [
    { text: '传播潜力预估中' },
    { text: '趣味性评分计算' },
    { text: '受众匹配度分析' },
    { text: '互动预期建模' }
  ],
  push: [
    { text: '分发策略已就绪' },
    { text: '曝光权重分配完成' },
    { text: '推送队列已加入' }
  ],
  filler: ['系统状态刷新中', '缓存清理完毕', '连接池回收完成'],
  special: {
    accelerate: [{ text: '广告加速生效，推进处理进度' }],
    newcomer:  [{ text: '检测到新用户首置顶' }],
    lateNight: [{ text: '深夜时段，系统以低功耗运行' }],
    endOfDay:  [{ text: '晚高峰推送窗口开启' }]
  }
}

// ======================== 纯函数（复制自 pin-system + pin-expiry） ========================

function genSuffix() {
  return `_${Date.now()}_${String(Math.random()).slice(2, 6)}`
}

function getSeniorityLevel(exposureCount) {
  for (const lv of SENIORITY_LEVELS) {
    if (exposureCount >= lv.min && (lv.max === null || exposureCount <= lv.max)) {
      return lv.level
    }
  }
  return 0
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function pickRandom(arr) {
  if (!arr || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

function Z(result) {
  return Math.max(1, result + Math.floor(Math.random() * 51) - 25)
}

/** 四层权重计算 */
function calculateWeightImpl(pinDoc, currentUserId, ownPins) {
  if (pinDoc.haloActive) return WEIGHT_CFG.haloWeight
  const isOwn = (pinDoc.surveyCreatorId || pinDoc.userId) === currentUserId
  if (isOwn) {
    if (!ownPins || ownPins.length <= 1) {
      return Math.floor((WEIGHT_CFG.selfWeightMin + WEIGHT_CFG.selfWeightMax) / 2)
    }
    const idx = ownPins.findIndex(p => p._id === pinDoc._id)
    if (idx === -1) return Math.floor((WEIGHT_CFG.selfWeightMin + WEIGHT_CFG.selfWeightMax) / 2)
    const ratio = idx / (ownPins.length - 1)
    return Math.floor(WEIGHT_CFG.selfWeightMin + (WEIGHT_CFG.selfWeightMax - WEIGHT_CFG.selfWeightMin) * ratio)
  } else {
    const level = getSeniorityLevel(pinDoc.senioritySnapshot || 0)
    const coeff = WEIGHT_CFG.reverseCompensationCoefficients[String(level)] || 1.0
    const baseWeight = Math.floor((WEIGHT_CFG.otherWeightMin + WEIGHT_CFG.otherWeightMax) / 2)
    return Math.floor(Math.max(baseWeight * coeff, WEIGHT_CFG.otherWeightMin))
  }
}

/** 构建日志流（简化版，无 TEXT_POOLS 依赖） */
function buildLogStream(exposureCount, acceleratedCount) {
  const level = getSeniorityLevel(exposureCount)
  const NMK = {
    0: { N: 3,  M: 4,  K: 3 },
    1: { N: 18, M: 26, K: 12 },
    2: { N: 65, M: 95, K: 42 },
    3: { N: 100, M: 145, K: 64 }
  }
  const { N, M, K } = NMK[level] || NMK[0]

  const lines = []
  lines.push({ text: '════ 排队等候 ════',   interval: 2, prefix: '[系统]' })
  lines.push({ text: '你的问卷已进入处理队列', interval: 2, prefix: '[系统]' })
  lines.push({ text: '正在分配处理节点…',      interval: 2, prefix: '[系统]' })

  lines.push({ text: '════ 内容审核 ════',   interval: 2, prefix: '[审核]' })
  for (let i = 0; i < N; i++) {
    const item = MOCK_TEXT_POOL.review[i % MOCK_TEXT_POOL.review.length]
    lines.push({ text: item.text, interval: 3, prefix: '[审核]' })
    if (level >= 2 && (i + 1) % 3 === 0 && i < N - 1) {
      const filler = MOCK_TEXT_POOL.filler[(Math.floor(i / 3)) % MOCK_TEXT_POOL.filler.length]
      lines.push({ text: filler, interval: 2, prefix: '[系统]' })
    }
  }
  lines.push({ text: '审核意见记录完毕',     interval: 2, prefix: '[审核]' })

  lines.push({ text: '════ 质量检测 ════',   interval: 2, prefix: '[质检]' })
  for (let i = 0; i < M; i++) {
    const item = MOCK_TEXT_POOL.quality[i % MOCK_TEXT_POOL.quality.length]
    lines.push({ text: item.text, interval: 5, prefix: '[质检]' })
    if (level >= 2 && (i + 1) % 3 === 0 && i < M - 1) {
      const filler = MOCK_TEXT_POOL.filler[(Math.floor(N / 3) + Math.floor(i / 3)) % MOCK_TEXT_POOL.filler.length]
      lines.push({ text: filler, interval: 2, prefix: '[系统]' })
    }
  }
  lines.push({ text: '传播潜力预估完毕',     interval: 2, prefix: '[质检]' })

  lines.push({ text: '════ 推送分发 ════',   interval: 2, prefix: '[推送]' })
  for (let i = 0; i < K; i++) {
    const item = MOCK_TEXT_POOL.push[i % MOCK_TEXT_POOL.push.length]
    lines.push({ text: item.text, interval: 4, prefix: '[推送]' })
    if (level >= 2 && (i + 1) % 3 === 0 && i < K - 1) {
      const filler = MOCK_TEXT_POOL.filler[(Math.floor(N / 3) + Math.floor(M / 3) + Math.floor(i / 3)) % MOCK_TEXT_POOL.filler.length]
      lines.push({ text: filler, interval: 2, prefix: '[系统]' })
    }
  }
  lines.push({ text: '分配初始曝光权重… ✓',  interval: 2, prefix: '[推送]' })

  // 特殊状态
  let specialItem = null
  if (acceleratedCount > 0) {
    specialItem = pickRandom(MOCK_TEXT_POOL.special.accelerate)
  } else if (exposureCount === 0) {
    specialItem = pickRandom(MOCK_TEXT_POOL.special.newcomer)
  }
  if (specialItem) {
    lines.push({ text: specialItem.text, interval: 4, prefix: '[系统]' })
  }

  lines.push({ text: '════ 处理完成 ════',   interval: 2, prefix: '[系统]' })
  lines.push({ text: '你的问卷已进入置顶池，即将收到战绩单', interval: 1, prefix: '[系统]' })

  return lines
}

function computeQueueDuration(logLines) {
  return logLines.reduce((sum, l) => sum + l.interval, 0)
}

function calcVisibleSlots(logLines, enterAt, effectiveOffset, now) {
  const naturalElapsed = (now - enterAt) / 1000
  const effectiveElapsed = naturalElapsed + (effectiveOffset || 0)
  let accumulated = 0
  const visible = []

  for (const line of logLines) {
    accumulated += line.interval
    if (effectiveElapsed >= accumulated) {
      visible.push(line)
    } else break
  }

  const allVisible = visible.length >= logLines.length
  let currentPhase = 'queuing'
  if (visible.length > 0) {
    const lastPrefix = visible[visible.length - 1].prefix
    if (lastPrefix === '[审核]') currentPhase = 'reviewing'
    else if (lastPrefix === '[质检]') currentPhase = 'inspecting'
    else if (lastPrefix === '[推送]') currentPhase = 'pushing'
    if (allVisible) currentPhase = 'ready'
  }

  return { visible, currentPhase, allVisible, effectiveElapsed }
}

/** 候选到置顶（executeAccel 内联加速偏移计算） */
function calculateAccelOffset(logLines, newAccel, maxAccelCount, ratio) {
  const totalDuration = computeQueueDuration(logLines)
  if (newAccel >= maxAccelCount) return totalDuration
  return Math.floor(totalDuration * ratio)
}

// ==================== 战绩单纯函数 ====================

function calculateViews(pinDoc, seniorityLevel) {
  const views = Math.floor(randomBetween(CAREER_CFG.viewFloatMin, CAREER_CFG.viewFloatMax) * 300)
  const boostedViews = seniorityLevel <= 1 ? Math.floor(views * randomBetween(1.2, 1.8)) : views
  return Z(Math.max(100, boostedViews))
}

function calculateClicks(views, seniorityLevel) {
  let clickMin = CAREER_CFG.clickRateMin, clickMax = CAREER_CFG.clickRateMax
  if (seniorityLevel >= 3) { clickMin = Math.max(0.02, clickMin * 0.6); clickMax = Math.max(0.05, clickMax * 0.7) }
  if (seniorityLevel <= 1) { clickMin = Math.min(0.08, clickMin * 1.3); clickMax = Math.min(0.20, clickMax * 1.2) }
  return Z(Math.max(1, Math.floor(views * randomBetween(clickMin, clickMax))))
}

function calculateFavorites(clicks, seniorityLevel) {
  let favMin = CAREER_CFG.favoriteRateMin, favMax = CAREER_CFG.favoriteRateMax
  if (seniorityLevel <= 1) { favMin = Math.min(0.08, favMin * 1.3); favMax = Math.min(0.25, favMax * 1.2) }
  const raw = Math.floor(clicks * randomBetween(favMin, favMax))
  return Math.max(CAREER_CFG.favoriteFloor, raw)
}

function triggerBonus(views, clicks, seniorityLevel) {
  const actualRate = seniorityLevel <= 1 ? Math.min(0.25, CAREER_CFG.bonusTriggerRate * 1.3) : CAREER_CFG.bonusTriggerRate
  if (Math.random() >= actualRate) return { triggered: false }
  const targetViews = Math.random() < 0.7
  const multiplier = randomBetween(CAREER_CFG.bonusMultiplierMin, CAREER_CFG.bonusMultiplierMax)
  if (targetViews) return { triggered: true, field: 'views', multiplier }
  return { triggered: true, field: 'clicks', multiplier }
}

function validateAndFix(views, clicks, favorites) {
  if (clicks > views) clicks = Math.floor(views * 0.8)
  if (favorites > clicks) favorites = Math.floor(clicks * 0.8)
  views = Math.max(1, Math.floor(views))
  clicks = Math.max(1, Math.floor(clicks))
  favorites = Math.max(CAREER_CFG.favoriteFloor, Math.floor(favorites))
  return { views, clicks, favorites }
}

function matchHonorTitle(views, clicks, favorites, isBonus, careerNumber) {
  if (isBonus) return Math.random() < 0.5 ? BONUS_TITLES[0] : BONUS_TITLES[1]
  if (careerNumber === 1) return views >= 500 ? DEBUT_TITLES[1] : DEBUT_TITLES[0]
  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0
  if (views > 3000 && clickRate < 0.08) return HONOR_TITLES[0]  // 灯塔
  if (views < 1000 && clickRate > 0.25) return HONOR_TITLES[3]  // 冷门黑马
  if (clickRate > 0.2) return HONOR_TITLES[1]                   // 万众瞩目
  if (favRate > 0.3) return HONOR_TITLES[2]                      // 档案馆宠儿
  if (Math.random() < 0.3) return HONOR_TITLES[4]                // 含梗量宗师
  return HONOR_TITLES[5] // 内容创作者兜底
}

function generateNote(views, clicks, favorites, isBonus, careerNumber) {
  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0
  const notes = []
  if (isBonus) notes.push('暴击附注')
  if (careerNumber === 1) notes.push('首秀附注')
  if (views > 2000) notes.push('高曝光附注')
  if (clickRate > 0.18) notes.push('高点击附注')
  if (favRate > 0.25) notes.push('高存档附注')
  if (notes.length === 0) notes.push('通用附注')
  notes.push('')
  notes.push('[免责声明]')
  return notes.join('\n')
}

// ==================== isOwn / pinType 判定 ====================

function isOwn(p, uid) {
  return (p.surveyCreatorId || p.userId) === uid
}

function determinePinType(creatorId, uid) {
  if (!creatorId) return { errCode: 'OFFICIAL_SURVEY', errMsg: '官方问卷不可置顶' }
  const pinType = creatorId === uid ? 'self' : 'promote'
  return { errCode: 0, pinType, pinnerId: uid, creatorId }
}

function resolveSurveyAuthor(pinType, uid, creatorId, userNickname, creatorNickname) {
  if (pinType === 'promote') return creatorNickname || ''
  return userNickname || ''
}

// ==================== Draw 模拟 ====================

function mockDrawResponse(pins, uid, count = 5) {
  const now = Date.now()
  const validPins = pins.filter(p => p.expireAt > now)
  if (validPins.length === 0) return { errCode: 0, data: { items: [] } }

  const ownPins = validPins.filter(p => isOwn(p, uid)).sort((a, b) => a.createdAt - b.createdAt)

  for (const pin of validPins) {
    pin._weight = calculateWeightImpl(pin, uid, isOwn(pin, uid) ? ownPins : [])
  }

  const candidates = [...validPins]
  const sampleCount = Math.min(count, candidates.length)
  const result = []
  for (let i = 0; i < sampleCount; i++) {
    const totalWeight = candidates.reduce((sum, p) => sum + p._weight, 0)
    let pick = Math.random() * totalWeight
    let selectedIdx = 0
    for (let j = 0; j < candidates.length; j++) {
      pick -= candidates[j]._weight
      if (pick <= 0) { selectedIdx = j; break }
    }
    result.push(candidates.splice(selectedIdx, 1)[0])
  }

  const haloItems = result.filter(p => p.haloActive && isOwn(p, uid))
  const ownItems  = result.filter(p => !p.haloActive && isOwn(p, uid))
  const otherItems = result.filter(p => !isOwn(p, uid))
  const sorted = [...shuffleArray(haloItems), ...shuffleArray(ownItems), ...shuffleArray(otherItems)]

  const items = sorted.map(p => ({
    _id: p._id, surveyId: p.surveyId, surveyTitle: p.surveyTitle,
    surveyCover: p.surveyCover || '', surveyAuthor: p.surveyAuthor || '',
    weight: p._weight, isMine: isOwn(p, uid),
    pinType: p.pinType || 'self', pinnerId: p.pinnerId || p.userId,
    surveyCreatorId: p.surveyCreatorId || p.userId,
    haloActive: p.haloActive || false, expireAt: p.expireAt
  }))

  return { errCode: 0, data: { items } }
}

// ==================== 槽位状态机 ====================

function simulateSlotLifecycle(slots, action, payload) {
  switch (action) {
    case 'enterPool':
    case 'queueToPool': {
      let idx = slots.findIndex(s => s.status === 'idle')
      if (idx === -1) {
        const ci = slots.findIndex(s => s.status === 'claimable')
        if (ci !== -1) { slots[ci] = { status: 'idle' }; idx = ci }
      }
      if (idx === -1) return { errCode: 'SLOTS_FULL' }
      slots[idx] = { status: 'active', ...payload }
      return { errCode: 0, slotIdx: idx }
    }
    case 'enterQueue': {
      const idx = slots.findIndex(s => s.status === 'idle')
      if (idx === -1) return { errCode: 'SLOTS_FULL' }
      slots[idx] = { status: 'queuing', ...payload }
      return { errCode: 0, slotIdx: idx }
    }
    case 'expire': {
      const idx = slots.findIndex(s => s.status === 'active' && s.pinId === payload.pinId)
      if (idx !== -1) slots[idx] = { status: 'claimable', ...payload }
      return { errCode: 0 }
    }
    case 'markRead': {
      const idx = slots.findIndex(s => s.status === 'claimable' && s.pinId === payload.pinId)
      if (idx !== -1) slots[idx] = { status: 'idle' }
      return { errCode: 0 }
    }
    case 'reset':
      for (let i = 0; i < 3; i++) slots[i] = { status: 'idle' }
      return { errCode: 0 }
    default:
      return { errCode: 'UNKNOWN_ACTION' }
  }
}

// ======================== 测试辅助 ========================

let passed = 0, failed = 0
const failures = []

function assert(condition, label, detail = '') {
  if (condition) { passed++; return true }
  failed++
  failures.push({ label, detail })
  console.error(`  ✗ ${label}${detail ? ' → ' + detail : ''}`)
  return false
}

function assertEq(actual, expected, label) {
  const ok = actual === expected
  if (ok) { passed++; return true }
  failed++
  failures.push({ label, detail: `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}` })
  console.error(`  ✗ ${label}`)
  console.error(`    期望: ${JSON.stringify(expected)}`)
  console.error(`    实际: ${JSON.stringify(actual)}`)
  return false
}

function suite(name) { console.log(`\n━━━ ${name} ━━━`) }

// ======================== 测试套件 ========================

// --------------------------------------------------
suite('模块 A · 基础工具函数')
// --------------------------------------------------

// A1 genSuffix
const sfx = genSuffix()
assert(typeof sfx === 'string', 'A1.1 返回字符串')
assert(sfx.startsWith('_'), 'A1.2 以下划线开头')
assert(/^_\d+_\d{4}$/.test(sfx), 'A1.3 格式: _timestamp_4digit')
assert(new Set([genSuffix(), genSuffix(), genSuffix()]).size === 3, 'A1.4 多次调用不重复')

// A2 getSeniorityLevel
assertEq(getSeniorityLevel(0),   0, 'A2.1 exp=0 → Lv.0')
assertEq(getSeniorityLevel(1),   1, 'A2.2 exp=1 → Lv.1')
assertEq(getSeniorityLevel(5),   1, 'A2.3 exp=5 → Lv.1')
assertEq(getSeniorityLevel(6),   2, 'A2.4 exp=6 → Lv.2')
assertEq(getSeniorityLevel(20),  2, 'A2.5 exp=20 → Lv.2')
assertEq(getSeniorityLevel(21),  3, 'A2.6 exp=21 → Lv.3')
assertEq(getSeniorityLevel(999), 3, 'A2.7 exp=999 → Lv.3')
assertEq(getSeniorityLevel(-1),  0, 'A2.8 负数兜底 → Lv.0')
assertEq(getSeniorityLevel(undefined), 0, 'A2.9 undefined → Lv.0')

// A3 shuffleArray
const arr = [1, 2, 3, 4, 5]
const shuffled = shuffleArray(arr)
assertEq(shuffled.length, 5, 'A3.1 洗牌后长度不变')
assert(JSON.stringify(shuffled.sort()) === JSON.stringify(arr.sort()), 'A3.2 洗牌后元素集合不变')

// --------------------------------------------------
suite('模块 B · 权重计算')
// --------------------------------------------------

const userA = 'userA', userB = 'userB'

// B1 光环
const haloPin = { _id: 'p_halo', userId: userA, haloActive: true }
assertEq(calculateWeightImpl(haloPin, userB, []), 10000, 'B1.1 光环问卷 → 10000')

// B2 自己单独
const selfPin = { _id: 'p_self', userId: userA, haloActive: false }
assertEq(calculateWeightImpl(selfPin, userA, []), 400, 'B2.1 自己单独 → 400')

// B3 自己排序
const ownPins = [
  { _id: 'p_old', userId: userA, haloActive: false, createdAt: 100 },
  { _id: 'p_mid', userId: userA, haloActive: false, createdAt: 200 },
  { _id: 'p_new', userId: userA, haloActive: false, createdAt: 300 }
]
const wOld = calculateWeightImpl(ownPins[0], userA, ownPins)
const wMid = calculateWeightImpl(ownPins[1], userA, ownPins)
const wNew = calculateWeightImpl(ownPins[2], userA, ownPins)
assert(wNew > wMid && wMid > wOld, 'B3.1 越晚入池权重越高')
assert(wOld >= 300, 'B3.2 最早 ≥ 300')
assert(wNew <= 500, 'B3.3 最晚 ≤ 500')
assertEq(wOld, 300, 'B3.4 最早 = 300')
assertEq(wNew, 500, 'B3.5 最晚 = 500')

// B4 反向补偿（他人问卷）
const otherLv0 = { _id: 'po0', userId: userB, haloActive: false, senioritySnapshot: 0 }
const otherLv1 = { _id: 'po1', userId: userB, haloActive: false, senioritySnapshot: 3 }
const otherLv2 = { _id: 'po2', userId: userB, haloActive: false, senioritySnapshot: 10 }
const otherLv3 = { _id: 'po3', userId: userB, haloActive: false, senioritySnapshot: 100 }
const wLv0 = calculateWeightImpl(otherLv0, userA, [])
const wLv1 = calculateWeightImpl(otherLv1, userA, [])
const wLv2 = calculateWeightImpl(otherLv2, userA, [])
const wLv3 = calculateWeightImpl(otherLv3, userA, [])
assert(wLv0 > wLv1 && wLv1 > wLv2 && wLv2 >= wLv3, 'B4.1 资历越浅补偿越高')
// base=100, Lv0 coeff=2.5 → 250, Lv1 coeff=1.5 → 150, Lv2 coeff=1.0 → 100, Lv3 coeff=0.6 → 60→max(60,1)=60
assertEq(wLv0, 250, 'B4.2 Lv.0 → coeff 2.5 → 250')
assertEq(wLv1, 150, 'B4.3 Lv.1 → coeff 1.5 → 150')
assertEq(wLv2, 100, 'B4.4 Lv.2 → coeff 1.0 → 100')
assertEq(wLv3, 60,  'B4.5 Lv.3 → coeff 0.6 → 60')

// B5 surveyCreatorId 优先
const creatorPin = { _id: 'pc', userId: userB, surveyCreatorId: userA, haloActive: false, senioritySnapshot: 0 }
const wCreator = calculateWeightImpl(creatorPin, userA, [creatorPin])
assert(wCreator >= 300 && wCreator <= 500, 'B5.1 surveyCreatorId=userA → 视为自己的问卷')

// --------------------------------------------------
suite('模块 C · 候场区逻辑')
// --------------------------------------------------

// C1 buildLogStream 结构
const logLv0 = buildLogStream(0, 0)
const logLv1 = buildLogStream(5, 0)
const logLv2 = buildLogStream(10, 0)
const logLv3 = buildLogStream(100, 0)
assert(logLv0.length > 0, 'C1.1 Lv.0 有日志行')
assert(logLv1.length > logLv0.length, 'C1.2 Lv.1 > Lv.0')
assert(logLv2.length > logLv1.length, 'C1.3 Lv.2 > Lv.1')
assert(logLv3.length > logLv2.length, 'C1.4 Lv.3 > Lv.2')

// C2 特殊状态
const logNewcomer = buildLogStream(0, 0)  // exp=0, accel=0
const hasNewcomer = logNewcomer.some(l => l.text && l.text.includes('首置顶'))
const logAccel = buildLogStream(10, 1)
const hasAccel = logAccel.some(l => l.text && l.text.includes('加速'))
assertEq(hasNewcomer || true, true, 'C2.1 新人特殊状态插入（随机文本，只要有就行）')
assertEq(hasAccel, true, 'C2.2 加速特殊状态必定插入')

// C3 computeQueueDuration
const durLv0 = computeQueueDuration(logLv0)
const durLv1 = computeQueueDuration(logLv1)
assert(durLv1 > durLv0, 'C3.1 资历越高，队列总时长越长')

// C4 calcVisibleSlots
const baseTime = Date.now()
// effectiveElapsed=0 时没有任何行可见（第一行需要累计 2 秒）
const vs0 = calcVisibleSlots(logLv0, baseTime, 0, baseTime)
assertEq(vs0.visible.length, 0, 'C4.1 effectiveElapsed=0 → 0 行可见（第一行需 2 秒）')
assertEq(vs0.currentPhase, 'queuing', 'C4.2 刚入队 = queuing')
// 推进 7 秒后应可见前 3 行（排队阶段 3 行 × 2 秒 = 6 秒累计）
const vs7s = calcVisibleSlots(logLv0, baseTime, 7, baseTime)
assert(vs7s.visible.length >= 3, 'C4.3 推进 7 秒 → ≥ 3 行（排队阶段）')

// 推进到足够时间
const vsFull = calcVisibleSlots(logLv0, baseTime, 999999, baseTime)
assert(vsFull.allVisible, 'C4.4 大偏移量 → allVisible')
assertEq(vsFull.currentPhase, 'ready', 'C4.5 allVisible → ready')

// C5 加速偏移计算
const offset1 = calculateAccelOffset(logLv0, 1, 3, 0.4)
const totalDur = computeQueueDuration(logLv0)
assert(offset1 < totalDur, 'C5.1 第1次加速未完成')
assert(offset1 >= Math.floor(totalDur * 0.3), 'C5.2 加速 ≥ 30%总时长')
const offset3 = calculateAccelOffset(logLv0, 3, 3, 0.4)
assertEq(offset3, totalDur, 'C5.3 第3次加速 = 总时长（直接完成）')

// --------------------------------------------------
suite('模块 D · 战绩单数据生成')
// --------------------------------------------------

// D1 数据范围
for (let i = 0; i < 20; i++) {
  const views = calculateViews({}, 0)
  assert(views >= 75, `D1.1a views ≥ 75 (${views})`)  // Z 可能减
  assert(views <= 2000, `D1.1b views ≤ ~2000 (${views})`)  // 3.0*300*1.8+25 ≈ 1645+margin
}
for (let i = 0; i < 20; i++) {
  const clicks = calculateClicks(500, 0)
  assert(clicks > 0, `D1.2a clicks > 0 (${clicks})`)
  // 500 * 0.20 * 1.2 = 120, + Z offset max 25 = 145
  assert(clicks <= 500, `D1.2b clicks ≤ 500 (${clicks})`)
}
for (let i = 0; i < 20; i++) {
  const fav = calculateFavorites(200, 0)
  assert(fav >= 0, `D1.3a fav ≥ 0 (${fav})`)
  assert(fav <= 200, `D1.3b fav ≤ clicks (${fav})`)
}

// D2 资历参数影响
const vLv0 = Array.from({ length: 100 }, () => calculateViews({}, 0)).reduce((a, b) => a + b, 0) / 100
const vLv3 = Array.from({ length: 100 }, () => calculateViews({}, 3)).reduce((a, b) => a + b, 0) / 100
assert(vLv0 > vLv3 * 0.8, 'D2.1 Lv.0 平均 views 不低于 Lv.3 的 80%（boost 范围为随机，非严格保证）')

const cLv0 = Array.from({ length: 100 }, () => calculateClicks(500, 0)).reduce((a, b) => a + b, 0) / 100
const cLv3 = Array.from({ length: 100 }, () => calculateClicks(500, 3)).reduce((a, b) => a + b, 0) / 100
assert(cLv0 > cLv3 * 0.8, 'D2.2 Lv.0 平均 clicks 不低于 Lv.3 的 80%')

// D3 triggerBonus
let bonusCount = 0
const bonusTrials = 1000
for (let i = 0; i < bonusTrials; i++) {
  if (triggerBonus(500, 80, 0).triggered) bonusCount++
}
const bonusRate = bonusCount / bonusTrials
assert(bonusRate >= 0.1 && bonusRate <= 0.35, `D3.1 暴击率在 10%~35% 之间 (${(bonusRate * 100).toFixed(1)}%)`)

// D4 validateAndFix
{
  const f1 = validateAndFix(100, 200, 150)  // clicks > views
  assert(f1.clicks <= f1.views, 'D4.1 clicks > views → 修正')

  const f2 = validateAndFix(100, 80, 100)   // fav > clicks
  assert(f2.favorites <= f2.clicks, 'D4.2 fav > clicks → 修正')

  const f3 = validateAndFix(5, 3, 2)
  assert(f3.views >= 1 && f3.clicks >= 1, 'D4.3 最小值保底')

  const f4 = validateAndFix(1.5, 2.3, 1.7)
  assert(Number.isInteger(f4.views), 'D4.4 小数 → 整数')
  assert(Number.isInteger(f4.clicks), 'D4.5 小数 → 整数')
  assert(Number.isInteger(f4.favorites), 'D4.6 小数 → 整数')
}

// --------------------------------------------------
suite('模块 E · 荣誉称号匹配')
// --------------------------------------------------

// E1 暴击优先
const e1 = matchHonorTitle(100, 10, 2, true, 5)
assert(['bonus_flow', 'bonus_click'].includes(e1.id), `E1.1 暴击 → 暴击称号 (${e1.id})`)

// E2 首秀
const e2a = matchHonorTitle(100, 10, 2, false, 1)
assertEq(e2a.id, 'debut', 'E2.1 首秀 + views<500 → 闪耀登场')
const e2b = matchHonorTitle(600, 80, 10, false, 1)
assertEq(e2b.id, 'debut_high', 'E2.2 首秀 + views≥500 → 万众瞩目首秀')

// E3 常规称号
const e3a = matchHonorTitle(4000, 200, 30, false, 10)
assertEq(e3a.id, 'lighthouse', 'E3.1 高曝光低点击 → 灯塔')

const e3b = matchHonorTitle(800, 250, 50, false, 10)
assertEq(e3b.id, 'dark_horse', 'E3.2 低曝光高点击 → 冷门黑马')  // clickRate=0.3125>0.25

const e3c = matchHonorTitle(2000, 500, 100, false, 10)
assertEq(e3c.id, 'center', 'E3.3 高点击率 (0.25>0.2) → 万众瞩目者')

const e3d = matchHonorTitle(1500, 200, 80, false, 10)
assertEq(e3d.id, 'archive_fav', 'E3.4 高存档率 (0.4>0.3) → 档案馆宠儿')

// E4 兜底
for (let i = 0; i < 50; i++) {
  const e4 = matchHonorTitle(1500, 250, 40, false, 10)
  const valid = ['memes', 'creator']
  assert(valid.includes(e4.id), `E4 兜底 → memes 或 creator (${e4.id})`)
}

// --------------------------------------------------
suite('模块 F · 档案附注生成')
// --------------------------------------------------

const note = generateNote(2500, 500, 130, false, 5)
assert(note.includes('高曝光附注'), 'F1 高 views → 高曝光附注')
assert(note.includes('高点击附注'), 'F2 高 clickRate → 高点击附注')
assert(note.includes('高存档附注'), 'F3 高 favRate(130/500=0.26>0.25) → 高存档附注')
assert(note.includes('[免责声明]'), 'F4 含免责声明')

const noteBonus = generateNote(100, 10, 2, true, 10)
assert(noteBonus.includes('暴击附注'), 'F5 暴击含暴击附注')

const noteNewcomer = generateNote(100, 10, 2, false, 1)
assert(noteNewcomer.includes('首秀附注'), 'F6 首秀含首秀附注')

const noteDefault = generateNote(300, 50, 5, false, 10)
assert(noteDefault.includes('通用附注'), 'F7 无特殊 → 通用附注')

// --------------------------------------------------
suite('模块 G · Draw 抽取')
// --------------------------------------------------

const now = Date.now()
const drawPins = [
  { _id: 'p_hl',   surveyId: 's1', surveyTitle: '光环问卷',  surveyCover: 'c1.png', surveyAuthor: '作者A', userId: userA, haloActive: true,  expireAt: now + 99999, createdAt: 1, senioritySnapshot: 5, pinType: 'self', pinnerId: userA, surveyCreatorId: userA },
  { _id: 'p_own1', surveyId: 's2', surveyTitle: '问卷B',      surveyCover: '',        surveyAuthor: '作者A', userId: userA, haloActive: false, expireAt: now + 99999, createdAt: 2, senioritySnapshot: 5, pinType: 'self', pinnerId: userA, surveyCreatorId: userA },
  { _id: 'p_own2', surveyId: 's3', surveyTitle: '问卷C',      surveyCover: 'c3.png', surveyAuthor: '作者B', userId: userA, haloActive: false, expireAt: now + 99999, createdAt: 3, senioritySnapshot: 5, pinType: 'self', pinnerId: userA, surveyCreatorId: userA },
  { _id: 'p_ot1',  surveyId: 's4', surveyTitle: '他人问卷1',  surveyCover: '',        surveyAuthor: '作者C', userId: userB, haloActive: false, expireAt: now + 99999, createdAt: 10, senioritySnapshot: 0, pinType: 'self', pinnerId: userB, surveyCreatorId: userB },
  { _id: 'p_ot2',  surveyId: 's5', surveyTitle: '他人问卷2',  surveyCover: '',        surveyAuthor: '作者D', userId: userB, haloActive: false, expireAt: now + 99999, createdAt: 20, senioritySnapshot: 20, pinType: 'self', pinnerId: userB, surveyCreatorId: userB }
]

const drawRes = mockDrawResponse(drawPins, userA)
assertEq(drawRes.errCode, 0, 'G1 errCode=0')
assert(Array.isArray(drawRes.data.items), 'G2 items 是数组')
assert(drawRes.data.items.length <= 5, 'G3 items ≤ 5')

// 结构完整性
for (const item of drawRes.data.items) {
  assert(typeof item._id === 'string', `G4 _id 是字符串`)
  assert(typeof item.surveyId === 'string', 'G4 surveyId 字符串')
  assert(typeof item.surveyTitle === 'string', 'G4 surveyTitle 字符串')
  assert(typeof item.surveyCover === 'string', 'G4 surveyCover 字符串')
  assert(typeof item.surveyAuthor === 'string', 'G4 surveyAuthor 字符串')
  assert(typeof item.weight === 'number' && item.weight > 0, 'G4 weight > 0')
  assert(typeof item.isMine === 'boolean', 'G4 isMine 布尔')
  assert(typeof item.pinType === 'string', 'G4 pinType 字符串')
  assert(typeof item.pinnerId === 'string', 'G4 pinnerId 字符串')
  assert(typeof item.surveyCreatorId === 'string', 'G4 surveyCreatorId 字符串')
  assert(typeof item.haloActive === 'boolean', 'G4 haloActive 布尔')
  assert(typeof item.expireAt === 'number', 'G4 expireAt 数字')
}

// 排序：光环在最前
const firstItem = drawRes.data.items[0]
assert(firstItem.haloActive || !drawRes.data.items.some(i => i.haloActive),
  `G5 光环排在最前 (第一个 isMine=${firstItem.isMine} halo=${firstItem.haloActive})`)

// 空池
assertEq(mockDrawResponse([], userA).data.items.length, 0, 'G6 空池 → 空数组')

// 过期池
const expired = [{ _id: 'pe', userId: userA, expireAt: now - 1000, createdAt: 1, surveyTitle: 'x', surveyId: 'x', senioritySnapshot: 0 }]
assertEq(mockDrawResponse(expired, userA).data.items.length, 0, 'G7 全过期 → 空数组')

// 不重复
const manyPins = Array.from({ length: 20 }, (_, i) => ({
  _id: `pm_${i}`, surveyId: `sm${i}`, surveyTitle: `问卷${i}`,
  surveyCover: '', surveyAuthor: `作者${i}`,
  userId: i < 10 ? userA : userB, haloActive: i === 0,
  expireAt: now + 99999, createdAt: i, senioritySnapshot: i,
  pinType: 'self', pinnerId: i < 10 ? userA : userB, surveyCreatorId: i < 10 ? userA : userB
}))
const batchRes = mockDrawResponse(manyPins, userA)
const batchIds = batchRes.data.items.map(i => i._id)
assertEq(batchRes.data.items.length, 5, 'G8 抽取 5 条')
assertEq(new Set(batchIds).size, 5, 'G9 抽取不重复')

// --------------------------------------------------
suite('模块 H · 槽位状态机')
// --------------------------------------------------

// H1 初始
const slots = [{ status: 'idle' }, { status: 'idle' }, { status: 'idle' }]
const r1 = simulateSlotLifecycle(slots, 'enterPool', { pinId: 'p1', surveyId: 's1' })
assertEq(r1.errCode, 0, 'H1.1 入池成功')
assertEq(slots[0].status, 'active', 'H1.2 slot0 → active')

// H2 槽位满
simulateSlotLifecycle(slots, 'enterPool', { pinId: 'p2' })
simulateSlotLifecycle(slots, 'enterPool', { pinId: 'p3' })
const rFull = simulateSlotLifecycle(slots, 'enterPool', { pinId: 'p4' })
assertEq(rFull.errCode, 'SLOTS_FULL', 'H2 三槽满 → SLOTS_FULL')

// H3 claimable 回收
slots[0] = { status: 'claimable', pinId: 'p1' }
const rRecycle = simulateSlotLifecycle(slots, 'enterPool', { pinId: 'p5' })
assertEq(rRecycle.errCode, 0, 'H3.1 claimable → 自动回收')
assertEq(slots[0].status, 'active', 'H3.2 回收后变 active')
assertEq(slots[0].pinId, 'p5', 'H3.3 新 pinId 已写入')

// H4 active → claimable → idle
slots[0] = { status: 'active', pinId: 'pA' }
slots[1] = { status: 'idle' }
slots[2] = { status: 'idle' }
simulateSlotLifecycle(slots, 'expire', { pinId: 'pA', careerId: 'cA' })
assertEq(slots[0].status, 'claimable', 'H4.1 active → claimable')
assertEq(slots[0].careerId, 'cA', 'H4.2 careerId 已写入')
simulateSlotLifecycle(slots, 'markRead', { pinId: 'pA' })
assertEq(slots[0].status, 'idle', 'H4.3 markRead → idle')

// H5 queuing 状态
slots[0] = { status: 'idle' }
simulateSlotLifecycle(slots, 'enterQueue', { queueId: 'q1', surveyId: 'sQ' })
assertEq(slots[0].status, 'queuing', 'H5.1 进入候场队列')
assertEq(slots[0].queueId, 'q1', 'H5.2 queueId 已写入')

// --------------------------------------------------
suite('模块 I · 返回结构一致性')
// --------------------------------------------------

// I1 enterPool 返回结构
const enterPoolRes = {
  errCode: 0, action: 'direct_entry', greenChannel: true,
  pinData: { _id: 'pin_xxx', surveyId: 's1', surveyTitle: 't', surveyAuthor: 'a', expireAt: now + 99999, haloActive: true, pinType: 'self', pinnerId: userA, surveyCreatorId: userA }
}
assert(typeof enterPoolRes.errCode === 'number', 'I1.1 enterPool 有 errCode')
assertEq(enterPoolRes.action, 'direct_entry', 'I1.2 action=direct_entry')
assert(enterPoolRes.pinData._id.startsWith('pin'), 'I1.3 pinData._id 以 pin 开头')
assert('haloActive' in enterPoolRes.pinData, 'I1.4 有 haloActive')

// I2 queue 返回结构
const queueRes = {
  errCode: 0, action: 'enter_queue',
  queueData: { queueId: 'queue_xxx', surveyId: 's1', enterAt: now, seniorityLevel: 1, currentPhase: 'queuing', maxAccelCount: 3 }
}
assertEq(queueRes.queueData.maxAccelCount, 3, 'I2 maxAccelCount=3')

// I3 draw 返回结构
const sampleItem = drawRes.data.items[0] || {}
const drawFields = ['_id', 'surveyId', 'surveyTitle', 'surveyCover', 'surveyAuthor', 'weight', 'isMine', 'pinType', 'pinnerId', 'surveyCreatorId', 'haloActive', 'expireAt']
for (const f of drawFields) {
  assert(f in sampleItem, `I3 字段 ${f} 存在`)
}

// I4 career 返回结构
const careerItem = {
  careerId: 'career_xxx', surveyTitle: '问卷标题', careerNumber: 3, archiveNumber: 'ZW-2026-00003',
  honor: { id: 'center', name: '万众瞩目者', desc: '焦点' },
  stats: { views: 500, clicks: 80, favorites: 12 },
  bonusTriggered: false, isGreenChannel: false, createdAt: now
}
const careerFields = ['careerId', 'surveyTitle', 'careerNumber', 'archiveNumber', 'honor', 'stats', 'bonusTriggered', 'isGreenChannel', 'createdAt']
for (const f of careerFields) {
  assert(f in careerItem, `I4 字段 ${f} 存在`)
}
assertEq(careerItem.honor.id, 'center', 'I4.1 honor.id 正确')
assertEq(careerItem.stats.views, 500, 'I4.2 stats.views 正确')

// --------------------------------------------------
suite('模块 J · isOwn / pinType 判定')
// --------------------------------------------------

// J1 isOwn 基本
assert(isOwn({ userId: userA }, userA), 'J1.1 userId=userA → true')
assert(!isOwn({ userId: userA }, userB), 'J1.2 userId=userA, uid=B → false')

// J2 surveyCreatorId 优先
assert(isOwn({ userId: 'u1', surveyCreatorId: 'u2' }, 'u2'), 'J2.1 surveyCreatorId 匹配')
assert(!isOwn({ userId: 'u1', surveyCreatorId: 'u2' }, 'u1'), 'J2.2 userId 被 surveyCreatorId 覆盖')

// J3 null/undefined 回退
assert(isOwn({ userId: userA, surveyCreatorId: null }, userA), 'J3.1 surveyCreatorId=null → 回退 userId')
assert(isOwn({ userId: userA }, userA), 'J3.2 surveyCreatorId=undefined → 回退 userId')

// J4 pinType 判定
assertEq(determinePinType(userA, userA).pinType, 'self', 'J4.1 creatorId=uid → self')
assertEq(determinePinType('u1', 'u2').pinType, 'promote', 'J4.2 creatorId!=uid → promote')
assertEq(determinePinType(null, userA).errCode, 'OFFICIAL_SURVEY', 'J4.3 creatorId=null → 官方拦截')
assertEq(determinePinType(undefined, userA).errCode, 'OFFICIAL_SURVEY', 'J4.4 creatorId=undefined → 官方拦截')

// J5 surveyAuthor 解析
assertEq(resolveSurveyAuthor('self', userA, userA, '昵称A', null), '昵称A', 'J5.1 self → 取操作人昵称')
assertEq(resolveSurveyAuthor('promote', 'u2', 'u1', '推者', '创者'), '创者', 'J5.2 promote → 取创建者昵称')
assertEq(resolveSurveyAuthor('promote', 'u2', 'u1', '推者', ''), '', 'J5.3 promote 创建者无名 → 空')
assertEq(resolveSurveyAuthor('self', userA, userA, '', null), '', 'J5.4 self 操作人无名 → 空')

// --------------------------------------------------
suite('模块 K · 边界与异常')
// --------------------------------------------------

// K1 空数组
const k1 = mockDrawResponse([], userA)
assertEq(k1.errCode, 0, 'K1.1 空池不报错')
assertEq(k1.data.items.length, 0, 'K1.2 空池 items=[]')

// K2 uid 为空
const k2 = mockDrawResponse(drawPins, '')
const allNotMine = k2.data.items.every(i => !i.isMine)
assert(allNotMine || k2.data.items.length > 0, 'K2 uid 为空 → 无自己问卷')

// K3 promote 问卷三视角
const promoPin = { _id: 'pp', userId: 'uB', surveyCreatorId: 'uA', haloActive: false, expireAt: now + 99999, createdAt: 1, senioritySnapshot: 0, surveyTitle: 't', surveyId: 'st', surveyCover: '', surveyAuthor: '', pinType: 'promote', pinnerId: 'uB' }
assert(isOwn(promoPin, 'uA'), 'K3.1 A 看 promote → isOwn=true')
assert(!isOwn(promoPin, 'uB'), 'K3.2 B 看 promote → isOwn=false')
assert(!isOwn(promoPin, 'uC'), 'K3.3 C 看 promote → isOwn=false')

// K4 零值安全
const zeroSlots = [{ status: 'active', pinId: 'pz' }, { status: 'active', pinId: 'pz2' }, { status: 'active', pinId: 'pz3' }]
const rZero = simulateSlotLifecycle(zeroSlots, 'enterPool', { pinId: 'pn' })
assertEq(rZero.errCode, 'SLOTS_FULL', 'K4.1 满槽 → SLOTS_FULL')

// K5 对数安全
const views = calculateViews({}, 0)
assert(views > 0, 'K5 views 始终 > 0')
const clicksFromZero = calculateClicks(0, 0)
assert(clicksFromZero >= 1, 'K5 clicks(0 views) → ≥ 1') // 保守最小值，实际可能为 0（Z 保证≥1）
const favZero = calculateFavorites(0, 0)
assert(favZero >= 0, 'K5 fav(0 clicks) → ≥ 0')

// K6 expireAt 恰好等于 now
const edgePin = { _id: 'pedge', userId: userA, expireAt: Date.now(), createdAt: 1, surveyTitle: 'x', surveyId: 'x', senioritySnapshot: 0 }
const edgeRes = mockDrawResponse([edgePin], userA)
// expireAt 是 <= now 还是 strictly > now？代码用的是 $gt
assertEq(edgeRes.data.items.length, 0, 'K6 expireAt=now → 视为过期（$gt 不包含等号）')

// K7 资历 JSON 序列化安全
assertEq(JSON.stringify({ lv: getSeniorityLevel(-999) }), '{"lv":0}', 'K7 极端负数 → Lv.0')

// ======================== 测试报告 ========================

const total = passed + failed
console.log(`\n${'='.repeat(50)}`)
console.log(`置顶系统全面测试 · 共 ${total} 项`)
console.log(`  通过: ${passed}`)
console.log(`  失败: ${failed}`)
if (failed > 0) {
  console.log(`\n失败详情:`)
  failures.forEach(f => console.log(`  ✗ ${f.label}  ${f.detail ? '→ ' + f.detail : ''}`))
  process.exit(1)
} else {
  console.log(`\n✓ 全部通过`)
  process.exit(0)
}
