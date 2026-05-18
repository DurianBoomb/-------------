'use strict'

/**
 * pin-expiry 定时云函数
 * 阶段三：定时云函数——过期清理 + 内联战绩单生成
 *
 * 定时触发：每分钟一次
 *
 * 职责：
 * 1. 检测 pin-pool 中 expireAt < now 的过期文档 → 生成战绩单 → 更新槽位 → 删除
 * 2. 检测 survey-queue 中 enterAt + 30min < now 的超时记录 → 兜底清理
 *
 * 设计原则：
 * - generateCareer 内联实现，不跨云函数调用 pin-system，避免两层冷启动
 * - 条件删除保证幂等
 * - 每条文档独立 try-catch
 * - 最多处理 20 条/次
 */

const db = uniCloud.database()

// TODO: 迁移至 uni-config-center（与 pin-system 保持一致的配置源）
const PIN_CONFIG = {
  pool: {
    poolLifecycleMinutes: 13
  },
  queue: {
    queueExpireMinutes: 30,
    maxAccelCount: 3
  },
  career: {
    simulatedActiveUsers: 1000,
    viewFloatMin: 1.5,
    viewFloatMax: 3.0,
    clickRateMin: 0.05,
    clickRateMax: 0.15,
    favoriteRateMin: 0.05,
    favoriteRateMax: 0.20,
    bonusTriggerRate: 0.15,
    bonusMultiplierMin: 1.5,
    bonusMultiplierMax: 2.0,
    favoriteFloor: 0
  },
  seniority: {
    levels: [
      { level: 0, min: 0, max: 0, label: 'Lv.0 · 新人' },
      { level: 1, min: 1, max: 5, label: 'Lv.1 · 偶发者' },
      { level: 2, min: 6, max: 20, label: 'Lv.2 · 常客' },
      { level: 3, min: 21, max: null, label: 'Lv.3 · 老面孔' }
    ]
  }
}

// ==================== 引用的配置（简化引用路径） ====================
const CFG_CAREER = PIN_CONFIG.career
const CFG_SENIORITY = PIN_CONFIG.seniority
const CFG_POOL = PIN_CONFIG.pool
const CFG_QUEUE = PIN_CONFIG.queue

// 每批最多处理条数（防止超时）
const BATCH_MAX = 20

// 单文档连续失败阈值
const MAX_RETRY_FAILURES = 3

// ==================== 荣誉称号池 ====================

const HONOR_TITLES = [
  {
    id: 'lighthouse',
    name: '人群中的灯塔',
    desc: '被很多人看见，但只有少数人真正懂得欣赏。你是人群中的一座沉默灯塔。',
    condition: 'highViewsLowClick'
  },
  {
    id: 'center',
    name: '万众瞩目者',
    desc: '你站在那里，哪里就是焦点。你的问卷有着让人无法移开目光的魔力。',
    condition: 'highClickRate'
  },
  {
    id: 'archive_fav',
    name: '档案馆宠儿',
    desc: '你的每一份作品都值得被永久收藏。档案馆已将你的问卷列为馆藏珍品。',
    condition: 'highFavRate'
  },
  {
    id: 'dark_horse',
    name: '冷门黑马',
    desc: '不鸣则已，一鸣惊人。在无人注意的角落，你的问卷悄然引爆了流量。',
    condition: 'lowViewsHighClick'
  },
  {
    id: 'memes',
    name: '含梗量宗师',
    desc: '你的问卷里藏着十个段子王也接不住的梗。「含梗量检测」评级：SSS。',
    condition: 'randomMeme'
  },
  {
    id: 'creator',
    name: '内容创作者',
    desc: '稳定输出，质量在线。你的每一份问卷都在为这个平台贡献优质内容。',
    condition: 'default',
    weight: 1
  }
]

