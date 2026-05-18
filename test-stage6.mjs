/**
 * 阶段六 · 纯函数测试脚本
 * 覆盖 pin-expiry / pin-system 中所有不依赖数据库的纯函数
 * 使用种子随机数保证可复现
 */

// ==================== 种子随机数（Mulberry32） ====================
let SEED = 42
function srand(seed) { SEED = seed ?? 42 }
function rand() {
  SEED |= 0; SEED = (SEED + 0x6D2B79F5) | 0
  let t = Math.imul(SEED ^ (SEED >>> 15), 1 | SEED)
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}
function randomBetween(min, max) { return min + rand() * (max - min) }
function Z(result) {
  const offset = Math.floor(rand() * 51) - 25
  return Math.max(1, result + offset)
}
function genSuffix(now) {
  return `_${now}_${String(Math.floor(rand() * 10000)).padStart(4, '0')}`
}

// ==================== 配置 ====================
const PIN_CONFIG = {
  seniority: {
    levels: [
      { level: 0, min: 0, max: 0, label: 'Lv.0 · 新人' },
      { level: 1, min: 1, max: 5, label: 'Lv.1 · 偶发者' },
      { level: 2, min: 6, max: 20, label: 'Lv.2 · 常客' },
      { level: 3, min: 21, max: null, label: 'Lv.3 · 老面孔' }
    ]
  },
  pool: { poolSizeThreshold: 1000, poolLifecycleMinutes: 13 },
  weight: {
    haloWeight: 10000, selfWeightMin: 300, selfWeightMax: 500,
    otherWeightMin: 1, otherWeightMax: 200,
    reverseCompensationCoefficients: { '0': 2.5, '1': 1.5, '2': 1.0, '3': 0.6 }
  },
  queue: {
    naturalDurationMinutes: 30, maxAccelCount: 3, queueExpireMinutes: 30,
    phases: [
      { phase: 'queuing', endMin: 5 },
      { phase: 'inspecting', endMin: 12 },
      { phase: 'pushing', endMin: 22 },
      { phase: 'ready', endMin: 30 }
    ]
  },
  career: {
    viewFloatMin: 1.5, viewFloatMax: 3.0,
    clickRateMin: 0.05, clickRateMax: 0.15,
    favoriteRateMin: 0.05, favoriteRateMax: 0.20,
    bonusTriggerRate: 0.15, bonusMultiplierMin: 1.5, bonusMultiplierMax: 2.0,
    favoriteFloor: 0, simulatedActiveUsers: 1000
  }
}
const CFG_CAREER = PIN_CONFIG.career
const CFG_SENIORITY = PIN_CONFIG.seniority

// ==================== 荣誉称号池 ====================
const HONOR_TITLES = [
  { id: 'lighthouse', name: '人群中的灯塔', condition: 'highViewsLowClick' },
  { id: 'center', name: '万众瞩目者', condition: 'highClickRate' },
  { id: 'archive_fav', name: '档案馆宠儿', condition: 'highFavRate' },
  { id: 'dark_horse', name: '冷门黑马', condition: 'lowViewsHighClick' },
  { id: 'memes', name: '含梗量宗师', condition: 'randomMeme' },
  { id: 'creator', name: '内容创作者', condition: 'default' }
]
const BONUS_TITLES = [
  { id: 'bonus_flow', name: '破格流量获得者' },
  { id: 'bonus_click', name: '点爆者' }
]
const DEBUT_TITLES = [
  { id: 'debut', name: '闪耀登场的新人' },
  { id: 'debut_high', name: '万众瞩目的首秀者' }
]
const NOTE_TEMPLATES = {
  views_high: ['A1', 'A2', 'A3'],
  click_high: ['B1', 'B2', 'B3'],
  fav_high: ['C1', 'C2'],
  newcomer: ['D1', 'D2'],
  bonus: ['E1', 'E2'],
  general: ['F1', 'F2', 'F3', 'F4']
}
const DISCLAIMER = 'DISCLAIMER TEXT'

// ==================== 纯函数（从原始代码提取） ====================

function getSeniorityLevel(exposureCount) {
  const levels = CFG_SENIORITY.levels || []
  for (const lv of levels) {
    if (exposureCount >= lv.min && (lv.max === null || exposureCount <= lv.max)) return lv.level
  }
  return 0
}

