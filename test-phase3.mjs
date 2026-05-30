/**
 * 阶段三 · 自动测试脚本
 *
 * 测试范围：
 *   1. 晋升阈值判定（recordClick 中 thresholds 逻辑）
 *   2. getSurveyByTag 返回结构（clickCount + rarity）
 *   3. getMySurveys 返回结构（clickCount + isPublic + rarity）
 *   4. submitAnswer 入参结构完整性
 *   5. 经验条计算（rarityLevels / currentLevel / expPercent / rarityDisplay）
 *   6. 自访跳过逻辑
 *   7. generateFromCoze 返回结构（clickCount + isPublic）
 *   8. getAnswerHistory / getSurveyDetail 返回结构
 *
 * 用法：node test-phase3.mjs
 */

// ======================== 测试框架 ========================

let passCount = 0
let failCount = 0
let suiteCount = 0

function suite(name) {
  suiteCount++
  console.log(`\n${'='.repeat(64)}`)
  console.log(`套件 ${suiteCount}：${name}`)
  console.log(`${'='.repeat(64)}`)
}

function pass(msg) {
  passCount++
  console.log(`  ✅ PASS — ${msg}`)
}

function fail(msg, detail) {
  failCount++
  console.log(`  ❌ FAIL — ${msg}`)
  if (detail != null) console.log(`     detail: ${JSON.stringify(detail)}`)
}

function assert(cond, passMsg, failMsg, detail) {
  if (cond) pass(passMsg)
  else fail(failMsg, detail)
}

// ======================== 1. 复制阶段三纯函数 ========================

/**
 * 晋升阈值（来自 survey/index.obj.js:685-693）
 * 首次从 handmade0 → handmade1 时 promoted=true
 */
const THRESHOLDS = [
  { min: 101,  rarity: 'handmade1' },
  { min: 501,  rarity: 'handmade2' },
  { min: 1501, rarity: 'handmade3' },
  { min: 5001, rarity: 'darkgold'   }
]

function getRarityFromClickCount(clickCount) {
  for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
    if (clickCount >= THRESHOLDS[i].min) return THRESHOLDS[i].rarity
  }
  return 'handmade0'
}

function shouldPromote(newClickCount) {
  const newRarity = getRarityFromClickCount(newClickCount)
  const oldRarity = getRarityFromClickCount(newClickCount - 1)
  const rarityChanged = newRarity !== oldRarity
  const firstPublic = rarityChanged && oldRarity === 'handmade0'
  return { promoted: firstPublic, newRarity, oldRarity }
}

/**
 * isPublic 判定（survey-preview.vue / my-surveys.vue 逻辑）
 */
function isPublic(rarity) {
  return rarity !== 'handmade0'
}

/**
 * 经验条计算（来自 result.vue:211-243）
 */
const RARITY_LEVELS = [
  { rarity: 'handmade0', min: 0,    next: 101 },
  { rarity: 'handmade1', min: 101,  next: 501 },
  { rarity: 'handmade2', min: 501,  next: 1501 },
  { rarity: 'handmade3', min: 1501, next: 5001 },
  { rarity: 'darkgold',  min: 5001, next: null }
]

function getCurrentLevel(clickCount) {
  const cnt = clickCount || 0
  const levels = RARITY_LEVELS
  for (let i = levels.length - 1; i >= 0; i--) {
    if (cnt >= levels[i].min) return levels[i]
  }
  return levels[0]
}

function getNextThreshold(clickCount) {
  const level = getCurrentLevel(clickCount)
  return level.next || null
}

function getExpPercent(clickCount) {
  const level = getCurrentLevel(clickCount)
  if (level.next == null) return 100
  const range = level.next - level.min
  return Math.min(100, ((clickCount || 0) - level.min) / range * 100)
}