const BONUS_TITLES = [
  {
    id: 'bonus_flow',
    name: '破格流量获得者',
    desc: '本局特此破格授予——数据显示，该问卷在曝光期间经历了罕见的指数级扩散。',
    condition: 'bonus'
  },
  {
    id: 'bonus_click',
    name: '点爆者',
    desc: '本局特此破格授予——点击量数据在短时间内出现了非理性爆发，经技术核查，确认为自然传播。',
    condition: 'bonus_click'
  }
]

// 首次认证特殊称号
const DEBUT_TITLES = [
  {
    id: 'debut',
    name: '闪耀登场的新人',
    desc: '首份认证档案：这是你的第一份 15 分钟名人档案，一切才刚刚开始。',
    condition: 'debut'
  },
  {
    id: 'debut_high',
    name: '万众瞩目的首秀者',
    desc: '首秀即高光——你的第一次亮相就获得了远超平均的注视。前方等着你的，是更广阔的舞台。',
    condition: 'debut_high'
  }
]

// ==================== 档案附注语料池 ====================

const NOTE_TEMPLATES = {
  views_high: [
    '数据表明，该问卷在发布期间受到了广泛注目——驻足注视你的人，足以坐满一个中型剧场。',
    '你的问卷像一件展品，路过的人都忍不住多看了一眼。人群效应在此刻生效。',
    '高曝光时段内，你的问卷像一束信号塔，吸引了大量目光。'
  ],
  click_high: [
    '好奇心是人类的底层代码，你的问卷成功解码了它——打开率远超平均水平。',
    '几乎每个看见它的人，都忍不住点进去看了。你的标题功夫，本局予以认可。',
    '高打开率意味着你的问卷在人群中产生了真实的吸引力，而非仅仅被扫过。'
  ],
  fav_high: [
    '收藏是最好的赞美——有人把你的问卷放进了自己的宝库，不舍得让它沉没在时间线里。',
    '决定存档不是轻率的动作。你的内容值得被反复翻看，这是最具诚实的认可。'
  ],
  newcomer: [
    '首次认证档案：你的第一份 15 分钟名人档案，值得纪念。这个数字会一直增长的。',
    '第一次被世界看见，哪怕只有一次，也是从零到一的飞跃。记录此刻。'
  ],
  bonus: [
    '本局特此破格授予——如上数据显示，该问卷在曝光期间经历了罕见的指数级扩散。无法用常规算法解释。',
    '数据异常升高，经本局技术核查，排除人为干扰，确认为自然传播爆发。珍稀现象。'
  ],
  general: [
    '本次档案签发完毕。你的每一份问卷，都在书写属于你的微型成名史。',
    '本档已归档。期待你的下一次亮相。',
    '每一份档案都是一块基石。积累下去，你的名字会成为一个标签。',
    '本局注意到，你的问卷在 15 分钟的短暂舞台上完成了一次完整的「被看见」周期。'
  ]
}

const DISCLAIMER = '本档案由「15分钟名气管理局」自动生成。数据在真实基础上做了微量艺术加工。如有疑问，请勿联系——因为我们不存在。'

// ==================== 工具函数 ====================

/**
 * 生成 _id 后缀：_{时间戳}_{4位随机数}
 */
function genSuffix() {
  return `_${Date.now()}_${String(Math.random()).slice(2, 6)}`
}

/**
 * [min, max] 区间随机浮点数
 */
function randomBetween(min, max) {
  return min + Math.random() * (max - min)
}

/**
 * 将 exposureCount 映射到资历档位
 */
function getSeniorityLevel(exposureCount) {
  const levels = CFG_SENIORITY.levels || []
  for (const lv of levels) {
    if (exposureCount >= lv.min && (lv.max === null || exposureCount <= lv.max)) {
      return lv.level
    }
  }
  return 0
}

/**
 * 对数值做零头修饰：加/减一个微小的随机偏移量，产生"有零有整"的效果
 */