function calculateViews(pinDoc, seniorityLevel) {
  const views = Math.floor(randomBetween(CFG_CAREER.viewFloatMin, CFG_CAREER.viewFloatMax) * 300)
  const boostedViews = seniorityLevel <= 1 ? Math.floor(views * randomBetween(1.2, 1.8)) : views
  return Z(Math.max(100, boostedViews))
}

function calculateClicks(views, seniorityLevel) {
  let clickMin = CFG_CAREER.clickRateMin, clickMax = CFG_CAREER.clickRateMax
  if (seniorityLevel >= 3) { clickMin = Math.max(0.02, clickMin * 0.6); clickMax = Math.max(0.05, clickMax * 0.7) }
  if (seniorityLevel <= 1) { clickMin = Math.min(0.08, clickMin * 1.3); clickMax = Math.min(0.20, clickMax * 1.2) }
  return Z(Math.max(1, Math.floor(views * randomBetween(clickMin, clickMax))))
}

function calculateFavorites(clicks, seniorityLevel) {
  let favMin = CFG_CAREER.favoriteRateMin, favMax = CFG_CAREER.favoriteRateMax
  if (seniorityLevel <= 1) { favMin = Math.min(0.08, favMin * 1.3); favMax = Math.min(0.25, favMax * 1.2) }
  return Math.max(CFG_CAREER.favoriteFloor, Math.floor(clicks * randomBetween(favMin, favMax)))
}

function triggerBonus(views, clicks, seniorityLevel) {
  const actualRate = seniorityLevel <= 1 ? Math.min(0.25, CFG_CAREER.bonusTriggerRate * 1.3) : CFG_CAREER.bonusTriggerRate
  if (rand() >= actualRate) return { triggered: false }
  const targetViews = rand() < 0.7
  const multiplier = randomBetween(CFG_CAREER.bonusMultiplierMin, CFG_CAREER.bonusMultiplierMax)
  return { triggered: true, field: targetViews ? 'views' : 'clicks', multiplier }
}

function validateAndFix(views, clicks, favorites) {
  if (clicks > views) clicks = Math.floor(views * 0.8)
  if (favorites > clicks) favorites = Math.floor(clicks * 0.8)
  views = Math.max(1, Math.floor(views))
  clicks = Math.max(1, Math.floor(clicks))
  favorites = Math.max(CFG_CAREER.favoriteFloor, Math.floor(favorites))
  return { views, clicks, favorites }
}

function matchHonorTitle(views, clicks, favorites, isBonus, careerNumber) {
  if (isBonus) return rand() < 0.5 ? BONUS_TITLES[0] : BONUS_TITLES[1]
  if (careerNumber === 1) return views >= 500 ? DEBUT_TITLES[1] : DEBUT_TITLES[0]
  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0
  if (views > 3000 && clickRate < 0.08) return HONOR_TITLES[0]
  // 🔧 冷门黑马需在万众瞩目前判定：clickRate>0.25 会被 center(>0.2) 截胡
  if (views < 1000 && clickRate > 0.25) return HONOR_TITLES[3]
  if (clickRate > 0.2) return HONOR_TITLES[1]
  if (favRate > 0.3) return HONOR_TITLES[2]
  if (rand() < 0.3) return HONOR_TITLES[4]
  return HONOR_TITLES[5]
}

function generateNote(views, clicks, favorites, isBonus, careerNumber) {
  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0
  const notes = []
  if (isBonus && NOTE_TEMPLATES.bonus.length > 0) notes.push(NOTE_TEMPLATES.bonus[Math.floor(rand() * NOTE_TEMPLATES.bonus.length)])
  if (careerNumber === 1 && NOTE_TEMPLATES.newcomer.length > 0) notes.push(NOTE_TEMPLATES.newcomer[Math.floor(rand() * NOTE_TEMPLATES.newcomer.length)])
  if (views > 2000 && NOTE_TEMPLATES.views_high.length > 0) notes.push(NOTE_TEMPLATES.views_high[Math.floor(rand() * NOTE_TEMPLATES.views_high.length)])
  if (clickRate > 0.18 && NOTE_TEMPLATES.click_high.length > 0) notes.push(NOTE_TEMPLATES.click_high[Math.floor(rand() * NOTE_TEMPLATES.click_high.length)])
  if (favRate > 0.25 && NOTE_TEMPLATES.fav_high.length > 0) notes.push(NOTE_TEMPLATES.fav_high[Math.floor(rand() * NOTE_TEMPLATES.fav_high.length)])
  if (notes.length === 0 && NOTE_TEMPLATES.general.length > 0) notes.push(NOTE_TEMPLATES.general[Math.floor(rand() * NOTE_TEMPLATES.general.length)])
  notes.push('')
  notes.push(DISCLAIMER)
  return notes.join('\n')
}