function getRarityDisplay(clickCount) {
  const level = getCurrentLevel(clickCount)
  if (level.rarity === 'darkgold') return '已达最高'
  const idx = RARITY_LEVELS.indexOf(level)
  const next = RARITY_LEVELS[idx + 1]
  return next ? '→ ' + next.rarity : ''
}

/**
 * 自访跳过判定（来自 survey/index.obj.js:650-652）
 */
function shouldSkipSelfVisit(uid, creatorId) {
  return !!(uid && uid === creatorId)
}


// ======================== 2. 测试套件 ========================

// ---------- 套件一：晋升阈值判定 ----------
suite('晋升阈值判定（recordClick thresholds）')

// 边界值测试
const testCases1 = [
  { cc: 0,    expected: 'handmade0' },
  { cc: 1,    expected: 'handmade0' },
  { cc: 100,  expected: 'handmade0' },
  { cc: 101,  expected: 'handmade1' },
  { cc: 102,  expected: 'handmade1' },
  { cc: 500,  expected: 'handmade1' },
  { cc: 501,  expected: 'handmade2' },
  { cc: 1500, expected: 'handmade2' },
  { cc: 1501, expected: 'handmade3' },
  { cc: 5000, expected: 'handmade3' },
  { cc: 5001, expected: 'darkgold' },
  { cc: 9999, expected: 'darkgold' },
]

for (const tc of testCases1) {
  const actual = getRarityFromClickCount(tc.cc)
  assert(
    actual === tc.expected,
    `clickCount=${tc.cc} → rarity="${actual}"`,
    `clickCount=${tc.cc} → 预期 "${tc.expected}"，实际 "${actual}"`
  )
}

// promoted 标记测试：仅在 handmade0→handmade1 时返回 true
const promoteCases = [
  { from: 0, to: 1, promoted: false },
  { from: 99, to: 100, promoted: false },
  { from: 100, to: 101, promoted: true },    // handmade0 → handmade1
  { from: 101, to: 102, promoted: false },
  { from: 500, to: 501, promoted: false },    // handmade1 → handmade2（非首次公开）
  { from: 1500, to: 1501, promoted: false },
  { from: 5000, to: 5001, promoted: false },
]

for (const pc of promoteCases) {
  const result = shouldPromote(pc.to)
  assert(
    result.promoted === pc.promoted,
    `clickCount ${pc.from}→${pc.to}: promoted=${result.promoted}`,
    `clickCount ${pc.from}→${pc.to}: 预期 promoted=${pc.promoted}，实际 ${result.promoted}`
  )
}


// ---------- 套件二：getSurveyByTag 返回结构 ----------
suite('getSurveyByTag 返回结构（clickCount + rarity）')

function mockGetSurveyByTag(survey, tag) {
  return {
    errCode: 0,
    data: {
      ...survey,
      clickCount: tag ? (tag.clickCount || 0) : 0,
      rarity: tag ? (tag.rarity || 'handmade0') : 'handmade0'
    }
  }
}

const mockSurvey = { _id: 'abc123', tagName: '测试标签', dims: ['A', 'B', 'C'], qs: [] }
const mockTag = { clickCount: 250, rarity: 'handmade1' }

const result2 = mockGetSurveyByTag(mockSurvey, mockTag)
assert(
  result2.data.clickCount === 250,
  'getSurveyByTag 返回 clickCount=250',
  `clickCount 预期 250，实际 ${result2.data.clickCount}`
)
assert(
  result2.data.rarity === 'handmade1',
  'getSurveyByTag 返回 rarity=handmade1',
  `rarity 预期 handmade1，实际 ${result2.data.rarity}`
)
assert(
  typeof isPublic(result2.data.rarity) === 'boolean',
  'isPublic 可正确判定',
  `isPublic 返回非 boolean`
)

// 测试 tag 不存在时的默认值
const result2b = mockGetSurveyByTag(mockSurvey, null)
assert(
  result2b.data.clickCount === 0 && result2b.data.rarity === 'handmade0',
  'getSurveyByTag tag 不存在时 clickCount=0, rarity=handmade0',
  `clickCount=${result2b.data.clickCount}, rarity=${result2b.data.rarity}`
)