function Z(result) {
  const offset = Math.floor(Math.random() * 51) - 25 // -25 ~ 25
  return Math.max(1, result + offset)
}

// ==================== 计数器初始化 ====================

async function ensureCounter() {
  try {
    const counterRes = await db.collection('counter').doc('careerArchiveSeq').get()
    if (!counterRes.data || counterRes.data.length === 0) {
      await db.collection('counter').add({
        _id: 'careerArchiveSeq',
        seq: 0
      })
      console.log('[pin-expiry] 计数器 careerArchiveSeq 已初始化')
    }
  } catch (e) {
    console.error('[pin-expiry] 计数器初始化失败:', e)
  }
}

// ==================== 荣誉称号匹配 ====================

function matchHonorTitle(views, clicks, favorites, isBonus, careerNumber) {
  if (isBonus) {
    const randomBonus = Math.random() < 0.5 ? BONUS_TITLES[0] : BONUS_TITLES[1]
    return randomBonus
  }

  // 首秀称号
  if (careerNumber === 1) {
    if (views >= 500) return DEBUT_TITLES[1]
    return DEBUT_TITLES[0]
  }

  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0

  if (views > 3000 && clickRate < 0.08) return HONOR_TITLES[0] // 人群中的灯塔
  // 🔧 冷门黑马需在万众瞩目前判定：clickRate>0.25 会被 center(>0.2) 截胡
  if (views < 1000 && clickRate > 0.25) return HONOR_TITLES[3] // 冷门黑马
  if (clickRate > 0.2) return HONOR_TITLES[1] // 万众瞩目者
  if (favRate > 0.3) return HONOR_TITLES[2] // 档案馆宠儿
  if (Math.random() < 0.3) return HONOR_TITLES[4] // 含梗量宗师
  return HONOR_TITLES[5] // 内容创作者（兜底）
}

// ==================== 档案附注生成 ====================

function generateNote(views, clicks, favorites, isBonus, careerNumber) {
  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0

  const notes = []

  if (isBonus && NOTE_TEMPLATES.bonus.length > 0) {
    notes.push(NOTE_TEMPLATES.bonus[Math.floor(Math.random() * NOTE_TEMPLATES.bonus.length)])
  }

  if (careerNumber === 1 && NOTE_TEMPLATES.newcomer.length > 0) {
    notes.push(NOTE_TEMPLATES.newcomer[Math.floor(Math.random() * NOTE_TEMPLATES.newcomer.length)])
  }

  if (views > 2000 && NOTE_TEMPLATES.views_high.length > 0) {
    notes.push(NOTE_TEMPLATES.views_high[Math.floor(Math.random() * NOTE_TEMPLATES.views_high.length)])
  }

  if (clickRate > 0.18 && NOTE_TEMPLATES.click_high.length > 0) {
    notes.push(NOTE_TEMPLATES.click_high[Math.floor(Math.random() * NOTE_TEMPLATES.click_high.length)])
  }

  if (favRate > 0.25 && NOTE_TEMPLATES.fav_high.length > 0) {
    notes.push(NOTE_TEMPLATES.fav_high[Math.floor(Math.random() * NOTE_TEMPLATES.fav_high.length)])
  }

  // 如果未命中任何特定模板，补一句通用附注
  if (notes.length === 0 && NOTE_TEMPLATES.general.length > 0) {
    notes.push(NOTE_TEMPLATES.general[Math.floor(Math.random() * NOTE_TEMPLATES.general.length)])
  }

  // 加入免责声明
  notes.push('')
  notes.push(DISCLAIMER)

  return notes.join('\n')
}

// ==================== 战绩单数据生成 ====================

/**
 * 计算驻足注视（views）
 */
function calculateViews(pinDoc, seniorityLevel) {
  const views = Math.floor(randomBetween(CFG_CAREER.viewFloatMin, CFG_CAREER.viewFloatMax) * 300)
  // 反向补偿：资历越浅，浮动系数取上限概率越高
  const boostedViews = seniorityLevel <= 1
    ? Math.floor(views * randomBetween(1.2, 1.8))
    : views
  return Z(Math.max(100, boostedViews))
}