function calcPhaseImpl(enterAt, acceleratedCount, seniorityLevel) {
  const now = Date.now()
  const elapsed = (now - enterAt) / 60000
  const phaseMap = PIN_CONFIG.queue.phases
  let naturalIdx = 0
  for (let i = 0; i < phaseMap.length; i++) {
    if (elapsed >= phaseMap[i].endMin) naturalIdx = i + 1
  }
  naturalIdx = Math.min(naturalIdx, phaseMap.length - 1)
  const jumpMap = { '0': 4, '1': 3, '2': 2, '3': 1 }
  const jumpSteps = jumpMap[String(seniorityLevel)] || 1
  const accelIdx = Math.min(acceleratedCount * jumpSteps, phaseMap.length - 1)
  const currentIdx = Math.max(naturalIdx, accelIdx)
  return { phaseIndex: currentIdx, currentPhase: phaseMap[currentIdx].phase }
}

function calculateWeightImpl(pinDoc, currentUserId, ownPins) {
  if (pinDoc.haloActive) return PIN_CONFIG.weight.haloWeight
  const cfg = PIN_CONFIG.weight
  if (pinDoc.userId === currentUserId) {
    if (!ownPins || ownPins.length <= 1) return Math.floor((cfg.selfWeightMin + cfg.selfWeightMax) / 2)
    const idx = ownPins.findIndex(p => p._id === pinDoc._id)
    if (idx === -1) return Math.floor((cfg.selfWeightMin + cfg.selfWeightMax) / 2)
    const ratio = idx / (ownPins.length - 1)
    return Math.floor(cfg.selfWeightMin + (cfg.selfWeightMax - cfg.selfWeightMin) * ratio)
  } else {
    const level = getSeniorityLevel(pinDoc.senioritySnapshot)
    const coeff = cfg.reverseCompensationCoefficients[String(level)] || 1.0
    const baseWeight = Math.floor((cfg.otherWeightMin + cfg.otherWeightMax) / 2)
    return Math.floor(Math.max(baseWeight * coeff, cfg.otherWeightMin))
  }
}

// ==================== 统计计数器 ====================
const stats = {
  views: { total: 0, min: Infinity, max: -Infinity, samples: 0 },
  clicks: { total: 0, min: Infinity, max: -Infinity, samples: 0 },
  favs: { total: 0, min: Infinity, max: -Infinity, samples: 0 },
  honors: {},
  bonusCount: 0,
  debutCount: 0,
  noteTypes: { bonus: 0, newcomer: 0, views_high: 0, click_high: 0, fav_high: 0, general: 0 },
  validateFixes: { clicksFixed: 0, favsFixed: 0, negClicksFixed: 0, negFavsFixed: 0 }
}

// ==================== 测试函数 ====================

let passed = 0, failed = 0

function assert(condition, label) {
  if (condition) { passed++ } else {
    failed++
    console.error(`  ✗ FAIL: ${label}`)
  }
}

// ===== 1. getSeniorityLevel =====
function testSeniorityLevel() {
  console.log('\n━━━ 1. getSeniorityLevel ━━━')
  assert(getSeniorityLevel(0) === 0, 'exposure=0 → Lv.0')
  assert(getSeniorityLevel(1) === 1, 'exposure=1 → Lv.1')
  assert(getSeniorityLevel(5) === 1, 'exposure=5 → Lv.1')
  assert(getSeniorityLevel(6) === 2, 'exposure=6 → Lv.2')
  assert(getSeniorityLevel(20) === 2, 'exposure=20 → Lv.2')
  assert(getSeniorityLevel(21) === 3, 'exposure=21 → Lv.3')
  assert(getSeniorityLevel(999) === 3, 'exposure=999 → Lv.3')
  assert(getSeniorityLevel(-1) === 0, 'exposure=-1 → Lv.0（fallback）')
}

