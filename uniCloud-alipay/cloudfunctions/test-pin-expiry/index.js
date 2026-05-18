'use strict'

/**
 * test-pin-expiry
 * 阶段三集成测试：一键验证 pin-expiry 全部功能
 *
 * 用法：部署后运行一次，自动完成全套测试
 *
 * ⚠️ 完成开发测试后请删除本云函数目录（占用云函数名额）
 * 删除方法：右键 test-pin-expiry → 删除 + 上传清理云端
 */

const db = uniCloud.database()
const _ = db.command

// ==================== 测试工具 ====================

const now = Date.now()
const TEST_PREFIX = 'test_expiry_'
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

async function count(collection, query) {
  const res = await db.collection(collection).where(query).count()
  return res.total
}

async function getOne(collection, id) {
  const res = await db.collection(collection).doc(id).get()
  return res.data && res.data.length > 0 ? res.data[0] : null
}

// ==================== 测试数据构造 ====================

/**
 * 构造一条模拟 pin-pool 记录（已过期）
 */
function makeExpiredPin(uid, slot, extra) {
  const id = `${TEST_PREFIX}pin_${slot}_${Date.now()}_${String(Math.random()).slice(2, 6)}`
  return {
    _id: id,
    userId: uid,
    surveyId: `${TEST_PREFIX}survey_${slot}`,
    surveyTitle: `测试问卷-${slot}`,
    surveyCover: '',
    slot,
    status: 'active',
    snapshot: 0,
    expireAt: now - 60 * 1000, // 1分钟前过期
    createdAt: now - 20 * 60 * 1000,
    weight: { total: 100, base: 100, halo: 0, seniority: 0 },
    senioritySnapshot: extra?.seniority ?? 0,
    haloActive: false,
    isGreenChannel: false,
    isTest: true,
    ...extra
  }
}

/**
 * 构造模拟 uni-id-users 文档（简化）
 */
function makeTestUser(uid, slotCount) {
  const slots = []
  for (let i = 0; i < (slotCount || 1); i++) {
    slots.push({
      status: 'active',
      surveyId: null,
      pinId: null,
      queueId: null
    })
  }
  return {
    _id: uid,
    nickname: `测试用户_${uid}`,
    career: {
      exposureCount: 0,
      hasUnread: false,
      unreadCareerIds: [],
      slots
    }
  }
}

/**
 * 构造超时候场记录
 */
function makeExpiredQueue(uid, slotIdx, extra) {
  const id = `${TEST_PREFIX}queue_${uid}_${Date.now()}_${String(Math.random()).slice(2, 6)}`
  return {
    _id: id,
    userId: uid,
    surveyId: `${TEST_PREFIX}survey_queue_${uid}`,
    slot: `slot_${slotIdx}`,
    status: extra?.status || 'queuing',
    enterAt: now - 35 * 60 * 1000, // 35分钟前，超时
    retryCount: 0,
    isTest: true,
    ...extra
  }
}

// ==================== 清理函数 ====================

async function cleanupTestData() {
  console.log('\n[test] 清理测试数据...')
  // 删除 test 前缀的 pin-pool 记录
  const p = await db.collection('pin-pool').where({ isTest: true }).remove()
  // 删除 test 前缀的 survey-queue 记录
  const q = await db.collection('survey-queue').where({ isTest: true }).remove()
  // 删除 test 前缀的 career-records 记录
  const c = await db.collection('career-records').where({ surveyId: /^test_expiry_/ }).remove()
  // 删除 test 用户
  const u = await db.collection('uni-id-users').where({ _id: /^test_expiry_user_/ }).remove()
  // 恢复计数器
  const counterDoc = await db.collection('counter').doc('careerArchiveSeq').get()
  if (counterDoc.data && counterDoc.data.length > 0) {
    await db.collection('counter').doc('careerArchiveSeq').update({ seq: 0 })
  }
  console.log(`[test] 清理完成: pin-pool删${p.deleted || 0}条, queue删${q.deleted || 0}条, career删${c.deleted || 0}条, user删${u.deleted || 0}条`)
}