/**
 * 计算好奇打开（clicks）
 */
function calculateClicks(views, seniorityLevel) {
  let clickMin = CFG_CAREER.clickRateMin
  let clickMax = CFG_CAREER.clickRateMax
  // 反向补偿：资深历用户点击率范围下移
  if (seniorityLevel >= 3) {
    clickMin = Math.max(0.02, clickMin * 0.6)
    clickMax = Math.max(0.05, clickMax * 0.7)
  }
  if (seniorityLevel <= 1) {
    clickMin = Math.min(0.08, clickMin * 1.3)
    clickMax = Math.min(0.20, clickMax * 1.2)
  }
  const clickRate = randomBetween(clickMin, clickMax)
  return Z(Math.max(1, Math.floor(views * clickRate)))
}

/**
 * 计算决定存档（favorites）
 */
function calculateFavorites(clicks, seniorityLevel) {
  let favMin = CFG_CAREER.favoriteRateMin
  let favMax = CFG_CAREER.favoriteRateMax
  if (seniorityLevel <= 1) {
    favMin = Math.min(0.08, favMin * 1.3)
    favMax = Math.min(0.25, favMax * 1.2)
  }
  const favRate = randomBetween(favMin, favMax)
  const raw = Math.floor(clicks * favRate)
  // favoriteFloor = 0，不设强制保底，追求真实仿真
  return Math.max(CFG_CAREER.favoriteFloor, raw)
}

/**
 * 数据暴击判定
 */
function triggerBonus(views, clicks, seniorityLevel) {
  // Lv.0/Lv.1 暴击概率略微提高
  const actualRate = seniorityLevel <= 1
    ? Math.min(0.25, CFG_CAREER.bonusTriggerRate * 1.3)
    : CFG_CAREER.bonusTriggerRate

  if (Math.random() >= actualRate) return { triggered: false }

  // 优先暴击 views，其次 clicks
  const targetViews = Math.random() < 0.7
  const multiplier = randomBetween(CFG_CAREER.bonusMultiplierMin, CFG_CAREER.bonusMultiplierMax)

  if (targetViews) {
    return { triggered: true, field: 'views', multiplier }
  }
  return { triggered: true, field: 'clicks', multiplier }
}

/**
 * 一致性校验与修正
 */
function validateAndFix(views, clicks, favorites) {
  // 好奇打开 ≤ 驻足注视
  if (clicks > views) clicks = Math.floor(views * 0.8)

  // 决定存档 ≤ 好奇打开
  if (favorites > clicks) favorites = Math.floor(clicks * 0.8)

  // 所有数值为正整数
  views = Math.max(1, Math.floor(views))
  clicks = Math.max(1, Math.floor(clicks))
  favorites = Math.max(CFG_CAREER.favoriteFloor, Math.floor(favorites))

  return { views, clicks, favorites }
}

// ==================== 战绩单生成主逻辑 ====================

/**
 * 生成单条战绩单记录（内联实现，供 pin-expiry 定时触发调用）
 * @param {string} uid - 用户ID
 * @param {Object} pinDoc - pin-pool 过期文档
 * @returns {string|null} 新生成的 careerId，失败返回 null
 */
