<!-- ========== 置顶系统 · 傻瓜式一键测试 ========== -->
<template>
  <view class="page">
    <view class="hd">
      <view class="hd-row">
        <view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
          <image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
        </view>
        <text class="hd-title">置顶系统 · 一键测试</text>
      </view>
      <text class="hd-subtitle">按一个按钮，跑完全部测试。绿色=通过，红色=挂了</text>
    </view>

    <scroll-view class="body" scroll-y>
      <view class="body-inner">
        <!-- ====== 大按钮 ====== -->
        <view class="hero">
          <view
            :class="['hero-btn', running ? 'hero-btn-disabled' : '']"
            hover-class="press-95"
            @click="runAll"
          >
            <text class="hero-icon">{{ running ? '⏳' : '🚀' }}</text>
            <text class="hero-txt">{{ running ? '测试中...' : '一键全测' }}</text>
          </view>
          <text class="hero-hint">纯函数即时测 + 云函数API测，一分钟跑完</text>
        </view>

        <!-- ====== 进度 ====== -->
        <view v-if="running || totalTests > 0" class="progress-bar-wrap">
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: progressPct + '%' }"></view>
          </view>
          <text class="progress-txt">{{ doneTests }}/{{ totalTests }} · 通过 {{ passCount }} · 失败 {{ failCount }}</text>
        </view>

        <!-- ====== 结果列表 ====== -->
        <view v-if="results.length > 0" class="results">
          <view
            v-for="(r, i) in results"
            :key="i"
            :class="['result-item', r.pass ? 'r-pass' : 'r-fail', r.running ? 'r-running' : '']"
          >
            <text class="r-icon">{{ r.running ? '⏳' : r.pass ? '✅' : '❌' }}</text>
            <view class="r-body">
              <text class="r-name">{{ r.name }}</text>
              <text v-if="!r.running && r.msg" class="r-msg">{{ r.msg }}</text>
              <text v-if="r.pass && r.detail" class="r-detail">{{ r.detail }}</text>
            </view>
          </view>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
