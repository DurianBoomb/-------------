/**
 * 阶段七 · 二期助力功能纯函数测试脚本
 *
 * 测试范围：
 *   1. isOwn() 所有权判定逻辑（surveyCreatorId 优先 / 回退 userId）
 *   2. pinType 判定（creatorId === uid → self, 否则 promote）
 *   3. 官方问卷拦截 (creatorId 为 null/undefined)
 *   4. surveyAuthor 修复逻辑（self 取操作人, promote 取创建者）
 *   5. drawImpl 返回值映射（新字段默认值 + 旧数据兼容）
 *   6. 分层过滤（halo/own/other）使用 isOwn 替代 userId 直判
 *   7. recalcOwnWeights 查询条件构造
 *   8. getQueueStatus 返回值完整性
 *   9. 跨用户视角差异验证（核心边界）
 *
 * 用法：node test-stage7.mjs
 */

// ======================== 配置 ========================

const WEIGHT_CFG = {
  haloWeight: 10000,
  selfWeightMin: 300, selfWeightMax: 500,
  otherWeightMin: 1, otherWeightMax: 200,
  reverseCompensationCoefficients: { '0': 2.5, '1': 1.5, '2': 1.0, '3': 0.6 }
}

// ======================== 被测试的函数（复制自云对象，去 DB 依赖）=====================

/**
 * 所有权判定（复制自 drawImpl）
 */
function isOwn(p, uid) {
  return (p.surveyCreatorId || p.userId) === uid
}

/**
 * pinType 判定与调查问卷拦截
 */
function determinePinType(creatorId, uid) {
  // 官方问卷拦截
  if (!creatorId) return { errCode: 'OFFICIAL_SURVEY', errMsg: '官方问卷不可置顶' }
  // 确定置顶类型
  const pinType = creatorId === uid ? 'self' : 'promote'
  return { errCode: 0, pinType, pinnerId: uid, creatorId }
}

/**
 * surveyAuthor 修复（仅逻辑判断层，模拟 DB 查询结果传入）
 */
function resolveSurveyAuthor(pinType, uid, creatorId, userNickname, creatorUserNickname) {
  if (pinType === 'promote') {
    return creatorUserNickname || ''
  }
  return userNickname || ''
}

/**
 * drawImpl 返回值映射（复制自 drawImpl）
 */
function mapDrawItem(p, uid) {
  return {
    _id: p._id,
    surveyId: p.surveyId,
    surveyTitle: p.surveyTitle,
    surveyCover: p.surveyCover || '',
    surveyAuthor: p.surveyAuthor || '',
    weight: p._weight,
    isMine: isOwn(p, uid),
    pinType: p.pinType || 'self',
    pinnerId: p.pinnerId || p.userId,
    surveyCreatorId: p.surveyCreatorId || p.userId,
    haloActive: p.haloActive || false,
    expireAt: p.expireAt
  }
}

/**
 * 分层过滤逻辑（复制自 drawImpl）
 */
function layerItems(items, uid) {
  const haloItems = items.filter(p => p.haloActive && isOwn(p, uid))
  const ownItems = items.filter(p => !p.haloActive && isOwn(p, uid))
  const otherItems = items.filter(p => !isOwn(p, uid))
  return { haloItems, ownItems, otherItems }
}

/**
 * recalcOwnWeights 查询条件构造
 */
function buildRecalcQuery(uid) {
  return {
    expireAt: { $gt: Date.now() },
    $or: [
      { surveyCreatorId: uid },
      { userId: uid, surveyCreatorId: null } // 模拟 db.command.exists(false)
    ]
  }
}

/**
 * getQueueStatusImpl 返回记录映射（pinType 部分）
 */
function mapQueueRecord(q) {
  return {
    queueId: q._id,
    surveyId: q.surveyId,
    acceleratedCount: q.acceleratedCount || 0,
    maxAccelCount: 3,
    seniorityLevel: q.seniorityLevel || 0,
    enterAt: q.enterAt,
    pinType: q.pinType || 'self'
  }
}

/**
 * career-records 写入映射
 */
function mapCareerRecord(pinDoc) {
  return {
    pinType: pinDoc.pinType || 'self'
  }
}

// ======================== 测试辅助 ========================

let passed = 0
let failed = 0
let failures = []