// ==================== 测试用例 ====================

/**
 * T1: 零过期数据——函数平稳运行，不执行任何写操作
 */
async function testNoExpiredData() {
  console.log('\n══════════════════════════════════════════')
  console.log('T1: 零过期数据 — 函数空跑')
  console.log('══════════════════════════════════════════')

  // 确保没有任何测试数据残留
  await cleanupTestData()

  const res = await uniCloud.callFunction({ name: 'pin-expiry' })

  assert(res.code === 0, `返回 code=0 (实际: ${res.code})`)
  assert(res.result.pinResult.processed === 0, `过期置顶处理数 = 0 (实际: ${res.result.pinResult.processed})`)
  assert(res.result.queueResult.processed === 0, `超时候场处理数 = 0 (实际: ${res.result.queueResult.processed})`)
}

/**
 * T2: 单条过期文档 + T9 计数器兜底 + T11 战绩单数据合理性
 */
async function testSingleExpiredPin() {
  console.log('\n══════════════════════════════════════════')
  console.log('T2: 单条过期清理 + 战绩单数据合理性')
  console.log('══════════════════════════════════════════')

  // 计数器先删除，测试兜底初始化
  await db.collection('counter').doc('careerArchiveSeq').remove()

  const uid = `${TEST_PREFIX}user_t2`
  const pin = makeExpiredPin(uid, 'slot_0', { surveyCover: 'https://test.cover/img.png' })
  const user = makeTestUser(uid, 1)
  user.career.slots[0].pinId = pin._id

  await db.collection('uni-id-users').add(user)
  await db.collection('pin-pool').add(pin)

  const res = await uniCloud.callFunction({ name: 'pin-expiry' })

  // 验证处理结果
  assert(res.code === 0, `返回 code=0`)
  assert(res.result.pinResult.processed >= 1, `至少处理 1 条过期文档`)
  assert(res.result.pinResult.success >= 1, `至少成功 1 条`)

  // 验证 pin-pool 记录已删除
  const pinAfter = await getOne('pin-pool', pin._id)
  assert(!pinAfter, `pin-pool 文档已删除`)

  // 验证战绩单已生成
  const careerRecords = await db.collection('career-records').where({
    userId: uid
  }).get()

  assert(careerRecords.data.length > 0, `战绩单已生成`)
  if (careerRecords.data.length > 0) {
    const record = careerRecords.data[0]
    // 验证字段完整性
    assert(!!record.careerNumber, `careerNumber 存在`)
    assert(!!record.archiveNumber, `archiveNumber 存在`)
    assert(record.archiveNumber.startsWith('ZW-'), `archiveNumber 格式: ZW-YYYY-XXXXX (实际: ${record.archiveNumber})`)

    // 战绩单数据合理性
    const { views, clicks, favorites } = record.stats
    assert(views >= 100, `驻足注视 >= 100 (实际: ${views})`)
    assert(clicks >= 1, `好奇打开 >= 1 (实际: ${clicks})`)
    assert(favorites >= 0, `决定存档 >= 0 (实际: ${favorites})`)
    assert(clicks <= views, `好奇打开 ≤ 驻足注视 (${clicks} ≤ ${views})`)
    assert(favorites <= clicks, `决定存档 ≤ 好奇打开 (${favorites} ≤ ${clicks})`)

    // 验证荣誉称号存在
    assert(!!record.honor, `荣誉称号存在`)
    assert(!!record.honor.name, `荣誉称号名称存在`)
    console.log(`    荣誉称号: ${record.honor.name} | views=${views} clicks=${clicks} fav=${favorites}`)

    // 验证档案附注存在
    assert(!!record.comment, `档案附注存在`)
    assert(record.comment.includes('不存在'), `档案附注含免责声明`)

    // 验证 surveyTitle 被保留
    assert(record.surveyTitle === pin.surveyTitle, `surveyTitle 保留`)
    assert(record.surveyId === pin.surveyId, `surveyId 保留`)
  }

  // 验证槽位状态更新
  const userAfter = await getOne('uni-id-users', uid)
  assert(!!userAfter, `用户文档存在`)
  if (userAfter) {
    const slot = userAfter.career.slots[0]
    assert(slot.status === 'claimable', `槽位状态 = claimable (实际: ${slot.status})`)
    assert(slot.surveyId === pin.surveyId, `槽位 surveyId 保留`)
    assert(userAfter.career.hasUnread === true, `hasUnread = true`)
    assert(userAfter.career.unreadCareerIds.length > 0, `unreadCareerIds 非空`)
  }

  // 验证计数器已初始化且自增
  const counterAfter = await getOne('counter', 'careerArchiveSeq')
  assert(!!counterAfter, `计数器存在`)
  if (counterAfter) {
    assert(counterAfter.seq > 0, `计数器已自增 seq > 0 (实际: ${counterAfter.seq})`)
  }
}