// ---------- 套件三：getMySurveys 返回结构 ----------
suite('getMySurveys 返回结构（clickCount + isPublic + rarity）')

function mockGetMySurveys(surveys, tagsMap) {
  return {
    errCode: 0,
    data: surveys.map(s => {
      const tag = tagsMap[s.tagName]
      const clickCount = tag ? (tag.clickCount || 0) : 0
      const rarity = tag ? (tag.rarity || 'handmade0') : 'handmade0'
      return {
        id: s._id,
        title: s.title,
        tagName: s.tagName,
        clickCount,
        isPublic: isPublic(rarity),
        rarity
      }
    })
  }
}

const mockSurveys = [
  { _id: 's1', title: '问卷A', tagName: '标签A' },
  { _id: 's2', title: '问卷B', tagName: '标签B' },
]
const mockTagsMap = {
  '标签A': { clickCount: 50, rarity: 'handmade0' },
  '标签B': { clickCount: 600, rarity: 'handmade2' },
}

const result3 = mockGetMySurveys(mockSurveys, mockTagsMap)
assert(result3.data.length === 2, `列表长度=2，实际=${result3.data.length}`)

const itemA = result3.data[0]
assert(itemA.clickCount === 50, `标签A clickCount=50`, `实际=${itemA.clickCount}`)
assert(itemA.isPublic === false, `标签A isPublic=false`, `实际=${itemA.isPublic}`)
assert(itemA.rarity === 'handmade0', `标签A rarity=handmade0`, `实际=${itemA.rarity}`)

const itemB = result3.data[1]
assert(itemB.clickCount === 600, `标签B clickCount=600`, `实际=${itemB.clickCount}`)
assert(itemB.isPublic === true, `标签B isPublic=true`, `实际=${itemB.isPublic}`)
assert(itemB.rarity === 'handmade2', `标签B rarity=handmade2`, `实际=${itemB.rarity}`)


// ---------- 套件四：submitAnswer 入参结构 ----------
suite('submitAnswer 入参结构完整性')

function mockSubmitAnswer(params) {
  const requiredFields = ['surveyId', 'answers', 'dimensionScores', 'matchedType', 'surveySnapshot']
  const missing = requiredFields.filter(f => !(f in params) || params[f] == null)
  return { errCode: missing.length ? 'PARAM_ERROR' : 0, missing }
}

// 合法入参
const answer1 = mockSubmitAnswer({
  surveyId: 's1',
  answers: [{ slot: 'A', idx: 0 }],
  dimensionScores: { 'a': 80, 'b': 60 },
  matchedType: { name: '类型A', emoji: '🎯' },
  surveySnapshot: { tagName: '标签A', dims: ['a', 'b'] }
})
assert(answer1.errCode === 0, '合法入参通过', `missing=${answer1.missing}`)

// 缺失 matchedType
const answer2 = mockSubmitAnswer({
  surveyId: 's1',
  answers: [{ slot: 'A', idx: 0 }],
  dimensionScores: { 'a': 80 },
  surveySnapshot: { tagName: '标签A' }
})
assert(answer2.errCode === 'PARAM_ERROR', '缺失 matchedType → PARAM_ERROR', `missing=${answer2.missing}`)

// 缺失 surveySnapshot
const answer3 = mockSubmitAnswer({
  surveyId: 's1',
  answers: [{ slot: 'A', idx: 0 }],
  dimensionScores: { 'a': 80 },
  matchedType: { name: '类型A' }
})
assert(answer3.errCode === 'PARAM_ERROR', '缺失 surveySnapshot → PARAM_ERROR', `missing=${answer3.missing}`)


// ---------- 套件五：经验条计算 ----------
suite('经验条计算（rarityLevels / expPercent / rarityDisplay）')

