<!-- ========== 置顶系统监控面板 ========== -->
<template>
	<view class="page">
		<view class="head">
			<view class="head-row">
				<view class="back-btn" hover-class="press-95" @click="goBack">
					<text class="back-arrow">←</text>
				</view>
				<view class="head-info">
					<text class="head-title">📡 置顶系统监控</text>
					<text class="head-sub">池子 · 候场 · 槽位 · 资历</text>
				</view>
			</view>
		</view>

		<!-- Tab 切换 -->
		<view class="tabs">
			<view
				v-for="tab in tabs" :key="tab.key"
				:class="['tab', activeTab === tab.key ? 'tab-active' : '']"
				@click="activeTab = tab.key"
			>
				<text>{{ tab.label }}</text>
			</view>
		</view>

		<!-- ====== 置顶池 ====== -->
		<view v-if="activeTab === 'pool'" class="panel">
			<view class="panel-hd">
				<text class="panel-title">🎯 置顶池 ({{ poolTotal }})</text>
				<view class="panel-actions">
					<text class="panel-refresh" @click="loadPool">🔄 刷新</text>
				</view>
			</view>

			<view v-if="poolLoading" class="loading-msg">加载中...</view>

			<view v-else-if="poolPins.length === 0" class="empty-msg">
				<text>池子为空 — 还没有任何问卷在置顶中</text>
				<text class="empty-hint">去「测试置顶」tab 发一条试试</text>
			</view>

			<view v-else class="card-list">
				<view v-for="p in poolPins" :key="p._id" class="pool-card">
					<view class="pool-card-top">
						<text class="pool-card-title">{{ p.surveyTitle || '无标题' }}</text>
						<view v-if="p.haloActive" class="badge badge-halo">光环</view>
						<view :class="['badge', p.pinType === 'promote' ? 'badge-promote' : 'badge-self']">
							{{ p.pinType === 'promote' ? '推广' : '自置顶' }}
						</view>
					</view>
					<view class="pool-card-info">
						<text>ID: {{ p._id }}</text>
						<text>surveyId: {{ p.surveyId }}</text>
					</view>
					<view class="pool-card-stats">
						<text>权重: {{ p.weight }}</text>
						<text>剩余: {{ p.remainingMinutes }}分钟</text>
						<text>作者: {{ p.surveyAuthor || '匿名' }}</text>
					</view>
					<view class="pool-card-meta">
						<text>创建: {{ formatTime(p.createdAt) }}</text>
						<text>过期: {{ formatTime(p.expireAt) }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- ====== 候场区 ====== -->
		<view v-if="activeTab === 'queue'" class="panel">
			<view class="panel-hd">
				<text class="panel-title">⏳ 候场区 ({{ queueRecords.length }})</text>
				<view class="panel-actions">
					<text class="panel-refresh" @click="loadQueue">🔄 刷新</text>
				</view>
			</view>

			<view v-if="queueLoading" class="loading-msg">加载中...</view>

			<view v-else-if="queueRecords.length === 0" class="empty-msg">
				<text>候场区为空 — 没有正在排队的问卷</text>
			</view>

			<view v-else class="card-list">
				<view v-for="q in queueRecords" :key="q.queueId" class="queue-card">
					<view class="queue-card-top">
						<text class="queue-card-id">{{ q.queueId }}</text>
						<view :class="['badge', q.status === 'completed' ? 'badge-done' : 'badge-waiting']">
							{{ q.status === 'completed' ? '✓ 完成' : q.status === 'auto_pool_failed' ? '✗ 失败' : '排队中' }}
						</view>
					</view>
					<view class="queue-card-info">
						<text>surveyId: {{ q.surveyId }}</text>
						<text v-if="q.currentPhase">阶段: {{ q.currentPhase }}</text>
					</view>
					<view class="queue-card-stats">
						<text>加速: {{ q.acceleratedCount || 0 }}/{{ q.maxAccelCount || 3 }}</text>
						<text>资历Lv: {{ q.seniorityLevel || 0 }}</text>
						<text v-if="q.pinType">类型: {{ q.pinType }}</text>
					</view>
					<view v-if="q.enterAt" class="queue-card-meta">
						<text>进入: {{ formatTime(q.enterAt) }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- ====== 槽位状态 ====== -->
		<view v-if="activeTab === 'slots'" class="panel">
			<view class="panel-hd">
				<text class="panel-title">📦 用户槽位</text>
				<view class="panel-actions">
					<text class="panel-refresh" @click="loadSlots">🔄 刷新</text>
				</view>
			</view>

			<view v-if="slotLoading" class="loading-msg">加载中...</view>

			<view v-else>
				<!-- 资历 -->
				<view class="seniority-card">
					<text class="seniority-label">曝光资历</text>
					<text class="seniority-value">{{ seniority.label || '加载中...' }}</text>
					<text class="seniority-count">累计曝光 {{ seniority.exposureCount || 0 }} 次</text>
					<text v-if="seniority.nextLevelAt !== null" class="seniority-next">下一级还需 {{ seniority.nextLevelAt - (seniority.exposureCount || 0) }} 次</text>
				</view>

				<!-- 槽位 -->
				<view class="slot-grid">
					<view v-for="(slot, idx) in slots" :key="idx" :class="['slot-card', 'slot-' + (slot.status || 'unknown')]">
						<text class="slot-idx">槽位 {{ idx + 1 }}</text>
						<text class="slot-status">{{ slotStatusText(slot.status) }}</text>
						<text v-if="slot.surveyId" class="slot-survey">{{ slot.surveyId }}</text>
						<text v-if="slot.pinId" class="slot-pin">{{ slot.pinId }}</text>
					</view>
					<view v-if="slots.length === 0" class="empty-msg">
						<text>无槽位数据 — 用户可能还未登录或无 career 字段</text>
					</view>
				</view>
			</view>
		</view>

		<!-- ====== 测试置顶 ====== -->
		<view v-if="activeTab === 'test'" class="panel">
			<view class="panel-hd">
				<text class="panel-title">🧪 测试置顶</text>
			</view>

			<view class="test-form">
				<text class="test-label">问卷 SurveyId</text>
				<input
					class="test-input"
					v-model="testSurveyId"
					placeholder="输入 surveyId（如 _migration_test_）"
				/>

				<view class="test-btns">
					<view class="btn btn-pin" hover-class="btn-press" @click="doTestPin">
						<text>📺 看广告置顶</text>
					</view>
					<view class="btn btn-pin btn-direct" hover-class="btn-press" @click="doDirectPin">
						<text>⚡ 直接入池（跳过广告）</text>
					</view>
				</view>

			<text class="test-hint">
				点击后自动刷新池子和候场区数据
			</text>

			<!-- 造他人数据 -->
			<view class="test-form" style="margin-top:20rpx;">
				<text class="test-label">🔮 造他人数据（测试首页 draw）</text>
				<view class="test-btns">
					<view class="btn btn-draw" hover-class="btn-press" @click="seedMockPins">
						<text>🚀 一键造 10 个他人的卡片</text>
					</view>
					<view class="btn btn-draw-all" hover-class="btn-press" @click="cleanMockPins">
						<text>🧹 清理模拟数据</text>
					</view>
				</view>
				<text class="test-hint">造完后切到「置顶池」Tab 查看，回到首页看置顶栏</text>
			</view>
			</view>

			<!-- 操作日志 -->
			<view class="test-log">
				<view class="test-log-hd">
					<text class="test-log-title">📋 操作日志</text>
					<text class="test-log-clear" @click="testLogs = []">清空</text>
				</view>
				<scroll-view class="test-log-box" scroll-y>
					<text v-for="(l, i) in testLogs" :key="i" :class="['log-line', 'log-' + l.type]">{{ l.text }}</text>
					<text v-if="testLogs.length === 0" class="log-empty">暂无操作记录</text>
				</scroll-view>
			</view>
		</view>

		<!-- ====== 安全测试（批量） ====== -->
		<view v-if="activeTab === 'safety'" class="panel">
			<view class="panel-hd">
				<text class="panel-title">🛡️ 批量安全测试</text>
				<text class="panel-sub">去重 · 槽位 · 资格检查</text>
			</view>

			<view class="test-hint" style="margin-bottom:20rpx;">
				自动运行全部用例，不需要手动输入 surveyId。运行前会自动清理。
			</view>

			<view class="test-btns" style="margin-bottom:24rpx;">
				<view class="btn btn-pin" hover-class="btn-press" @click="runSafetyTests" :style="{ opacity: safetyRunning ? 0.5 : 1 }">
					<text>{{ safetyRunning ? '⏳ 运行中...' : '▶ 运行全部测试' }}</text>
				</view>
				<view class="btn btn-direct" hover-class="btn-press" @click="safetyResults = []; safetyPassed = 0; safetyFailed = 0">
					<text>清空结果</text>
				</view>
			</view>

			<!-- 汇总 -->
			<view v-if="safetyResults.length > 0" class="safety-summary" :class="safetyFailed === 0 ? 'safety-all-pass' : 'safety-has-fail'">
				<text class="safety-summary-title">{{ safetyFailed === 0 ? '✅ 全部通过' : '⚠️ 有失败项' }}</text>
				<text class="safety-summary-detail">通过 {{ safetyPassed }} / 共 {{ safetyTotal }}，失败 {{ safetyFailed }}</text>
			</view>

			<!-- 逐条结果 -->
			<view v-if="safetyResults.length > 0" class="card-list">
				<view v-for="(r, i) in safetyResults" :key="i" :class="['pool-card', r.passed ? 'safety-pass' : 'safety-fail']">
					<view class="pool-card-top">
						<text class="pool-card-title">{{ r.passed ? '✅' : '❌' }} {{ r.name }}</text>
					</view>
					<view class="pool-card-info">
						<text>{{ r.detail }}</text>
					</view>
					<view v-if="r.expected && r.actual" class="pool-card-stats" style="font-size:20rpx; color:#99A1AF;">
						<text>预期: {{ r.expected }} | 实际: {{ r.actual }}</text>
					</view>
				</view>
			</view>
		</view>

		<!-- ====== Draw 测试 ====== -->
		<view v-if="activeTab === 'draw'" class="panel">
			<view class="panel-hd">
				<text class="panel-title">🎲 Draw 测试 — 模拟首页置顶栏</text>
				<view class="panel-actions">
					<text class="panel-refresh" @click="doDraw">🔄 执行 Draw</text>
				</view>
			</view>

			<text class="draw-hint">调用 ps.draw({ count: 5 })，模拟置顶栏实际拿到的数据</text>

			<view class="draw-btns">
				<view class="btn btn-draw" hover-class="btn-press" @click="doDraw">▶ 执行 Draw (count=5)</view>
				<view class="btn btn-draw btn-draw-all" hover-class="btn-press" @click="doDrawAll">▶ 执行 Draw (count=50)</view>
			</view>

			<view v-if="drawLoading" class="loading-msg">Draw 中...</view>

			<view v-else-if="drawResult !== null">
				<view class="draw-summary">
					<text>返回 {{ drawItems.length }} 条 (总池子 {{ poolTotal }} 条), count={{ drawCount }}</text>
					<text v-if="drawItems.length === 0 && poolTotal > 0" class="draw-warn">
						⚠ 池子有数据但 Draw 返回空！检查 pin-system 云对象日志
					</text>
				</view>

				<view v-if="drawItems.length > 0" class="card-list">
					<view v-for="d in drawItems" :key="d._id" class="pool-card">
						<view class="pool-card-top">
							<text class="pool-card-title">{{ d.surveyTitle || '无标题' }}</text>
							<view v-if="d.haloActive" class="badge badge-halo">光环</view>
							<view v-if="d.isMine" class="badge badge-self">我的</view>
							<view :class="['badge', d.pinType === 'promote' ? 'badge-promote' : 'badge-self']">
								{{ d.pinType === 'promote' ? '推广' : '自置顶' }}
							</view>
						</view>
						<view class="pool-card-info">
							<text>ID: {{ d._id }}</text>
							<text>surveyId: {{ d.surveyId }}</text>
						</view>
						<view class="pool-card-stats">
							<text>权重: {{ d.weight }}</text>
							<text>作者: {{ d.surveyAuthor || '匿名' }}</text>
							<text v-if="d.surveyCover">封面: 有</text>
						</view>
					</view>
				</view>
			</view>
		</view>

		<view class="bottom-spacer"></view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			activeTab: 'pool',
			tabs: [
				{ key: 'pool', label: '置顶池' },
				{ key: 'queue', label: '候场区' },
				{ key: 'slots', label: '槽位' },
				{ key: 'draw', label: 'Draw测试' },
				{ key: 'test', label: '测试置顶' },
				{ key: 'safety', label: '安全测试' }
			],

			// 置顶池
			poolPins: [],
			poolTotal: 0,
			poolLoading: false,

			// 候场区
			queueRecords: [],
			queueLoading: false,

			// 槽位 + 资历
			slots: [],
			seniority: {},
			slotLoading: false,

			// 测试置顶
			testSurveyId: '',
			testLogs: [],

			// Draw 测试
			drawResult: null,
			drawItems: [],
			drawCount: 5,
			drawLoading: false,

			// 安全测试（批量）
			safetyRunning: false,
			safetyResults: [],
			safetyTotal: 0,
			safetyPassed: 0,
			safetyFailed: 0,
			safetySurveyIdBase: '_safety_test_'
		}
	},
	onShow() {
		this.loadAll()
	},
	methods: {
		goBack() {
			const pages = getCurrentPages()
			if (pages.length > 1) {
				uni.navigateBack()
			} else {
				uni.navigateTo({ url: '/pages/index/index' })
			}
		},
		addLog(text, type) {
			const time = new Date().toLocaleTimeString()
			this.testLogs.unshift({ text: `[${time}] ${text}`, type: type || 'info' })
		},

		async loadAll() {
			await Promise.all([this.loadPool(), this.loadQueue(), this.loadSlots()])
		},

		// ====== 置顶池 ======
		async loadPool() {
			this.poolLoading = true
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getPoolContents()
				if (res.errCode === 0 && res.data) {
					this.poolPins = res.data.pins || []
					this.poolTotal = res.data.total || 0
				} else {
					this.addLog('池子查询失败: ' + (res.errMsg || ''), 'error')
				}
			} catch (e) {
				this.addLog('池子查询异常: ' + (e.message || ''), 'error')
			}
			this.poolLoading = false
		},

		// ====== 候场区 ======
		async loadQueue() {
			this.queueLoading = true
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getQueueStatus()
				if (res.errCode === 0 && res.data) {
					this.queueRecords = res.data.records || []
				} else {
					this.addLog('候场查询失败: ' + (res.errMsg || ''), 'error')
				}
			} catch (e) {
				this.addLog('候场查询异常: ' + (e.message || ''), 'error')
			}
			this.queueLoading = false
		},

		// ====== 槽位 + 资历 ======
		async loadSlots() {
			this.slotLoading = true
			try {
				const ps = uniCloud.importObject('pin-system')
				const [slotRes, senRes] = await Promise.all([
					ps.getSlotStatus(),
					ps.getSeniority()
				])
				if (slotRes.errCode === 0 && slotRes.data) {
					this.slots = slotRes.data.slots || []
				}
				if (senRes.errCode === 0 && senRes.data) {
					this.seniority = senRes.data
				}
			} catch (e) {
				this.addLog('槽位查询异常: ' + (e.message || ''), 'error')
			}
			this.slotLoading = false
		},

		// ====== 测试置顶 ======
		async doTestPin() {
			const sid = this.testSurveyId.trim()
			if (!sid) {
				uni.showToast({ title: '请输入 surveyId', icon: 'none' })
				return
			}
			this.addLog(`▶ 发起置顶: ${sid}`, 'info')
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.handleAdReward({ scene: 'first_pin', surveyId: sid, adDuration: 20000 })
				this.addLog(`响应: action=${res.action}`, res.action === 'direct_entry' ? 'success' : 'warn')
				if (res.action === 'direct_entry') {
					this.addLog('✅ 直接入池成功', 'success')
				} else if (res.action === 'enter_queue') {
					this.addLog('📥 进入候场区', 'warn')
				}
			} catch (e) {
				this.addLog('置顶异常: ' + (e.message || ''), 'error')
			}
			// 自动刷新
			await this.loadAll()
			this.addLog('🔄 数据已刷新', 'info')
		},

		async doDirectPin() {
			const sid = this.testSurveyId.trim()
			if (!sid) {
				uni.showToast({ title: '请输入 surveyId', icon: 'none' })
				return
			}
			this.addLog(`▶ 直接入池: ${sid}`, 'info')
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.handleAdReward({ scene: 'first_pin', surveyId: sid, adDuration: 20000 })
				this.addLog(`响应: action=${res.action}`, res.action === 'direct_entry' ? 'success' : 'warn')
				if (res.action === 'direct_entry') {
					this.addLog('✅ 直接入池成功', 'success')
				} else if (res.action === 'enter_queue') {
					this.addLog('📥 进入候场区 - 原因可能是池满或槽位占用', 'warn')
				}
			} catch (e) {
				this.addLog('入池异常: ' + (e.message || ''), 'error')
			}
			await this.loadAll()
			this.addLog('🔄 数据已刷新', 'info')
		},

		// ====== 造他人模拟数据 ======
		async seedMockPins() {
			this.addLog('🔮 造 10 个他人模拟数据...', 'info')
			const fakes = [
				{ surveyId: 'mock_1', surveyTitle: '你是哪种奶茶人格？',   surveyCover: '', exposureCount: 2 },
				{ surveyId: 'mock_2', surveyTitle: '朋克养生等级测试',   surveyCover: '', exposureCount: 8 },
				{ surveyId: 'mock_3', surveyTitle: '你的MBTI过期了吗',    surveyCover: '', exposureCount: 0 },
				{ surveyId: 'mock_4', surveyTitle: '淀粉肠指数检测',     surveyCover: '', exposureCount: 15 },
				{ surveyId: 'mock_5', surveyTitle: '社交电池容量评估',   surveyCover: '', exposureCount: 3 },
				{ surveyId: 'mock_6', surveyTitle: '你到底多能扛揍',     surveyCover: '', exposureCount: 22 },
				{ surveyId: 'mock_7', surveyTitle: '摸鱼等级资格考试',   surveyCover: '', exposureCount: 1 },
				{ surveyId: 'mock_8', surveyTitle: '焦虑指数速查表',     surveyCover: '', exposureCount: 6 },
				{ surveyId: 'mock_9', surveyTitle: '你适合养什么宠物',   surveyCover: '', exposureCount: 0 },
				{ surveyId: 'mock_10', surveyTitle: '深夜emo自测量表',    surveyCover: '', exposureCount: 10 }
			]
			try {
				const ps = uniCloud.importObject('pin-system')
				const pins = fakes.map((f, i) => ({ ...f, userId: `fake_user_${String(i + 1).padStart(3, '0')}`, nickname: `测试用户${i + 1}` }))
				const res = await ps.testSeedMockPins({ pins })
				this.addLog(`✅ 已造 ${res.data?.inserted || 0} 条`, 'success')
			} catch (e) {
				this.addLog('造数据异常: ' + (e.message || ''), 'error')
			}
			await this.loadAll()
		},
		async cleanMockPins() {
			this.addLog('🧹 清理模拟数据...', 'info')
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.testCleanMockPins()
				this.addLog(`✅ 已清理 ${res.data?.deleted || 0} 条`, 'success')
			} catch (e) {
				this.addLog('清理异常: ' + (e.message || ''), 'error')
			}
			await this.loadAll()
		},

		// ====== 批量安全测试 ======
		async runSafetyTests() {
			if (this.safetyRunning) return
			this.safetyRunning = true
			this.safetyResults = []
			this.safetyPassed = 0
			this.safetyFailed = 0

			const ps = uniCloud.importObject('pin-system')
			const base = this.safetySurveyIdBase

			// --- 用例函数 ---
			const record = (name, passed, detail, expected, actual) => {
				this.safetyResults.push({ name, passed, detail, expected, actual })
				this.safetyTotal++
				if (passed) this.safetyPassed++
				else this.safetyFailed++
			}

			// 清理
			try { await ps.testResetSlots(); await ps.testCleanTestSurveys() } catch (_) {}

			const uniqueId = `${base}${Date.now()}`
			const sidA = uniqueId + '_a'  // 正常
			const sidB = uniqueId + '_b'  // pool
			const sidC = uniqueId + '_c'  // queue
			const sidD = uniqueId + '_d'  // dupe

			// 1) 创建问卷
			try {
				const sr = await ps.testEnsureSurveys({ surveyIds: [sidA, sidB, sidC, sidD] })
				if ((sr.data?.created || []).length !== 4) {
					this.addLog('问卷创建不完整', 'error'); this.safetyRunning = false; return
				}
			} catch (e) { this.addLog('创建异常: '+(e.message||''), 'error'); this.safetyRunning = false; return }

			const run = async (name, fn, expected) => {
				try {
					const r = await fn()
					record(name, r.errCode === expected, r.errMsg || '', expected, r.errCode)
				} catch (e) {
					// uniCloud 客户端框架会把非 0 的 errCode 包装成异常抛出
					// 从异常中提取 errCode 和 errMsg
					const code = e.errCode || e.code || '异常'
					const msg  = e.errMsg || e.message || '异常'
					if (String(code) === String(expected)) {
						// 业务拦截正确
						record(name, true, msg, expected, code)
					} else {
						record(name, false, `异常: ${msg}`, expected, code)
					}
				}
			}

			// --- 先跑不依赖状态的 ---
			await run('1. 正常通过',   () => ps.checkPinEligibility({ surveyId: sidA }), 0)
			await run('2. 空surveyId',  () => ps.checkPinEligibility({ surveyId: '' }),   'INVALID_PARAM')

			// --- 构造 pool + queue ---
			try { await ps.testSeedSafetyState({ poolSurveyIds: [sidB], queueSurveyIds: [sidC] }) }
			catch (e) { this.addLog('状态异常: '+(e.message||''), 'error'); this.safetyRunning = false; return }
			await run('3. 已在置顶池', () => ps.checkPinEligibility({ surveyId: sidB }), 'ALREADY_IN_POOL')
			await run('4. 已在候场区', () => ps.checkPinEligibility({ surveyId: sidC }), 'ALREADY_IN_QUEUE')

			// --- 填满槽位 ---
			try { await ps.testResetSlots() } catch (_) {}
			try { await ps.testSeedSafetyState({ fillSlotIds: [sidA, sidB, sidC] }) }
			catch (e) { this.addLog('槽位异常: '+(e.message||''), 'error'); this.safetyRunning = false; return }
			await run('5. 槽位已满', () => ps.checkPinEligibility({ surveyId: sidD }), 'SLOTS_FULL')

			// --- dupe 兜底：需 idle 槽位 ---
			try { await ps.testResetSlots() } catch (_) {}
			try {
				const r1 = await ps.handleAdReward({ scene: 'first_pin', surveyId: sidD, adDuration: 20000 })
				// 第二次调用应该被拦截（走 enterPoolImpl 内部去重兜底）
				let r2Code = 'OK', r2Msg = ''
				try {
					const r2 = await ps.handleAdReward({ scene: 'first_pin', surveyId: sidD, adDuration: 20000 })
					r2Code = r2.errCode
					r2Msg = r2.errMsg
				} catch (e2) {
					r2Code = e2.errCode || e2.code || '异常'
					r2Msg = e2.errMsg || e2.message || ''
				}
				const ok = r1.errCode === 0 && (r2Code === 'ALREADY_IN_POOL' || r2Code === 'SLOTS_FULL')
				record('6. dupe兜底', ok, `1st=${r1.errCode} 2nd=${r2Code}: ${r2Msg}`, '第2次拦截', r2Code)
			} catch (e) { record('6. dupe兜底', false, e.message || '异常', '第2次拦截', '异常') }

			// --- 重置回归 ---
			try { await ps.testResetSlots() } catch (_) {}
			await run('7. 重置后正常', () => ps.checkPinEligibility({ surveyId: sidA }), 0)

			// 清理
			try { await ps.testResetSlots(); await ps.testCleanTestSurveys() } catch (_) {}

			this.safetyRunning = false
			await this.loadAll()
			this.addLog(`🛡️ 安全测试完成：${this.safetyPassed}/${this.safetyTotal} 通过`, this.safetyFailed === 0 ? 'success' : 'warn')
		},

		// ====== Draw 测试 ======
		async doDraw() { await this._execDraw(5) },
		async doDrawAll() { await this._execDraw(50) },
		async _execDraw(count) {
			this.drawLoading = true
			this.drawCount = count
			try {
				const ps = uniCloud.importObject('pin-system')
				this.drawResult = await ps.draw({ count })
				this.drawItems = (this.drawResult && this.drawResult.data && this.drawResult.data.items) || []
				this.addLog(`Draw(count=${count}): 返回 ${this.drawItems.length} 条`, this.drawItems.length > 0 ? 'success' : 'warn')
				if (this.drawItems.length === 0 && this.poolTotal > 0) {
					this.addLog('⚠ 池子有数据但 Draw 返回空！', 'error')
				}
			} catch (e) {
				this.drawResult = null
				this.drawItems = []
				this.addLog('Draw 异常: ' + (e.message || ''), 'error')
			}
			this.drawLoading = false
		},

		// ====== 工具 ======
		slotStatusText(status) {
			const map = { idle: '空闲', queuing: '排队中', active: '置顶中', claimable: '可领取' }
			return map[status] || status || '未知'
		},

		formatTime(ts) {
			if (!ts) return '--'
			const d = new Date(ts)
			const pad = (n) => String(n).padStart(2, '0')
			return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
		}
	}
}
</script>