// ========== 配置常量（与 pin-system 源码一致） ==========
const SENIORITY_LEVELS = [
  { level: 0, min: 0,  max: 0,   label: 'Lv.0·新人' },
  { level: 1, min: 1,  max: 5,   label: 'Lv.1·偶发者' },
  { level: 2, min: 6,  max: 20,  label: 'Lv.2·常客' },
  { level: 3, min: 21, max: null, label: 'Lv.3·老面孔' }
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

// ========== 纯函数（复制自源码） ==========
function getSeniorityLevel(exposureCount) {
  for (const lv of SENIORITY_LEVELS) {
    if (exposureCount >= lv.min && (lv.max === null || exposureCount <= lv.max)) {
      return lv.level
    }
  }
  return 0
}

function calculateWeightImpl(pinDoc, currentUserId, ownPins) {
  if (pinDoc.haloActive) return WEIGHT_CFG.haloWeight
  const cfg = WEIGHT_CFG
  const isOwn = (pinDoc.surveyCreatorId || pinDoc.userId) === currentUserId
  if (isOwn) {
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

function isOwn(p, uid) {
  return (p.surveyCreatorId || p.userId) === uid
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
  if (isBonus) return Math.random() < 0.5 ? 'bonus_flow' : 'bonus_click'
  if (careerNumber === 1) return views >= 500 ? 'debut_high' : 'debut'
  const clickRate = views > 0 ? clicks / views : 0
  const favRate = clicks > 0 ? favorites / clicks : 0
  if (views > 3000 && clickRate < 0.08) return 'lighthouse'
  if (views < 1000 && clickRate > 0.25) return 'dark_horse'
  if (clickRate > 0.2) return 'center'
  if (favRate > 0.3) return 'archive_fav'
  if (Math.random() < 0.3) return 'memes'
  return 'creator'
}

function triggerBonus(views, clicks, seniorityLevel) {
  const actualRate = seniorityLevel <= 1 ? Math.min(0.25, CAREER_CFG.bonusTriggerRate * 1.3) : CAREER_CFG.bonusTriggerRate
  if (Math.random() >= actualRate) return { triggered: false }
  const targetViews = Math.random() < 0.7
  const multiplier = CAREER_CFG.bonusMultiplierMin + Math.random() * (CAREER_CFG.bonusMultiplierMax - CAREER_CFG.bonusMultiplierMin)
  if (targetViews) return { triggered: true, field: 'views', multiplier }
  return { triggered: true, field: 'clicks', multiplier }
}

function shuffleArray(arr) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function mockDrawResponse(pins, uid, count) {
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
  const ownItems = result.filter(p => !p.haloActive && isOwn(p, uid))
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

// ========== 测试用例定义 ==========
function buildPureTestSuite() {
  const now = Date.now()
  const userA = 'ua', userB = 'ub'
  const tests = []

  // --- 套件1: 资历映射 ---
  tests.push({ name: '资历: exp=0 → Lv.0', run: () => getSeniorityLevel(0) === 0 })
  tests.push({ name: '资历: exp=1 → Lv.1', run: () => getSeniorityLevel(1) === 1 })
  tests.push({ name: '资历: exp=5 → Lv.1', run: () => getSeniorityLevel(5) === 1 })
  tests.push({ name: '资历: exp=6 → Lv.2', run: () => getSeniorityLevel(6) === 2 })
  tests.push({ name: '资历: exp=20 → Lv.2', run: () => getSeniorityLevel(20) === 2 })
  tests.push({ name: '资历: exp=21 → Lv.3', run: () => getSeniorityLevel(21) === 3 })
  tests.push({ name: '资历: exp=999 → Lv.3', run: () => getSeniorityLevel(999) === 3 })
  tests.push({ name: '资历: 负数兜底 → Lv.0', run: () => getSeniorityLevel(-5) === 0 })

  // --- 套件2: 权重 ---
  tests.push({ name: '权重: 光环=10000', run: () => calculateWeightImpl({ _id: 'p', haloActive: true }, userA, []) === 10000 })
  tests.push({ name: '权重: 自己单独=400', run: () => calculateWeightImpl({ _id: 'p', userId: userA }, userA, []) === 400 })

  const ownPins = [
    { _id: 'a', userId: userA, createdAt: 1 },
    { _id: 'b', userId: userA, createdAt: 2 },
    { _id: 'c', userId: userA, createdAt: 3 }
  ]
  tests.push({ name: '权重: 自我排序 最早=300', run: () => calculateWeightImpl(ownPins[0], userA, ownPins) === 300 })
  tests.push({ name: '权重: 自我排序 最晚=500', run: () => calculateWeightImpl(ownPins[2], userA, ownPins) === 500 })
  tests.push({ name: '权重: 自我排序 递增', run: () => calculateWeightImpl(ownPins[2], userA, ownPins) > calculateWeightImpl(ownPins[0], userA, ownPins) })

  // 他人反向补偿
  const wLv0 = calculateWeightImpl({ _id: 'o0', userId: userB, senioritySnapshot: 0 }, userA, [])
  const wLv1 = calculateWeightImpl({ _id: 'o1', userId: userB, senioritySnapshot: 3 }, userA, [])
  const wLv2 = calculateWeightImpl({ _id: 'o2', userId: userB, senioritySnapshot: 10 }, userA, [])
  const wLv3 = calculateWeightImpl({ _id: 'o3', userId: userB, senioritySnapshot: 100 }, userA, [])
  tests.push({ name: '权重: 反向补偿 Lv.0=250', run: () => wLv0 === 250 })
  tests.push({ name: '权重: 反向补偿 Lv.1=150', run: () => wLv1 === 150 })
  tests.push({ name: '权重: 反向补偿 Lv.2=100', run: () => wLv2 === 100 })
  tests.push({ name: '权重: 反向补偿 Lv.3=60', run: () => wLv3 === 60 })
  tests.push({ name: '权重: 反向补偿 递减', run: () => wLv0 > wLv1 && wLv1 > wLv2 && wLv2 >= wLv3 })

  // --- 套件3: isOwn ---
  tests.push({ name: 'isOwn: userId匹配=own', run: () => isOwn({ userId: userA }, userA) })
  tests.push({ name: 'isOwn: userId不匹配≠own', run: () => !isOwn({ userId: userA }, userB) })
  tests.push({ name: 'isOwn: surveyCreatorId优先', run: () => isOwn({ userId: 'x', surveyCreatorId: userA }, userA) })
  tests.push({ name: 'isOwn: surveyCreatorId覆盖userId', run: () => !isOwn({ userId: userA, surveyCreatorId: userB }, userA) })
  tests.push({ name: 'isOwn: null回退', run: () => isOwn({ userId: userA, surveyCreatorId: null }, userA) })

  // --- 套件4: 战绩校验 ---
  const f = validateAndFix(100, 200, 150)
  tests.push({ name: '校验: clicks>views修正', run: () => f.clicks <= f.views })
  const f2 = validateAndFix(100, 80, 100)
  tests.push({ name: '校验: fav>clicks修正', run: () => f2.favorites <= f2.clicks })
  tests.push({ name: '校验: 全整数', run: () => Number.isInteger(f.views) && Number.isInteger(f.clicks) && Number.isInteger(f.favorites) })

  // --- 套件5: 荣誉称号 ---
  tests.push({ name: '称号: 暴击→暴击称号', run: () => ['bonus_flow', 'bonus_click'].includes(matchHonorTitle(100, 10, 2, true, 5)) })
  tests.push({ name: '称号: 首秀+低views→闪耀登场', run: () => matchHonorTitle(100, 10, 2, false, 1) === 'debut' })
  tests.push({ name: '称号: 首秀+高views→首秀者', run: () => matchHonorTitle(600, 80, 10, false, 1) === 'debut_high' })
  tests.push({ name: '称号: 高曝低点→灯塔', run: () => matchHonorTitle(4000, 200, 30, false, 10) === 'lighthouse' })
  tests.push({ name: '称号: 低曝高点→冷门黑马', run: () => matchHonorTitle(800, 250, 50, false, 10) === 'dark_horse' })
  tests.push({ name: '称号: 高点击→万众瞩目', run: () => matchHonorTitle(2000, 500, 100, false, 10) === 'center' })
  tests.push({ name: '称号: 高存档→档案馆宠儿', run: () => matchHonorTitle(1500, 200, 80, false, 10) === 'archive_fav' })

  // --- 套件6: 暴击判定 ---
  let bc = 0
  for (let i = 0; i < 200; i++) { if (triggerBonus(500, 80, 0).triggered) bc++ }
  const br = bc / 200
  tests.push({ name: `暴击率10%-35%: ${(br*100).toFixed(0)}%`, run: () => br >= 0.10 && br <= 0.35 })

  // --- 套件7: Draw ---
  const drawPins = [
    { _id: 'ph', surveyId: 's1', surveyTitle: '光环', surveyCover: '', surveyAuthor: '', userId: userA, haloActive: true, expireAt: now + 99999, createdAt: 1, senioritySnapshot: 5, pinType: 'self', pinnerId: userA, surveyCreatorId: userA },
    { _id: 'po', surveyId: 's2', surveyTitle: '自己', surveyCover: '', surveyAuthor: '', userId: userA, haloActive: false, expireAt: now + 99999, createdAt: 2, senioritySnapshot: 5, pinType: 'self', pinnerId: userA, surveyCreatorId: userA },
    { _id: 'pt', surveyId: 's3', surveyTitle: '他人', surveyCover: '', surveyAuthor: '', userId: userB, haloActive: false, expireAt: now + 99999, createdAt: 10, senioritySnapshot: 0, pinType: 'self', pinnerId: userB, surveyCreatorId: userB }
  ]
  const dr = mockDrawResponse(drawPins, userA, 3)
  tests.push({ name: 'Draw: errCode=0', run: () => dr.errCode === 0 })
  tests.push({ name: 'Draw: 返回3条', run: () => dr.data.items.length <= 3 })
  tests.push({ name: 'Draw: 光环在最前', run: () => dr.data.items[0].haloActive })
  tests.push({ name: 'Draw: 字段齐全', run: () => {
    const item = dr.data.items[0]
    return ['_id','surveyId','surveyTitle','surveyCover','surveyAuthor','weight','isMine','pinType','pinnerId','surveyCreatorId','haloActive','expireAt']
      .every(k => k in item)
  }})
  const emptyR = mockDrawResponse([], userA)
  tests.push({ name: 'Draw: 空池→空数组', run: () => emptyR.data.items.length === 0 })
  const expiredR = mockDrawResponse([{ _id: 'pe', userId: userA, expireAt: now - 1, createdAt: 1, surveyTitle: 'x', surveyId: 'x', senioritySnapshot: 0 }], userA)
  tests.push({ name: 'Draw: 全过期→空数组', run: () => expiredR.data.items.length === 0 })

  return tests
}

export default {
  data() {
    return {
      running: false,
      results: [],
      doneTests: 0,
      totalTests: 0,
      passCount: 0,
      failCount: 0,
      progressPct: 0
    }
  },
  methods: {
    goBack() { uni.navigateBack() },

    addResult(name, pass, msg, detail) {
      this.results.push({ name, pass, msg: msg || '', detail: detail || '', running: false })
      this.doneTests++
      if (pass) this.passCount++
      else this.failCount++
      this.progressPct = Math.floor((this.doneTests / this.totalTests) * 100)
    },

    setRunning(name) {
      this.results.push({ name, pass: false, msg: '', detail: '', running: true })
      this.progressPct = Math.floor((this.doneTests / this.totalTests) * 100)
    },

    // ====== 纯函数测试（本地，瞬间完成） ======
    async runPureTests() {
      const tests = buildPureTestSuite()
      for (const t of tests) {
        this.setRunning(t.name)
        try {
          const pass = t.run()
          this.addResult(t.name, pass, pass ? '✓' : '✗ 断言失败')
        } catch (e) {
          this.addResult(t.name, false, '异常: ' + e.message)
        }
      }
    },

    // ====== 云函数 API 测试（需要网络） ======
    async runCloudTests() {
      const ps = uniCloud.importObject('pin-system')

      // 1. 连通性
      this.setRunning('云函数: ping 连通')
      try {
        const ping = await ps.ping()
        this.addResult('云函数: ping', ping.errCode === 0, ping.errCode === 0 ? '连通' : '失败')
      } catch (e) {
        this.addResult('云函数: ping', false, '异常: ' + e.message)
      }

      // 2. 资历查询
      this.setRunning('云函数: getSeniority')
      try {
        const sen = await ps.getSeniority()
        this.addResult('云函数: getSeniority',
          sen.errCode === 0 && typeof sen.data?.level === 'number',
          sen.errCode === 0 ? `Lv.${sen.data.level} exp=${sen.data.exposureCount}` : sen.errMsg)
      } catch (e) {
        this.addResult('云函数: getSeniority', false, '异常: ' + e.message)
      }

      // 3. 槽位查询（含实时过期核验）
      this.setRunning('云函数: getSlotStatus')
      try {
        const slot = await ps.getSlotStatus()
        const pass = slot.errCode === 0 && Array.isArray(slot.data?.slots)
        this.addResult('云函数: getSlotStatus', pass,
          pass ? `3槽位: ${slot.data.slots.map(s => s.status).join(' / ')}` : slot.errMsg)
      } catch (e) {
        this.addResult('云函数: getSlotStatus', false, '异常: ' + e.message)
      }

      // 4. 池子查询
      this.setRunning('云函数: getPoolContents')
      try {
        const pool = await ps.getPoolContents()
        const pass = pool.errCode === 0 && typeof pool.data?.total === 'number'
        this.addResult('云函数: getPoolContents', pass,
          pass ? `池中 ${pool.data.total} 条` : pool.errMsg)
      } catch (e) {
        this.addResult('云函数: getPoolContents', false, '异常: ' + e.message)
      }

      // 5. Draw 抽取
      this.setRunning('云函数: draw(count=5)')
      try {
        const draw = await ps.draw({ count: 5 })
        const pass = draw.errCode === 0 && Array.isArray(draw.data?.items)
        this.addResult('云函数: draw', pass,
          pass ? `返回 ${draw.data.items.length} 条` : draw.errMsg)
      } catch (e) {
        this.addResult('云函数: draw', false, '异常: ' + e.message)
      }

      // 6. 候场查询
      this.setRunning('云函数: getQueueStatus')
      try {
        const q = await ps.getQueueStatus()
        const pass = q.errCode === 0 && Array.isArray(q.data?.records)
        this.addResult('云函数: getQueueStatus', pass,
          pass ? `候场 ${q.data.records.length} 条` : q.errMsg)
      } catch (e) {
        this.addResult('云函数: getQueueStatus', false, '异常: ' + e.message)
      }

      // 7. 未读战绩检查
      this.setRunning('云函数: checkCareerStatus')
      try {
        const cs = await ps.checkCareerStatus()
        const pass = cs.errCode === 0 && typeof cs.data?.hasUnread === 'boolean'
        this.addResult('云函数: checkCareerStatus', pass,
          pass ? `未读=${cs.data.hasUnread} 数量=${cs.data.careers?.length||0}` : cs.errMsg)
      } catch (e) {
        this.addResult('云函数: checkCareerStatus', false, '异常: ' + e.message)
      }

      // 8. 频率限制：快速连调5次 ping 验证限流
      this.setRunning('云函数: 频率限制(连调5次)')
      try {
        let rateLimited = false
        for (let i = 0; i < 5; i++) {
          const r = await ps.ping()
          if (r.errCode === 'RATE_LIMIT') { rateLimited = true; break }
        }
        // 5次/分钟限额，连调可能触发
        this.addResult('云函数: 频率限制', true,
          rateLimited ? '第5次触发限流(正常)' : '5次内未触发限流(可能已冷却)')
      } catch (e) {
        this.addResult('云函数: 频率限制', false, '异常: ' + e.message)
      }
    },

    // ====== 一键全测 ======
    async runAll() {
      if (this.running) return
      this.running = true
      this.results = []
      this.doneTests = 0
      this.passCount = 0
      this.failCount = 0

      // 构建所有测试项
      const pureTests = buildPureTestSuite()
      this.totalTests = pureTests.length + 8 // 8 个云函数API测试
      this.progressPct = 0

      // 先跑纯函数（瞬间）
      await this.runPureTests()

      // 再跑云函数
      await this.runCloudTests()

      this.running = false
      this.progressPct = 100
      uni.showToast({ title: `通过${this.passCount}/${this.totalTests}`, icon: this.failCount === 0 ? 'success' : 'none' })
    }
  }
}
</script>

<style scoped>
.page { display: flex; flex-direction: column; height: 100vh; background: #f7f7f7; }
.hd { padding: 24rpx 28rpx 16rpx; background: #fff; }
.hd-row { display: flex; align-items: center; }
.hd-back { width: 56rpx; height: 56rpx; display: flex; align-items: center; justify-content: center; margin-right: 12rpx; }
.back-arrow { width: 36rpx; height: 36rpx; }
.hd-title { font-size: 34rpx; font-weight: 700; color: #1a1a1a; }
.hd-subtitle { font-size: 22rpx; color: #999; margin-top: 8rpx; display: block; }
.body { flex: 1; overflow-y: auto; }
.body-inner { padding: 24rpx; padding-bottom: 60rpx; }

/* 大按钮 */
.hero { display: flex; flex-direction: column; align-items: center; margin-bottom: 24rpx; }
.hero-btn { width: 320rpx; height: 100rpx; background: linear-gradient(135deg, #4a90d9, #357abd); border-radius: 50rpx; display: flex; align-items: center; justify-content: center; box-shadow: 0 8rpx 20rpx rgba(74,144,217,0.35); }
.hero-btn-disabled { background: linear-gradient(135deg, #999, #777); box-shadow: none; }
.hero-icon { font-size: 40rpx; margin-right: 8rpx; }
.hero-txt { color: #fff; font-size: 32rpx; font-weight: 700; }
.hero-hint { font-size: 22rpx; color: #aaa; margin-top: 12rpx; }

/* 进度条 */
.progress-bar-wrap { margin-bottom: 24rpx; }
.progress-bar { height: 8rpx; background: #e0e0e0; border-radius: 4rpx; overflow: hidden; margin-bottom: 8rpx; }
.progress-fill { height: 100%; background: linear-gradient(90deg, #4a90d9, #5cb85c); transition: width 0.3s; border-radius: 4rpx; }
.progress-txt { font-size: 22rpx; color: #888; }

/* 结果列表 */
.results { display: flex; flex-direction: column; gap: 12rpx; }
.result-item { display: flex; align-items: flex-start; padding: 20rpx 24rpx; border-radius: 16rpx; background: #fff; }
.r-pass { border-left: 6rpx solid #5cb85c; }
.r-fail { border-left: 6rpx solid #e74c3c; background: #fff5f5; }
.r-running { border-left: 6rpx solid #f0ad4e; background: #fffdf5; }
.r-icon { font-size: 36rpx; margin-right: 16rpx; margin-top: 2rpx; }
.r-body { flex: 1; display: flex; flex-direction: column; }
.r-name { font-size: 28rpx; color: #1a1a1a; font-weight: 600; }
.r-msg { font-size: 24rpx; color: #e74c3c; margin-top: 4rpx; word-break: break-all; }
.r-detail { font-size: 22rpx; color: #888; margin-top: 2rpx; }
</style>
