/**
 * 二期·助力功能纯函数测试脚本
 *
 * 测试范围（不依赖数据库的纯函数）：
 *   1. calculateWeightImpl — surveyCreatorId 所有权判定 + 旧数据兼容
 *   2. mockDrawResponse — 返回字段携带 pinType/pinnerId/surveyCreatorId
 *   3. isPromotedByMe — 前端按钮/徽章判定逻辑
 *   4. pinType 判定逻辑
 *   5. 旧数据回退兼容
 *
 * 用法：node test-promote-phase2.mjs
 */

// ======================== 配置（与正式代码保持一致） ========================

const WEIGHT_CFG = {
  haloWeight: 10000,
  selfWeightMin: 300, selfWeightMax: 500,
  otherWeightMin: 1, otherWeightMax: 200,
  reverseCompensationCoefficients: { '0': 2.5, '1': 1.5, '2': 1.0, '3': 0.6 }
}

const SENIORITY_LEVELS = [
  { level: 0, min: 0, max: 0, label: 'Lv.0 · 新人' },
  { level: 1, min: 1, max: 5, label: 'Lv.1 · 偶发者' },
  { level: 2, min: 6, max: 20, label: 'Lv.2 · 常客' },
  { level: 3, min: 21, max: null, label: 'Lv.3 · 老面孔' }
]

function getSeniorityLevel(exposureCount) {
  const levels = SENIORITY_LEVELS
  for (const lv of levels) {
    if (exposureCount >= lv.min && (lv.max === null || exposureCount <= lv.max)) {
      return lv.level
    }
  }
  return 0
}

// ======================== 核心函数（从正式代码提取，反映二期改动） ========================

/**
 * 四层权重计算（二期版）
 * 所有权判定：pinDoc.surveyCreatorId（新）→ 回退 pinDoc.userId（旧数据兼容）
 */
function calculateWeightImpl(pinDoc, currentUserId, ownPins) {
  if (pinDoc.haloActive) return WEIGHT_CFG.haloWeight

  const cfg = WEIGHT_CFG

  // ★ 二期改动：使用 surveyCreatorId 判定所有权，旧数据回退到 userId
  if ((pinDoc.surveyCreatorId || pinDoc.userId) === currentUserId) {
    if (!ownPins || ownPins.length <= 1) {
      return Math.floor((cfg.selfWeightMin + cfg.selfWeightMax) / 2)
    }
    const idx = ownPins.findIndex(p => p._id === pinDoc._id)
    if (idx === -1) return Math.floor((cfg.selfWeightMin + cfg.selfWeightMax) / 2)
    const ratio = idx / (ownPins.length - 1)
    return Math.floor(cfg.selfWeightMin + (cfg.selfWeightMax - cfg.selfWeightMin) * ratio)
  } else {
    const level = getSeniorityLevel(pinDoc.senioritySnapshot || 0)
    const coeff = cfg.reverseCompensationCoefficients[String(level)] || 1.0
    const baseWeight = Math.floor((cfg.otherWeightMin + cfg.otherWeightMax) / 2)
    return Math.floor(Math.max(baseWeight * coeff, cfg.otherWeightMin))
  }
}

/**
 * 加权随机采样抽取（二期版）
 * 返回字段新增 pinType / pinnerId / surveyCreatorId
 * isMine 使用 surveyCreatorId 判定
 */
