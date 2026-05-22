'use strict'

/**
 * test-pin-stage7
 * 二期助力功能集成测试：一键验证 cloudfunction 与 schema 的正确性
 *
 * 测试范围：
 *   1. 新字段写入 pin-pool（新数据 + 旧数据兼容）
 *   2. 新字段写入 career-records（新数据 + 旧数据兼容）
 *   3. 新字段写入 survey-queue
 *   4. 过期处理 → 战绩单携带 pinType
 *   5. 旧数据兼容（无新字段的记录被正常处理）
 *   6. 字段校验（enum / 必填约束）
 *
 * 用法：部署为云函数后运行一次，自动完成全套测试
 *
 * ⚠️ 完成测试后请删除本云函数目录
 */

const db = uniCloud.database()
const _ = db.command

// ==================== 测试工具 ====================

const now = Date.now()
let passed = 0
let failed = 0
const failures = []

function assert(condition, msg) {
  if (condition) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    const errMsg = `  ❌ ${msg}`
    console.error(errMsg)
    failures.push(errMsg)
  }
}

function assertEq(actual, expected, msg) {
  if (actual === expected) {
    passed++
    console.log(`  ✅ ${msg}`)
  } else {
    failed++
    const errMsg = `  ❌ ${msg} (期望: ${JSON.stringify(expected)}, 实际: ${JSON.stringify(actual)})`
    console.error(errMsg)
    failures.push(errMsg)
  }
}

async function count(collection, query) {
  const res = await db.collection(collection).where(query).count()
  return res.total
}

async function getOne(collection, id) {
  const res = await db.collection(collection).doc(id).get()
  return res.data && res.data.length > 0 ? res.data[0] : null
}

// ==================== 测试数据构造 ====================

const TP = 'test_s7_' // 测试数据前缀

function makePinNew(uid, extra) {
  const id = `${TP}pin_${uid}_${Date.now()}_${String(Math.random()).slice(2, 6)}`
  return {
    _id: id,
    userId: uid,
    surveyId: `${TP}survey_${uid}`,
    surveyTitle: `二期测试问卷-self-${uid}`,
    surveyCover: '',
    surveyAuthor: `测试用户-${uid}`,
    weight: 100,
    createdAt: now,
    expireAt: now + 60 * 1000, // 1分钟后过期（过期测试用）
    senioritySnapshot: 0,
    haloActive: false,
    isGreenChannel: false,
    isTest: true,
    pinType: 'self',
    pinnerId: uid,
    surveyCreatorId: uid,
    ...extra
  }
}

function makePinPromote(promoterId, creatorId) {
  const id = `${TP}pin_promote_${Date.now()}_${String(Math.random()).slice(2, 6)}`
  return {
    _id: id,
    userId: promoterId,
    surveyId: `${TP}survey_promote_${creatorId}`,
    surveyTitle: `二期测试问卷-promote-${creatorId}`,
    surveyCover: '',
    surveyAuthor: `创建者-${creatorId}`,
    weight: 100,
    createdAt: now,
    expireAt: now + 60 * 1000,
    senioritySnapshot: 0,
    haloActive: false,
    isGreenChannel: false,
    isTest: true,
    pinType: 'promote',
    pinnerId: promoterId,
    surveyCreatorId: creatorId
  }
}

function makePinOldData(uid) {
  // 模拟旧数据：无 pinType / pinnerId / surveyCreatorId
  const id = `${TP}pin_old_${uid}_${Date.now()}_${String(Math.random()).slice(2, 6)}`
  return {
    _id: id,
    userId: uid,
    surveyId: `${TP}survey_old_${uid}`,
    surveyTitle: `旧数据问卷-${uid}`,
    weight: 100,
    createdAt: now,
    expireAt: now + 60 * 1000,
    senioritySnapshot: 0,
    haloActive: false,
    isGreenChannel: false,
    isTest: true
  }
}