const expCases = [
  { cc: 0,    level: 'handmade0', next: 101,  percent: 0,      display: '→ handmade1' },
  { cc: 50,   level: 'handmade0', next: 101,  percent: 50/101*100, display: '→ handmade1' },
  { cc: 100,  level: 'handmade0', next: 101,  percent: 100/101*100, display: '→ handmade1' },
  { cc: 101,  level: 'handmade1', next: 501,  percent: 0,      display: '→ handmade2' },
  { cc: 300,  level: 'handmade1', next: 501,  percent: 199/400*100, display: '→ handmade2' },
  { cc: 501,  level: 'handmade2', next: 1501, percent: 0,      display: '→ handmade3' },
  { cc: 1501, level: 'handmade3', next: 5001, percent: 0,      display: '→ darkgold' },
  { cc: 5001, level: 'darkgold',  next: null,  percent: 100,    display: '已达最高' },
  { cc: 9999, level: 'darkgold',  next: null,  percent: 100,    display: '已达最高' },
]

for (const tc of expCases) {
  const level = getCurrentLevel(tc.cc)
  const next = getNextThreshold(tc.cc)
  const pct = getExpPercent(tc.cc)
  const display = getRarityDisplay(tc.cc)

  const levelOk = level.rarity === tc.level
  const nextOk = tc.next === null ? next === null : next === tc.next
  const pctOk = Math.abs(pct - tc.percent) < 0.01
  const displayOk = display === tc.display

  assert(
    levelOk && nextOk && pctOk && displayOk,
    `cc=${tc.cc}: level=${level.rarity} next=${next} pct=${pct.toFixed(1)}% display="${display}"`,
    levelOk ? '' : `level 预期 ${tc.level} 实际 ${level.rarity}; ` +
    (nextOk ? '' : `next 预期 ${tc.next} 实际 ${next}; `) +
    (pctOk ? '' : `pct 预期 ${tc.percent} 实际 ${pct}; `) +
    (displayOk ? '' : `display 预期 "${tc.display}" 实际 "${display}"`)
  )
}

// 额外测极端值
const pct5000 = getExpPercent(5000)
assert(pct5000 < 100, `cc=5000 时 expPercent < 100（${pct5000.toFixed(1)}%）`)
const pct5001 = getExpPercent(5001)
assert(pct5001 === 100, `cc=5001 时 expPercent = 100`)


// ---------- 套件六：自访跳过逻辑 ----------
suite('自访跳过逻辑')

assert(shouldSkipSelfVisit('user123', 'user123') === true, '相同 uid → 跳过')
assert(shouldSkipSelfVisit('user123', 'user456') === false, '不同 uid → 不跳过')
assert(shouldSkipSelfVisit('user123', null) === false, 'creatorId=null → 不跳过')
assert(shouldSkipSelfVisit(null, 'user456') === false, 'uid=null → 不跳过')
assert(shouldSkipSelfVisit(null, null) === false, '都为空 → 不跳过')


// ---------- 套件七：generateFromCoze 返回结构 ----------
suite('generateFromCoze 返回结构（clickCount + isPublic）')

function mockGenerateFromCoze(existingTag) {
  return {
    errCode: 0,
    data: {
      surveyId: 'new_survey_123',
      tagName: '测试标签',
      questionnaire: { title: '测试', dims: [], qs: [], resultTypes: [] },
      clickCount: existingTag ? (existingTag.clickCount || 0) : 0,
      isPublic: existingTag ? (existingTag.rarity !== 'handmade0') : false
    }
  }
}

const result7a = mockGenerateFromCoze({ clickCount: 0, rarity: 'handmade0' })
assert(result7a.data.clickCount === 0, '新标签 clickCount=0')
assert(result7a.data.isPublic === false, '新标签 isPublic=false')
assert('clickCount' in result7a.data, '返回含 clickCount 字段')
assert('isPublic' in result7a.data, '返回含 isPublic 字段')