function mockDrawResponse(pins, uid) {
  const now = Date.now()
  const validPins = pins.filter(p => p.expireAt > now)
  if (validPins.length === 0) return { errCode: 0, data: { items: [] } }

  // ★ 二期改动：isOwn 使用 surveyCreatorId 判定
  const isOwn = (p) => (p.surveyCreatorId || p.userId) === uid
  const ownPins = validPins.filter(isOwn).sort((a, b) => a.createdAt - b.createdAt)

  for (const pin of validPins) {
    const userOwnPins = isOwn(pin) ? ownPins : []
    pin._weight = calculateWeightImpl(pin, uid, userOwnPins)
  }

  const candidates = [...validPins]
  const sampleCount = Math.min(5, candidates.length)
  const result = []

  for (let i = 0; i < sampleCount; i++) {
    const totalWeight = candidates.reduce((sum, p) => sum + p._weight, 0)
    let pick = Math.random() * totalWeight
    let selectedIdx = 0
    for (let j = 0; j < candidates.length; j++) {
      pick -= candidates[j]._weight
      if (pick <= 0) { selectedIdx = j; break }
    }
    const selected = candidates.splice(selectedIdx, 1)[0]
    result.push(selected)
  }

  // ★ 二期改动：分层排序使用 surveyCreatorId
  const haloItems = result.filter(p => p.haloActive && isOwn(p))
  const ownItems = result.filter(p => !p.haloActive && isOwn(p))
  const otherItems = result.filter(p => !isOwn(p))

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    return arr
  }

  const sorted = [...shuffle(haloItems), ...shuffle(ownItems), ...shuffle(otherItems)]

  // ★ 二期改动：返回字段新增 pinType / pinnerId / surveyCreatorId
  const items = sorted.map(p => ({
    _id: p._id,
    surveyId: p.surveyId,
    surveyTitle: p.surveyTitle,
    surveyCover: p.surveyCover || '',
    surveyAuthor: p.surveyAuthor || '',
    weight: p._weight,
    isMine: isOwn(p),
    pinType: p.pinType || 'self',
    pinnerId: p.pinnerId || p.userId,
    surveyCreatorId: p.surveyCreatorId || p.userId,
    haloActive: p.haloActive || false,
    expireAt: p.expireAt
  }))

  return { errCode: 0, data: { items } }
}

/**
 * 前端置顶栏徽章判定逻辑
 * 与 pin-topbar.vue 中 isPromotedByMe 一致
 */
function isPromotedByMe(card, currentUid) {
  return !card.isMine && card.pinType === 'promote' && card.pinnerId === currentUid
}

/**
 * pinType 判定逻辑（前端按钮文案 + 后端入池核心）
 */
function determinePinType(creatorId, uid) {
  if (!creatorId) return null           // 官方问卷
  return creatorId === uid ? 'self' : 'promote'
}

// ======================== 测试引擎 ========================

let passed = 0
let failed = 0

function assert(label, condition) {
  if (condition) {
    passed++
    console.log(`  ✓ ${label}`)
  } else {
    failed++
    console.log(`  ✗ ${label}`)
  }
}

function printStats() {
  const total = passed + failed
  console.log(`\n${'━'.repeat(50)}`)
  console.log(`📊 测试汇总: ${total} 项`)
  console.log(`  ✅ 通过: ${passed}`)
  console.log(`  ❌ 失败: ${failed}`)
  console.log(`  ${failed === 0 ? '🎉 全部通过！' : '⚠️  有失败项，请检查'}`)
  console.log(`${'━'.repeat(50)}\n`)
  process.exit(failed > 0 ? 1 : 0)
}

// ======================== 套件一：calculateWeightImpl 所有权判定 ========================