/**
 * T3: 多条过期文档同时处理
 */
async function testMultipleExpiredPins() {
  console.log('\n══════════════════════════════════════════')
  console.log('T3: 多条过期文档同时处理 (5条)')
  console.log('══════════════════════════════════════════')

  const uid = `${TEST_PREFIX}user_t3`
  const user = makeTestUser(uid, 5)
  const pins = []

  for (let i = 0; i < 5; i++) {
    const pin = makeExpiredPin(uid, `slot_${i}`)
    pins.push(pin)
    user.career.slots[i].pinId = pin._id
  }

  await db.collection('uni-id-users').add(user)
  await db.collection('pin-pool').add(pins)

  const res = await uniCloud.callFunction({ name: 'pin-expiry' })

  assert(res.code === 0, `返回 code=0`)
  assert(res.result.pinResult.processed >= 5, `处理数 >= 5 (实际: ${res.result.pinResult.processed})`)

  // 验证所有 pin-pool 文档已被删除
  for (const pin of pins) {
    const doc = await getOne('pin-pool', pin._id)
    assert(!doc, `pin-pool ${pin._id} 已删除`)
  }

  // 验证 5 个槽位全部变为 claimable
  const userAfter = await getOne('uni-id-users', uid)
  if (userAfter) {
    const claimableCount = userAfter.career.slots.filter(s => s.status === 'claimable').length
    assert(claimableCount === 5, `5 个槽位均为 claimable (实际: ${claimableCount})`)
  }

  // 验证生成了 5 条战绩单
  const careerCount = await count('career-records', { userId: uid })
  assert(careerCount === 5, `生成了 5 条战绩单 (实际: ${careerCount})`)
}

/**
 * T5: 未过期文档不被误删
 */
async function testNonExpiredUntouched() {
  console.log('\n══════════════════════════════════════════')
  console.log('T5: 未过期文档不被误删')
  console.log('══════════════════════════════════════════')

  const uid = `${TEST_PREFIX}user_t5`
  const user = makeTestUser(uid, 2)

  const expiredPin = makeExpiredPin(uid, 'slot_0')
  const validPin = makeExpiredPin(uid, 'slot_1', {
    _id: `${TEST_PREFIX}pin_valid_${Date.now()}`,
    expireAt: now + 30 * 60 * 1000 // 30分钟后才过期
  })

  user.career.slots[0].pinId = expiredPin._id
  user.career.slots[1].pinId = validPin._id

  await db.collection('uni-id-users').add(user)
  await db.collection('pin-pool').add([expiredPin, validPin])

  await uniCloud.callFunction({ name: 'pin-expiry' })

  // 已过期文档被删除
  const expiredAfter = await getOne('pin-pool', expiredPin._id)
  assert(!expiredAfter, `过期文档已删除`)

  // 未过期文档保留
  const validAfter = await getOne('pin-pool', validPin._id)
  assert(!!validAfter, `未过期文档保留`)
  if (validAfter) {
    assert(validAfter.status === 'active', `未过期文档 status 不变`)
  }
}