// ===== 2. calculateViews =====
function testCalculateViews() {
  console.log('\n━━━ 2. calculateViews ━━━')
  const pinDoc = {}
  const N = 1000
  const results = { lv0: [], lv2: [] }
  srand(42)
  for (let i = 0; i < N; i++) {
    const v0 = calculateViews(pinDoc, 0)
    results.lv0.push(v0)
  }
  srand(42)
  for (let i = 0; i < N; i++) {
    const v2 = calculateViews(pinDoc, 2)
    results.lv2.push(v2)
  }
  // 所有值 ≥ 100
  assert(results.lv0.every(v => v >= 100), 'Lv.0: 所有 views ≥ 100')
  assert(results.lv2.every(v => v >= 100), 'Lv.2: 所有 views ≥ 100')
  // Lv.0 均值显著高于 Lv.2（有反向补偿）
  const avg0 = results.lv0.reduce((a, b) => a + b, 0) / N
  const avg2 = results.lv2.reduce((a, b) => a + b, 0) / N
  assert(avg0 > avg2 * 1.1, `Lv.0 均值(${avg0.toFixed(0)}) > Lv.2 均值(${avg2.toFixed(0)}) × 1.1（反向补偿生效）`)
  console.log(`  Lv.0 均值: ${avg0.toFixed(0)}, Lv.2 均值: ${avg2.toFixed(0)}`)
}

// ===== 3. calculateClicks =====
function testCalculateClicks() {
  console.log('\n━━━ 3. calculateClicks ━━━')
  const N = 1000
  srand(42)
  for (let i = 0; i < N; i++) {
    const views = 500 + i
    const cl0 = calculateClicks(views, 0)
    const cl3 = calculateClicks(views, 3)
    assert(cl0 >= 1, `Lv.0: clicks(${cl0}) ≥ 1`)
    assert(cl3 >= 1, `Lv.3: clicks(${cl3}) ≥ 1`)
    assert(cl0 <= views, `Lv.0: clicks(${cl0}) ≤ views(${views})`)
    assert(cl3 <= views, `Lv.3: clicks(${cl3}) ≤ views(${views})`)
  }
}

// ===== 4. calculateFavorites =====
function testCalculateFavorites() {
  console.log('\n━━━ 4. calculateFavorites ━━━')
  const N = 1000
  srand(42)
  for (let i = 0; i < N; i++) {
    const clicks = 50 + i
    const fav = calculateFavorites(clicks, 0)
    assert(fav >= 0, `favorites(${fav}) ≥ 0`)
    assert(fav <= clicks, `favorites(${fav}) ≤ clicks(${clicks})`)
  }
}

// ===== 5. triggerBonus =====
function testTriggerBonus() {
  console.log('\n━━━ 5. triggerBonus ━━━')
  const N = 10000
  let bonusLv0 = 0, bonusLv3 = 0
  srand(42)
  for (let i = 0; i < N; i++) {
    if (triggerBonus(1000, 100, 0).triggered) bonusLv0++
  }
  srand(42)
  for (let i = 0; i < N; i++) {
    if (triggerBonus(1000, 100, 3).triggered) bonusLv3++
  }
  const rate0 = bonusLv0 / N
  const rate3 = bonusLv3 / N
  // Lv.0 暴击率 ≈ 0.195 (0.15 * 1.3), Lv.3 ≈ 0.15
  assert(rate0 > 0.15, `Lv.0 暴击率(${(rate0*100).toFixed(1)}%) > 15%`)
  assert(rate3 > 0.05 && rate3 < 0.30, `Lv.3 暴击率(${(rate3*100).toFixed(1)}%) 在 5%~30% 之间`)
  assert(rate0 > rate3, `Lv.0 暴击率(${(rate0*100).toFixed(1)}%) > Lv.3(${(rate3*100).toFixed(1)}%)`)
  console.log(`  Lv.0 暴击率: ${(rate0*100).toFixed(1)}%, Lv.3 暴击率: ${(rate3*100).toFixed(1)}%`)
}