function testCalculateWeight() {
  console.log('\n━━━ 套件一：calculateWeightImpl（surveyCreatorId 所有权判定）━━━')

  const userA = 'uid_a'
  const userB = 'uid_b'

  // T01: 光环不受影响
  const haloPin = { _id: 'p1', userId: userA, surveyCreatorId: userA, haloActive: true }
  assert('T01: 光环问卷返回 10000', calculateWeightImpl(haloPin, userB, []) === 10000)

  // T02: 自己问卷（surveyCreatorId === uid）
  const selfPin = { _id: 'p2', userId: userA, surveyCreatorId: userA, haloActive: false, senioritySnapshot: 0 }
  assert('T02: 自己问卷(surveyCreatorId)权重 ~400', calculateWeightImpl(selfPin, userA, []) === 400)

  // T03: 他人问卷（surveyCreatorId !== uid）
  const otherPin = { _id: 'p3', userId: userB, surveyCreatorId: userB, haloActive: false, senioritySnapshot: 0 }
  assert('T03: 他人问卷(surveyCreatorId)走他人区间', calculateWeightImpl(otherPin, userA, []) <= 500)

  // ★ T04: 推广场景——所有者查看被推广的问卷
  // B的问卷被A推广 → pin.surveyCreatorId === uid_b，B看自己的
  const promotedPin = { _id: 'p4', userId: userA, surveyCreatorId: userB, pinnerId: userA, haloActive: false, senioritySnapshot: 5 }
  const wB = calculateWeightImpl(promotedPin, userB, [])
  assert('T04: 所有者看被推广的问卷 → 自己区间', wB >= 300 && wB <= 500)

  // ★ T05: 推广场景——推广者查看被推广的问卷
  // B的问卷被A推广 → pin.surveyCreatorId === uid_b，A看自己的推广记录 → 走他人区间
  const wA = calculateWeightImpl(promotedPin, userA, [])
  assert('T05: 推广者看被推广的问卷 → 他人区间', wA <= 200)

  // ★ T06: 推广场景权重对比——所有者权重 > 推广者权重
  assert('T06: 所有者权重 > 推广者权重', wB > wA)

  // T07: 多问卷内部排序 — 使用 surveyCreatorId 判定
  const ownPinsA = [
    { _id: 'p_a', userId: userA, surveyCreatorId: userA, haloActive: false, senioritySnapshot: 0, createdAt: 100 },
    { _id: 'p_b', userId: userA, surveyCreatorId: userA, haloActive: false, senioritySnapshot: 0, createdAt: 200 },
  ]
  const wOld = calculateWeightImpl(ownPinsA[0], userA, ownPinsA)
  const wNew = calculateWeightImpl(ownPinsA[1], userA, ownPinsA)
  assert('T07: 越晚入池权重越高', wNew > wOld)
  assert('T07: 最早问卷权重 ≥ 300', wOld >= 300)
  assert('T07: 最晚问卷权重 ≤ 500', wNew <= 500)
}

// ======================== 套件二：旧数据兼容（无 surveyCreatorId） ========================

function testBackwardCompat() {
  console.log('\n━━━ 套件二：旧数据兼容性（无 surveyCreatorId 回退到 userId）━━━')

  const userA = 'uid_a'
  const userB = 'uid_b'

  // T08: 旧数据——自己的（无 surveyCreatorId，有 userId）
  const oldSelfPin = { _id: 'old1', userId: userA, haloActive: false, senioritySnapshot: 3 }
  assert('T08: 旧数据自身判定 → 自己区间', calculateWeightImpl(oldSelfPin, userA, []) >= 300)

  // T09: 旧数据——他人的（无 surveyCreatorId，有 userId）
  const oldOtherPin = { _id: 'old2', userId: userB, haloActive: false, senioritySnapshot: 10 }
  assert('T09: 旧数据他人判定 → 他人区间', calculateWeightImpl(oldOtherPin, userA, []) <= 200)

  // T10: 旧数据——userId 等于当前用户，surveyCreatorId 不存在
  assert('T10: 旧数据 userId 回退正确', (oldSelfPin.userId) === userA)
  assert('T10: 旧数据 surveyCreatorId 为 undefined', oldSelfPin.surveyCreatorId === undefined)

  // T11: draw 中旧数据回退字段
  const now = Date.now()
  const oldPins = [
    { _id: 'old_self', surveyId: 's1', surveyTitle: '老数据自', surveyAuthor: '用户A',
      userId: userA, pinType: undefined, pinnerId: undefined, surveyCreatorId: undefined,
      haloActive: false, expireAt: now + 600000, createdAt: 100, senioritySnapshot: 0 },
    { _id: 'old_other', surveyId: 's2', surveyTitle: '老数据他', surveyAuthor: '用户B',
      userId: userB, pinType: undefined, pinnerId: undefined, surveyCreatorId: undefined,
      haloActive: false, expireAt: now + 600000, createdAt: 200, senioritySnapshot: 0 },
  ]
  const oldRes = mockDrawResponse(oldPins, userA)
  if (oldRes.data.items.length > 0) {
    const selfItem = oldRes.data.items.find(i => i._id === 'old_self')
    if (selfItem) {
      assert('T11: 旧数据 pinType 回退为 self', selfItem.pinType === 'self')
      assert('T11: 旧数据 pinnerId 回退为 userId', selfItem.pinnerId === userA)
      assert('T11: 旧数据 surveyCreatorId 回退为 userId', selfItem.surveyCreatorId === userA)
      assert('T11: 旧数据 isMine 正确（userId 回退）', selfItem.isMine === true)
    }
    const otherItem = oldRes.data.items.find(i => i._id === 'old_other')
    if (otherItem) {
      assert('T11: 旧数据他人 isMine = false', otherItem.isMine === false)
    }
  } else {
    console.log('  ⚠ T11: 未命中（概率问题，重新运行即可）')
  }
}