async function generateCareerRecord(uid, pinDoc) {
  try {
    // 1. 获取 counter 自增值
    await db.collection('counter').doc('careerArchiveSeq').update({
      seq: db.command.inc(1)
    })
    const counterRes = await db.collection('counter').doc('careerArchiveSeq').get()
    if (!counterRes.data || counterRes.data.length === 0) {
      console.error('[pin-expiry] 计数器读取失败，跳过 archiveNumber')
      return null
    }
    const seq = counterRes.data[0].seq
    const year = new Date(pinDoc.createdAt).getFullYear()
    const archiveNumber = `ZW-${year}-${String(seq).padStart(5, '0')}`

    // 2. 计算 careerNumber
    const careerNumber = (pinDoc.senioritySnapshot || 0) + 1

    // 3. 获取用户资历档位用于反向补偿
    const seniorityLevel = getSeniorityLevel(pinDoc.senioritySnapshot || 0)

    // 4. 计算三项核心数据
    let views = calculateViews(pinDoc, seniorityLevel)
    let clicks = calculateClicks(views, seniorityLevel)
    let favorites = calculateFavorites(clicks, seniorityLevel)

    // 5. 数据暴击判定
    const bonus = triggerBonus(views, clicks, seniorityLevel)
    let isBonus = bonus.triggered
    let bonusMultiplier = isBonus ? bonus.multiplier : 1.0
    if (isBonus) {
      if (bonus.field === 'views') {
        views = Math.floor(views * bonus.multiplier)
        // 暴击后更新 clicks 和 favorites（保持一致性）
        clicks = Math.min(clicks, Math.floor(views * 0.8))
        favorites = Math.min(favorites, Math.floor(clicks * 0.8))
      } else {
        clicks = Math.floor(clicks * bonus.multiplier)
        favorites = Math.min(favorites, Math.floor(clicks * 0.8))
      }
    }

    // 6. 一致性校验与修正
    const fixed = validateAndFix(views, clicks, favorites)
    views = fixed.views
    clicks = fixed.clicks
    favorites = fixed.favorites

    // 7. 荣誉称号匹配
    const honor = matchHonorTitle(views, clicks, favorites, isBonus, careerNumber)

    // 8. 档案附注生成
    const comment = generateNote(views, clicks, favorites, isBonus, careerNumber)

    // 9. 写入 career-records
    const suffix = genSuffix()
    const careerId = `career${suffix}`
    const now = Date.now()

    await db.collection('career-records').add({
      _id: careerId,
      userId: uid,
      surveyId: pinDoc.surveyId,
      pinId: pinDoc._id,
      careerNumber,
      archiveNumber,
      createdAt: now,
      stats: { views, clicks, favorites },
      bonusTriggered: isBonus,
      bonusMultiplier,
      honor: { id: honor.id, name: honor.name, desc: honor.desc },
      comment,
      surveyTitle: pinDoc.surveyTitle || pinDoc.surveyId,
      // 冗余字段，便于查阅
      isGreenChannel: pinDoc.isGreenChannel || false,
      haloActive: pinDoc.haloActive || false,
      senioritySnapshot: pinDoc.senioritySnapshot || 0
    })

    // 10. 标记用户未读档案
    await db.collection('uni-id-users').doc(uid).update({
      'career.hasUnread': true,
      'career.unreadCareerIds': db.command.push(careerId)
    })

    console.log(`[pin-expiry] 战绩单已生成: ${careerId} | ${archiveNumber} | ${honor.name} | views=${views} clicks=${clicks} fav=${favorites}`)

    return careerId
  } catch (e) {
    console.error('[pin-expiry] generateCareerRecord 失败:', e)
    return null
  }
}

// ==================== 处理过期 pin-pool 文档 ====================