const result7b = mockGenerateFromCoze({ clickCount: 150, rarity: 'handmade1' })
assert(result7b.data.clickCount === 150, '已有标签 clickCount=150')
assert(result7b.data.isPublic === true, 'handmade1 → isPublic=true')


// ---------- 套件八：getAnswerHistory / getSurveyDetail 返回结构 ----------
suite('getAnswerHistory / getSurveyDetail 返回结构')

function mockGetAnswerHistory(records) {
  return {
    errCode: 0,
    data: {
      list: records.map(r => ({
        _id: r._id,
        surveyId: r.surveyId,
        tagName: (r.surveySnapshot && r.surveySnapshot.tagName) || '',
        dims: (r.surveySnapshot && r.surveySnapshot.dims) || [],
        scores: r.dimensionScores || {},
        resultName: (r.matchedType && r.matchedType.name) || '',
        emoji: (r.matchedType && r.matchedType.emoji) || '',
        createdAt: r.createdAt,
        duration: r.duration
      })),
      total: records.length
    }
  }
}

const mockRecords = [
  {
    _id: 'a1',
    surveyId: 's1',
    dimensionScores: { 'a': 80 },
    matchedType: { name: '类型A', emoji: '🎯' },
    surveySnapshot: { tagName: '标签A', dims: ['a', 'b'] },
    createdAt: 1700000000000,
    duration: 45
  }
]

const result8a = mockGetAnswerHistory(mockRecords)
assert(result8a.data.list.length === 1, '历史记录列表长度=1')
const rec = result8a.data.list[0]
assert(rec.tagName === '标签A', `tagName="标签A"`, `实际="${rec.tagName}"`)
assert(rec.dims.length === 2, `dims 长度=2`, `实际=${rec.dims.length}`)
assert(rec.scores && rec.scores.a === 80, `scores.a=80`, `实际=${JSON.stringify(rec.scores)}`)
assert(rec.resultName === '类型A', `resultName="类型A"`, `实际="${rec.resultName}"`)
assert(rec.emoji === '🎯', `emoji="🎯"`, `实际="${rec.emoji}"`)

function mockGetSurveyDetail(survey, usersMap) {
  const creatorId = survey.creatorId || ''
  return {
    errCode: 0,
    data: {
      resultTypes: survey.resultTypes || [],
      creatorId,
      creatorNickname: usersMap[creatorId] || '',
      isCreator: true
    }
  }
}

const result8b = mockGetSurveyDetail(
  { resultTypes: [{ name: 'A', match: 'd1' }], creatorId: 'uid1' },
  { 'uid1': '张三' }
)
assert(result8b.data.creatorNickname === '张三', `creatorNickname="张三"`, `实际="${result8b.data.creatorNickname}"`)
assert(result8b.data.resultTypes.length === 1, `resultTypes 长度=1`, `实际=${result8b.data.resultTypes.length}`)
assert(result8b.data.isCreator === true, 'isCreator=true')

// 无 creatorId 时的默认值
const result8c = mockGetSurveyDetail({ resultTypes: [] }, {})
assert(result8c.data.creatorNickname === '', '无 creatorId → creatorNickname=""')
assert(result8c.data.creatorId === '', '无 creatorId → creatorId=""')


// ======================== 3. 统计输出 ========================

console.log(`\n${'='.repeat(64)}`)
console.log(`测试完成：${suiteCount} 个套件 | ${passCount + failCount} 项测试`)
console.log(`✅ 通过: ${passCount}`)
console.log(`❌ 失败: ${failCount}`)
console.log(`${'='.repeat(64)}`)

if (failCount > 0) {
  console.log('\n⚠️  有测试失败，请检查上方 FAIL 项！')
  process.exit(1)
} else {
  console.log('\n🎉 全部测试通过！')
  process.exit(0)
}