<style>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; padding: 96rpx 32rpx 0; }
.head { margin-bottom: 24rpx; }
.head-row { display: flex; align-items: flex-start; gap: 16rpx; }
.back-btn {
	width: 56rpx; height: 56rpx; border-radius: 50%; background: white;
	display: flex; align-items: center; justify-content: center; flex-shrink: 0;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
	margin-top: 4rpx;
}
.back-arrow { font-size: 28rpx; color: #1E2939; font-weight: 700; }
.head-info { flex: 1; }
.head-title { font-size: 40rpx; font-weight: 800; color: #101828; display: block; }
.head-sub { font-size: 24rpx; color: #99A1AF; display: block; margin-top: 6rpx; }

/* ====== Tabs ====== */
.tabs {
	display: flex; gap: 8rpx; margin-bottom: 24rpx;
	background: white; border-radius: 20rpx; padding: 6rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
}
.tab {
	flex: 1; text-align: center;
	padding: 14rpx 0; border-radius: 16rpx;
	font-size: 24rpx; color: #6A7282; font-weight: 500;
	transition: all .15s;
}
.tab-active { background: #1E2939; color: white; font-weight: 700; }

/* ====== 面板 ====== */
.panel { margin-bottom: 24rpx; }
.panel-hd {
	display: flex; justify-content: space-between; align-items: center;
	margin-bottom: 16rpx;
}
.panel-title { font-size: 28rpx; font-weight: 700; color: #1E2939; }
.panel-refresh { font-size: 22rpx; color: #F97316; }

.loading-msg, .empty-msg {
	background: white; border-radius: 20rpx;
	padding: 40rpx 24rpx; text-align: center;
	font-size: 24rpx; color: #6A7282; line-height: 1.8;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
}
.empty-hint { color: #F97316; display: block; margin-top: 8rpx; }

/* ====== 卡片列表 ====== */
.card-list { display: flex; flex-direction: column; gap: 12rpx; }

.pool-card, .queue-card {
	background: white; border-radius: 20rpx;
	padding: 20rpx 24rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
}
.pool-card-top, .queue-card-top {
	display: flex; align-items: center; gap: 10rpx; margin-bottom: 10rpx;
}
.pool-card-title { font-size: 26rpx; font-weight: 700; color: #1E2939; flex: 1; }
.queue-card-id { font-size: 24rpx; font-weight: 600; color: #F97316; flex: 1; font-family: monospace; }

.badge {
	padding: 4rpx 12rpx; border-radius: 12rpx;
	font-size: 18rpx; font-weight: 600; flex-shrink: 0;
}
.badge-halo { background: #FEF3C7; color: #92400E; }
.badge-self { background: #EFF6FF; color: #1D4ED8; }
.badge-promote { background: #F5F3FF; color: #6D28D9; }
.badge-done { background: #DCFCE7; color: #166534; }
.badge-waiting { background: #FEF9C3; color: #854D0E; }

.pool-card-info, .queue-card-info {
	display: flex; gap: 16rpx; margin-bottom: 8rpx;
	font-size: 20rpx; color: #99A1AF; font-family: monospace;
}
.pool-card-stats, .queue-card-stats {
	display: flex; gap: 16rpx; margin-bottom: 6rpx;
	font-size: 22rpx; color: #374151;
}
.pool-card-meta, .queue-card-meta {
	display: flex; gap: 16rpx; font-size: 20rpx; color: #99A1AF; font-family: monospace;
}

/* ====== 槽位 ====== */
.seniority-card {
	background: linear-gradient(90deg, #FFD230 0%, #FF8904 100%);
	border-radius: 20rpx; padding: 24rpx; margin-bottom: 20rpx;
}
.seniority-label { font-size: 22rpx; color: rgba(68,19,6,.7); display: block; }
.seniority-value { font-size: 36rpx; font-weight: 900; color: #441306; display: block; margin: 6rpx 0; }
.seniority-count { font-size: 24rpx; color: rgba(68,19,6,.8); display: block; }
.seniority-next { font-size: 22rpx; color: rgba(68,19,6,.6); display: block; margin-top: 4rpx; }

.slot-grid { display: flex; gap: 12rpx; }
.slot-card {
	flex: 1; border-radius: 20rpx; padding: 20rpx 16rpx;
	text-align: center;
	background: white;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
}
.slot-idle { }
.slot-active { border: 2rpx solid #22C55E; background: #F0FFF0; }
.slot-queuing { border: 2rpx solid #F59E0B; background: #FFFBEB; }
.slot-unknown { border: 2rpx solid #EF4444; }
.slot-idx { font-size: 20rpx; color: #99A1AF; display: block; margin-bottom: 6rpx; }
.slot-status { font-size: 26rpx; font-weight: 700; color: #1E2939; display: block; }
.slot-idle .slot-status { color: #9CA3AF; }
.slot-active .slot-status { color: #166534; }
.slot-queuing .slot-status { color: #92400E; }
.slot-survey, .slot-pin {
	font-size: 18rpx; color: #99A1AF; display: block; margin-top: 4rpx;
	font-family: monospace; word-break: break-all;
}

/* ====== 测试表单 ====== */
.test-form {
	background: white; border-radius: 20rpx; padding: 24rpx; margin-bottom: 20rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
}
.test-label { font-size: 24rpx; color: #6A7282; display: block; margin-bottom: 10rpx; }
.test-input {
	background: #F7F8FA; border: 1rpx solid #D1D5DC; border-radius: 16rpx;
	padding: 18rpx 20rpx; font-size: 24rpx; color: #101828; margin-bottom: 20rpx;
}
.test-btns { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.btn { flex: 1; padding: 18rpx; border-radius: 16rpx; text-align: center; font-size: 24rpx; font-weight: 600; }
.btn-pin { background: linear-gradient(90deg, #FFD230 0%, #FF8904 100%); color: #441306; }
.btn-direct { background: #1E2939; color: white; }
.btn-press { opacity: .7; transform: scale(.95); }
.test-hint { font-size: 20rpx; color: #99A1AF; display: block; text-align: center; }

/* ====== Draw 测试 ====== */
.draw-hint { font-size: 22rpx; color: #99A1AF; display: block; margin-bottom: 16rpx; }
.draw-btns { display: flex; gap: 12rpx; margin-bottom: 16rpx; }
.btn-draw { background: #1E2939; color: white; }
.btn-draw-all { background: #F97316; }
.draw-summary {
	font-size: 24rpx; color: #374151; margin-bottom: 16rpx; line-height: 1.6;
}
.draw-warn { color: #DC2626; font-weight: 700; display: block; margin-top: 4rpx; }

/* ====== 日志 ====== */
.test-log {
	background: white; border-radius: 20rpx; padding: 20rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
}
.test-log-hd {
	display: flex; justify-content: space-between; align-items: center;
	margin-bottom: 12rpx;
}
.test-log-title { font-size: 24rpx; font-weight: 700; color: #1E2939; }
.test-log-clear { font-size: 22rpx; color: #F97316; }
.test-log-box { height: 360rpx; }
.log-line {
	font-size: 22rpx; display: block; font-family: monospace;
	line-height: 1.8; padding: 2rpx 0;
}
.log-info { color: #6A7282; }
.log-success { color: #166534; }
.log-warn { color: #92400E; }
.log-error { color: #DC2626; }
.log-empty { font-size: 22rpx; color: #99A1AF; font-family: monospace; }

/* ====== 安全测试 ====== */
.safety-summary {
	padding: 24rpx; border-radius: 20rpx; margin-bottom: 20rpx;
}
.safety-all-pass { background: #DCFCE7; border: 2rpx solid #22C55E; }
.safety-has-fail { background: #FEF2F2; border: 2rpx solid #EF4444; }
.safety-summary-title { font-size: 28rpx; font-weight: 700; display: block; }
.safety-all-pass .safety-summary-title { color: #166534; }
.safety-has-fail .safety-summary-title { color: #991B1B; }
.safety-summary-detail { font-size: 22rpx; display: block; margin-top: 4rpx; }
.safety-all-pass .safety-summary-detail { color: #22C55E; }
.safety-has-fail .safety-summary-detail { color: #EF4444; }

.safety-pass { border-left: 6rpx solid #22C55E; }
.safety-fail { border-left: 6rpx solid #EF4444; }

.panel-sub { font-size: 22rpx; color: #99A1AF; margin-left: 12rpx; }

.bottom-spacer { height: 60rpx; }
</style>