async function processExpiredPins() {
  const now = Date.now()

  // 查询过期文档，最多 BATCH_MAX 条
  const pinRes = await db.collection('pin-pool').where({
    expireAt: { $lt: now }
  }).limit(BATCH_MAX).get()

  const expiredPins = pinRes.data || []
  if (expiredPins.length === 0) {
    return { processed: 0, success: 0, failed: 0, skipped: 0 }
  }

  console.log(`[pin-expiry] 发现 ${expiredPins.length} 条过期 pin-pool 文档`)

  let success = 0
  let failed = 0
  let skipped = 0

  for (const pinDoc of expiredPins) {
    try {
      // 1. 生成战绩单
      const careerId = await generateCareerRecord(pinDoc.userId, pinDoc)
      if (!careerId) {
        failed++
        console.error(`[pin-expiry] 文档 ${pinDoc._id} 战绩单生成失败，跳过`)
        continue
      }

      // 2. 更新对应槽位状态（active → claimable）
      try {
        const userRes = await db.collection('uni-id-users').doc(pinDoc.userId).get()
        if (userRes.data && userRes.data.length > 0) {
          const slots = userRes.data[0].career?.slots || []
          const slotIdx = slots.findIndex(s => s.pinId === pinDoc._id)
          if (slotIdx !== -1) {
            await db.collection('uni-id-users').doc(pinDoc.userId).update({
              [`career.slots.${slotIdx}`]: {
                status: 'claimable',
                surveyId: pinDoc.surveyId,
                pinId: pinDoc._id,
                queueId: null
              }
            })
          } else {
            console.warn(`[pin-expiry] 未找到匹配槽位: userId=${pinDoc.userId}, pinId=${pinDoc._id}`)
            // 槽位未找到不影响流程，继续删除
          }
        }
      } catch (slotErr) {
        console.error(`[pin-expiry] 更新槽位失败:`, slotErr)
        // 槽位更新失败不影响删除流程，但影响战绩单完整性
      }

      // 3. 条件删除 pin-pool 文档（幂等）
      const delRes = await db.collection('pin-pool').doc(pinDoc._id).remove()
      if (delRes.deleted > 0) {
        success++
      } else {
        skipped++ // 可能已被另一路径处理
      }
    } catch (e) {
      failed++
      console.error(`[pin-expiry] 处理过期文档 ${pinDoc._id} 失败:`, e)
    }
  }

  return { processed: expiredPins.length, success, failed, skipped }
}

// ==================== 处理超时候场记录 ====================

async function processExpiredQueues() {
  const now = Date.now()
  const expireThreshold = now - CFG_QUEUE.queueExpireMinutes * 60 * 1000

  // 查询超时记录
  const queueRes = await db.collection('survey-queue').where({
    enterAt: { $lt: expireThreshold }
  }).limit(BATCH_MAX).get()

  const expiredQueues = queueRes.data || []
  if (expiredQueues.length === 0) {
    return { processed: 0, autoPromoted: 0, deleted: 0, failed: 0 }
  }

  console.log(`[pin-expiry] 发现 ${expiredQueues.length} 条超时候场记录`)

  let autoPromoted = 0
  let deleted = 0
  let failed = 0

  for (const que of expiredQueues) {
    try {
      // 检查用户槽位状态
      const userRes = await db.collection('uni-id-users').doc(que.userId).get()
      let shouldDelete = true
      if (userRes.data && userRes.data.length > 0) {
        const slots = userRes.data[0].career?.slots || []
        const slotIdx = slots.findIndex(s => s.queueId === que._id)

        if (slotIdx !== -1 && slots[slotIdx].status === 'queuing') {
          // 槽位仍为 queuing → 自动调用 queueToPool
          shouldDelete = false
          try {
            // 内联 queueToPool 核心逻辑（避免跨云函数调用）
            await inlineQueueToPool(que.userId, que.surveyId, que._id)
            autoPromoted++
            console.log(`[pin-expiry] 超时候场自动入池: userId=${que.userId}, queueId=${que._id}`)
          } catch (qe) {
            failed++
            console.error(`[pin-expiry] 超时候场自动入池失败: userId=${que.userId}, queueId=${que._id}`, qe)
          }
        }
      }

      if (shouldDelete) {
        // 槽位已不是 queuing 或用户不存在 → 直接删除候场记录
        await db.collection('survey-queue').doc(que._id).remove()
        deleted++
      }
    } catch (e) {
      failed++
      console.error(`[pin-expiry] 处理超时候场记录 ${que._id} 失败:`, e)
    }
  }

  return { processed: expiredQueues.length, autoPromoted, deleted, failed }
}