function assert(condition, label, detail = '') {
  if (condition) {
    passed++
    return true
  }
  failed++
  failures.push({ label, detail })
  console.error(`  ✗ ${label}`)
  if (detail) console.error(`    详情: ${detail}`)
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

function assertDeep(actual, expected, label) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected)
  if (ok) { passed++; return true }
  failed++
  failures.push({ label, detail: '对象不匹配' })
  console.error(`  ✗ ${label}`)
  console.error(`    期望: ${JSON.stringify(expected, null, 2)}`)
  console.error(`    实际: ${JSON.stringify(actual, null, 2)}`)
  return false
}

function suite(name) {
  console.log(`\n━━━ ${name} ━━━`)
}

// ======================== 测试用例 ========================

// ==================== 套件 1: isOwn() 所有权判定 ====================

suite('1. isOwn() 所有权判定')

function test_isOwn_basic() {
  // 1a. surveyCreatorId 优先匹配
  const p1a = { userId: 'userA', surveyCreatorId: 'userB' }
  assert(isOwn(p1a, 'userB'), '1a: surveyCreatorId=userB, uid=userB → true')
  assert(!isOwn(p1a, 'userA'), '1a: surveyCreatorId=userB, uid=userA → false (userId 被覆盖)')

  // 1b. 无 surveyCreatorId → 回退 userId
  const p1b = { userId: 'userA' }
  assert(isOwn(p1b, 'userA'), '1b: 无 surveyCreatorId, userId=userA, uid=userA → true')
  assert(!isOwn(p1b, 'userB'), '1b: 无 surveyCreatorId, userId=userA, uid=userB → false')

  // 1c. surveyCreatorId === null → 回退 userId
  const p1c = { userId: 'userA', surveyCreatorId: null }
  assert(isOwn(p1c, 'userA'), '1c: surveyCreatorId=null, userId=userA → 回退 userId 匹配')
  assert(!isOwn(p1c, 'userB'), '1c: surveyCreatorId=null, uid=userB → false')

  // 1d. surveyCreatorId === undefined → 回退 userId
  const p1d = { userId: 'userC' }
  assert(isOwn(p1d, 'userC'), '1d: 无 surveyCreatorId 字段 → 回退 userId 正确')
}
test_isOwn_basic()

function test_isOwn_promote_scenario() {
  // promote 场景：B 推广了 A 的问卷
  // userId=B（操作人）, surveyCreatorId=A（创建者）
  const promoPin = { userId: 'userB', surveyCreatorId: 'userA', pinType: 'promote' }
  assert(isOwn(promoPin, 'userA'), '1e: promote 问卷, surveyCreatorId=A, uid=A → true')
  assert(isOwn(promoPin, 'userA') && !isOwn(promoPin, 'userB') && !isOwn(promoPin, 'userC'),
    '1f: promote 问卷三视角: A 视为 own, B 不 own, C 不 own')
}
test_isOwn_promote_scenario()

function test_isOwn_old_data() {
  // 旧 self-pin: 无 surveyCreatorId
  const oldSelf = { userId: 'userA' }
  const oldSelf2 = { userId: 'userB', surveyCreatorId: undefined } // 字段不存在
  assert(isOwn(oldSelf, 'userA'), '1g: 旧数据 self-pin, userId=A → A 是 owner')
  assert(!isOwn(oldSelf, 'userB'), '1g: 旧数据 self-pin, userId=A → B 不是 owner')
  assert(isOwn(oldSelf2, 'userB'), '1h: 旧数据无 surveyCreatorId 字段 → 回退 userId')
}
test_isOwn_old_data()

// ==================== 套件 2: pinType 判定 ====================

suite('2. pinType 判定')

function test_pinType_self() {
  const r = determinePinType('userA', 'userA')
  assertEq(r.pinType, 'self', '2a: creatorId===uid → pinType=self')
}
test_pinType_self()

function test_pinType_promote() {
  const r = determinePinType('userB', 'userA')
  assertEq(r.pinType, 'promote', '2b: creatorId!==uid → pinType=promote')
  assertEq(r.pinnerId, 'userA', '2b: pinnerId 为操作人 uid')
}
test_pinType_promote()

function test_pinType_official_block() {
  const r1 = determinePinType(null, 'userA')
  assertEq(r1.errCode, 'OFFICIAL_SURVEY', '2c: creatorId=null → OFFICIAL_SURVEY')

  const r2 = determinePinType(undefined, 'userB')
  assertEq(r2.errCode, 'OFFICIAL_SURVEY', '2d: creatorId=undefined → OFFICIAL_SURVEY')

  const r3 = determinePinType('userC', 'userB')
  assertEq(r3.errCode, 0, '2e: 有值 creatorId → 不拦截')
}
test_pinType_official_block()

// ==================== 套件 3: surveyAuthor 修复 ====================