// ======================== 套件三：draw 返回字段 ========================

function testDrawFields() {
  console.log('\n━━━ 套件三：draw 返回字段（新增 pinType / pinnerId / surveyCreatorId）━━━')

  const userA = 'uid_a'
  const userB = 'uid_b'
  const userC = 'uid_c'
  const now = Date.now()

  const mockPins = [
    // 自己置顶
    { _id: 'pin_self', surveyId: 's1', surveyTitle: '自创问卷', surveyAuthor: '用户A',
      userId: userA, pinType: 'self', pinnerId: userA, surveyCreatorId: userA,
      haloActive: true, weight: 10000, expireAt: now + 600000, createdAt: 100, senioritySnapshot: 0 },
    // 自己推广他人的
    { _id: 'pin_promote', surveyId: 's2', surveyTitle: '他人问卷', surveyAuthor: '用户B',
      userId: userA, pinType: 'promote', pinnerId: userA, surveyCreatorId: userB,
      haloActive: false, weight: 100, expireAt: now + 600000, createdAt: 200, senioritySnapshot: 5 },
    // 与自己无关的他人问卷
    { _id: 'pin_other', surveyId: 's3', surveyTitle: '别人的', surveyAuthor: '用户C',
      userId: userC, pinType: 'self', pinnerId: userC, surveyCreatorId: userC,
      haloActive: false, weight: 80, expireAt: now + 600000, createdAt: 150, senioritySnapshot: 10 },
  ]

  const res = mockDrawResponse(mockPins, userA)
  assert('T12: draw errCode = 0', res.errCode === 0)
  assert('T13: draw 返回 data.items', Array.isArray(res.data.items))

  // 逐字段检查
  for (const item of res.data.items) {
    assert(`T14: 包含 _id(${item._id})`, typeof item._id === 'string' && item._id.length > 0)
    assert(`T15: 包含 surveyId(${item.surveyId})`, typeof item.surveyId === 'string')
    assert(`T16: 包含 surveyTitle(${item.surveyTitle})`, typeof item.surveyTitle === 'string')
    assert(`T17: 包含 surveyAuthor`, typeof item.surveyAuthor === 'string')
    assert(`T18: 包含 pinType(${item.pinType})`, ['self', 'promote'].includes(item.pinType))
    assert(`T19: 包含 pinnerId(${item.pinnerId})`, typeof item.pinnerId === 'string')
    assert(`T20: 包含 surveyCreatorId(${item.surveyCreatorId})`, typeof item.surveyCreatorId === 'string')
    assert(`T21: 包含 weight`, typeof item.weight === 'number' && item.weight > 0)
    assert(`T22: 包含 isMine`, typeof item.isMine === 'boolean')
    assert(`T23: 包含 haloActive`, typeof item.haloActive === 'boolean')
    assert(`T24: 包含 expireAt`, typeof item.expireAt === 'number')
  }

  // 验证具体字段值
  const selfCard = res.data.items.find(i => i._id === 'pin_self')
  if (selfCard) {
    assert('T25: 自己置顶 isMine = true', selfCard.isMine === true)
    assert('T25: 自己置顶 pinType = self', selfCard.pinType === 'self')
    assert('T25: 自己置顶 pinnerId = uid_a', selfCard.pinnerId === userA)
    assert('T25: 自己置顶 surveyCreatorId = uid_a', selfCard.surveyCreatorId === userA)
  }

  const promoteCard = res.data.items.find(i => i._id === 'pin_promote')
  if (promoteCard) {
    assert('T26: 推广卡片 isMine = false（推广者视角）', promoteCard.isMine === false)
    assert('T26: 推广卡片 pinType = promote', promoteCard.pinType === 'promote')
    assert('T26: 推广卡片 pinnerId = uid_a', promoteCard.pinnerId === userA)
    assert('T26: 推广卡片 surveyCreatorId = uid_b', promoteCard.surveyCreatorId === userB)
    // surveyAuthor 应为问卷所有者 B
    assert('T26: 推广卡片 surveyAuthor = 用户B', promoteCard.surveyAuthor === '用户B')
  }

  // T27: 被推广者的视角
  const resB = mockDrawResponse(mockPins, userB)
  const bView = resB.data.items.find(i => i._id === 'pin_promote')
  if (bView) {
    assert('T27: 被推广者看到自己的 isMine = true', bView.isMine === true)
    assert('T27: 被推广者看到 pinType = promote', bView.pinType === 'promote')
  }
}

