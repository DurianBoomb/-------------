/**
 * pin-system 云对象
 * 问卷置顶系统核心业务逻辑
 * 阶段一：入池核心逻辑
 *
 * 注意：uniCloud 云对象的自定义方法不挂在 this 上，
 * 内部调用必须使用顶层函数 + 传参 uid 的方式。
 */

const db = uniCloud.database()
const uniID = require('uni-id-common')
const TEXT_POOLS = require('./text-pools.js')

// 置顶系统配置（后续迁移至 uni-config-center）
const PIN_CONFIG = {
  seniority: {
    levels: [
      { level: 0, min: 0, max: 0, label: 'Lv.0 · 新人' },
      { level: 1, min: 1, max: 5, label: 'Lv.1 · 偶发者' },
      { level: 2, min: 6, max: 20, label: 'Lv.2 · 常客' },
      { level: 3, min: 21, max: null, label: 'Lv.3 · 老面孔' }
    ]
  },
  pool: {
    poolSizeThreshold: 1000,
    poolLifecycleMinutes: 1,
    poolLifecycleDisplayMinutes: 3
  },
  weight: {
    haloWeight: 10000,
    selfWeightMin: 300, selfWeightMax: 500,
    otherWeightMin: 1, otherWeightMax: 200,
    reverseCompensationCoefficients: { '0': 2.5, '1': 1.5, '2': 1.0, '3': 0.6 }
  },
  queue: {
    maxAccelCount: 3,
    queueExpireMinutes: 35,
    accelAdvanceRatio: 0.4
  },
  career: {
    viewFloatMin: 1.5, viewFloatMax: 3.0,
    clickRateMin: 0.05, clickRateMax: 0.15,
    favoriteRateMin: 0.05, favoriteRateMax: 0.20,
    bonusTriggerRate: 0.15,
    bonusMultiplierMin: 1.5, bonusMultiplierMax: 2.0,
    favoriteFloor: 0,
    simulatedActiveUsers: 1000
  },
  security: {
    dailyPinSoftCap: 100,
    adMinDurationSeconds: 15,
    rateLimitPerMinute: 5
  }
}

// ==================== 顶层工具函数 ====================

/**
 * 生成 _id 后缀：_{时间戳}_{4位随机数}
 */
function genSuffix() {
  return `_${Date.now()}_${String(Math.random()).slice(2, 6)}`
}

/**
 * 将 exposureCount 映射到资历档位
 */
function getSeniorityLevel(exposureCount) {
  const levels = PIN_CONFIG.seniority.levels || []
  for (const lv of levels) {
    if (exposureCount >= lv.min && (lv.max === null || exposureCount <= lv.max)) {
      return lv.level
    }
  }
  return 0
}

/**
 * 从数组中随机抽取一条（不修改原数组）
 */
function pickRandom(arr) {
  if (!arr || arr.length === 0) return null
  return arr[Math.floor(Math.random() * arr.length)]
}

/**
 * 构建完整日志流
 * @param {number} exposureCount - 用户当前曝光资历
 * @param {number} acceleratedCount - 已加速次数（用于特殊状态判定）
 * @returns {Array} logLines - [{ text, interval, prefix }]
 */
function buildLogStream(exposureCount, acceleratedCount) {
  const level = getSeniorityLevel(exposureCount)

  // 资历-池文本数量查表
  const NMK = {
    0: { N: 3,  M: 4,  K: 3 },
    1: { N: 18, M: 26, K: 12 },
    2: { N: 65, M: 95, K: 42 },
    3: { N: 100, M: 145, K: 64 }
  }
  const { N, M, K } = NMK[level] || NMK[0]

  const lines = []

  // === 排队阶段（固定文本） ===
  lines.push({ text: '════ 排队等候 ════',   interval: 2, prefix: '[系统]' })
  lines.push({ text: '你的问卷已进入处理队列', interval: 2, prefix: '[系统]' })
  lines.push({ text: '正在分配处理节点… 节点已就绪', interval: 2, prefix: '[系统]' })

  // === 审核阶段 ===
  lines.push({ text: '════ 内容审核 ════',   interval: 2, prefix: '[审核]' })
  const reviewPool = shuffleArray([...TEXT_POOLS.reviewPool])
  for (let i = 0; i < N; i++) {
    const item = reviewPool[i % reviewPool.length]
    lines.push({ text: item.text, interval: 3, prefix: '[审核]' })
    // L2+ 每3条插入1条填充
    if (level >= 2 && (i + 1) % 3 === 0 && i < N - 1) {
      const fillerIdx = Math.floor(i / 3) % TEXT_POOLS.fillerPool.length
      lines.push({ text: TEXT_POOLS.fillerPool[fillerIdx], interval: 2, prefix: '[系统]' })
    }
  }
  lines.push({ text: '审核意见记录完毕',     interval: 2, prefix: '[审核]' })

  // === 质检阶段 ===
  lines.push({ text: '════ 质量检测 ════',   interval: 2, prefix: '[质检]' })
  const qualityPool = shuffleArray([...TEXT_POOLS.qualityPool])
  for (let i = 0; i < M; i++) {
    const item = qualityPool[i % qualityPool.length]
    lines.push({ text: item.text, interval: 5, prefix: '[质检]' })
    if (level >= 2 && (i + 1) % 3 === 0 && i < M - 1) {
      const fillerIdx = (Math.floor(N / 3) + Math.floor(i / 3)) % TEXT_POOLS.fillerPool.length
      lines.push({ text: TEXT_POOLS.fillerPool[fillerIdx], interval: 2, prefix: '[系统]' })
    }
  }
  lines.push({ text: '传播潜力预估完毕',     interval: 2, prefix: '[质检]' })

  // === 推送阶段 ===
  lines.push({ text: '════ 推送分发 ════',   interval: 2, prefix: '[推送]' })
  const pushPool = shuffleArray([...TEXT_POOLS.pushPool])
  for (let i = 0; i < K; i++) {
    const item = pushPool[i % pushPool.length]
    lines.push({ text: item.text, interval: 4, prefix: '[推送]' })
    if (level >= 2 && (i + 1) % 3 === 0 && i < K - 1) {
      const fillerIdx = (Math.floor(N / 3) + Math.floor(M / 3) + Math.floor(i / 3)) % TEXT_POOLS.fillerPool.length
      lines.push({ text: TEXT_POOLS.fillerPool[fillerIdx], interval: 2, prefix: '[系统]' })
    }
  }
  lines.push({ text: '分配初始曝光权重… ✓',  interval: 2, prefix: '[推送]' })

  // === 特殊状态判定（互斥四选一，插在完成标题之前） ===
  const cnHour = new Date().getHours()
  let specialItem = null
  if (acceleratedCount > 0) {
    specialItem = pickRandom(TEXT_POOLS.specialPool.accelerate)
  } else if (exposureCount === 0) {
    specialItem = pickRandom(TEXT_POOLS.specialPool.newcomer)
  } else if (cnHour >= 0 && cnHour < 6) {
    specialItem = pickRandom(TEXT_POOLS.specialPool.lateNight)
  } else if (cnHour >= 17 && cnHour < 19) {
    specialItem = pickRandom(TEXT_POOLS.specialPool.endOfDay)
  }
  if (specialItem) {
    lines.push({ text: specialItem.text, interval: 4, prefix: '[系统]' })
  }

  // === 完成 ===
  lines.push({ text: '════ 处理完成 ════',   interval: 2, prefix: '[系统]' })
  lines.push({ text: '你的问卷已进入置顶池，即将收到战绩单', interval: 1, prefix: '[系统]' })

  return lines
}

/**
 * 计算日志流总时长（秒）
 */
function computeQueueDuration(logLines) {
  return logLines.reduce((sum, l) => sum + l.interval, 0)
}

/**
 * 计算当前到期可见的日志行
 * @param {Array} logLines - 完整日志流
 * @param {number} enterAt - 入候场时间戳 ms
 * @param {number} effectiveOffset - 加速偏移量 秒
 * @param {number} now - 当前时间戳 ms
 * @returns {{ visible: Array, currentPhase: string, allVisible: boolean, effectiveElapsed: number }}
 */