suite('3. surveyAuthor 修复')

function test_surveyAuthor_self() {
  const author = resolveSurveyAuthor('self', 'userA', 'userA', '我的昵称', null)
  assertEq(author, '我的昵称', '3a: self → 取当前用户昵称')
}
test_surveyAuthor_self()

function test_surveyAuthor_promote() {
  const author = resolveSurveyAuthor('promote', 'userB', 'userA', '推广者名', '创建者名')
  assertEq(author, '创建者名', '3b: promote → 取问卷创建者昵称')
}
test_surveyAuthor_promote()

function test_surveyAuthor_promote_no_nickname() {
  const author = resolveSurveyAuthor('promote', 'userB', 'userA', '推广者名', '')
  assertEq(author, '', '3c: promote + 创建者无名 → 空字符串')
}
test_surveyAuthor_promote_no_nickname()

function test_surveyAuthor_self_no_nickname() {
  const author = resolveSurveyAuthor('self', 'userA', 'userA', '', null)
  assertEq(author, '', '3d: self + 用户有名 → 空字符串')
}
test_surveyAuthor_self_no_nickname()

// ==================== 套件 4: drawImpl 返回值映射 ====================

suite('4. drawImpl 返回值映射')

function test_drawItem_new_data() {
  const pin = {
    _id: 'pin_001', surveyId: 's001', surveyTitle: '测试问卷',
    surveyCover: 'cover.jpg', surveyAuthor: '张老三',
    userId: 'userB', pinType: 'promote', pinnerId: 'userB',
    surveyCreatorId: 'userA', haloActive: false, expireAt: Date.now() + 99999,
    _weight: 100
  }
  const item = mapDrawItem(pin, 'userA')
  assertEq(item.isMine, true, '4a: userA 看 promote 问卷, isMine=true')
  assertEq(item.pinType, 'promote', '4a: pinType=promote')
  assertEq(item.pinnerId, 'userB', '4a: pinnerId 为推广者')
  assertEq(item.surveyCreatorId, 'userA', '4a: surveyCreatorId 为创建者')
  assertEq(item.surveyAuthor, '张老三', '4a: surveyAuthor 完整')
}
test_drawItem_new_data()

function test_drawItem_old_data() {
  // 旧数据：无 pinType、pinnerId、surveyCreatorId
  const oldPin = {
    _id: 'pin_old_001', surveyId: 's_old', surveyTitle: '旧数据问卷',
    surveyAuthor: '旧用户', userId: 'userX',
    haloActive: false, expireAt: Date.now() + 99999,
    _weight: 50
  }
  const item = mapDrawItem(oldPin, 'userX')
  assertEq(item.isMine, true, '4b: 旧数据 self-pin, userId=userX, uid=userX → isMine=true')
  assertEq(item.pinType, 'self', '4b: 旧数据无 pinType → 默认 self')
  assertEq(item.pinnerId, 'userX', '4b: 旧数据无 pinnerId → 回退 userId')
  assertEq(item.surveyCreatorId, 'userX', '4b: 旧数据无 surveyCreatorId → 回退 userId')
}
test_drawItem_old_data()

function test_drawItem_viewer_mismatch() {
  // userZ 看 userA 的 old self-pin
  const oldPin = { _id: 'p2', userId: 'userA', surveyTitle: 't', _weight: 30, expireAt: Date.now() + 999 }
  const item = mapDrawItem(oldPin, 'userZ')
  assertEq(item.isMine, false, '4c: userZ 看 userA 的 old self-pin → isMine=false')
  assertEq(item.pinType, 'self', '4c: 回退默认 self')
  assertEq(item.surveyCreatorId, 'userA', '4c: surveyCreatorId 回退到 userA 的 userId')
}
test_drawItem_viewer_mismatch()

// ==================== 套件 5: 分层过滤 ====================

suite('5. 分层过滤（isOwn 替代 userId 直判）')