// ===== 6. validateAndFix =====
function testValidateAndFix() {
  console.log('\n━━━ 6. validateAndFix ━━━')
  // 正常数据不变
  const r1 = validateAndFix(500, 200, 50)
  assert(r1.views === 500 && r1.clicks === 200 && r1.favorites === 50, '正常数据: 不变')
  // clicks > views → 修正
  const r2 = validateAndFix(100, 500, 50)
  assert(r2.clicks <= r2.views, `clicks(${r2.clicks}) ≤ views(${r2.views})`)
  assert(r2.clicks === 80, `clicks 修正为 views×0.8 = 80, 实际 ${r2.clicks}`)
  // favs > clicks → 修正
  const r3 = validateAndFix(500, 200, 500)
  assert(r3.favorites <= r3.clicks, `favs(${r3.favorites}) ≤ clicks(${r3.clicks})`)
  // 负值 → 兜底 1
  const r4 = validateAndFix(-10, -5, -3)
  assert(r4.views >= 1 && r4.clicks >= 1 && r4.favorites >= 0, '负值兜底')
  // 小数 → 取整
  const r5 = validateAndFix(100.7, 50.3, 10.9)
  assert(Number.isInteger(r5.views) && Number.isInteger(r5.clicks) && Number.isInteger(r5.favorites), '小数取整')
}

// ===== 7. matchHonorTitle =====
function testMatchHonorTitle() {
  console.log('\n━━━ 7. matchHonorTitle ━━━')
  // 暴击 → bonus title
  srand(42)
  const bt = matchHonorTitle(500, 200, 50, true, 3)
  assert(['bonus_flow', 'bonus_click'].includes(bt.id), `bonus: ${bt.id}`)

  // 首秀 careerNumber=1, views<500
  srand(42)
  const d1 = matchHonorTitle(300, 100, 10, false, 1)
  assert(d1.id === 'debut', `首秀低关注: ${d1.id}`)

  // 首秀 careerNumber=1, views≥500
  srand(42)
  const d2 = matchHonorTitle(800, 100, 10, false, 1)
  assert(d2.id === 'debut_high', `首秀高光: ${d2.id}`)

  // 灯塔 views>3000, clickRate<0.08
  srand(42)
  const lh = matchHonorTitle(4000, 200, 50, false, 5)
  assert(lh.id === 'lighthouse', `灯塔: ${lh.id}`)

  // 万众瞩目 clickRate>0.2（需避让 dark_horse: views<1000 且 clickRate>0.25）
  // 用 views=1200, clicks=300 (rate=0.25, 但 views>=1000 不触发 dark_horse)
  srand(42)
  const ct = matchHonorTitle(1200, 300, 50, false, 5)
  assert(ct.id === 'center', `万众瞩目: ${ct.id}`)

  // 档案馆 favRate>0.3（需避让 center: clickRate>0.2, 以及 dark_horse: views<1000 && clickRate>0.25）
  // views=1500, clicks=150 (rate=0.1 ≤ 0.2 且 < 0.25), favs=60 (rate=0.4 > 0.3)
  srand(42)
  const af = matchHonorTitle(1500, 150, 60, false, 5)
  assert(af.id === 'archive_fav', `档案馆: ${af.id}`)

  // 冷门黑马 views<1000, clickRate>0.25（修复后 dark_horse 在 center 之前判定）
  // views=900, clicks=250 (rate=0.278 > 0.25, 且 views<1000)
  srand(42)
  const dh = matchHonorTitle(900, 250, 10, false, 5)
  assert(dh.id === 'dark_horse', `冷门黑马: ${dh.id}`)

  // 兜底 "内容创作者"
  srand(42)
  // 构造条件：views=1500, clicks=150 (rate=0.1), favs=20 (rate=0.13)
  // 不满足任何前置条件，30%概率随机到memes，否则兜底creator
  let creatorCount = 0, memesCount = 0
  srand(42)
  for (let i = 0; i < 1000; i++) {
    const h = matchHonorTitle(1500, 150, 20, false, 5)
    if (h.id === 'creator') creatorCount++
    if (h.id === 'memes') memesCount++
  }
  assert(creatorCount > 500, `creator 兜底: ${creatorCount}次(共1000)`)
  console.log(`  称号分布: creator=${creatorCount}, memes=${memesCount}`)
}

// ===== 8. generateNote =====
function testGenerateNote() {
  console.log('\n━━━ 8. generateNote ━━━')
  srand(42)
  const noteAll = generateNote(5000, 1200, 400, true, 1)
  assert(noteAll.includes('DISCLAIMER TEXT'), '包含免责声明')
  assert(noteAll.split('\n').length >= 3, '至少3行（bonus+newcomer+views_high+空行+disclaimer）')

  // 无触发条件 → 只出 general
  const noteGen = generateNote(300, 10, 1, false, 5)
  assert(noteGen.includes('DISCLAIMER TEXT'), 'general: 包含免责声明')
  // 应该包含 general 模板（F1-F4）
  assert(noteGen.match(/[F][1-4]/), `general 包含F1-F4: ${noteGen}`)

  // careerNumber=1, 无 bonus
  const noteDebut = generateNote(1500, 200, 30, false, 1)
  assert(noteDebut.match(/[D][1-2]/), `首秀含 D 模板: ${noteDebut}`)
}