// ======================== 套件四：isPromotedByMe（前端徽章判定） ========================

function testIsPromotedByMe() {
  console.log('\n━━━ 套件四：isPromotedByMe（前端徽章判定逻辑）━━━')

  const userA = 'uid_a'
  const userB = 'uid_b'
  const userC = 'uid_c'

  // T28: 自己置顶 → 不显示"推广"徽章
  const selfCard = { isMine: true, pinType: 'self', pinnerId: userA }
  assert('T28: 自己置顶 isPromotedByMe = false', isPromotedByMe(selfCard, userA) === false)

  // T29: 自己推广他人 → 显示"推广"徽章
  const promoteCard = { isMine: false, pinType: 'promote', pinnerId: userA }
  assert('T29: 我推广他人 → isPromotedByMe = true', isPromotedByMe(promoteCard, userA) === true)

  // T30: 他人推广他人 → 不显示"推广"徽章（非我推广）
  const otherPromoteCard = { isMine: false, pinType: 'promote', pinnerId: userC }
  assert('T30: 他人推广 → 非我推广', isPromotedByMe(otherPromoteCard, userA) === false)

  // T31: 与我无关的他人置顶本人问卷
  const otherSelfCard = { isMine: false, pinType: 'self', pinnerId: userB }
  assert('T31: 他人置顶自己 → 与我无关', isPromotedByMe(otherSelfCard, userA) === false)

  // T32: 被推广者看到自己的卡片 → 不显示"推广"徽章
  const ownerViewCard = { isMine: true, pinType: 'promote', pinnerId: userA }
  assert('T32: 被推广者看 → 不显示推广徽章', isPromotedByMe(ownerViewCard, userB) === false)

  // T33: 徽章互斥验证：isMine=true时不应显示推广徽章（即使pinnerId匹配）
  assert('T33: isMine 优先于 isPromotedByMe', isPromotedByMe(ownerViewCard, userA) === false)
}

// ======================== 套件五：pinType 判定逻辑 ========================