function test_layer_halo_own() {
  // userA 视角:
  //   Pin1: 自己 self-pin, haloActive=true
  //   Pin2: 自己 promote（B 推广了 A）, 无 halo
  //   Pin3: 他人 self-pin
  const pins = [
    { _id: 'p1', userId: 'userA', surveyCreatorId: 'userA', pinType: 'self', haloActive: true, _weight: 10000 },
    { _id: 'p2', userId: 'userB', surveyCreatorId: 'userA', pinType: 'promote', haloActive: false, _weight: 200 },
    { _id: 'p3', userId: 'userC', surveyCreatorId: 'userC', pinType: 'self', haloActive: false, _weight: 50 },
  ]
  const { haloItems, ownItems, otherItems } = layerItems(pins, 'userA')
  assertEq(haloItems.length, 1, '5a: 光环层 1 条')
  assertEq(haloItems[0]._id, 'p1', '5a: 光环层是 p1（自己的 self-pin）')
  assertEq(ownItems.length, 1, '5a: 自己层 1 条')
  assertEq(ownItems[0]._id, 'p2', '5a: 自己层是 p2（自己被推广的 promote 问卷）')
  assertEq(otherItems.length, 1, '5a: 他人层 1 条')
  assertEq(otherItems[0]._id, 'p3', '5a: 他人层是 p3')
}
test_layer_halo_own()

function test_layer_userB_perspective() {
  // userB 视角（B 推广了 A 的问卷）：
  //   p2 中 userId=B, surveyCreatorId=A → B 不 own
  const pins = [
    { _id: 'p1', userId: 'userA', surveyCreatorId: 'userA', haloActive: false, _weight: 300 },
    { _id: 'p2', userId: 'userB', surveyCreatorId: 'userA', haloActive: false, _weight: 200 },
  ]
  const { ownItems, otherItems } = layerItems(pins, 'userB')
  assertEq(ownItems.length, 0, '5b: userB 无 own 问卷（promote 的问卷归属 A）')
  assertEq(otherItems.length, 2, '5b: 两条都在他人层')
}
test_layer_userB_perspective()

// ==================== 套件 6: recalcOwnWeights 查询条件 ====================

suite('6. recalcOwnWeights 查询条件')

function test_recalc_query() {
  // 不能精确测试数据库行为，但验证查询结构
  const query = buildRecalcQuery('userA')
  assert(!!query.expireAt, '6a: 有 expireAt 条件')
  assert(!!query.$or, '6a: 有 $or 条件')
  assert(Array.isArray(query.$or), '6a: $or 是数组')
  assertEq(query.$or.length, 2, '6a: $or 有 2 条')
  assertDeep(query.$or[0], { surveyCreatorId: 'userA' }, '6b: 第一条 surveyCreatorId 匹配')
  assertDeep(query.$or[1], { userId: 'userA', surveyCreatorId: null }, '6c: 第二条 userId 匹配 + surveyCreatorId 不存在')
}
test_recalc_query()

// ==================== 套件 7: queue 返回 pinType ====================

suite('7. getQueueStatus 返回 pinType')

function test_queue_pinType_new() {
  const q = { _id: 'q1', surveyId: 's1', pinType: 'promote', pinnerId: 'userB', enterAt: Date.now(), acceleratedCount: 1, seniorityLevel: 2 }
  const rec = mapQueueRecord(q)
  assertEq(rec.pinType, 'promote', '7a: 新数据 pinType=promote')
}
test_queue_pinType_new()

function test_queue_pinType_old() {
  const q = { _id: 'q2', surveyId: 's2', enterAt: Date.now() }
  const rec = mapQueueRecord(q)
  assertEq(rec.pinType, 'self', '7b: 旧数据无 pinType → 默认 self')
}
test_queue_pinType_old()

// ==================== 套件 8: career-records pinType ====================

suite('8. career-records pinType 写入')

function test_career_pinType_new() {
  const record = mapCareerRecord({ pinType: 'promote' })
  assertEq(record.pinType, 'promote', '8a: 新数据携带 pinType')
}
test_career_pinType_new()

function test_career_pinType_old() {
  const record = mapCareerRecord({})
  assertEq(record.pinType, 'self', '8b: 旧数据无 pinType → 默认 self')
}
test_career_pinType_old()

// ==================== 套件 9: 跨用户视角差异（核心边界） ====================

suite('9. 跨用户三视角差异（核心边界）')