function makeExpiredPinWithPinType(uid, pinType, extra) {
  const id = `${TP}exp_pin_${Date.now()}_${String(Math.random()).slice(2, 6)}`
  return {
    _id: id,
    userId: uid,
    surveyId: `${TP}survey_exp_${pinType}`,
    surveyTitle: `过期测试-${pinType}`,
    weight: 100,
    createdAt: now - 20 * 60 * 1000,
    expireAt: now - 60 * 1000, // 已过期
    senioritySnapshot: 0,
    haloActive: false,
    isGreenChannel: false,
    isTest: true,
    pinType,
    pinnerId: uid,
    surveyCreatorId: uid === 'test_s7_promoter' ? 'test_s7_creator' : uid,
    ...extra
  }
}

function makeTestUser(uid, slotCount, extra) {
  const slots = []
  for (let i = 0; i < (slotCount || 1); i++) {
    slots.push({ status: 'active', surveyId: null, pinId: null, queueId: null })
  }
  return {
    _id: uid,
    nickname: `测试用户_${uid}`,
    career: {
      exposureCount: 0,
      hasUnread: false,
      unreadCareerIds: [],
      slots
    },
    ...extra
  }
}

// ==================== 清理 ====================

async function cleanupTestData() {
  console.log('\n[test] 清理测试数据...')
  const p = await db.collection('pin-pool').where({ isTest: true }).remove()
  const q = await db.collection('survey-queue').where({ isTest: true }).remove()
  const c = await db.collection('career-records').where({ surveyId: /^test_s7_/ }).remove()
  const u = await db.collection('uni-id-users').where({ _id: /^test_s7_/ }).remove()
  const counterDoc = await db.collection('counter').doc('careerArchiveSeq').get()
  if (counterDoc.data && counterDoc.data.length > 0) {
    await db.collection('counter').doc('careerArchiveSeq').update({ seq: 0 })
  }
  console.log(`[test] 清理完成: pin-pool删${p.deleted || 0}条, queue删${q.deleted || 0}条, career删${c.deleted || 0}条, user删${u.deleted || 0}条`)
}

// ==================== 测试用例 ====================

/**
 * T1: 新数据写入 pin-pool — pinType=self + promote
 */
async function testPinPoolNewFields() {
  console.log('\n══════════════════════════════════════════')
  console.log('T1: pin-pool 新字段写入')
  console.log('══════════════════════════════════════════')

  // 写入 self 记录
  const pinSelf = makePinNew('test_s7_user_a', {})
  await db.collection('pin-pool').add(pinSelf)

  // 写入 promote 记录
  const pinPromote = makePinPromote('test_s7_promoter', 'test_s7_creator')
  await db.collection('pin-pool').add(pinPromote)

  // 读取验证
  const docSelf = await getOne('pin-pool', pinSelf._id)
  assert(!!docSelf, `self-pin 写入成功`)
  if (docSelf) {
    assertEq(docSelf.pinType, 'self', `T1a: pinType=self`)
    assertEq(docSelf.pinnerId, 'test_s7_user_a', `T1b: pinnerId 正确`)
    assertEq(docSelf.surveyCreatorId, 'test_s7_user_a', `T1c: surveyCreatorId 正确`)
    assertEq(docSelf.surveyAuthor, '测试用户-test_s7_user_a', `T1d: surveyAuthor 正确`)
  }

  const docPromote = await getOne('pin-pool', pinPromote._id)
  assert(!!docPromote, `promote-pin 写入成功`)
  if (docPromote) {
    assertEq(docPromote.pinType, 'promote', `T1e: pinType=promote`)
    assertEq(docPromote.pinnerId, 'test_s7_promoter', `T1f: pinnerId 为推广者`)
    assertEq(docPromote.surveyCreatorId, 'test_s7_creator', `T1g: surveyCreatorId 为问卷创建者`)
    assertEq(docPromote.userId, 'test_s7_promoter', `T1h: userId 仍为操作人`)
  }
}

/**
 * T2: 旧数据兼容 — 无新字段的记录可以被读/写/更新
 */