/**
 * T6: 幂等性——第二次运行不做重复处理
 */
async function testIdempotency() {
  console.log('\n══════════════════════════════════════════')
  console.log('T6: 幂等性 — 重复运行不重复处理')
  console.log('══════════════════════════════════════════')

  // 准备一条过期文档
  const uid = `${TEST_PREFIX}user_t6`
  const pin = makeExpiredPin(uid, 'slot_0')
  const user = makeTestUser(uid, 1)
  user.career.slots[0].pinId = pin._id

  await db.collection('uni-id-users').add(user)
  await db.collection('pin-pool').add(pin)

  // 第一次运行
  const res1 = await uniCloud.callFunction({ name: 'pin-expiry' })
  const careerCount1 = await count('career-records', { userId: uid })
  const counter1 = await getOne('counter', 'careerArchiveSeq')

  // 第二次运行（不改任何数据）
  const res2 = await uniCloud.callFunction({ name: 'pin-expiry' })
  const careerCount2 = await count('career-records', { userId: uid })
  const counter2 = await getOne('counter', 'careerArchiveSeq')

  // 第一次成功处理
  assert(res1.result.pinResult.success >= 1, `第一次执行成功处理`)
  assert(careerCount1 >= 1, `第一次执行后战绩单数 >= 1`)

  // 第二次没有处理任何过期文档（已删除）
  assert(res2.result.pinResult.processed === 0, `第二次执行处理数 = 0 (实际: ${res2.result.pinResult.processed})`)

  // 战绩单数不变
  assert(careerCount2 === careerCount1, `战绩单数不变 (${careerCount1} → ${careerCount2})`)

  // 计数器只自增了一次
  if (counter1 && counter2) {
    assert(counter2.seq === counter1.seq, `计数器未重复自增 (${counter1.seq} → ${counter2.seq})`)
  }
}

/**
 * T7: 候场区超时升池
 */
async function testQueueTimeoutPromotion() {
  console.log('\n══════════════════════════════════════════')
  console.log('T7: 候场区超时自动升池 + 未超时不处理')
  console.log('══════════════════════════════════════════')

  const uid = `${TEST_PREFIX}user_t7`
  const user = makeTestUser(uid, 2)

  // 超时记录
  const expiredQ = makeExpiredQueue(uid, 0)
  user.career.slots[0].queueId = expiredQ._id

  // 未超时记录
  const validQ = makeExpiredQueue(uid, 1, {
    _id: `${TEST_PREFIX}queue_valid_${Date.now()}`,
    enterAt: now - 5 * 60 * 1000 // 5分钟前，未超时
  })
  user.career.slots[1].queueId = validQ._id

  await db.collection('uni-id-users').add(user)
  await db.collection('survey-queue').add([expiredQ, validQ])

  await uniCloud.callFunction({ name: 'pin-expiry' })

  // 超时记录应被处理（升池或删除）
  const expiredQAfter = await getOne('survey-queue', expiredQ._id)
  assert(!expiredQAfter, `超时 queue 记录已被处理 (${expiredQAfter ? '仍存在' : '已处理'})`)

  // 未超时记录应保留
  const validQAfter = await getOne('survey-queue', validQ._id)
  assert(!!validQAfter, `未超时 queue 记录保留`)
  if (validQAfter) {
    assert(validQAfter.status === 'queuing', `未超时记录 status 不变`)
  }

  // 验证超时记录被升池（槽位状态变为 active，且有 pin-pool 记录）
  const userAfter = await getOne('uni-id-users', uid)
  if (userAfter) {
    const slot0 = userAfter.career.slots[0]
    assert(slot0.status === 'active', `超时升池后槽位状态 = active (实际: ${slot0.status})`)
    assert(!!slot0.pinId, `超时升池后槽位有 pinId`)

    const slot1 = userAfter.career.slots[1]
    assert(slot1.status === 'queuing', `未超时槽位状态不变 (实际: ${slot1.status})`)
  }
}

/**
 * T8: 候场超时但槽位已非 queuing —— 直接删除候场记录
 */