// ===== 9. 完整管线一致性 =====
function testFullPipeline() {
  console.log('\n━━━ 9. 完整管线一致性（500次） ━━━')
  srand(42)
  let bonusCount = 0, debutCount = 0
  for (let i = 0; i < 500; i++) {
    const exposure = Math.floor(rand() * 30)
    const pinDoc = {
      surveyId: `test_${i}`,
      surveyTitle: `测试问卷${i}`,
      senioritySnapshot: exposure,
      createdAt: Date.now() - Math.floor(rand() * 86400000),
      _id: `pin_test_${i}`,
      isGreenChannel: exposure === 0,
      haloActive: i === 0
    }
    const seniorityLevel = getSeniorityLevel(exposure)
    const careerNumber = exposure + 1
    let views = calculateViews(pinDoc, seniorityLevel)
    let clicks = calculateClicks(views, seniorityLevel)
    let favs = calculateFavorites(clicks, seniorityLevel)

    // bonus
    const bonus = triggerBonus(views, clicks, seniorityLevel)
    let isBonus = bonus.triggered
    let bonusMultiplier = isBonus ? bonus.multiplier : 1.0
    if (isBonus) {
      bonusCount++
      if (bonus.field === 'views') {
        views = Math.floor(views * bonus.multiplier)
        clicks = Math.min(clicks, Math.floor(views * 0.8))
        favs = Math.min(favs, Math.floor(clicks * 0.8))
      } else {
        clicks = Math.floor(clicks * bonus.multiplier)
        favs = Math.min(favs, Math.floor(clicks * 0.8))
      }
    }

    const fixed = validateAndFix(views, clicks, favs)
    views = fixed.views; clicks = fixed.clicks; favs = fixed.favorites

    const honor = matchHonorTitle(views, clicks, favs, isBonus, careerNumber)
    const comment = generateNote(views, clicks, favs, isBonus, careerNumber)

    // 断言一致性
    assert(views >= 100, `views(${views}) ≥ 100`)
    assert(clicks >= 1, `clicks(${clicks}) ≥ 1`)
    assert(favs >= 0, `favs(${favs}) ≥ 0`)
    assert(clicks <= views, `clicks(${clicks}) ≤ views(${views})`)
    assert(favs <= clicks, `favs(${favs}) ≤ clicks(${clicks})`)
    assert(honor.id && honor.name, `honor 有 id(${honor.id}) 和 name`)
    assert(comment.length > 0, `comment 非空`)

    if (careerNumber === 1) debutCount++

    if (isBonus) { assert(honor.id.startsWith('bonus'), `bonus 称号: ${honor.id}`) }
    // 首秀和暴击可能重叠：首秀匹配前置但暴击优先，故 careerNumber=1 && isBonus 时称号为 bonus 而非 debut
    if (careerNumber === 1 && !isBonus) { assert(honor.id.startsWith('debut'), `首秀称号: ${honor.id}`) }
  }
  console.log(`  暴击触发: ${bonusCount}/500 (${(bonusCount/5).toFixed(1)}%)`)
  console.log(`  首秀: ${debutCount}次`)
}