function test_three_views() {
  // 构造数据：A 有三条相关记录
  const pins = [
    // PinA: A 自己的 self-pin（已入池）
    { _id: 'pinA', userId: 'userA', surveyCreatorId: 'userA', pinType: 'self', pinnerId: 'userA', _weight: 400, haloActive: false, expireAt: Date.now() + 99999, surveyTitle: 'A的问卷1', surveyAuthor: '用户A' },
    // PinB: B 推广了 A 的问卷（在池中）
    { _id: 'pinB', userId: 'userB', surveyCreatorId: 'userA', pinType: 'promote', pinnerId: 'userB', _weight: 100, haloActive: false, expireAt: Date.now() + 99999, surveyTitle: 'A的问卷2', surveyAuthor: '用户A' },
    // PinC: C 的 self-pin（旧数据，无新字段）
    { _id: 'pinC', userId: 'userC', _weight: 50, haloActive: false, expireAt: Date.now() + 99999, surveyTitle: 'C的问卷', surveyAuthor: '用户C' },
  ]

  // --- 视角 A ---
  const itemsA = pins.map(p => mapDrawItem(p, 'userA'))
  assertEq(itemsA[0].isMine, true, '9a(A): PinA self-pin → isMine=true ✓')
  assertEq(itemsA[0].pinType, 'self', '9a(A): PinA pinType=self ✓')
  assertEq(itemsA[1].isMine, true, '9a(A): PinB promote(surveyCreatorId=A) → isMine=true ✓')
  assertEq(itemsA[1].pinType, 'promote', '9a(A): PinB pinType=promote ✓')
  assertEq(itemsA[2].isMine, false, '9a(A): PinC others → isMine=false ✓')

  // --- 视角 B ---
  const itemsB = pins.map(p => mapDrawItem(p, 'userB'))
  assertEq(itemsB[0].isMine, false, '9b(B): PinA(surveyCreatorId=A≠B) → isMine=false ✓')
  assertEq(itemsB[1].isMine, false, '9b(B): PinB(surveyCreatorId=A≠B) → isMine=false（B推广但所有权归A）✓')
  assertEq(itemsB[1].pinnerId, 'userB', '9b(B): PinB pinnerId=userB（B是推广者）✓')
  assertEq(itemsB[2].isMine, false, '9b(B): PinC → isMine=false ✓')

  // --- 视角 C ---
  const itemsC = pins.map(p => mapDrawItem(p, 'userC'))
  assertEq(itemsC[0].isMine, false, '9c(C): PinA → isMine=false ✓')
  assertEq(itemsC[1].isMine, false, '9c(C): PinB → isMine=false ✓')
  assertEq(itemsC[2].isMine, true, '9c(C): PinC(旧数据回退 userId=C) → isMine=true ✓')
  assertEq(itemsC[2].pinType, 'self', '9c(C): PinC 旧数据 → pinType 默认 self ✓')
  assertEq(itemsC[2].surveyCreatorId, 'userC', '9c(C): PinC 旧数据 → surveyCreatorId 回退 userId ✓')
}
test_three_views()

// ==================== 套件 10: 边界情况 ====================

suite('10. 边界情况')

function test_edge_cases() {
  // 10a: uid 为空的情况
  const emptyView = mapDrawItem({ _id: 'px', userId: 'userA', surveyTitle: 't', _weight: 10, expireAt: Date.now() }, '')
  assertEq(emptyView.isMine, false, '10a: uid 为空 → isMine=false')

  // 10b: surveyAuthor 为空字符串
  const noAuthor = mapDrawItem({ _id: 'px', userId: 'userA', surveyTitle: 't', _weight: 10, expireAt: Date.now() }, 'userA')
  assertEq(noAuthor.surveyAuthor, '', '10b: surveyAuthor 缺失 → 空字符串')

  // 10c: surveyCover 为空
  assertEq(noAuthor.surveyCover, '', '10c: surveyCover 缺失 → 空字符串')

  // 10d: uid === userId 但 userId 来自他人 promote 问卷 → 非 own
  // 极端场景：D 推广了 C 的问卷，但 C 的 userId 在 pin 中 = D（操作人）
  // surveyCreatorId = C → C 是创建者, userId = D → D 是推广者
  const promoEdge = { _id: 'pe', userId: 'userD', surveyCreatorId: 'userC', pinType: 'promote', pinnerId: 'userD', _weight: 100, expireAt: Date.now(), surveyTitle: 't' }
  assertEq(isOwn(promoEdge, 'userD'), false, '10d: promote 问卷, userId=D, uid=D, 但 surveyCreatorId=C≠D → isOwn=false')
  assertEq(isOwn(promoEdge, 'userC'), true, '10d: promote 问卷, uid=C → isOwn=true')

  // 10e: 空数组边界
  const { haloItems, ownItems, otherItems } = layerItems([], 'userA')
  assertEq(haloItems.length, 0, '10e: 空数组 → 三层均为空')
  assertEq(ownItems.length, 0, '10e: 空数组 → 自己层为空')
  assertEq(otherItems.length, 0, '10e: 空数组 → 他人层为空')
}
test_edge_cases()

// ==================== 测试报告 ====================

const total = passed + failed
console.log(`\n${'='.repeat(50)}`)
console.log(`测试完成 · 共 ${total} 项`)
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