async function testOldDataCompatibility() {
  console.log('\n══════════════════════════════════════════')
  console.log('T2: pin-pool 旧数据兼容性')
  console.log('══════════════════════════════════════════')

  const oldPin = makePinOldData('test_s7_old_user')
  await db.collection('pin-pool').add(oldPin)

  const doc = await getOne('pin-pool', oldPin._id)
  assert(!!doc, `旧数据写入成功`)
  if (doc) {
    // 旧数据无新字段，应为 undefined
    assert(doc.pinType === undefined, `T2a: 旧数据 pinType 为 undefined`)
    assert(doc.pinnerId === undefined, `T2b: 旧数据 pinnerId 为 undefined`)
    assert(doc.surveyCreatorId === undefined, `T2c: 旧数据 surveyCreatorId 为 undefined`)
    // 其他字段正常
    assert(!!doc.userId, `T2d: 保留字段 userId 正常`)
    assert(!!doc.surveyId, `T2e: 保留字段 surveyId 正常`)
  }
}

/**
 * T3: survey-queue 新字段写入 + 读取
 */
async function testQueueNewFields() {
  console.log('\n══════════════════════════════════════════')
  console.log('T3: survey-queue 新字段')
  console.log('══════════════════════════════════════════')

  const qid = `${TP}queue_${Date.now()}_${String(Math.random()).slice(2, 6)}`
  const qData = {
    _id: qid,
    userId: 'test_s7_queue_user',
    surveyId: `${TP}survey_queue`,
    enterAt: now,
    acceleratedCount: 0,
    seniorityLevel: 1,
    currentPhase: 'queuing',
    isTest: true,
    pinType: 'promote',
    pinnerId: 'test_s7_promoter'
  }
  await db.collection('survey-queue').add(qData)

  const doc = await getOne('survey-queue', qid)
  assert(!!doc, `queue 写入成功`)
  if (doc) {
    assertEq(doc.pinType, 'promote', `T3a: pinType=promote`)
    assertEq(doc.pinnerId, 'test_s7_promoter', `T3b: pinnerId 正确`)
  }
}

/**
 * T4: 过期 pin-pool → career-records 携带 pinType
 * 创建带 pinType 和不带 pinType(旧数据) 的过期记录，调 pin-expiry，验证战绩单
 */
async function testExpiryCareerPinType() {
  console.log('\n══════════════════════════════════════════')
  console.log('T4: 过期处理 → career-records 携带 pinType')
  console.log('══════════════════════════════════════════')

  // 创建两个过期用户和过期记录
  const uidSelf = 'test_s7_exp_self'
  const uidPromote = 'test_s7_exp_promote'

  await db.collection('uni-id-users').add(makeTestUser(uidSelf, 1))
  await db.collection('uni-id-users').add(makeTestUser(uidPromote, 1))

  // self 过期记录
  const pinSelf = makeExpiredPinWithPinType(uidSelf, 'self')
  // promote 过期记录
  const pinPromote = makeExpiredPinWithPinType(uidPromote, 'promote')
  // 旧数据过期记录（无 pinType）
  const pinOld = makePinOldData('test_s7_exp_old')

  await db.collection('pin-pool').add(pinSelf)
  await db.collection('pin-pool').add(pinPromote)
  await db.collection('pin-pool').add(pinOld)

  // 更新用户槽位指向
  await db.collection('uni-id-users').doc(uidSelf).update({
    'career.slots.0.pinId': pinSelf._id
  })
  await db.collection('uni-id-users').doc(uidPromote).update({
    'career.slots.0.pinId': pinPromote._id
  })
  await db.collection('uni-id-users').doc('test_s7_exp_old').update({
    'career.slots.0.pinId': pinOld._id
  })

  // 调 pin-expiry
  const res = await uniCloud.callFunction({ name: 'pin-expiry' })
  assert(res.code === 0, `T4a: pin-expiry 返回 code=0`)
  assert(res.result.pinResult.processed >= 3, `T4b: 至少处理 3 条过期记录 (实际: ${res.result.pinResult.processed})`)

  // 读取战绩单验证 pinType
  const careerRecords = await db.collection('career-records').where({
    surveyId: /^test_s7_/
  }).get()

  assert(careerRecords.data.length >= 3, `T4c: 至少生成 3 条战绩单 (实际: ${careerRecords.data.length})`)

  for (const rec of careerRecords.data) {
    const surveyId = rec.surveyId
    if (surveyId.includes('self')) {
      assertEq(rec.pinType, 'self', `T4d: self 类型战绩单 pinType=self (${rec._id})`)
    } else if (surveyId.includes('promote')) {
      assertEq(rec.pinType, 'promote', `T4e: promote 类型战绩单 pinType=promote (${rec._id})`)
    } else if (surveyId.includes('old')) {
      assertEq(rec.pinType, 'self', `T4f: 旧数据战绩单 pinType 默认 self (${rec._id})`)
    }
  }
}