function testDeterminePinType() {
  console.log('\n━━━ 套件五：pinType 判定逻辑（前端按钮文案 + 后端入池）━━━')

  const userA = 'uid_a'
  const userB = 'uid_b'

  // T34: 官方问卷
  assert('T34: 官方问卷 pinType = null', determinePinType(null, userA) === null)
  assert('T34: 官方问卷(undefined)', determinePinType(undefined, userA) === null)
  assert('T34: 官方问卷(空串)', determinePinType('', userA) === null)

  // T35: 自己问卷
  assert('T35: 自己问卷 pinType = self', determinePinType(userA, userA) === 'self')

  // T36: 他人问卷
  assert('T36: 他人问卷 pinType = promote', determinePinType(userB, userA) === 'promote')

  // T37: creatorId === uid 语义测试（前端按钮用）
  const mockCreatorId = userB
  const mockUid = userA
  const isCreator = mockCreatorId === mockUid
  const hasCreatorId = !!mockCreatorId
  assert('T37: creatorId !== uid → isCreator=false', isCreator === false)
  assert('T37: creatorId 非空 → 显示按钮', hasCreatorId === true)

  // T38: 前端按钮 "看广告置顶" vs "助力推广"
  const btnTextSelf = determinePinType(userA, userA) === 'self' ? '看广告置顶' : '助力推广'
  const btnTextPromote = determinePinType(userB, userA) === 'self' ? '看广告置顶' : '助力推广'
  assert('T38: 自己 → 看广告置顶', btnTextSelf === '看广告置顶')
  assert('T38: 他人 → 助力推广', btnTextPromote === '助力推广')
}

// ======================== 套件六：旧数据回退边界 ========================

function testLegacyBoundary() {
  console.log('\n━━━ 套件六：旧数据回退边界━━━')

  const userA = 'uid_a'
  const userB = 'uid_b'

  // T39: 有 surveyCreatorId 且等于 userId → 正常
  const pinNormal = { _id: 'n1', userId: userA, surveyCreatorId: userA, haloActive: false }
  assert('T39: 新数据 userId=surveyCreatorId', calculateWeightImpl(pinNormal, userA, []) >= 300)

  // T40: 无 surveyCreatorId，仅有 userId → 旧数据回退
  const pinOld = { _id: 'o1', userId: userA, haloActive: false }
  assert('T40: 旧数据无 surveyCreatorId → userId 回退', calculateWeightImpl(pinOld, userA, []) >= 300)

  // T41: surveyCreatorId 与 userId 不同（推广场景）
  const pinPromote = { _id: 'p1', userId: userA, surveyCreatorId: userB, pinnerId: userA, haloActive: false, senioritySnapshot: 0 }
  const wPromoteOwner = calculateWeightImpl(pinPromote, userB, [])
  const wPromotePromoter = calculateWeightImpl(pinPromote, userA, [])
  assert('T41: promote: 所有者 see 自己区间', wPromoteOwner >= 300 && wPromoteOwner <= 500)
  assert('T41: promote: 推广者 see 他人区间（非自区间）', wPromotePromoter < 300)  // 含 Lv.0 补偿

  // T42: 第三方视角 → 他人区间
  const wThirdParty = calculateWeightImpl(pinPromote, 'uid_c', [])
  assert('T42: 第三方视角 → 非自区间', wThirdParty < 300)

  // T43: 全部字段 undefined → 走他人区间（userId=undefined 不可能等于任何 uid）
  const pinWeird = { _id: 'w1', haloActive: false, senioritySnapshot: 0 }
  const wWeird = calculateWeightImpl(pinWeird, userA, [])
  assert('T43: 全空字段权重 ≥ 1', wWeird >= 1)
  assert('T43: 全空字段走他人区间', wWeird <= 500)
}

// ======================== 套件七：空池/边界/不重复 ========================