// ===== 10. calcPhaseImpl =====
function testCalcPhaseImpl() {
  console.log('\n━━━ 10. calcPhaseImpl（候场阶段推进） ━━━')
  const now = Date.now()

  // 刚进入（0分钟）→ queuing
  const p0 = calcPhaseImpl(now, 0, 0)
  assert(p0.currentPhase === 'queuing' && p0.phaseIndex === 0, `刚进入 → queuing: ${p0.currentPhase}`)

  // 10分钟后（inspecting）
  const p1 = calcPhaseImpl(now - 10 * 60000, 0, 0)
  assert(p1.currentPhase === 'inspecting', `10分钟 → inspecting: ${p1.currentPhase}`)

  // 15分钟后（pushing）
  const p2 = calcPhaseImpl(now - 15 * 60000, 0, 0)
  assert(p2.currentPhase === 'pushing', `15分钟 → pushing: ${p2.currentPhase}`)

  // 25分钟后（ready）
  const p3 = calcPhaseImpl(now - 25 * 60000, 0, 0)
  assert(p3.currentPhase === 'ready', `25分钟 → ready: ${p3.currentPhase}`)

  // 加速1次 Lv.0 → 跳跃4个阶段 → 直接 ready
  const p4 = calcPhaseImpl(now - 1000, 1, 0)
  assert(p4.currentPhase === 'ready', `加速1次 Lv.0 → ready: ${p4.currentPhase}`)

  // 加速1次 Lv.2 → 跳跃1个阶段 → pushing（因为自然推进也在 pushing 范围内）
  const p5 = calcPhaseImpl(now - 1000, 1, 2)
  assert(p5.phaseIndex >= 1, `加速1次 Lv.2 → phaseIndex≥1: ${p5.phaseIndex}`)

  // 加速1次 Lv.3 → 跳跃1个阶段
  const p6 = calcPhaseImpl(now - 1000, 1, 3)
  assert(p6.phaseIndex >= 1, `加速1次 Lv.3 → phaseIndex≥1: ${p6.phaseIndex}`)
}

// ===== 11. calculateWeightImpl =====
function testCalculateWeight() {
  console.log('\n━━━ 11. calculateWeightImpl（四层权重） ━━━')
  const uid = 'user_01'

  // 光环 → 10000
  const halo = calculateWeightImpl({ _id: 'p1', haloActive: true, userId: uid, senioritySnapshot: 0 }, uid, [])
  assert(halo === 10000, `光环权重=10000: ${halo}`)

  // 自己的问卷，只有1个
  const self = calculateWeightImpl({ _id: 'p2', haloActive: false, userId: uid, senioritySnapshot: 0 }, uid, [{ _id: 'p2', createdAt: 100 }])
  assert(self >= 300 && self <= 500, `自己问卷权重 300~500: ${self}`)

  // 自己的问卷，多个（内部排序权重递增）
  const ownPins = [
    { _id: 'p_a', userId: uid, createdAt: 100 },
    { _id: 'p_b', userId: uid, createdAt: 200 },
    { _id: 'p_c', userId: uid, createdAt: 300 }
  ]
  const wa = calculateWeightImpl({ _id: 'p_a', haloActive: false, userId: uid, senioritySnapshot: 0 }, uid, ownPins)
  const wc = calculateWeightImpl({ _id: 'p_c', haloActive: false, userId: uid, senioritySnapshot: 0 }, uid, ownPins)
  assert(wc > wa, `越晚入池权重越高: p_a(${wa}) < p_c(${wc})`)

  // 他人的问卷 → 反向补偿
  const otherLv0 = calculateWeightImpl({ _id: 'p3', haloActive: false, userId: 'other_user', senioritySnapshot: 0 }, uid, [])
  assert(otherLv0 >= 75 && otherLv0 <= 500, `他人 Lv.0 权重: ${otherLv0}`) // (1+200)/2*2.5 ≈ 251

  const otherLv3 = calculateWeightImpl({ _id: 'p4', haloActive: false, userId: 'other_user', senioritySnapshot: 21 }, uid, [])
  assert(otherLv3 < otherLv0, `Lv.3 权重(${otherLv3}) < Lv.0 权重(${otherLv0})`)
}

// ===== 汇总 =====
function printSummary() {
  const total = passed + failed
  console.log(`\n${'━'.repeat(40)}`)
  console.log(`📊 测试汇总: ${total} 项`)
  console.log(`  ✅ 通过: ${passed}`)
  console.log(`  ❌ 失败: ${failed}`)
  console.log(`  ${failed === 0 ? '🎉 全部通过！' : '⚠️  有失败项，请检查'}`)
  console.log(`${'━'.repeat(40)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

// ==================== 主入口 ====================
console.log(`\n🚀 阶段六 · 纯函数测试开始 (seed=${SEED})`)

testSeniorityLevel()
testCalculateViews()
testCalculateClicks()
testCalculateFavorites()
testTriggerBonus()
testValidateAndFix()
testMatchHonorTitle()
testGenerateNote()
testFullPipeline()
testCalcPhaseImpl()
testCalculateWeight()

printSummary()