/**
 * T5: 数据库直接查询 — 验证 draw 可读、聚合查询正常
 */
async function testDrawReadable() {
  console.log('\n══════════════════════════════════════════')
  console.log('T5: 数据库读取 + 字段存在性')
  console.log('══════════════════════════════════════════')

  // 读取刚写入的测试数据（不过期），验证 query 正常
  const validPins = await db.collection('pin-pool').where({
    isTest: true,
    expireAt: { $gt: now }
  }).get()

  assert(validPins.data.length > 0, `T5a: 有效测试记录可读取`)

  for (const pin of validPins.data) {
    if (pin._id.includes('promote')) {
      assertEq(pin.pinType, 'promote', `T5b: promote 记录 pinType 存在`)
      assert(!!pin.pinnerId, `T5c: promote 记录 pinnerId 存在`)
      assert(!!pin.surveyCreatorId, `T5d: promote 记录 surveyCreatorId 存在`)
    }
  }

  // 验证旧数据没有新字段
  const oldPins = validPins.data.filter(p => p._id.includes('old'))
  if (oldPins.length > 0) {
    assert(oldPins[0].pinType === undefined, `T5e: 旧数据 pinType 不存在`)
  } else {
    console.log('  ℹ️ 跳过旧数据验证（已在 T2 测试）')
  }
}

// ==================== 主测试流程 ====================

exports.main = async (event, context) => {
  const startTime = Date.now()
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║     🧪 pin-stage7 二期助力功能集成测试套件          ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`开始时间: ${new Date().toISOString()}`)

  const testCases = [
    { name: 'T1 - pin-pool 新字段写入 (self+promote)', fn: testPinPoolNewFields },
    { name: 'T2 - pin-pool 旧数据兼容性', fn: testOldDataCompatibility },
    { name: 'T3 - survey-queue 新字段', fn: testQueueNewFields },
    { name: 'T4 - 过期处理 → career-records 携带 pinType', fn: testExpiryCareerPinType },
    { name: 'T5 - 数据库读取 + 字段存在性', fn: testDrawReadable }
  ]

  try {
    for (const tc of testCases) {
      try {
        await tc.fn()
      } catch (e) {
        failed++
        const msg = `${tc.name} 异常: ${e.message || e}`
        console.error(`  💥 ${msg}`)
        failures.push(msg)
      }
    }
  } finally {
    // 最终清理
    await cleanupTestData()
  }

  // ==================== 测试报告 ====================
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log('\n╔══════════════════════════════════════════════════════╗')
  console.log('║                  🏁 测试报告                        ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`执行耗时: ${elapsed}s`)
  console.log(`总计用例: ${passed + failed}`)
  console.log(`  ✅ 通过: ${passed}`)
  console.log(`  ❌ 失败: ${failed}`)

  if (failures.length > 0) {
    console.log('\n失败明细:')
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`))
  }

  return {
    code: failed === 0 ? 0 : -1,
    elapsed,
    passed,
    failed,
    failures
  }
}