/**
 * 内联 queueToPool 简化版（仅用于候场超时兜底）
 * 不包含完整 queueToPoolImpl 中的槽位搜索和全部校验，
 * 因为调用前已确认槽位为 queuing 状态
 */
async function inlineQueueToPool(uid, surveyId, queueId) {
  // 1. 幂等检查
  const queueRes = await db.collection('survey-queue').doc(queueId).get()
  if (!queueRes.data || queueRes.data.length === 0) return

  // 2. 读用户信息
  const userRes = await db.collection('uni-id-users').doc(uid).get()
  if (!userRes.data || userRes.data.length === 0) return
  const user = userRes.data[0]
  const exposureCount = user.career?.exposureCount ?? 0
  const slots = user.career?.slots || []

  // 3. 定位槽位
  const slotIdx = slots.findIndex(s => s.queueId === queueId)
  if (slotIdx === -1) return

  // 4. 获取问卷标题
  let surveyTitle = surveyId
  try {
    const surveyRes = await db.collection('surveys').doc(surveyId).get()
    if (surveyRes.data && surveyRes.data.length > 0) {
      surveyTitle = surveyRes.data[0].title || surveyRes.data[0].tagName || surveyId
    }
  } catch (e) { /* 兜底 */ }

  // 5. 写入 pin-pool（含登场光环）
  const suffix = genSuffix()
  const docId = `pin${suffix}`
  const now = Date.now()
  const expireAt = now + CFG_POOL.poolLifecycleMinutes * 60 * 1000
  const weight = 10000 // haloWeight

  // 取消该用户已有问卷的光环
  await db.collection('pin-pool').where({
    userId: uid,
    expireAt: { $gt: now }
  }).update({ haloActive: false })

  await db.collection('pin-pool').add({
    _id: docId, surveyId, userId: uid,
    surveyTitle, surveyCover: '',
    weight, createdAt: now, expireAt,
    senioritySnapshot: exposureCount,
    haloActive: true, isGreenChannel: false
  })

  // 6. 资历累加
  await db.collection('uni-id-users').doc(uid).update({
    'career.exposureCount': db.command.inc(1)
  })

  // 7. 删除候场记录
  await db.collection('survey-queue').doc(queueId).remove()

  // 8. 更新槽位
  await db.collection('uni-id-users').doc(uid).update({
    [`career.slots.${slotIdx}`]: {
      status: 'active', surveyId, pinId: docId, queueId: null
    }
  })

  // 9. 重算权重的简化版（跳过 recalcOwnWeights，仅更新本问卷 weight）
  // 光环问卷 weight 已是 haloWeight，不需要额外更新
  // 完整重算会在用户下次操作时触发
}

// ==================== 主入口 ====================

exports.main = async (event, context) => {
  const startTime = Date.now()
  console.log('[pin-expiry] 定时触发')

  try {
    // 1. 计数器兜底初始化
    await ensureCounter()

    // 2. 处理过期 pin-pool 文档
    const pinResult = await processExpiredPins()

    // 3. 处理超时候场记录
    const queueResult = await processExpiredQueues()

    const elapsed = Date.now() - startTime
    console.log(`[pin-expiry] 执行完成 | 耗时: ${elapsed}ms | 过期置顶: ${pinResult.processed} (成功${pinResult.success}/失败${pinResult.failed}) | 超时候场: ${queueResult.processed} (升池${queueResult.autoPromoted}/删除${queueResult.deleted}/失败${queueResult.failed})`)

    return {
      code: 0,
      elapsed,
      pinResult,
      queueResult
    }
  } catch (e) {
    console.error('[pin-expiry] 执行异常:', e)
    return {
      code: 1,
      message: e.message || '未知错误'
    }
  }
}