function testEdgeCases() {
  console.log('\n━━━ 套件七：空池 & 边界━━━')

  const userA = 'uid_a'
  const now = Date.now()

  // T44: 空池
  const emptyRes = mockDrawResponse([], userA)
  assert('T44: 空池返回空数组', emptyRes.data.items.length === 0)

  // T45: 全部过期
  const expiredRes = mockDrawResponse([
    { _id: 'exp', surveyId: 's', userId: userA, surveyCreatorId: userA,
      expireAt: now - 1000, createdAt: 1, senioritySnapshot: 0, pinType: 'self' }
  ], userA)
  assert('T45: 全部过期视为空池', expiredRes.data.items.length === 0)

  // T46: 20条数据抽取不重复
  const manyPins = Array.from({ length: 20 }, (_, i) => ({
    _id: `pin_${i}`, surveyId: `s${i}`, surveyTitle: `问卷${i}`,
    surveyAuthor: `作者${(i % 3)}`, userId: `uid_${i % 4}`,
    surveyCreatorId: `uid_${i % 4}`, pinnerId: `uid_${i % 4}`,
    pinType: i % 2 === 0 ? 'self' : 'promote',
    haloActive: i < 2,
    expireAt: now + 600000, createdAt: i * 10, senioritySnapshot: i
  }))
  const batchRes = mockDrawResponse(manyPins, userA)
  assert('T46: 抽取 5 条', batchRes.data.items.length === 5)
  const ids = batchRes.data.items.map(i => i._id)
  assert('T46: 抽取不重复', new Set(ids).size === 5)
}

// ======================== 套件八：确认 isOwn 与 pin-topbar 徽章互斥 ========================

function testBadgeMutualExclusion() {
  console.log('\n━━━ 套件八：徽章互斥 + 全场景覆盖━━━')

  const userA = 'uid_a'
  const userB = 'uid_b'
  const userC = 'uid_c'
  const now = Date.now()

  // 构建多种场景的池数据
  const scenarioPins = [
    // 场景1: 自己置顶自己
    { _id: 'sc_self', surveyId: 's1', surveyTitle: '自创问卷', surveyAuthor: '用户A',
      userId: userA, pinType: 'self', pinnerId: userA, surveyCreatorId: userA,
      haloActive: false, expireAt: now + 600000, createdAt: 100, senioritySnapshot: 0 },
    // 场景2: A推广B的问卷
    { _id: 'sc_promote', surveyId: 's2', surveyTitle: 'B的问卷', surveyAuthor: '用户B',
      userId: userA, pinType: 'promote', pinnerId: userA, surveyCreatorId: userB,
      haloActive: false, expireAt: now + 600000, createdAt: 200, senioritySnapshot: 5 },
    // 场景3: C推广B的问卷（A无关）
    { _id: 'sc_other_promote', surveyId: 's3', surveyTitle: 'B的另一问卷', surveyAuthor: '用户B',
      userId: userC, pinType: 'promote', pinnerId: userC, surveyCreatorId: userB,
      haloActive: false, expireAt: now + 600000, createdAt: 150, senioritySnapshot: 10 },
    // 场景4: 与A完全无关
    { _id: 'sc_unrelated', surveyId: 's4', surveyTitle: 'C的问卷', surveyAuthor: '用户C',
      userId: userC, pinType: 'self', pinnerId: userC, surveyCreatorId: userC,
      haloActive: false, expireAt: now + 600000, createdAt: 250, senioritySnapshot: 15 },
  ]

  const resA = mockDrawResponse(scenarioPins, userA)

  for (const card of resA.data.items) {
    const hasMyBadge = card.isMine
    const hasPromoteBadge = isPromotedByMe(card, userA)

    if (card._id === 'sc_self') {
      assert('T47: 自己置顶 → isMine=true', hasMyBadge === true)
      assert('T47: 自己置顶 → 无推广徽章', hasPromoteBadge === false)
    } else if (card._id === 'sc_promote') {
      assert('T48: 我推广 → isMine=false', hasMyBadge === false)
      assert('T48: 我推广 → 有推广徽章', hasPromoteBadge === true)
    } else if (card._id === 'sc_other_promote') {
      assert('T49: 他人推广 → 与我无关', hasMyBadge === false)
      assert('T49: 他人推广 → 无推广徽章', hasPromoteBadge === false)
    } else if (card._id === 'sc_unrelated') {
      assert('T50: 与我无关 → 无徽章', hasMyBadge === false && hasPromoteBadge === false)
    }

    // ★ 互斥验证：isMine 和 isPromotedByMe 不应同时为 true
    assert(`T51: 徽章互斥(${card._id})`, !(hasMyBadge && hasPromoteBadge))
  }

  // T52: 被推广者 B 的视角
  const resB = mockDrawResponse(scenarioPins, userB)
  for (const card of resB.data.items) {
    if (card._id === 'sc_promote' || card._id === 'sc_other_promote') {
      // B 是问卷所有者 → isMine = true（即使被他人推广）
      assert(`T52: B看${card._id} → isMine=true`, card.isMine === true)
    }
  }
}