function calcVisibleSlots(logLines, enterAt, effectiveOffset, now) {
  const naturalElapsed = (now - enterAt) / 1000
  const effectiveElapsed = naturalElapsed + (effectiveOffset || 0)
  let accumulated = 0
  const visible = []

  for (const line of logLines) {
    accumulated += line.interval
    if (effectiveElapsed >= accumulated) {
      visible.push(line)
    } else {
      break
    }
  }

  const allVisible = visible.length >= logLines.length
  // 根据最后一个可见行所属阶段判断 currentPhase
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

/**
 * Fisher-Yates 洗牌
 */
function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * 四层权重计算
 * pinDoc: pin-pool 文档, currentUserId: 当前用户ID, ownPins: 该用户所有在池问卷（按 createdAt 升序）
 * 1. 登场光环 → 固定极高值
 * 2. 归属分层 → 确定权重区间（自己 300~500 / 他人 1~200）
 * 3. 内部排序（自己的问卷之间）→ 越晚入池越高
 * 4. 反向补偿（他人的问卷之间）→ 资历越浅系数越高
 */
function calculateWeightImpl(pinDoc, currentUserId, ownPins) {
  // 1. 登场光环
  if (pinDoc.haloActive) return PIN_CONFIG.weight.haloWeight

  const cfg = PIN_CONFIG.weight

  if ((pinDoc.surveyCreatorId || pinDoc.userId) === currentUserId) {
    // 2. 归属分层（自己区间）+ 3. 内部排序
    if (!ownPins || ownPins.length <= 1) {
      return Math.floor((cfg.selfWeightMin + cfg.selfWeightMax) / 2)
    }
    // ownPins 按 createdAt 升序，idx 越大表示越晚入池
    const idx = ownPins.findIndex(p => p._id === pinDoc._id)
    if (idx === -1) return Math.floor((cfg.selfWeightMin + cfg.selfWeightMax) / 2)
    const ratio = idx / (ownPins.length - 1) // 0 ~ 1
    return Math.floor(cfg.selfWeightMin + (cfg.selfWeightMax - cfg.selfWeightMin) * ratio)
  } else {
    // 2. 归属分层（他人区间）+ 4. 反向补偿
    const level = getSeniorityLevel(pinDoc.senioritySnapshot)
    const coeff = cfg.reverseCompensationCoefficients[String(level)] || 1.0
    const baseWeight = Math.floor((cfg.otherWeightMin + cfg.otherWeightMax) / 2)
    return Math.floor(Math.max(baseWeight * coeff, cfg.otherWeightMin))
  }
}

/**
 * 入池完整逻辑（内部实现，不依赖 this）
 * uid: 用户标识, surveyId: 问卷标识
 */
async function enterPoolImpl(uid, surveyId) {
  if (!uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
  if (!surveyId) return { errCode: 'INVALID_PARAM', errMsg: '缺少 surveyId' }

  try {
    // 1. 读用户信息
    const userRes = await db.collection('uni-id-users').doc(uid).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { errCode: 'USER_NOT_FOUND', errMsg: '用户不存在' }
    }
    const user = userRes.data[0]
    const exposureCount = user.career?.exposureCount ?? 0
    let slots = user.career?.slots || []

    // 1b. 去重检查（兜底——防止 checkPinEligibility 通过后，广告播放期间被其他设备抢占）
    {
      const now = Date.now()
      const poolCheck = await db.collection('pin-pool').where({
        surveyId,
        expireAt: { $gt: now }
      }).get()
      if (poolCheck.data && poolCheck.data.length > 0) {
        return { errCode: 'ALREADY_IN_POOL', errMsg: '该问卷已在置顶池中，无法重复置顶' }
      }

      const queueCheck = await db.collection('survey-queue').where({ surveyId }).get()
      if (queueCheck.data && queueCheck.data.length > 0) {
        return { errCode: 'ALREADY_IN_QUEUE', errMsg: '该问卷已在候场区排队中，无法重复置顶' }
      }
    }

    // 2. 兜底初始化（新用户可能没有 career.slots）
    if (!slots || slots.length === 0) {
      slots = [
        { status: 'idle', surveyId: null, pinId: null, queueId: null },
        { status: 'idle', surveyId: null, pinId: null, queueId: null },
        { status: 'idle', surveyId: null, pinId: null, queueId: null }
      ]
      await db.collection('uni-id-users').doc(uid).update({
        'career.slots': slots
      })
    }

    // 3. 槽位二次确认
    let idleIdx = slots.findIndex(s => s.status === 'idle')
    if (idleIdx === -1) {
      // 3b. 没有 idle 时，自动释放已过期的 claimable 槽位（战绩已由 pin-expiry 生成）
      const claimableIdx = slots.findIndex(s => s.status === 'claimable')
      if (claimableIdx !== -1) {
        idleIdx = claimableIdx
        slots[idleIdx] = { status: 'idle', surveyId: null, pinId: null, queueId: null }
        await db.collection('uni-id-users').doc(uid).update({
          [`career.slots.${idleIdx}`]: slots[idleIdx]
        })
      } else {
        return { errCode: 'SLOTS_FULL', errMsg: '已达到 3 条上限，请等待其中一条完成' }
      }
    }

    // 4b. 每日置顶次数软帽检查（阶段七防刷）
    const todayStart = new Date(new Date().toLocaleDateString()).getTime()
    const todayCountRes = await db.collection('pin-pool').where({
      userId: uid,
      createdAt: { $gt: todayStart }
    }).count()
    const todayCount = todayCountRes.total || 0
    if (todayCount >= PIN_CONFIG.security.dailyPinSoftCap) {
      return { errCode: 'DAILY_CAP_SOFT', errMsg: `今日置顶已达${PIN_CONFIG.security.dailyPinSoftCap}次软帽限制，明日起恢复` }
    }

    // 5. 确定资历档位
    const levels = PIN_CONFIG.seniority.levels || []
    let seniorityLevel = 0
    for (const lv of levels) {
      if (exposureCount >= lv.min && (lv.max === null || exposureCount <= lv.max)) {
        seniorityLevel = lv.level
        break
      }
    }

    // 6. 绿色通道判断（Lv.0 跳过池满线）
    const isGreenChannel = seniorityLevel === 0
    let poolFull = false
    let poolTotal = 0
    if (!isGreenChannel) {
      const poolRes = await db.collection('pin-pool').count()
      poolTotal = poolRes.total
      poolFull = poolTotal >= PIN_CONFIG.pool.poolSizeThreshold
    }
    console.log(`[pin-test] enterPool: uid=${uid} survey=${surveyId} level=${seniorityLevel}(exp=${exposureCount}) green=${isGreenChannel} pool=${poolTotal}/${PIN_CONFIG.pool.poolSizeThreshold} full=${poolFull}`)

    // 7. 获取问卷信息（含 creatorId 用于身份判断）
    let surveyTitle = surveyId
    let surveyCover = ''
    let creatorId = null
    try {
      const surveyRes = await db.collection('surveys').doc(surveyId).get()
      if (surveyRes.data && surveyRes.data.length > 0) {
        surveyTitle = surveyRes.data[0].title || surveyRes.data[0].tagName || surveyId
        surveyCover = surveyRes.data[0].cover || surveyRes.data[0].surveyCover || ''
        creatorId = surveyRes.data[0].creatorId || null
      }
    } catch (e) { /* 查不到就用兜底 */ }

    // 7b. 官方问卷拦截
    if (!creatorId) {
      return { errCode: 'OFFICIAL_SURVEY', errMsg: '官方问卷不可置顶' }
    }

    // 7c. 置顶类型固定为 self（入口校验已拦截非创建者）
    const pinType = 'self'
    const pinnerId = uid

    // 7d. surveyAuthor 取当前用户昵称
    const surveyAuthor = user.nickname || ''

    if (!poolFull || isGreenChannel) {
      // === 直接入池 ===
      const suffix = genSuffix()
      const docId = `pin${suffix}`
      const now = Date.now()
      const expireAt = now + PIN_CONFIG.pool.poolLifecycleMinutes * 60 * 1000
      const weight = PIN_CONFIG.weight.haloWeight

      // 取消该用户已有问卷的光环（操作人维度：userId 始终为操作人 uid）
      await db.collection('pin-pool').where({
        userId: uid,
        expireAt: { $gt: now }
      }).update({ haloActive: false })

      await db.collection('pin-pool').add({
        _id: docId, surveyId, userId: uid,
        surveyTitle, surveyCover, surveyAuthor,
        weight, createdAt: now, expireAt,
        senioritySnapshot: exposureCount,
        haloActive: true, isGreenChannel,
        pinType, pinnerId, surveyCreatorId: creatorId
      })

      await db.collection('uni-id-users').doc(uid).update({
        'career.exposureCount': db.command.inc(1)
      })

      await db.collection('uni-id-users').doc(uid).update({
        [`career.slots.${idleIdx}`]: {
          status: 'active', surveyId, pinId: docId, queueId: null
        }
      })

      // 权重重算（新入池后更新已有非光环问卷的内部排序）
      await recalcOwnWeights(uid)

      return {
        errCode: 0, action: 'direct_entry', greenChannel: isGreenChannel,
        pinData: { _id: docId, surveyId, surveyTitle, surveyAuthor, expireAt, haloActive: true, pinType, pinnerId, surveyCreatorId: creatorId }
      }
    } else {
      // === 进入候场区 ===
      const suffix = genSuffix()
      const queId = `queue${suffix}`
      const now = Date.now()

      // 生成完整日志流
      const logLines = buildLogStream(exposureCount, 0)

      await db.collection('survey-queue').add({
        _id: queId, userId: uid, surveyId,
        enterAt: now, acceleratedCount: 0,
        seniorityLevel, currentPhase: 'queuing',
        logLines, effectiveOffset: 0,
        pinType, pinnerId
      })

      await db.collection('uni-id-users').doc(uid).update({
        [`career.slots.${idleIdx}`]: {
          status: 'queuing', surveyId, pinId: null, queueId: queId
        }
      })

      // 计算初始可见行
      const { visible } = calcVisibleSlots(logLines, now, 0, now)

      return {
        errCode: 0, action: 'enter_queue',
        queueData: {
          queueId: queId, surveyId, enterAt: now,
          seniorityLevel, currentPhase: 'queuing',
          maxAccelCount: PIN_CONFIG.queue.maxAccelCount,
          logLines, visibleLines: visible
        }
      }
    }
  } catch (e) {
    console.error('[pin-system] enterPool error:', e)
    return { errCode: 'SYSTEM_ERROR', errMsg: '入池失败: ' + (e.message || '') }
  }
}

/**
 * 候场转置顶（内部实现，不依赖 this）
 * uid: 用户标识, surveyId: 问卷标识, queueId: 候场记录标识
 */
async function queueToPoolImpl(uid, surveyId, queueId) {
  if (!uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
  if (!surveyId || !queueId) return { errCode: 'INVALID_PARAM', errMsg: '缺少 surveyId 或 queueId' }

  try {
    // 1. 幂等检查
    const queueRes = await db.collection('survey-queue').doc(queueId).get()
    if (!queueRes.data || queueRes.data.length === 0) {
      return { errCode: 0, errMsg: '该候场记录已被处理' }
    }

    // 2. 读用户信息
    const userRes = await db.collection('uni-id-users').doc(uid).get()
    if (!userRes.data || userRes.data.length === 0) {
      return { errCode: 'USER_NOT_FOUND', errMsg: '用户不存在' }
    }
    const user = userRes.data[0]
    let slots = user.career?.slots || []
    const exposureCount = user.career?.exposureCount ?? 0

    // 3. 兜底初始化
    if (!slots || slots.length === 0) {
      slots = [
        { status: 'idle', surveyId: null, pinId: null, queueId: null },
        { status: 'idle', surveyId: null, pinId: null, queueId: null },
        { status: 'idle', surveyId: null, pinId: null, queueId: null }
      ]
      await db.collection('uni-id-users').doc(uid).update({
        'career.slots': slots
      })
    }

    // 4. 定位槽位
    const slotIdx = slots.findIndex(s => s.queueId === queueId)
    if (slotIdx === -1) {
      return { errCode: 'SLOT_NOT_FOUND', errMsg: '未找到对应的槽位' }
    }

    // 5. 获取问卷信息（含 creatorId）
    let surveyTitle = surveyId
    let surveyCover = ''
    let creatorId = null
    try {
      const surveyRes = await db.collection('surveys').doc(surveyId).get()
      if (surveyRes.data && surveyRes.data.length > 0) {
        surveyTitle = surveyRes.data[0].title || surveyRes.data[0].tagName || surveyId
        surveyCover = surveyRes.data[0].cover || surveyRes.data[0].surveyCover || ''
        creatorId = surveyRes.data[0].creatorId || null
      }
    } catch (e) {}

    // 5b. 置顶类型固定为 self（入口校验已拦截非创建者）
    const pinType = 'self'
    const pinnerId = uid
    const surveyAuthor = user.nickname || ''

    // 6. 写入 pin-pool
    const suffix = genSuffix()
    const docId = `pin${suffix}`
    const now = Date.now()
    const expireAt = now + PIN_CONFIG.pool.poolLifecycleMinutes * 60 * 1000
    const weight = PIN_CONFIG.weight.haloWeight

    // 取消该用户已有问卷的光环（仅保留最后一个入池的有光环）
    await db.collection('pin-pool').where({
      userId: uid,
      expireAt: { $gt: now }
    }).update({ haloActive: false })

    await db.collection('pin-pool').add({
      _id: docId, surveyId, userId: uid,
      surveyTitle, surveyCover, surveyAuthor,
      weight, createdAt: now, expireAt,
      senioritySnapshot: exposureCount,
      haloActive: true, isGreenChannel: false,
      pinType, pinnerId, surveyCreatorId: creatorId
    })

    // 7. 资历累加
    await db.collection('uni-id-users').doc(uid).update({
      'career.exposureCount': db.command.inc(1)
    })

    // 8. 删除候场记录
    await db.collection('survey-queue').doc(queueId).remove()

    // 9. 更新槽位
    await db.collection('uni-id-users').doc(uid).update({
      [`career.slots.${slotIdx}`]: {
        status: 'active', surveyId, pinId: docId, queueId: null
      }
    })

    // 权重重算
    await recalcOwnWeights(uid)

    return {
      errCode: 0, action: 'pool_entry',
      pinData: { _id: docId, surveyId, surveyTitle, surveyAuthor, expireAt, haloActive: true, pinType, pinnerId, surveyCreatorId: creatorId }
    }
  } catch (e) {
    console.error('[pin-system] queueToPool error:', e)
    return { errCode: 'SYSTEM_ERROR', errMsg: '入池失败: ' + (e.message || '') }
  }
}

/**
 * 权重重算：用户新问卷入池后，遍历该用户在池中已有非光环问卷，
 * 重新计算内部排序权重。
 * 当前阶段所有问卷都带光环，所以是空操作，但保留机制供后续使用。
 */
async function recalcOwnWeights(uid) {
  try {
    // 用 surveyCreatorId 查询（旧数据无此字段则回退到 userId）
    const ownRes = await db.collection('pin-pool').where({
      expireAt: { $gt: Date.now() },
      $or: [
        { surveyCreatorId: uid },
        { userId: uid, surveyCreatorId: db.command.exists(false) }
      ]
    }).get()

    const ownPins = (ownRes.data || []).filter(p => !p.haloActive)
      .sort((a, b) => a.createdAt - b.createdAt)

    if (ownPins.length === 0) return

    for (const pin of ownPins) {
      const newWeight = calculateWeightImpl(pin, uid, ownPins)
      if (newWeight !== pin.weight) {
        await db.collection('pin-pool').doc(pin._id).update({ weight: newWeight })
      }
    }
  } catch (e) {
    console.error('[pin-system] recalcOwnWeights error:', e)
  }
}

/**
 * 加权随机采样抽取（内部实现，不依赖 this）
 * uid: 当前用户标识, count: 抽取数量（默认5）
 */
async function drawImpl(uid, count = 5) {
  if (!uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }

  try {
    const now = Date.now()
    const pinRes = await db.collection('pin-pool').where({
      expireAt: { $gt: now }
    }).get()

    const pins = pinRes.data || []

    if (pins.length === 0) {
      return { errCode: 0, data: { items: [] } }
    }

    // 分离当前用户的问卷（按 createdAt 升序，用于内部排序）
    const isOwn = (p) => (p.surveyCreatorId || p.userId) === uid
    const ownPins = pins.filter(isOwn)
      .sort((a, b) => a.createdAt - b.createdAt)

    // 计算每条问卷权重
    for (const pin of pins) {
      const userOwnPins = isOwn(pin) ? ownPins : []
      pin._weight = calculateWeightImpl(pin, uid, userOwnPins)
    }

    // 加权随机采样（不放回）
    const result = []
    const candidates = [...pins]
    const sampleCount = Math.min(count, candidates.length)

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

    // 分层随机乱序：光环 > 自己 > 他人，每层内 Fisher-Yates 洗牌去除焊死感
    // 光环仅对自己的问卷生效（视觉诡计），他人的光环问卷归入他人层
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

    const sorted = [
      ...shuffle(haloItems),
      ...shuffle(ownItems),
      ...shuffle(otherItems)
    ]
    result.length = 0
    result.push(...sorted)

    const items = result.map(p => ({
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
  } catch (e) {
    console.error('[pin-system] draw error:', e)
    return { errCode: 'SYSTEM_ERROR', errMsg: '抽取失败: ' + (e.message || '') }
  }
}

/**
 * 查询当前有效的池子内容（仅供 Mock 页调试用）
 */
async function getPoolContentsImpl() {
  try {
    const now = Date.now()
    const pinRes = await db.collection('pin-pool').where({
      expireAt: { $gt: now }
    }).get()

    const pins = (pinRes.data || []).map(p => ({
      _id: p._id,
      surveyId: p.surveyId,
      surveyTitle: p.surveyTitle || '',
      weight: p.weight,
      haloActive: p.haloActive || false,
      userId: p.userId,
      createdAt: p.createdAt,
      expireAt: p.expireAt,
      remainingMinutes: Math.floor((p.expireAt - now) / 60000) + (PIN_CONFIG.pool.poolLifecycleDisplayMinutes - PIN_CONFIG.pool.poolLifecycleMinutes),
      pinType: p.pinType || 'self',
      pinnerId: p.pinnerId || '',
      surveyCreatorId: p.surveyCreatorId || '',
      surveyAuthor: p.surveyAuthor || ''
    }))

    // 按权重降序排列
    pins.sort((a, b) => b.weight - a.weight)

    return {
      errCode: 0,
      data: {
        total: pins.length,
        pins
      }
    }
  } catch (e) {
    console.error('[pin-system] getPoolContents error:', e)
    return { errCode: 'SYSTEM_ERROR', errMsg: '查询失败: ' + (e.message || '') }
  }
}

/**
 * 查询候场状态（内部实现，不依赖 this）
 * uid: 用户标识, queueId: 可选，指定查询某条候场记录
 */
async function getQueueStatusImpl(uid, queueId) {
  try {
    const query = { userId: uid }
    if (queueId) query._id = queueId

    const qRes = await db.collection('survey-queue').where(query).get()
    const queues = qRes.data || []

    if (queues.length === 0) {
      return { errCode: 0, data: { records: [] } }
    }

    const records = []
    for (const q of queues) {
      const logLines = q.logLines || []
      const effectiveOffset = q.effectiveOffset || 0

      // 兜底：老候场记录没有 logLines
      if (logLines.length === 0) {
        records.push({
          queueId: q._id, surveyId: q.surveyId,
          currentPhase: 'queuing', acceleratedCount: q.acceleratedCount || 0,
          maxAccelCount: PIN_CONFIG.queue.maxAccelCount,
          logLines: [], visibleLines: [], effectiveElapsed: 0,
          seniorityLevel: q.seniorityLevel || 0, enterAt: q.enterAt,
          pinType: q.pinType || 'self'
        })
        continue
      }

      const now = Date.now()
      const { visible, currentPhase, allVisible, effectiveElapsed } =
        calcVisibleSlots(logLines, q.enterAt, effectiveOffset, now)

      // 检测 ready → 自动兜底入池
      if (allVisible || currentPhase === 'ready') {
        try {
          const poolResult = await queueToPoolImpl(uid, q.surveyId, q._id)
          records.push({
            queueId: q._id, surveyId: q.surveyId,
            status: 'completed', poolResult
          })
          continue
        } catch (e) {
          console.error('[pin-system] getQueueStatus auto queueToPool failed:', e)
          records.push({
            queueId: q._id, surveyId: q.surveyId,
            status: 'auto_pool_failed', currentPhase: 'ready',
            errMsg: '自动入池失败: ' + (e.message || '')
          })
          continue
        }
      }

      records.push({
        queueId: q._id,
        surveyId: q.surveyId,
        currentPhase,
        logLines,
        visibleLines: visible,
        acceleratedCount: q.acceleratedCount || 0,
        effectiveElapsed,
        maxAccelCount: PIN_CONFIG.queue.maxAccelCount,
        seniorityLevel: q.seniorityLevel || 0,
        enterAt: q.enterAt,
        pinType: q.pinType || 'self'
      })
    }

    return { errCode: 0, data: { records } }
  } catch (e) {
    console.error('[pin-system] getQueueStatus error:', e)
    return { errCode: 'SYSTEM_ERROR', errMsg: '查询候场状态失败: ' + (e.message || '') }
  }
}

/**
 * 执行广告加速（内部实现，不依赖 this）
 * uid: 用户标识, queueId: 候场记录标识
 * 推进 effectiveOffset，第三次加速自动调用 queueToPool 完成入池
 */
async function executeAccelImpl(uid, queueId) {
  try {
    const qRes = await db.collection('survey-queue').doc(queueId).get()
    if (!qRes.data || qRes.data.length === 0) {
      return { errCode: 'QUEUE_NOT_FOUND', errMsg: '候场记录不存在，可能已被处理' }
    }

    const q = qRes.data[0]
    const currentAccel = q.acceleratedCount || 0

    // 幂等：已加速次数达到上限
    if (currentAccel >= PIN_CONFIG.queue.maxAccelCount) {
      return await queueToPoolImpl(uid, q.surveyId, queueId)
    }

    const newAccel = currentAccel + 1
    const logLines = q.logLines || []
    const totalDuration = computeQueueDuration(logLines)

    // 计算本次加速偏移量
    let advanceSeconds = 0
    if (newAccel >= PIN_CONFIG.queue.maxAccelCount) {
      // 第三次加速 → 直接完成
      advanceSeconds = totalDuration
    } else {
      // 加速推进总时长的 accelAdvanceRatio（默认 40%）
      advanceSeconds = Math.floor(totalDuration * PIN_CONFIG.queue.accelAdvanceRatio)
    }

    const oldOffset = q.effectiveOffset || 0
    const newOffset = oldOffset + advanceSeconds

    // 更新数据库
    await db.collection('survey-queue').doc(queueId).update({
      acceleratedCount: newAccel,
      effectiveOffset: newOffset
    })

    // 计算加速后的可见行
    const now = Date.now()
    const { visible, currentPhase, allVisible, effectiveElapsed } =
      calcVisibleSlots(logLines, q.enterAt, newOffset, now)

    // 加速前后可见行数量差（用于前端展示"解锁了N行"）
    const { visible: oldVisible } = calcVisibleSlots(logLines, q.enterAt, oldOffset, now)
    const newLines = visible.length - oldVisible.length

    // 第三次加速 → 自动入池
    if (newAccel >= PIN_CONFIG.queue.maxAccelCount) {
      return await queueToPoolImpl(uid, q.surveyId, queueId)
    }

    return {
      errCode: 0,
      action: 'accelerated',
      data: {
        queueId,
        currentPhase,
        logLines,
        visibleLines: visible,
        effectiveElapsed,
        acceleratedCount: newAccel,
        maxAccelCount: PIN_CONFIG.queue.maxAccelCount,
        newLinesUnlocked: Math.max(0, newLines),
        advanceSeconds
      }
    }
  } catch (e) {
    console.error('[pin-system] executeAccel error:', e)
    return { errCode: 'SYSTEM_ERROR', errMsg: '加速失败: ' + (e.message || '') }
  }
}

// ==================== 战绩单数据生成（内联实现，供 generateCareer 方法使用） ====================

// 荣誉称号池
const HONOR_TITLES = [
  { id: 'lighthouse', name: '人群中的灯塔', desc: '被很多人看见，但只有少数人真正懂得欣赏。你是人群中的一座沉默灯塔。', condition: 'highViewsLowClick' },
  { id: 'center', name: '万众瞩目者', desc: '你站在那里，哪里就是焦点。你的问卷有着让人无法移开目光的魔力。', condition: 'highClickRate' },
  { id: 'archive_fav', name: '档案馆宠儿', desc: '你的每一份作品都值得被永久收藏。档案馆已将你的问卷列为馆藏珍品。', condition: 'highFavRate' },
  { id: 'dark_horse', name: '冷门黑马', desc: '不鸣则已，一鸣惊人。在无人注意的角落，你的问卷悄然引爆了流量。', condition: 'lowViewsHighClick' },
  { id: 'memes', name: '含梗量宗师', desc: '你的问卷里藏着十个段子王也接不住的梗。「含梗量检测」评级：SSS。', condition: 'randomMeme' },
  { id: 'creator', name: '内容创作者', desc: '稳定输出，质量在线。你的每一份问卷都在为这个平台贡献优质内容。', condition: 'default' }
]

const BONUS_TITLES = [
  { id: 'bonus_flow', name: '破格流量获得者', desc: '本局特此破格授予——数据显示，该问卷在曝光期间经历了罕见的指数级扩散。', condition: 'bonus' },
  { id: 'bonus_click', name: '点爆者', desc: '本局特此破格授予——点击量数据在短时间内出现了非理性爆发，经技术核查，确认为自然传播。', condition: 'bonus_click' }
]

const DEBUT_TITLES = [
  { id: 'debut', name: '闪耀登场的新人', desc: '首份认证档案：这是你的第一份 15 分钟名人档案，一切才刚刚开始。', condition: 'debut' },
  { id: 'debut_high', name: '万众瞩目的首秀者', desc: '首秀即高光——你的第一次亮相就获得了远超平均的注视。前方等着你的，是更广阔的舞台。', condition: 'debut_high' }
]

// 档案附注语料池
const NOTE_TEMPLATES = {
  views_high: ['数据表明，该问卷在发布期间受到了广泛注目——驻足注视你的人，足以坐满一个中型剧场。', '你的问卷像一件展品，路过的人都忍不住多看了一眼。人群效应在此刻生效。', '高曝光时段内，你的问卷像一束信号塔，吸引了大量目光。'],
  click_high: ['好奇心是人类的底层代码，你的问卷成功解码了它——打开率远超平均水平。', '几乎每个看见它的人，都忍不住点进去看了。你的标题功夫，本局予以认可。', '高打开率意味着你的问卷在人群中产生了真实的吸引力，而非仅仅被扫过。'],
  fav_high: ['收藏是最好的赞美——有人把你的问卷放进了自己的宝库，不舍得让它沉没在时间线里。', '决定存档不是轻率的动作。你的内容值得被反复翻看，这是最具诚实的认可。'],
  newcomer: ['首次认证档案：你的第一份 15 分钟名人档案，值得纪念。这个数字会一直增长的。', '第一次被世界看见，哪怕只有一次，也是从零到一的飞跃。记录此刻。'],
  bonus: ['本局特此破格授予——如上数据显示，该问卷在曝光期间经历了罕见的指数级扩散。无法用常规算法解释。', '数据异常升高，经本局技术核查，排除人为干扰，确认为自然传播爆发。珍稀现象。'],
  general: ['本次档案签发完毕。你的每一份问卷，都在书写属于你的微型成名史。', '本档已归档。期待你的下一次亮相。', '每一份档案都是一块基石。积累下去，你的名字会成为一个标签。', '本局注意到，你的问卷在 15 分钟的短暂舞台上完成了一次完整的「被看见」周期。']
}
const DISCLAIMER = '本档案由「15分钟名气管理局」自动生成。数据在真实基础上做了微量艺术加工。如有疑问，请勿联系——因为我们不存在。'

/** [min, max] 区间随机浮点数 */
function randomBetween(min, max) { return min + Math.random() * (max - min) }

/** 零头修饰：加/减随机偏移量，产生"有零有整"效果 */
function Z(result) { return Math.max(1, result + Math.floor(Math.random() * 51) - 25) }

/** 计算驻足注视 */
function calculateViews(pinDoc, seniorityLevel) {
  const cfg = PIN_CONFIG.career
  const views = Math.floor(randomBetween(cfg.viewFloatMin, cfg.viewFloatMax) * 300)
  const boostedViews = seniorityLevel <= 1 ? Math.floor(views * randomBetween(1.2, 1.8)) : views
  return Z(Math.max(100, boostedViews))
}

/** 计算好奇打开 */
function calculateClicks(views, seniorityLevel) {
  const cfg = PIN_CONFIG.career
  let clickMin = cfg.clickRateMin, clickMax = cfg.clickRateMax
  if (seniorityLevel >= 3) { clickMin = Math.max(0.02, clickMin * 0.6); clickMax = Math.max(0.05, clickMax * 0.7) }
  if (seniorityLevel <= 1) { clickMin = Math.min(0.08, clickMin * 1.3); clickMax = Math.min(0.20, clickMax * 1.2) }
  return Z(Math.max(1, Math.floor(views * randomBetween(clickMin, clickMax))))
}

/** 计算决定存档 */
function calculateFavorites(clicks, seniorityLevel) {
  const cfg = PIN_CONFIG.career
  let favMin = cfg.favoriteRateMin, favMax = cfg.favoriteRateMax
  if (seniorityLevel <= 1) { favMin = Math.min(0.08, favMin * 1.3); favMax = Math.min(0.25, favMax * 1.2) }
  const raw = Math.floor(clicks * randomBetween(favMin, favMax))
  return Math.max(cfg.favoriteFloor, raw)
}

/** 数据暴击判定 */
function triggerBonus(views, clicks, seniorityLevel) {
  const cfg = PIN_CONFIG.career
  const actualRate = seniorityLevel <= 1 ? Math.min(0.25, cfg.bonusTriggerRate * 1.3) : cfg.bonusTriggerRate
  if (Math.random() >= actualRate) return { triggered: false }
  const targetViews = Math.random() < 0.7
  const multiplier = randomBetween(cfg.bonusMultiplierMin, cfg.bonusMultiplierMax)
  return { triggered: true, field: targetViews ? 'views' : 'clicks', multiplier }
}

/** 一致性校验与修正 */
function validateAndFix(views, clicks, favorites) {
  const cfg = PIN_CONFIG.career
  if (clicks > views) clicks = Math.floor(views * 0.8)
  if (favorites > clicks) favorites = Math.floor(clicks * 0.8)
  views = Math.max(1, Math.floor(views))
  clicks = Math.max(1, Math.floor(clicks))
  favorites = Math.max(cfg.favoriteFloor, Math.floor(favorites))
  return { views, clicks, favorites }
}

/** 荣誉称号匹配 */
function matchHonorTitle(views, clicks, favorites, isBonus, careerNumber) {
  if (isBonus) return Math.random() < 0.5 ? BONUS_TITLES[0] : BONUS_TITLES[1]
  if (careerNumber === 1) return views >= 500 ? DEBUT_TITLES[1] : DEBUT_TITLES[0]
  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0
  if (views > 3000 && clickRate < 0.08) return HONOR_TITLES[0]
  // 🔧 冷门黑马需在万众瞩目前判定：clickRate>0.25 会被 center(>0.2) 截胡
  if (views < 1000 && clickRate > 0.25) return HONOR_TITLES[3]
  if (clickRate > 0.2) return HONOR_TITLES[1]
  if (Math.random() < 0.3) return HONOR_TITLES[4]
  return HONOR_TITLES[5]
}

/** 档案附注生成 */
function generateNote(views, clicks, favorites, isBonus, careerNumber) {
  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0
  const notes = []
  if (isBonus && NOTE_TEMPLATES.bonus.length > 0) notes.push(NOTE_TEMPLATES.bonus[Math.floor(Math.random() * NOTE_TEMPLATES.bonus.length)])
  if (careerNumber === 1 && NOTE_TEMPLATES.newcomer.length > 0) notes.push(NOTE_TEMPLATES.newcomer[Math.floor(Math.random() * NOTE_TEMPLATES.newcomer.length)])
  if (views > 2000 && NOTE_TEMPLATES.views_high.length > 0) notes.push(NOTE_TEMPLATES.views_high[Math.floor(Math.random() * NOTE_TEMPLATES.views_high.length)])
  if (clickRate > 0.18 && NOTE_TEMPLATES.click_high.length > 0) notes.push(NOTE_TEMPLATES.click_high[Math.floor(Math.random() * NOTE_TEMPLATES.click_high.length)])
  if (favRate > 0.25 && NOTE_TEMPLATES.fav_high.length > 0) notes.push(NOTE_TEMPLATES.fav_high[Math.floor(Math.random() * NOTE_TEMPLATES.fav_high.length)])
  if (notes.length === 0 && NOTE_TEMPLATES.general.length > 0) notes.push(NOTE_TEMPLATES.general[Math.floor(Math.random() * NOTE_TEMPLATES.general.length)])
  notes.push('')
  notes.push(DISCLAIMER)
  return notes.join('\n')
}

/**
 * 战绩单生成记录（内联实现）
 * @param {string} uid - 用户ID
 * @param {Object} pinDoc - pin-pool 文档
 * @returns {string|null} careerId
 */
async function generateCareerRecordImpl(uid, pinDoc) {
  try {
    // 1. 计数器自增
    await db.collection('counter').doc('careerArchiveSeq').update({ seq: db.command.inc(1) })
    const counterRes = await db.collection('counter').doc('careerArchiveSeq').get()
    if (!counterRes.data || counterRes.data.length === 0) return null
    const seq = counterRes.data[0].seq
    const year = new Date(pinDoc.createdAt).getFullYear()
    const archiveNumber = `ZW-${year}-${String(seq).padStart(5, '0')}`
    const careerNumber = (pinDoc.senioritySnapshot || 0) + 1

    // 2. 资历档位
    const seniorityLevel = getSeniorityLevel(pinDoc.senioritySnapshot || 0)

    // 3. 数据生成
    let views = calculateViews(pinDoc, seniorityLevel)
    let clicks = calculateClicks(views, seniorityLevel)
    let favorites = calculateFavorites(clicks, seniorityLevel)

    // 4. 数据暴击
    const bonus = triggerBonus(views, clicks, seniorityLevel)
    let isBonus = bonus.triggered
    let bonusMultiplier = isBonus ? bonus.multiplier : 1.0
    if (isBonus) {
      if (bonus.field === 'views') {
        views = Math.floor(views * bonus.multiplier)
        clicks = Math.min(clicks, Math.floor(views * 0.8))
        favorites = Math.min(favorites, Math.floor(clicks * 0.8))
      } else {
        clicks = Math.floor(clicks * bonus.multiplier)
        favorites = Math.min(favorites, Math.floor(clicks * 0.8))
      }
    }

    // 5. 一致性校验
    const fixed = validateAndFix(views, clicks, favorites)
    views = fixed.views; clicks = fixed.clicks; favorites = fixed.favorites

    // 6. 荣誉称号匹配
    const honor = matchHonorTitle(views, clicks, favorites, isBonus, careerNumber)

    // 7. 档案附注生成
    const comment = generateNote(views, clicks, favorites, isBonus, careerNumber)

    // 8. 写入 career-records
    const suffix = genSuffix()
    const careerId = `career${suffix}`
    const now = Date.now()
    await db.collection('career-records').add({
      _id: careerId, userId: uid,
      surveyId: pinDoc.surveyId, pinId: pinDoc._id,
      careerNumber, archiveNumber, createdAt: now,
      stats: { views, clicks, favorites },
      bonusTriggered: isBonus, bonusMultiplier,
      honor: { id: honor.id, name: honor.name, desc: honor.desc },
      comment, surveyTitle: pinDoc.surveyTitle || pinDoc.surveyId,
      isGreenChannel: pinDoc.isGreenChannel || false,
      haloActive: pinDoc.haloActive || false,
      senioritySnapshot: pinDoc.senioritySnapshot || 0,
      pinType: pinDoc.pinType || 'self'
    })

    // 9. 标记未读
    await db.collection('uni-id-users').doc(uid).update({
      'career.hasUnread': true,
      'career.unreadCareerIds': db.command.push(careerId)
    })

    return careerId
  } catch (e) {
    console.error('[pin-system] generateCareerRecordImpl 失败:', e)
    return null
  }
}

/**
 * 计数器兜底初始化
 */
async function ensureCounter() {
  try {
    const counterRes = await db.collection('counter').doc('careerArchiveSeq').get()
    if (!counterRes.data || counterRes.data.length === 0) {
      await db.collection('counter').add({ _id: 'careerArchiveSeq', seq: 0 })
    }
  } catch (e) {
    console.error('[pin-system] 计数器初始化失败:', e)
  }
}

// ==================== 导出的云对象方法 ====================

module.exports = {
  async _before() {
    this.timestamp = Date.now()
    this.uid = null
    const token = this.getUniIdToken()
    if (!token) return
    try {
      const uniIDInstance = uniID.createInstance({ context: this.getCloudInfo() })
      const payload = await uniIDInstance.checkToken(token)
      if (payload.uid) {
        this.uid = payload.uid
      }
    } catch (e) {
      console.error('[pin-system] token 校验失败', e.errCode || '', e.message || e)
    }

    // 阶段七：请求频率限制（基于 uid，云函数实例生命周期内有效）
    if (this.uid) {
      const now = Date.now()
      if (!this._rateLimitTimestamps) this._rateLimitTimestamps = {}
      if (!this._rateLimitTimestamps[this.uid]) this._rateLimitTimestamps[this.uid] = []
      const timestamps = this._rateLimitTimestamps[this.uid]
      // 清理 60 秒前的旧戳
      while (timestamps.length > 0 && timestamps[0] < now - 60000) {
        timestamps.shift()
      }
      if (timestamps.length >= PIN_CONFIG.security.rateLimitPerMinute) {
        return { errCode: 'RATE_LIMIT', errMsg: '请求过于频繁，请稍后再试' }
      }
      timestamps.push(now)
    }
  },

  /** 预热方法 */
  async ping() {
    return { errCode: 0 }
  },

  /**
   * 查询用户资历
   * @returns {Object} { errCode, data: { exposureCount, level, label, nextLevelAt } }
   */
  async getSeniority() {
    if (!this.uid) {
      return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    }

    if (this._seniority) {
      return { errCode: 0, data: this._seniority }
    }

    try {
      const levels = PIN_CONFIG.seniority.levels || []
      const userRes = await db.collection('uni-id-users').doc(this.uid).get()
      if (!userRes.data || userRes.data.length === 0) {
        return { errCode: 'USER_NOT_FOUND', errMsg: '用户不存在' }
      }

      const user = userRes.data[0]
      const exposureCount = user.career?.exposureCount ?? 0

      let matched = levels[0]
      for (const lv of levels) {
        if (exposureCount >= lv.min && (lv.max === null || exposureCount <= lv.max)) {
          matched = lv
          break
        }
      }

      let nextLevelAt = null
      for (const lv of levels) {
        if (lv.level === matched.level + 1) {
          nextLevelAt = lv.min - exposureCount
          break
        }
      }

      const result = { exposureCount, level: matched.level, label: matched.label, nextLevelAt }
      this._seniority = result
      return { errCode: 0, data: result }
    } catch (e) {
      console.error('[pin-system] getSeniority error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '查询资历失败' }
    }
  },

  // ==================== 阶段一：入池核心逻辑 ====================

  /**
   * 前置资格检查（广告播放之前调用）
   * 检查去重 + 槽位可用性，不消耗任何资源
   * 前端确认通过后才播放广告 → 广告完成后调用 handleAdReward
   */
  async checkPinEligibility({ surveyId } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (!surveyId) return { errCode: 'INVALID_PARAM', errMsg: '缺少 surveyId' }

    try {
      // 0. 创建者身份校验：仅问卷创建者本人可置顶
      const surveyRes = await db.collection('surveys').doc(surveyId).get()
      const surveyCreatorId = (surveyRes.data && surveyRes.data.length > 0)
        ? (surveyRes.data[0].creatorId || null)
        : null
      if (!surveyCreatorId) {
        return { errCode: 'OFFICIAL_SURVEY', errMsg: '官方问卷不可置顶' }
      }
      if (surveyCreatorId !== this.uid) {
        return { errCode: 'NOT_CREATOR', errMsg: '仅问卷创建者可置顶' }
      }

      // 1. 去重检查：同一问卷是否已在置顶流程中
      const now = Date.now()
      const poolRes = await db.collection('pin-pool').where({
        surveyId,
        expireAt: { $gt: now }
      }).get()
      if (poolRes.data && poolRes.data.length > 0) {
        return { errCode: 'ALREADY_IN_POOL', errMsg: '该问卷已在置顶池中，无法重复置顶' }
      }

      const queueRes = await db.collection('survey-queue').where({ surveyId }).get()
      if (queueRes.data && queueRes.data.length > 0) {
        return { errCode: 'ALREADY_IN_QUEUE', errMsg: '该问卷已在候场区排队中，无法重复置顶' }
      }

      // 1. 读用户信息
      const userRes = await db.collection('uni-id-users').doc(this.uid).get()
      if (!userRes.data || userRes.data.length === 0) {
        return { errCode: 'USER_NOT_FOUND', errMsg: '用户不存在' }
      }
      const user = userRes.data[0]
      let slots = user.career?.slots || []

      // 2. 兜底初始化
      if (!slots || slots.length === 0) {
        slots = [
          { status: 'idle', surveyId: null, pinId: null, queueId: null },
          { status: 'idle', surveyId: null, pinId: null, queueId: null },
          { status: 'idle', surveyId: null, pinId: null, queueId: null }
        ]
      }

      // 3. 槽位检查（idle 或可回收的 claimable）
      const hasIdle = slots.some(s => s.status === 'idle')
      const hasClaimable = slots.some(s => s.status === 'claimable')
      if (!hasIdle && !hasClaimable) {
        return { errCode: 'SLOTS_FULL', errMsg: '已达到 3 条上限，请等待其中一条完成' }
      }

      // 4. 每日置顶次数软帽检查
      const todayStart = new Date(new Date().toLocaleDateString()).getTime()
      const todayCountRes = await db.collection('pin-pool').where({
        userId: this.uid,
        createdAt: { $gt: todayStart }
      }).count()
      const todayCount = todayCountRes.total || 0
      if (todayCount >= PIN_CONFIG.security.dailyPinSoftCap) {
        return { errCode: 'DAILY_CAP_SOFT', errMsg: `今日置顶已达${PIN_CONFIG.security.dailyPinSoftCap}次软帽限制，明日起恢复` }
      }

      return { errCode: 0, errMsg: '检查通过，可以展示广告' }
    } catch (e) {
      console.error('[pin-system] checkPinEligibility error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '资格检查失败: ' + (e.message || '') }
    }
  },

  /**
   * 处理广告奖励（前端 onRewarded 后调用的统一入口）
   * scene: 'first_pin' → enterPool | 'queue_accel' → executeAccel
   */
  async handleAdReward({ scene, surveyId, queueId, adDuration } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }

    // 阶段七：广告最短时长校验（防刷兜底，前端 isEnded 为主，服务端为辅）
    if (typeof adDuration === 'number' && adDuration > 0) {
      if (adDuration < PIN_CONFIG.security.adMinDurationSeconds * 1000) {
        console.warn(`[pin-system] 广告时长不足: uid=${this.uid} adDuration=${adDuration}ms threshold=${PIN_CONFIG.security.adMinDurationSeconds}s`)
        return { errCode: 'AD_TOO_SHORT', errMsg: '广告观看时长不足，请完整观看后重试' }
      }
    }

    try {
      if (scene === 'first_pin') return await enterPoolImpl(this.uid, surveyId)
      if (scene === 'queue_accel') return await this.executeAccel({ queueId })
      return { errCode: 'INVALID_PARAM', errMsg: `未知 scene: ${scene}` }
    } catch (e) {
      console.error('[pin-system] handleAdReward error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: `处理广告奖励失败: ${e.message}` }
    }
  },

  /** 入池（导出给直接调用或测试用，内部路由走 handleAdReward） */
  async enterPool({ surveyId } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    this._seniority = null
    return await enterPoolImpl(this.uid, surveyId)
  },

  /** 候场转置顶（导出供前端直接调用） */
  async queueToPool({ surveyId, queueId } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    this._seniority = null
    return await queueToPoolImpl(this.uid, surveyId, queueId)
  },

  /**
   * 查询用户三槽位状态（含实时过期核验，兜底 pin-expiry 延迟）
   */
  async getSlotStatus() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const userRes = await db.collection('uni-id-users').doc(this.uid).get()
      if (!userRes.data || userRes.data.length === 0) {
        return { errCode: 0, data: { slots: [] } }
      }
      let slots = userRes.data[0].career?.slots || []

      // 实时校验 active 槽位：检查对应 pin 是否已过期
      const now = Date.now()
      let slotsChanged = false

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i]
        if (slot.status !== 'active') continue

        let pinDoc = null
        if (slot.pinId) {
          try {
            const pinRes = await db.collection('pin-pool').doc(slot.pinId).get()
            if (pinRes.data && pinRes.data.length > 0) {
              pinDoc = pinRes.data[0]
            }
          } catch (e) { /* pin 已被 pin-expiry 删除 */ }
        }

        const pinExpired = !pinDoc || (pinDoc.expireAt && pinDoc.expireAt <= now)
        if (!pinExpired) continue // pin 仍有效，跳过

        // pin 已过期或不存在，检查生涯记录
        const careerRes = await db.collection('career-records').where({
          userId: this.uid,
          pinId: slot.pinId
        }).get()

        if (careerRes.data && careerRes.data.length > 0) {
          // pin-expiry 已生成生涯记录 → 设为 claimable
          const foundCareerId = careerRes.data[0]._id
          slots[i] = { status: 'claimable', surveyId: slot.surveyId, pinId: slot.pinId, careerId: foundCareerId, queueId: null }
          slotsChanged = true
        } else if (pinDoc) {
          // pin 已过期但生涯记录未生成，兜底生成
          const careerId = await generateCareerRecordImpl(this.uid, pinDoc)
          if (careerId) {
            slots[i] = { status: 'claimable', surveyId: slot.surveyId, pinId: slot.pinId, careerId: careerId, queueId: null }
            slotsChanged = true
          } else {
            // 生成失败 → 清空槽位释放资源
            slots[i] = { status: 'idle', surveyId: null, pinId: null, queueId: null }
            slotsChanged = true
          }
        } else {
          // pin 已删除且无生涯记录（极端异常）→ 清空槽位
          slots[i] = { status: 'idle', surveyId: null, pinId: null, queueId: null }
          slotsChanged = true
        }
      }

      if (slotsChanged) {
        await db.collection('uni-id-users').doc(this.uid).update({ 'career.slots': slots })
      }

      return { errCode: 0, data: { slots } }
    } catch (e) {
      console.error('[pin-system] getSlotStatus error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '查询槽位失败' }
    }
  },

  // ==================== 阶段二：权重与抽取 ====================

  async draw({ count = 5 } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    return await drawImpl(this.uid, count)
  },

  // ==================== 阶段四：候场区系统 ====================

  /**
   * 查询候场状态
   * @param {string} queueId 可选，指定查询某条候场记录
   */
  async getQueueStatus({ queueId } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    return await getQueueStatusImpl(this.uid, queueId)
  },

  /**
   * 执行广告加速
   * @param {string} queueId 候场记录标识
   */
  async executeAccel({ queueId } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (!queueId) return { errCode: 'INVALID_PARAM', errMsg: '缺少 queueId' }
    this._seniority = null
    return await executeAccelImpl(this.uid, queueId)
  },

  /**
   * 生成战绩单（非定时场景使用，如管理台手动触发）
   * 核心逻辑已内联实现，与 pin-expiry 保持独立不依赖
   */
  async generateCareer({ userId, pinDoc } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (!userId || !pinDoc) return { errCode: 'INVALID_PARAM', errMsg: '缺少 userId 或 pinDoc' }
    await ensureCounter()
    const careerId = await generateCareerRecordImpl(userId, pinDoc)
    if (careerId) {
      return { errCode: 0, data: { careerId } }
    }
    return { errCode: 'CAREER_GEN_FAILED', errMsg: '战绩单生成失败' }
  },

  /**
   * 检测用户是否有未读档案（首页 onShow 调用）
   * 返回未读档案摘要列表，前端无需再次查询详情
   */
  async checkCareerStatus() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const userRes = await db.collection('uni-id-users').doc(this.uid).get()
      if (!userRes.data || userRes.data.length === 0) {
        return { errCode: 0, data: { hasUnread: false, careers: [] } }
      }
      const career = userRes.data[0].career || {}
      const unreadIds = career.unreadCareerIds || []

      if (unreadIds.length === 0) {
        return { errCode: 0, data: { hasUnread: false, careers: [] } }
      }

      // 批量查询未读档案摘要
      const careerRes = await db.collection('career-records').where({
        _id: { $in: unreadIds }
      }).get()

      const careers = (careerRes.data || []).map(c => ({
        careerId: c._id,
        surveyTitle: c.surveyTitle || '',
        careerNumber: c.careerNumber,
        archiveNumber: c.archiveNumber || '',
        honor: c.honor || { id: 'unknown', name: '未知称号', desc: '' },
        stats: c.stats || { views: 0, clicks: 0, favorites: 0 },
        bonusTriggered: c.bonusTriggered || false,
        isGreenChannel: c.isGreenChannel || false,
        createdAt: c.createdAt
      }))

      return { errCode: 0, data: { hasUnread: true, careers } }
    } catch (e) {
      console.error('[pin-system] checkCareerStatus error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '查询未读档案失败' }
    }
  },

  /**
   * 标记档案为已读，释放对应槽位（双路径原子化处理）
   * 1. 从 unreadCareerIds 中移除该 ID
   * 2. 若数组为空则置 hasUnread = false
   * 3. 通过 career-records 的 pinId 定位对应槽位，条件更新为 idle
   */
  async markCareerAsRead({ careerId } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (!careerId) return { errCode: 'INVALID_PARAM', errMsg: '缺少 careerId' }
    try {
      // 1. 从未读列表中移除
      const updateRes = await db.collection('uni-id-users').doc(this.uid).update({
        'career.unreadCareerIds': db.command.pull(careerId)
      })

      // 2. 读取更新后的用户数据，判断是否还有未读
      const userRes = await db.collection('uni-id-users').doc(this.uid).get()
      if (userRes.data && userRes.data.length > 0) {
        const remaining = userRes.data[0].career?.unreadCareerIds || []
        if (remaining.length === 0) {
          await db.collection('uni-id-users').doc(this.uid).update({
            'career.hasUnread': false
          })
        }
      }

      // 3. 查询 career-records 获取 pinId，用于定位槽位
      const careerRes = await db.collection('career-records').doc(careerId).get()
      if (careerRes.data && careerRes.data.length > 0) {
        const rec = careerRes.data[0]
        const pinId = rec.pinId

        if (pinId) {
          // 通过 pinId 匹配对应槽位，条件更新（仅 claimable → idle）
          const slotRes = await db.collection('uni-id-users').doc(this.uid).get()
          if (slotRes.data && slotRes.data.length > 0) {
            const slots = slotRes.data[0].career?.slots || []
            const slotIdx = slots.findIndex(s => s.pinId === pinId && s.status === 'claimable')
            if (slotIdx !== -1) {
              await db.collection('uni-id-users').doc(this.uid).update({
                [`career.slots.${slotIdx}`]: {
                  status: 'idle', surveyId: null, pinId: null, queueId: null
                }
              })
            }
          }
        }
      }

      return { errCode: 0, errMsg: '已标记为已读' }
    } catch (e) {
      console.error('[pin-system] markCareerAsRead error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '标记已读失败: ' + (e.message || '') }
    }
  },

  /**
   * 按 pinId 查询对应的 careerId（供前端兜底，避免客户端直查 DB）
   */
  async getCareerByPinId({ pinId } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (!pinId) return { errCode: 'INVALID_PARAM', errMsg: '缺少 pinId' }
    try {
      const careerRes = await db.collection('career-records').where({
        userId: this.uid,
        pinId: pinId
      }).get()
      if (careerRes.data && careerRes.data.length > 0) {
        return { errCode: 0, data: { careerId: careerRes.data[0]._id } }
      }
      return { errCode: 'NOT_FOUND', errMsg: '未找到对应生涯记录' }
    } catch (e) {
      console.error('[pin-system] getCareerByPinId error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '查询失败' }
    }
  },

  // ==================== 测试专用方法 ====================

  /**
   * 设置测试用户的 exposureCount（仅供 mock 页测试用）
   */
  async testSetExposureCount({ count } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (typeof count !== 'number' || count < 0) return { errCode: 'INVALID_PARAM', errMsg: 'count 必须为非负整数' }
    try {
      await db.collection('uni-id-users').doc(this.uid).update({
        'career.exposureCount': count
      })
      this._seniority = null
      return { errCode: 0, errMsg: `exposureCount 已设为 ${count}` }
    } catch (e) {
      console.error('[pin-system] testSetExposureCount error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '设置失败' }
    }
  },

  /**
   * 重置三槽位为闲置，并删除该用户在 pin-pool 中的所有记录（仅供 mock 页测试用）
   */
  async testResetSlots() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const slots = [
        { status: 'idle', surveyId: null, pinId: null, queueId: null },
        { status: 'idle', surveyId: null, pinId: null, queueId: null },
        { status: 'idle', surveyId: null, pinId: null, queueId: null }
      ]
      await db.collection('uni-id-users').doc(this.uid).update({
        'career.slots': slots
      })
      // 清掉该用户在池中的所有记录
      await db.collection('pin-pool').where({ userId: this.uid }).remove()
      this._seniority = null
      return { errCode: 0, errMsg: '槽位已重置，池中记录已清空' }
    } catch (e) {
      console.error('[pin-system] testResetSlots error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '重置失败' }
    }
  },

  /**
   * 设置候场记录 enterAt（仅供测试用，手动模拟时间推进）
   */
  async testSetEnterAt({ queueId, minutesAgo } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (!queueId || typeof minutesAgo !== 'number') return { errCode: 'INVALID_PARAM', errMsg: '缺少 queueId 或 minutesAgo' }
    try {
      const newEnterAt = Date.now() - minutesAgo * 60 * 1000
      await db.collection('survey-queue').doc(queueId).update({
        enterAt: newEnterAt
      })
      return { errCode: 0, errMsg: `enterAt 已设为 ${minutesAgo} 分钟前` }
    } catch (e) {
      console.error('[pin-system] testSetEnterAt error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '设置失败: ' + (e.message || '') }
    }
  },

  /**
   * 切换强制候场模式（仅供测试用）
   * force=true: 池满线设为 0（所有非 Lv.0 进候场）
   * force=false: 恢复原阈值 1000
   */
  async testSetForceQueue({ force } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      if (force) {
        PIN_CONFIG.pool._savedThreshold = PIN_CONFIG.pool._savedThreshold || PIN_CONFIG.pool.poolSizeThreshold
        PIN_CONFIG.pool.poolSizeThreshold = 0
        console.log('[pin-test] 强制候场模式已开启，poolSizeThreshold=0')
        return { errCode: 0, errMsg: '强制候场模式已开启，所有非 Lv.0 用户将进入候场区' }
      } else {
        const restored = PIN_CONFIG.pool._savedThreshold || 1000
        PIN_CONFIG.pool.poolSizeThreshold = restored
        PIN_CONFIG.pool._savedThreshold = null
        console.log(`[pin-test] 强制候场模式已关闭，poolSizeThreshold=${restored}`)
        return { errCode: 0, errMsg: `强制候场模式已关闭，池满线恢复为 ${restored}` }
      }
    } catch (e) {
      console.error('[pin-system] testSetForceQueue error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '设置失败: ' + (e.message || '') }
    }
  },

  /**
   * 查询当前池子内容（仅供 Mock 页调试用）
   */
  async getPoolContents() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    return await getPoolContentsImpl()
  },

  // ==================== 阶段三测试专用方法 ====================

  /**
   * 创建过期测试数据：过期 pin-pool + 超时候场 queue（仅供 mock 页测试用）
   */
  async testSeedExpiryData() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const now = Date.now()
      const suffix = `_${now}_${String(Math.random()).slice(2, 6)}`

      // 1. 过期 pin-pool 文档（1 分钟前过期）
      const pinId = `test_pin${suffix}`
      await db.collection('pin-pool').add({
        _id: pinId, userId: this.uid,
        surveyId: `test_survey${suffix}`,
        surveyTitle: '测试问卷-过期',
        surveyCover: '',
        status: 'active', snapshot: 0,
        expireAt: now - 60 * 1000,
        createdAt: now - 20 * 60 * 1000,
        weight: { total: 100, base: 100 },
        senioritySnapshot: 0, haloActive: false, isGreenChannel: false,
        isTest: true
      })

      // 2. 超时候场记录（35 分钟前入队）
      const queueId = `test_queue${suffix}`
      await db.collection('survey-queue').add({
        _id: queueId, userId: this.uid,
        surveyId: `test_survey_queue${suffix}`,
        status: 'queuing',
        enterAt: now - 35 * 60 * 1000,
        retryCount: 0, isTest: true
      })

      // 3. 找两个闲置槽位，分别占住
      const userRes = await db.collection('uni-id-users').doc(this.uid).get()
      let slots = userRes.data && userRes.data.length > 0
        ? (userRes.data[0].career?.slots || []) : []

      if (slots.length === 0) {
        slots = Array.from({ length: 3 }, () => ({ status: 'idle', surveyId: null, pinId: null, queueId: null }))
      }

      const idx0 = slots.findIndex(s => s.status === 'idle')
      if (idx0 !== -1) {
        slots[idx0] = { status: 'active', surveyId: `test_survey${suffix}`, pinId, queueId: null }
      }
      const idx1 = slots.findIndex((s, i) => i !== idx0 && s.status === 'idle')
      if (idx1 !== -1) {
        slots[idx1] = { status: 'queuing', surveyId: `test_survey_queue${suffix}`, pinId: null, queueId }
      }

      await db.collection('uni-id-users').doc(this.uid).update({ 'career.slots': slots })

      return { errCode: 0, data: { pinId, queueId } }
    } catch (e) {
      console.error('[pin-system] testSeedExpiryData error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '造数据失败: ' + (e.message || '') }
    }
  },

  /**
   * 播种 slot-fix-test 测试场景（仅供 mock 页测试用）
   * 创建 3 个 pin-pool 记录 + 1 个 career-record，设置 3 个槽位为 active
   */
  async testSeedSlotFixScenarios() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const uid = this.uid
      const now = Date.now()
      const suffix = '_' + now

      // 1. A1: pin 未过期（10分钟后过期）
      const pinA1 = 'pin_a1' + suffix
      await db.collection('pin-pool').add({
        _id: pinA1, userId: uid,
        surveyId: 's_a1', surveyTitle: 'A1-未过期测试',
        surveyCover: '',
        weight: 100, createdAt: now,
        expireAt: now + 10 * 60 * 1000,
        senioritySnapshot: 1,
        haloActive: false, isGreenChannel: false,
        pinType: 'self', pinnerId: uid, surveyCreatorId: uid
      })

      // 2. A2: pin 已过期 + 有 career-record
      const pinA2 = 'pin_a2' + suffix
      await db.collection('pin-pool').add({
        _id: pinA2, userId: uid,
        surveyId: 's_a2', surveyTitle: 'A2-过期有记录',
        surveyCover: '',
        weight: 100, createdAt: now - 20 * 60 * 1000,
        expireAt: now - 2 * 60 * 1000,
        senioritySnapshot: 2,
        haloActive: false, isGreenChannel: false,
        pinType: 'self', pinnerId: uid, surveyCreatorId: uid
      })
      const careerA2 = 'career_a2' + suffix
      await db.collection('career-records').add({
        _id: careerA2, userId: uid,
        pinId: pinA2, surveyId: 's_a2',
        careerNumber: 3, archiveNumber: 'ZW-2026-00003',
        createdAt: now - 2 * 60 * 1000,
        stats: { views: 500, clicks: 80, favorites: 12 },
        bonusTriggered: false, bonusMultiplier: 1,
        honor: { id: 'center', name: '万众瞩目者', desc: '' },
        comment: '', surveyTitle: 'A2-过期有记录',
        isGreenChannel: false, haloActive: false,
        senioritySnapshot: 2, pinType: 'self'
      })

      // 3. A3: pin 已过期 + 无 career-record（靠兜底生成）
      const pinA3 = 'pin_a3' + suffix
      await db.collection('pin-pool').add({
        _id: pinA3, userId: uid,
        surveyId: 's_a3', surveyTitle: 'A3-过期无记录',
        surveyCover: '',
        weight: 100, createdAt: now - 20 * 60 * 1000,
        expireAt: now - 2 * 60 * 1000,
        senioritySnapshot: 3,
        haloActive: false, isGreenChannel: false,
        pinType: 'self', pinnerId: uid, surveyCreatorId: uid
      })

      // 4. 三个槽位都设 active
      await db.collection('uni-id-users').doc(uid).update({
        'career.slots': [
          { status: 'active', surveyId: 's_a1', pinId: pinA1, queueId: null },
          { status: 'active', surveyId: 's_a2', pinId: pinA2, queueId: null },
          { status: 'active', surveyId: 's_a3', pinId: pinA3, queueId: null }
        ]
      })

      return {
        errCode: 0,
        data: { pinA1, pinA2, pinA3, careerA2 }
      }
    } catch (e) {
      console.error('[pin-system] testSeedSlotFixScenarios error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '播种失败: ' + (e.message || '') }
    }
  },

  /**
   * 更新单个槽位（仅供 slot-fix-test 页测试用）
   * @param {number} idx - 槽位索引 0/1/2
   * @param {object} slotData - { status, surveyId, pinId, queueId }
   */
  async testUpdateSlot({ idx, slotData } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (typeof idx !== 'number' || idx < 0 || idx > 2) return { errCode: 'INVALID_PARAM', errMsg: 'idx 必须为 0/1/2' }
    if (!slotData || !slotData.status) return { errCode: 'INVALID_PARAM', errMsg: 'slotData 缺少 status' }
    try {
      const userRes = await db.collection('uni-id-users').doc(this.uid).get()
      const slots = (userRes.data && userRes.data.length > 0 && userRes.data[0].career?.slots) || []
      while (slots.length <= idx) slots.push({ status: 'idle', surveyId: null, pinId: null, queueId: null })
      slots[idx] = slotData
      await db.collection('uni-id-users').doc(this.uid).update({ 'career.slots': slots })
      return { errCode: 0, errMsg: `槽位 ${idx} 已更新为 ${slotData.status}` }
    } catch (e) {
      console.error('[pin-system] testUpdateSlot error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '更新槽位失败: ' + (e.message || '') }
    }
  },

  /**
   * 加载当前用户的 career-records（仅供 slot-fix-test 页测试用）
   */
  async testLoadCareers() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const res = await db.collection('career-records').where({
        userId: this.uid
      }).orderBy('createdAt', 'desc').get()
      return { errCode: 0, data: res.data || [] }
    } catch (e) {
      console.error('[pin-system] testLoadCareers error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '查询失败: ' + (e.message || '') }
    }
  },

  /**
   * 清理阶段三测试数据（仅供 mock 页测试用）
   *
   * ⚠️ 测试完成后记得删除 cloudfunctions/test-pin-expiry/ 目录
   *    （右键删除 + 上传清理云端），该云函数仅用于一次性集成测试。
   */
  async testCleanupExpiryData() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const pd = await db.collection('pin-pool').where({ isTest: true }).remove()
      const qd = await db.collection('survey-queue').where({ isTest: true }).remove()
      const cd = await db.collection('career-records').where({
        userId: this.uid,
        surveyId: new RegExp('^test_')
      }).remove()

      // 重置槽位
      const slots = Array.from({ length: 3 }, () => ({ status: 'idle', surveyId: null, pinId: null, queueId: null }))
      await db.collection('uni-id-users').doc(this.uid).update({ 'career.slots': slots })

      return {
        errCode: 0,
        data: {
          pinPoolDeleted: pd.deleted || 0,
          queueDeleted: qd.deleted || 0,
          careerDeleted: cd.deleted || 0
        }
      }
    } catch (e) {
      console.error('[pin-system] testCleanupExpiryData error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '清理失败: ' + (e.message || '') }
    }
  },

  /**
   * 查询当前用户的最新战绩单（仅供 mock 页测试用）
   */
  async testQueryCareer() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const res = await db.collection('career-records').where({
        userId: this.uid
      }).orderBy('createdAt', 'desc').limit(5).get()
      return { errCode: 0, data: res.data || [] }
    } catch (e) {
      console.error('[pin-system] testQueryCareer error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '查询失败: ' + (e.message || '') }
    }
  },

  // ==================== 阶段五测试专用方法 ====================

  /**
   * 批量生成他人模拟 pin-pool 数据（仅供 mock 页测试用）
   * pins: [{ userId, nickname?, surveyId, surveyTitle?, surveyCover?, exposureCount? }]
   * 用于画出"他人的卡片"测试首页
   */
  async testSeedMockPins({ pins } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (!Array.isArray(pins) || pins.length === 0) return { errCode: 'INVALID_PARAM', errMsg: 'pins 必须是非空数组' }
    try {
      const now = Date.now()
      const results = []
      for (let i = 0; i < pins.length; i++) {
        const pin = pins[i]
        if (!pin.userId || !pin.surveyId) {
          results.push({ index: i, err: '缺少 userId 或 surveyId' })
          continue
        }
        const suffix = `_mock_${now}_${String(Math.random()).slice(2, 6)}_${i}`
        const docId = `pin${suffix}`
        const expireAt = now + PIN_CONFIG.pool.poolLifecycleMinutes * 60 * 1000
        await db.collection('pin-pool').add({
          _id: docId,
          surveyId: pin.surveyId,
          userId: pin.userId,
          surveyTitle: pin.surveyTitle || pin.surveyId,
          surveyCover: pin.surveyCover || '',
          surveyAuthor: pin.surveyAuthor || pin.nickname || '',
          weight: PIN_CONFIG.weight.otherWeightMin,
          createdAt: now + i * 1000,
          expireAt,
          senioritySnapshot: pin.exposureCount || 0,
          haloActive: false,
          isGreenChannel: false,
          isTestMockData: true
        })
        results.push({ index: i, _id: docId, ok: true })
      }
      return {
        errCode: 0,
        data: {
          inserted: results.filter(r => r.ok).length,
          failed: results.filter(r => !r.ok).length,
          details: results
        }
      }
    } catch (e) {
      console.error('[pin-system] testSeedMockPins error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '造数据失败: ' + (e.message || '') }
    }
  },

  /**
   * 清理模拟数据（仅供 mock 页测试用）
   */
  async testCleanMockPins() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const res = await db.collection('pin-pool').where({ isTestMockData: true }).remove()
      return { errCode: 0, data: { deleted: res.deleted || 0 } }
    } catch (e) {
      console.error('[pin-system] testCleanMockPins error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '清理失败: ' + (e.message || '') }
    }
  },

  /**
   * 安全测试专用：批量直接写入 pin-pool + survey-queue 构造测试状态
   * 绕过完整的 handleAdReward 流程，精确定位每种拦截路径
   * @param {string[]} poolSurveyIds - 要写入 pin-pool 的 surveyId
   * @param {string[]} queueSurveyIds - 要写入 survey-queue 的 surveyId
   * @param {string[]} fillSlotIds - 要用完所有槽位的 surveyId（最多 3 个）
   */
  async testSeedSafetyState({ poolSurveyIds = [], queueSurveyIds = [], fillSlotIds = [] } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const now = Date.now()
      const expireAt = now + 13 * 60 * 1000

      // 1. 写入 pin-pool
      for (const sid of poolSurveyIds) {
        const suffix = genSuffix()
        await db.collection('pin-pool').add({
          _id: `pin_safety${suffix}`,
          surveyId: sid,
          userId: this.uid,
          surveyTitle: '[安全测试] ' + sid,
          surveyCover: '',
          surveyAuthor: '',
          weight: 100,
          createdAt: now,
          expireAt,
          senioritySnapshot: 0,
          haloActive: false,
          isGreenChannel: false,
          pinType: 'self',
          pinnerId: this.uid,
          surveyCreatorId: this.uid
        })
      }

      // 2. 写入 survey-queue
      for (const sid of queueSurveyIds) {
        const suffix = genSuffix()
        await db.collection('survey-queue').add({
          _id: `queue_safety${suffix}`,
          userId: this.uid,
          surveyId: sid,
          enterAt: now,
          acceleratedCount: 0,
          seniorityLevel: 0,
          currentPhase: 'queuing',
          logLines: [],
          effectiveOffset: 0
        })
      }

      // 3. 占满槽位
      if (fillSlotIds.length > 0) {
        const slots = []
        for (let i = 0; i < 3; i++) {
          if (i < fillSlotIds.length) {
            slots.push({
              status: 'active',
              surveyId: fillSlotIds[i],
              pinId: `pin_safety_slot_${i}`,
              queueId: null
            })
          } else {
            slots.push({ status: 'idle', surveyId: null, pinId: null, queueId: null })
          }
        }
        await db.collection('uni-id-users').doc(this.uid).update({ 'career.slots': slots })
      }

      return { errCode: 0, data: { poolCount: poolSurveyIds.length, queueCount: queueSurveyIds.length, slotCount: fillSlotIds.length } }
    } catch (e) {
      console.error('[pin-system] testSeedSafetyState error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '构造测试状态失败: ' + (e.message || '') }
    }
  },
  async testEnsureSurveys({ surveyIds } = {}) {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    if (!Array.isArray(surveyIds) || surveyIds.length === 0) {
      return { errCode: 'INVALID_PARAM', errMsg: 'surveyIds 必须是非空数组' }
    }
    try {
      const created = []
      for (const sid of surveyIds) {
        const existRes = await db.collection('surveys').doc(sid).get()
        if (existRes.data && existRes.data.length > 0) {
          created.push(sid)
          continue
        }
        await db.collection('surveys').add({
          _id: sid,
          creatorId: this.uid,
          title: '[测试问卷] ' + sid,
          tagName: '测试标签',
          cover: '',
          surveyCover: '',
          // schema 强制要求的最小字段
          dims: ['维度A', '维度B', '维度C'],
          qs: [{ title: '测试题目', dim: '维度A' }],
          resultTypes: [{ name: '测试结果', emoji: '🧪', desc: '测试用' }]
        })
        created.push(sid)
      }
      return { errCode: 0, data: { created } }
    } catch (e) {
      console.error('[pin-system] testEnsureSurveys error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '创建测试问卷失败: ' + (e.message || '') }
    }
  },

  /**
   * 清理测试用问卷
   */
  async testCleanTestSurveys() {
    if (!this.uid) return { errCode: 'NOT_AUTH', errMsg: '用户未登录' }
    try {
      const res = await db.collection('surveys').where({ creatorId: this.uid }).get()
      const testIds = (res.data || []).filter(d => (d.title || '').startsWith('[测试问卷]')).map(d => d._id)
      let deleted = 0
      for (const id of testIds) {
        try { await db.collection('surveys').doc(id).remove(); deleted++ } catch (_) {}
      }
      return { errCode: 0, data: { deleted } }
    } catch (e) {
      console.error('[pin-system] testCleanTestSurveys error:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '清理失败: ' + (e.message || '') }
    }
  },

  // ==================== 老用户迁移 ====================

  /**
   * 老用户 career 字段迁移
   * 为所有缺少 career 字段的 uni-id-users 补全默认值
   * 无需登录，只需调用时传参 { token: 'migrate' } 确认
   */
  async systemRunCareerMigration({ confirm } = {}) {
    // 安全确认，防止误调用
    if (confirm !== 'migrate') {
      return { errCode: 'NEED_CONFIRM', errMsg: '请传 { confirm: "migrate" } 确认执行迁移' }
    }
    try {
      const result = await db.collection('uni-id-users').where({
        career: { $exists: false }
      }).update({
        career: {
          exposureCount: 0,
          hasUnread: false,
          unreadCareerIds: [],
          slots: [
            { status: 'idle', surveyId: null, pinId: null, queueId: null },
            { status: 'idle', surveyId: null, pinId: null, queueId: null },
            { status: 'idle', surveyId: null, pinId: null, queueId: null }
          ]
        }
      })
      console.log('[pin-system] 老用户 career 迁移完成，受影响的文档数：', result.updated)
      return { errCode: 0, data: { updated: result.updated }, errMsg: `迁移完成，已为 ${result.updated} 个老用户补全 career 字段` }
    } catch (e) {
      console.error('[pin-system] 老用户 career 迁移失败:', e)
      return { errCode: 'SYSTEM_ERROR', errMsg: '迁移失败: ' + (e.message || '') }
    }
  }
}