async function testQueueExpiredNonQueuing() {
  console.log('\n══════════════════════════════════════════')
  console.log('T8: 候场超时但槽位已非 queuing — 直接删除')
  console.log('══════════════════════════════════════════')

  const uid = `${TEST_PREFIX}user_t8`
  const user = makeTestUser(uid, 1)

  const expiredQ = makeExpiredQueue(uid, 0, {
    status: 'entered' // 槽位状态已非 queuing
  })
  user.career.slots[0].queueId = expiredQ._id
  user.career.slots[0].status = 'entered'

  await db.collection('uni-id-users').add(user)
  await db.collection('survey-queue').add(expiredQ)

  await uniCloud.callFunction({ name: 'pin-expiry' })

  // 候场记录应被直接删除
  const qAfter = await getOne('survey-queue', expiredQ._id)
  assert(!qAfter, `已非 queuing 的超时 queue 记录已删除`)

  // 槽位应保持不变（未升池）
  const userAfter = await getOne('uni-id-users', uid)
  if (userAfter) {
    assert(userAfter.career.slots[0].status === 'entered', `槽位状态未变 (仍为 entered)`)
  }
}

/**
 * T4: 每批最多处理 20 条
 */
async function testBatchLimit() {
  console.log('\n══════════════════════════════════════════')
  console.log('T4: 每批最多处理 20 条')
  console.log('══════════════════════════════════════════')

  // 用多个用户来创建 25 条过期记录
  const userUids = []
  const allPins = []
  const allUsers = []

  for (let i = 0; i < 25; i++) {
    const uid = `${TEST_PREFIX}user_t4_${i}`
    userUids.push(uid)
    const user = makeTestUser(uid, 1)
    const pin = makeExpiredPin(uid, 'slot_0')
    user.career.slots[0].pinId = pin._id
    allPins.push(pin)
    allUsers.push(user)
  }

  // 分批插入（避免单次 add 过大）
  for (const user of allUsers) {
    await db.collection('uni-id-users').add(user)
  }
  await db.collection('pin-pool').add(allPins)

  const res = await uniCloud.callFunction({ name: 'pin-expiry' })

  // 最多处理 20 条
  assert(res.result.pinResult.processed <= 20, `处理数 ≤ 20 (实际: ${res.result.pinResult.processed})`)
  assert(res.result.pinResult.processed > 0, `确实处理了数据 (实际: ${res.result.pinResult.processed})`)

  // 统计剩余过期文档数
  const remaining = await count('pin-pool', { isTest: true })
  assert(remaining >= 5, `剩余 ≥ 5 条未被处理 (实际: ${remaining})`)
}

// ==================== 主测试流程 ====================

exports.main = async (event, context) => {
  const startTime = Date.now()
  console.log('╔══════════════════════════════════════════════════════╗')
  console.log('║          🧪 pin-expiry 集成测试套件                ║')
  console.log('╚══════════════════════════════════════════════════════╝')
  console.log(`开始时间: ${new Date().toISOString()}`)

  const testCases = [
    { name: 'T1 - 零过期数据', fn: testNoExpiredData },
    { name: 'T5 - 未过期不被误删', fn: testNonExpiredUntouched },
    { name: 'T2 - 单条过期 + 战绩单合理性', fn: testSingleExpiredPin },
    { name: 'T3 - 多条过期 (5条)', fn: testMultipleExpiredPins },
    { name: 'T6 - 幂等性', fn: testIdempotency },
    { name: 'T7 - 候场超时升池', fn: testQueueTimeoutPromotion },
    { name: 'T8 - 候场超时非 queuing 直接删除', fn: testQueueExpiredNonQueuing },
    { name: 'T4 - 批处理上限 20 条', fn: testBatchLimit }
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

  console.log('\n')

  return {
    code: failed > 0 ? 1 : 0,
    elapsed: elapsed + 's',
    total: passed + failed,
    passed,
    failed,
    failures: failures.length > 0 ? failures : undefined
  }
}