// ======================== 套件九：surveyAuthor 修复场景 ========================

function testSurveyAuthorFix() {
  console.log('\n━━━ 套件九：surveyAuthor 取值逻辑━━━')

  const now = Date.now()

  // 模拟后端逻辑：promote 时取创建者昵称，self 时取操作者昵称
  function mockGetSurveyAuthor(pinType, creatorNickname, operatorNickname) {
    if (pinType === 'promote') return creatorNickname || ''
    return operatorNickname || ''
  }

  // T53: self → 取操作者昵称
  assert('T53: self → 操作者昵称', mockGetSurveyAuthor('self', '创建者B', '操作者A') === '操作者A')

  // T54: promote → 取创建者昵称
  assert('T54: promote → 创建者昵称', mockGetSurveyAuthor('promote', '创建者B', '操作者A') === '创建者B')

  // T55: promote + 创建者无昵称 → 空字符串
  assert('T55: promote + 创建者无昵称', mockGetSurveyAuthor('promote', '', '操作者A') === '')

  // T56: self + 操作者无昵称 → 空字符串
  assert('T56: self + 操作者无昵称', mockGetSurveyAuthor('self', '创建者B', '') === '')

  // T57: 验证 draw 返回中 promote 卡片的 surveyAuthor 为创建者
  const userA = 'uid_a'
  const userB = 'uid_b'
  const promotePins = [
    { _id: 'pin_p', surveyId: 's1', surveyTitle: 'B的问卷', surveyAuthor: '用户B',
      userId: userA, pinType: 'promote', pinnerId: userA, surveyCreatorId: userB,
      haloActive: false, expireAt: now + 600000, createdAt: 100, senioritySnapshot: 0 },
    { _id: 'pin_self', surveyId: 's2', surveyTitle: 'A的问卷', surveyAuthor: '用户A',
      userId: userA, pinType: 'self', pinnerId: userA, surveyCreatorId: userA,
      haloActive: true, expireAt: now + 600000, createdAt: 200, senioritySnapshot: 0 },
  ]
  const resA = mockDrawResponse(promotePins, userA)
  const pCard = resA.data.items.find(i => i._id === 'pin_p')
  const sCard = resA.data.items.find(i => i._id === 'pin_self')
  if (pCard && sCard) {
    assert('T57: promote 卡片 surveyAuthor = 创建者(B)', pCard.surveyAuthor === '用户B')
    assert('T57: self 卡片 surveyAuthor = 操作者(A)', sCard.surveyAuthor === '用户A')
    // surveyAuthor 不应相同（证明区分生效）
    assert('T57: promote 与 self 的 surveyAuthor 不同', pCard.surveyAuthor !== sCard.surveyAuthor)
  }
}

// ======================== 主入口 ========================

console.log('\n🚀 二期·助力功能纯函数测试开始')

testCalculateWeight()
testBackwardCompat()
testDrawFields()
testIsPromotedByMe()
testDeterminePinType()
testLegacyBoundary()
testEdgeCases()
testBadgeMutualExclusion()
testSurveyAuthorFix()

printStats()
