<!-- ========== 答题页 - 完整重写 ========== -->
<template>
	<view class="page">
		<!-- 加载 / 重试层 -->
		<view v-if="loading" class="retry-layer">
			<view class="skeleton-q"></view>
			<view class="skeleton-opts">
				<view class="skeleton-o" v-for="n in 3" :key="n"></view>
			</view>
		</view>
		<view v-else-if="loadFailed" class="retry-layer">
			<text class="retry-icon">😵</text>
			<text class="retry-text">网络不太给力</text>
			<view class="retry-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="manualRetry">
				<text class="retry-btn-text">点我重试</text>
			</view>
		</view>
		<template v-else>
			<view class="frame" :style="frameBgStyle">
				<!-- 背景光斑（低端机关闭） -->
				<view v-if="!lowPerf" class="ambient-layer">
					<view class="orb orb-a"></view>
					<view class="orb orb-b"></view>
					<view class="orb orb-c"></view>
				</view>

				<!-- ====== 顶部栏 ====== -->
				<view class="hd" :style="{ paddingTop: capsuleBottom + 'px' }">
					<view class="hd-row1">
						<view class="hd-back" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="goBack"><image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image></view>
						<text class="hd-tag">{{ title }}</text>
						<text v-if="isUserGenerated" class="creator-line">—— <text class="creator-name">{{ creatorNickname || '用户' }}</text> 创作</text>
					</view>
					<view class="hd-row2">
						<view class="hd-step">
							<text>第 </text>
							<text :class="['digit-roll', digitFlip ? 'a' : 'b']">{{ idx + 1 }}</text>
							<text>/{{ qs.length }} 题</text>
						</view>
						<text :class="['hd-motto', digitFlip ? 'motto-a' : 'motto-b']">{{ motto }}</text>
					</view>
					<view class="hd-dots">
						<view v-for="(q, i) in qs" :key="i" class="step-dot"
							:class="{ done: i < idx, current: i === idx }"
							:style="{ background: i <= idx ? '#F97316' : '#E5E7EB' }"
						></view>
					</view>
					<view class="hd-bar">
						<view class="hd-fill" :style="{ width: pct + '%' }"></view>
						<view class="hd-glow" :style="{ left: pct + '%' }"></view>
					</view>
				</view>

				<!-- ====== 答题区（双槽位 A/B） ====== -->
				<view class="stage">
					<block v-for="slot in ['A', 'B']" :key="slot">
						<view v-if="slots[slot].visible" class="card" :class="slots[slot].phase">
							<!-- 题目区域 -->
							<view class="q-wrap">
								<view class="q-txt">
									<view v-for="(ch, ci) in slots[slot].q.title" :key="ci"
										class="char-drop"
										:style="{ animationDelay: (180 + ci * 25) + 'ms' }"
									>{{ ch }}</view>
								</view>
							</view>
							<!-- 选项区域 -->
							<view class="opts" :class="{ 'idle-breathe': idleActive }">
								<view v-for="(o, i) in slots[slot].q.opts" :key="i"
									class="o-wrap" hover-class="o-press"
									:hover-start-time="0" :hover-stay-time="50"
									@touchstart="onTouchStart(slot, i, $event)"
									@touchend="onTouchEnd(slot, i)"
									@touchcancel="onTouchCancel(slot, i)"
									@tap="pick(slot, i, $event)"
								>
									<view class="o-inner"
										:class="{
											'o-on': slots[slot].sel === i,
											'o-confirm': slots[slot].confirm === i,
											'o-dim': slots[slot].dim === i
										}"
										:style="{ '--idx': i }"
										:id="'o-' + slot + '-' + i"
									>
										<!-- 字母标 -->
										<view v-if="showLetters" class="o-letter">{{ ['A','B','C','D'][i] }}</view>
										<!-- 长按充能环（居中，在文字下方） -->
										<view class="charge-ring" :style="{ width: chargeSize + 'rpx', height: chargeSize + 'rpx' }" v-if="pressFill === i">
											<view class="charge-fill"></view>
										</view>
										<!-- 选项文字 -->
										<text class="o-txt">{{ o.text }}</text>
										<!-- 水波纹（v-for渲染 ripples） -->
										<view v-for="rp in ripples" :key="rp.id"
											v-if="rp.slot === slot && rp.idx === i"
											class="ripple-circle"
											:style="{ left: rp.x + 'px', top: rp.y + 'px' }"
										></view>
									</view>
									<!-- .o-fx 独立浮层（粒子 + 描边环） -->
									<view class="o-fx">
										<view v-for="rp in ripples" :key="'ring-' + rp.id"
											v-if="rp.slot === slot && rp.idx === i"
											class="ring-pulse"
										></view>
										<view v-for="n in 6" :key="'b-' + n"
											class="burst-dot"
											:style="{ '--angle': ((n - 2.5) * 28) + 'deg' }"
											v-if="burstVisible[slot + '-' + i]"
										></view>
									</view>
								</view>
							</view>
						</view>
					</block>
				</view>

				<!-- ====== 浮层区 ====== -->
				<!-- 全屏 flash -->
				<view class="flash-overlay" v-if="flashVisible"></view>
				<!-- 边缘光晕 -->
				<view class="edge-glow" v-if="edgeGlowVisible"></view>
				<!-- 连击徽章 -->
				<view class="streak-badge" v-if="streakPopVisible">{{ streak }}连击🔥</view>
				<!-- 纸屑层（仅最后一题） -->
				<view class="confetti-layer" v-if="confettiVisible">
					<view v-for="(p, pi) in confettiPieces" :key="pi"
						class="confetti-piece"
						:style="{
							left: p.left + '%',
							background: p.color,
							animationDelay: p.delay + 's',
							animationDuration: p.dur + 's',
							transform: 'rotate(' + p.rot + 'deg)'
						}"
					></view>
				</view>
			</view>
			<!-- #ifdef H5 -->
			<!-- 调试面板 -->
			<view class="debug-panel">
				<view class="debug-hd">
					<text class="debug-title">🛠 调试</text>
					<view class="debug-close" @click="showDebug = false">✕</view>
				</view>
				<view class="debug-row">
					<text class="debug-label">充能延迟(ms)：</text>
					<input class="debug-input" type="number" v-model="debugChargeDelay" />
				</view>
				<view class="debug-row">
					<text class="debug-label">充能环大小：</text>
					<view class="debug-size-group">
						<view class="debug-size-btn" @click="chargeSize = Math.max(20, chargeSize - 4)">−</view>
						<text class="debug-size-val">{{ chargeSize }}</text>
						<view class="debug-size-btn" @click="chargeSize = Math.min(120, chargeSize + 4)">+</view>
					</view>
				</view>
				<view class="debug-row">
					<view class="debug-btn-wrap">
						<view class="o-wrap"
							hover-class="o-press" :hover-start-time="0" :hover-stay-time="150"
							@touchstart="debugTouchStart($event)"
							@touchend="debugTouchEnd"
							@touchcancel="debugTouchEnd"
						>
							<view class="o-inner" style="width:260rpx;">
								<text class="o-txt">调试按钮</text>
								<view class="charge-ring" :style="{ width: chargeSize + 'rpx', height: chargeSize + 'rpx' }" v-if="debugPressFill === 0">
									<view class="charge-fill"></view>
								</view>
								<view v-for="rp in debugRipples" :key="rp.id"
									class="ripple-circle"
									:style="{ left: rp.x + 'px', top: rp.y + 'px' }"
								></view>
							</view>
							<view class="o-fx">
								<view v-for="rp in debugRipples" :key="'ring-' + rp.id"
									class="ring-pulse"
								></view>
								<view v-for="n in 6" :key="'b-' + n"
									class="burst-dot"
									:style="{ '--angle': ((n - 2.5) * 28) + 'deg' }"
									v-if="debugBurstVisible"
								></view>
							</view>
						</view>
					</view>
				</view>
			</view>
			<!-- #endif -->
			<!-- 临时测试：跳过答题直接出结果（不污染数据库） -->
			<view class="mock-skip" @click="mockSkip">⚡M</view>
		</template>
	</view>
</template>

<script>
// ====== 常量 ======
const OPTS_LV1 = [
	'绝非如此 🤨', '根本不是 🚫', '太扯了 🙄', '绝对不是 🤨',
	'你瞎了 🙅', '举报了 🚫', '我裂开 💀', '不是我 🙈',
	'别扯了 😒', '不可能 😤', '你在放屁 💨', '想多了 🥱',
	'完全不对 ❌', '关我啥事 🤷', '少来这套 😏', '笑死 🥴'
]
const OPTS_LV2 = [
	'有点意思 🤔', '也许吧 🤷', '说不准 🫤', '好像有点 🫤',
	'猜对一半 🤷', '再想想 🤔', '有点痛 🩹', '一半一半 🐒',
	'不好说 🫣', '看情况 😶', '也许大概 😬', '好像是的 🤥',
	'说不好 🤫', '有点道理 🤨', '被你说中了 😅', 'emmm... 🤔'
]
const OPTS_LV3 = [
	'被看穿了 😱', '就是我本人 ✅', '太准了 😳', '本人在此 😳',
	'你监视我？ 🎯', '删掉监控 ✅', '精准打击 🔪', '是我本人 🐺',
	'救命太准了 😰', '你在偷看我 👀', '我承认 😮‍💨', '被你发现了 🫢',
	'全中 🎯', '这是监控吧 📹', '有被冒犯到 😠', '我闭嘴 🤐'
]
const MOTTOS = ['离确诊又近了一步 🤡','嗯…有点东西 👀','你逃不掉的 🙃','这题有点扎心 🫠','最后一击 💥','稳住别慌 🫡']
const BG_COLORS = ['#F7F8FA','#FFF9F4','#F4F7FB','#F7FAF4','#FCF6F4','#F4F8F9']
const CONFETTI_COLORS = ['#FB923C','#F97316','#FDBA74','#FCD34D','#34D399','#60A5FA']

export default {
	data() {
		return {
			idx: 0,
			locked: false,
			activeSlot: 'A',
			digitFlip: false,
			showLetters: true,
			lowPerf: false,
			slots: {
				A: { visible: true, phase: 'in', q: null, sel: -1, confirm: -1, dim: -1 },
				B: { visible: false, phase: 'in', q: null, sel: -1, confirm: -1, dim: -1 }
			},
			tag: '',
			ans: [],
			survey: null,
			loading: true,
			loadFailed: false,
			capsuleBottom: 92,
			// 特效状态
			ripples: [],
			rippleId: 0,
			flashVisible: false,
			edgeGlowVisible: false,
			streak: 0,
			streakPopVisible: false,
			lastPickTime: 0,
			pressFill: null,
			confettiVisible: false,
			confettiPieces: [],
			burstVisible: {},
			idleTimer: null,
			pressTimer: null,
			chargeTimer: null,
			idleActive: false,
			/* #ifdef H5 */
			// 调试面板
			showDebug: true,
			debugChargeDelay: 1000,
			debugPressFill: null,
			debugRipples: [],
			debugRippleId: 0,
			debugBurstVisible: false,
			debugChargeTimer: null,
			debugChargeEndTimer: null,
			debugChargeComplete: false,
			/* #endif */
			// 充能环大小
			chargeSize: 240,
			// 答题按钮充能就绪标记
			chargeReady: false,
			creatorNickname: ''
		}
	},
	computed: {
		isUserGenerated() { return !!(this.survey && this.survey.creatorId) },
		qs() { return (this.survey && this.survey.qs) || [] },
		title() { return (this.survey && this.survey.title) || this.tag || '' },
		pct() { return this.qs.length ? (this.idx / this.qs.length) * 100 : 0 },
		motto() { return MOTTOS[this.idx % MOTTOS.length] },
		isLast() { return this.idx + 1 >= this.qs.length },
		frameBgStyle() {
			const bg = BG_COLORS[this.idx % BG_COLORS.length]
			return { background: bg, transition: 'background-color 0.7s ease-out' }
		}
	},
	onLoad(o) {
		this.tag = decodeURIComponent(o.tag || '确诊为烤肠')
		this.detectLowPerf()
		this.loadSurvey()
		try { const menu = uni.getMenuButtonBoundingClientRect(); this.capsuleBottom = menu.bottom } catch (e) {}
		// fire-and-forget: recordClick
		if (o.surveyId) {
			const survey = uniCloud.importObject('survey')
			survey.recordClick({ surveyId: decodeURIComponent(o.surveyId) }).catch(() => {})
		}
	},

	onShareAppMessage() {
		// fire-and-forget：记录分享计数
		if (this.survey && this.survey._id) {
			const survey = uniCloud.importObject('survey')
			survey.recordShare({ surveyId: this.survey._id }).catch(() => {})
		}
		return {
			title: '来看看「' + (this.title || '这份问卷') + '」',
			path: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(this.tag) + '&surveyId=' + encodeURIComponent(this.survey._id)
		}
	},
	methods: {
		// ====== 核心时序 pick() ======
		pick(slot, i, e) {
			if (this.locked || slot !== this.activeSlot) return
			this.locked = true
			const t0 = Date.now()
			const at = (delay, fn) => setTimeout(fn, Math.max(0, delay - (Date.now() - t0)))
			const cur = this.slots[slot]

			// T+0ms: 选中态 + 弹跳
			cur.sel = i
			cur.confirm = i

			// T+0ms: 震动反馈（最后一题三连震）— 仅充能完毕触发
			if (this.chargeReady) {
				if (this.isLast) {
					uni.vibrateShort({ type: 'heavy' })
					at(260, () => uni.vibrateShort({ type: 'medium' }))
					at(520, () => uni.vibrateShort({ type: 'light' }))
				} else {
					uni.vibrateShort({ type: 'light' })
				}
			}

			// T+0ms: 记录答案
			this.ans.push({
				dim: cur.q.dim,
				score: cur.q.opts[i].score,
				questionIndex: this.idx,
				optionIndex: i
			})

			// T+0ms: 特效触发 — 仅充能完毕才触发水波纹/粒子迸溅
			if (this.chargeReady) {
				this.spawnRipple(slot, i, e)
				this.triggerBurst(slot, i)
				this.chargeReady = false
			}
			this.flashVisible = true
			this.edgeGlowVisible = true
			this.checkStreak()

			// T+0ms: 最后一题纸屑
			if (this.isLast) this.toggleConfetti(true)

			// T+220ms: flash 结束
			at(220, () => { this.flashVisible = false })

			// T+420ms: 移除弹跳、edge-glow
			at(420, () => {
				cur.confirm = -1
				this.edgeGlowVisible = false
			})

			// T+420ms: 最后一题 -> 跳转结果
			if (this.isLast) {
				at(1100, () => this.goResult())
				return
			}

			// T+420ms: 普通题 -> 离场
			at(420, () => {
				this.idx++
				this.digitFlip = !this.digitFlip
				cur.phase = 'out'
			})

			// T+520ms: 新卡入场（100ms 叠加窗口）
			at(520, () => {
				const next = slot === 'A' ? 'B' : 'A'
				const ns = this.slots[next]
				ns.q = { ...this.qs[this.idx], opts: this.pickOpts() }
				ns.sel = -1
				ns.confirm = -1
				ns.dim = -1
				ns.phase = 'in'
				ns.visible = true
				this.activeSlot = next
				// 重置闲置呼吸
				this.resetIdleTimer()
				// T+1370ms (= 520 + 850): 新卡入场动画完成后回到 entered
				at(1370, () => {
					if (ns.phase === 'in') ns.phase = 'entered'
				})
			})

			// T+720ms: 旧卡销毁
			at(720, () => {
				cur.visible = false
			})

			// T+1170ms: 解锁
			at(1170, () => {
				this.locked = false
			})
		},

		// ====== 特效方法 ======
		spawnRipple(slot, i, e) {
			const id = ++this.rippleId
			// 事件坐标（基于 .o-inner 自身坐标）
			const touch = e && e.touches && e.touches[0]
			const x = touch ? touch.x : 50
			const y = touch ? touch.y : 50
			this.ripples.push({ id, slot, idx: i, x, y })
			// 700ms 后移除
			setTimeout(() => {
				this.ripples = this.ripples.filter(r => r.id !== id)
			}, 700)
		},

		triggerBurst(slot, i) {
			const key = slot + '-' + i
			this.$set(this.burstVisible, key, true)
			setTimeout(() => {
				this.$set(this.burstVisible, key, false)
			}, 600)
		},

		checkStreak() {
			const now = Date.now()
			const threshold = 3000 // 3秒内连续答题才算连击
			if (this.lastPickTime && now - this.lastPickTime > threshold) {
				this.streak = 1 // 超时，重置从1开始
			} else {
				this.streak++
			}
			this.lastPickTime = now
			if (this.streak >= 2) {
				this.streakPopVisible = true
				uni.vibrateShort({ type: 'medium' })
				clearTimeout(this._streakTimer)
				this._streakTimer = setTimeout(() => {
					this.streakPopVisible = false
				}, 1200)
			}
		},

		// ====== 闲置呼吸 ======
		resetIdleTimer() {
			clearTimeout(this.idleTimer)
			this.idleActive = false
			this.idleTimer = setTimeout(() => {
				this.idleActive = true
			}, 4000)
		},

		/* #ifdef H5 */
		// ====== 调试面板 ======
		debugTouchStart(e) {
			this.debugChargeComplete = false
			clearTimeout(this.debugChargeTimer)
			clearTimeout(this.debugChargeEndTimer)
			// 充能环出现（fill 动画开始）
			this.debugChargeTimer = setTimeout(() => {
				this.debugPressFill = 0
			}, this.debugChargeDelay)
			// 充能环 fill 动画完毕（0.6s）
			this.debugChargeEndTimer = setTimeout(() => {
				this.debugChargeComplete = true
			}, this.debugChargeDelay + 600)
		},
		debugTouchEnd() {
			if (this.debugChargeComplete) {
				// 充能完毕后才触发全套特效
				const id = ++this.debugRippleId
				this.debugRipples.push({ id, x: 50, y: 50 })
				setTimeout(() => {
					this.debugRipples = this.debugRipples.filter(r => r.id !== id)
				}, 700)
				this.debugBurstVisible = true
				setTimeout(() => { this.debugBurstVisible = false }, 600)
				uni.vibrateShort({ type: 'light' })
			}
			this.debugPressFill = null
			this.debugChargeComplete = false
			clearTimeout(this.debugChargeTimer)
			clearTimeout(this.debugChargeEndTimer)
		},
		/* #endif */

		// ====== 长按彩蛋 + 充能环 ======
		onTouchStart(slot, i, e) {
			this.chargeReady = false
			clearTimeout(this.pressTimer)
			clearTimeout(this.chargeTimer)
			// 270ms 触发充能环开始蓄力
			this.chargeTimer = setTimeout(() => {
				this.pressFill = i
			}, 270)
			// 充能环动画 0.6s 充能完毕后标记就绪（270 + 600 = 870ms）
			this.pressTimer = setTimeout(() => {
				this.chargeReady = true
			}, 870)
		},
		onTouchEnd(slot, i) {
			this.pressFill = null
			clearTimeout(this.pressTimer)
			clearTimeout(this.chargeTimer)
			// chargeReady 不清，留给后面 pick() 消费
		},
		onTouchCancel(slot, i) {
			this.pressFill = null
			this.chargeReady = false
			clearTimeout(this.pressTimer)
			clearTimeout(this.chargeTimer)
		},

		// ====== 纸屑 ======
		toggleConfetti(show) {
			if (show) {
				const count = this.lowPerf ? 20 : 40
				const pieces = []
				for (let pi = 0; pi < count; pi++) {
					pieces.push({
						left: Math.random() * 100,
						color: CONFETTI_COLORS[pi % CONFETTI_COLORS.length],
						delay: Math.random() * 0.4,
						dur: 1.4 + Math.random() * 1.2,
						rot: Math.random() * 720 - 360
					})
				}
				this.confettiPieces = pieces
				this.confettiVisible = true
			} else {
				this.confettiVisible = false
				this.confettiPieces = []
			}
		},

		// ====== 低端机检测 ======
		detectLowPerf() {
			try {
				const sys = uni.getSystemInfoSync()
				if (sys.benchmarkLevel !== undefined && sys.benchmarkLevel < 10) {
					this.lowPerf = true
				}
			} catch (e) {
				// 降级处理
			}
		},

		// ====== 选项文本生成 ======
		pickOpts() {
			const lv1 = OPTS_LV1[Math.floor(Math.random() * OPTS_LV1.length)]
			const lv2 = OPTS_LV2[Math.floor(Math.random() * OPTS_LV2.length)]
			const lv3 = OPTS_LV3[Math.floor(Math.random() * OPTS_LV3.length)]
			return [
				{ text: lv1, score: 1 },
				{ text: lv2, score: 2 },
				{ text: lv3, score: 3 }
			]
		},

		// ====== 加载问卷 ======
		async loadSurvey() {
			this.loading = true
			this.loadFailed = false
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getSurveyByTag({ tagName: this.tag })
				if (res && res.data) {
				this.survey = res.data
				// 如果是用户生成问卷，查创建者昵称
				if (this.survey.creatorId) {
					this.loadCreatorNickname()
				}
				this.slots.A.q = { ...this.qs[0], opts: this.pickOpts() }
				// 首题入场动画完成后切到 entered 态（避免切题时 in→out 的 fill-mode 释放闪烁）
				this.$nextTick(() => {
					setTimeout(() => {
						if (this.slots.A.phase === 'in') this.slots.A.phase = 'entered'
					}, 850)
				})
				this.loading = false
				} else {
					this.loading = false
					this.loadFailed = true
				}
			} catch (e) {
				console.error('[answer-quiz] load error:', e.message)
				this.loading = false
				if (e.message && e.message.indexOf('未找到') !== -1) {
					uni.showToast({ title: '该标签暂无问卷数据', icon: 'none' })
					setTimeout(() => {
						const pages = getCurrentPages()
						if (pages.length > 1) {
							uni.navigateBack()
						} else {
							uni.redirectTo({ url: '/pages-tools/quiz-home/quiz-home' })
						}
					}, 1000)
				} else {
					this.loadFailed = true
				}
			}
		},
		manualRetry() { this.loadSurvey() },

		async loadCreatorNickname() {
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getSurveyDetail({ surveyId: this.survey._id })
				if (res.errCode === 0 && res.data.creatorNickname) {
					this.creatorNickname = res.data.creatorNickname
				}
			} catch (e) {
				console.error('[answer-quiz] loadCreatorNickname:', e)
			}
		},

		// ====== 返回 ======
		goBack() {
			uni.redirectTo({ url: '/pages-tools/quiz-home/quiz-home' })
		},

		// ====== 雷达图造假工具函数 ======

		// djb2 字符串哈希
		hashString(str) {
			let hash = 5381
			for (let i = 0; i < str.length; i++) {
				hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
			}
			return hash >>> 0
		},

		// mulberry32 PRNG
		createSeededRNG(seed) {
			let s = seed | 0
			return function() {
				s |= 0
				s = s + 0x6D2B79F5 | 0
				let t = Math.imul(s ^ s >>> 15, 1 | s)
				t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
				return ((t ^ t >>> 14) >>> 0) / 4294967296
			}
		},

		// Box-Muller 正态分布
		boxMuller(rng, mean, stddev) {
			let u1, u2
			do { u1 = rng() } while (u1 === 0)
			u2 = rng()
			const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
			return mean + z * stddev
		},

		// 主函数：生成假雷达图数据（普通问卷）
		generateFakeScores(raw, resultType, dims) {
			const rawSum = raw.reduce((a, b) => a + b, 0)
			const bucket = Math.floor(rawSum / 20)
			const seedStr = resultType.name + '_' + bucket
			const seed = this.hashString(seedStr)

			const mainIdx = dims.indexOf(resultType.match)
			// 兜底：match 不在 dims 中
			if (mainIdx === -1) return dims.map(() => 50)

			const rng = this.createSeededRNG(seed)
			const fake = dims.map(() => {
				const val = this.boxMuller(rng, 55, 12)
				return Math.max(20, Math.min(70, Math.round(val)))
			})

			const mainRng = this.createSeededRNG(seed ^ 0x5A77)
			const mainVal = 75 + Math.floor(mainRng() * 11)

			fake[mainIdx] = mainVal

			const threshold = mainVal - 20
			for (let i = 0; i < fake.length; i++) {
				if (i !== mainIdx && fake[i] >= threshold) {
					fake[i] = threshold - 1
				}
			}

			const maxOther = Math.max(...fake.filter((_, i) => i !== mainIdx))
			if (fake[mainIdx] <= maxOther) {
				fake[mainIdx] = maxOther + 21
			}

			return fake
		},

		// 特殊问卷：按 profile 比例缩放生成假雷达图数据
		generateFakeScoresByProfile(raw, resultType, dims) {
			const profile = resultType.profile
			const rawSum = raw.reduce((a, b) => a + b, 0)
			const bucket = Math.floor(rawSum / 20)
			const seedStr = resultType.name + '_' + bucket
			const seed = this.hashString(seedStr)

			// 确定主维度：profile 最大值索引
			const mainIdx = profile.indexOf(Math.max(...profile))

			// 步骤 2: profile 线性映射到 [30, 70]
			const pMin = Math.min(...profile)
			const pMax = Math.max(...profile)
			let fake
			if (pMax === pMin) {
				// profile 全相等 → fallback 到随机分布
				const rng = this.createSeededRNG(seed)
				fake = dims.map(() => {
					const val = this.boxMuller(rng, 55, 12)
					return Math.max(20, Math.min(70, Math.round(val)))
				})
			} else {
				fake = profile.map(p => Math.round(30 + (p - pMin) / (pMax - pMin) * 40))
			}

			// 步骤 3: 主维度 boost 到 75-85
			const mainRng = this.createSeededRNG(seed ^ 0x5A77)
			const mainVal = 75 + Math.floor(mainRng() * 11)
			fake[mainIdx] = mainVal

			// 步骤 4: 非主维度加种子噪声 ±3
			const noiseRng = this.createSeededRNG(seed ^ 0x3CAD)
			for (let i = 0; i < fake.length; i++) {
				if (i !== mainIdx) {
					fake[i] += Math.round((noiseRng() - 0.5) * 6)
				}
			}

			// 步骤 5: clamp 非主维度 [20, 70]
			for (let i = 0; i < fake.length; i++) {
				if (i !== mainIdx) {
					fake[i] = Math.max(20, Math.min(70, fake[i]))
				}
			}

			// 步骤 6: gap ≥ 20 修正
			const threshold = mainVal - 20
			for (let i = 0; i < fake.length; i++) {
				if (i !== mainIdx && fake[i] >= threshold) {
					fake[i] = threshold - 1
				}
			}

			// 步骤 7: 兜底检查 mainIdx 是否最高
			const maxOther = Math.max(...fake.filter((_, i) => i !== mainIdx))
			if (fake[mainIdx] <= maxOther) {
				fake[mainIdx] = maxOther + 21
			}

			return fake
		},

		// ====== Mock 跳过（临时测试，不调用 submitAnswer 避免污染） ======
		mockSkip() {
			if (!this.survey) return
			const dims = this.survey.dims
			// 随机生成分数
			const scores = dims.map(() => Math.floor(Math.random() * 60) + 30)
			// 随机选中一个结果类型
			const results = this.survey.resultTypes
			const result = results[Math.floor(Math.random() * results.length)]
			const colors = results.map(r => r.emojiBg)
			uni.redirectTo({
				url: '/pages-tools/result/result?tag=' + encodeURIComponent(this.tag) +
					'&dims=' + encodeURIComponent(JSON.stringify(dims)) +
					'&scores=' + encodeURIComponent(JSON.stringify(scores)) +
					'&emoji=' + encodeURIComponent(result.emoji) +
					'&image=' + encodeURIComponent(result.image || '') +
					'&rname=' + encodeURIComponent(result.name) +
					'&rdesc=' + encodeURIComponent(result.desc) +
					'&colors=' + encodeURIComponent(JSON.stringify(colors)) +
					'&surveyId=' + encodeURIComponent(this.survey._id)
			})
		},

		// ====== 跳转结果 ======
		async goResult() {
			if (!this.survey) return
			const dims = this.survey.dims
			const sums = {}, cnts = {}
			dims.forEach(d => { sums[d] = 0; cnts[d] = 0 })
			this.ans.forEach(a => { sums[a.dim] += a.score; cnts[a.dim]++ })
			const raw = dims.map(d => cnts[d] ? ((sums[d] / cnts[d] - 1) / 2) * 100 : 50)

			let result
			let scores

			if (this.survey.resultTypes[0]?.profile) {
				// 特殊问卷：五维向量欧几里得距离匹配
				const distances = this.survey.resultTypes.map(rt => {
					const sumSq = rt.profile.reduce((acc, p, i) => acc + Math.pow(p - raw[i], 2), 0)
					return Math.sqrt(sumSq)
				})
				const minIdx = distances.indexOf(Math.min(...distances))
				result = this.survey.resultTypes[minIdx]
				scores = this.generateFakeScoresByProfile(raw, result, dims)
			} else {
				// 普通问卷：取最高维度匹配
				const topDim = dims.reduce((a, b) => raw[dims.indexOf(a)] >= raw[dims.indexOf(b)] ? a : b)
				result = this.survey.resultTypes.find(r => r.match === topDim) || this.survey.resultTypes[0]
				scores = this.generateFakeScores(raw, result, dims)
			}

			const dimensionScores = {}
			dims.forEach((d, i) => { dimensionScores[d] = raw[i] })

			try {
				const survey = uniCloud.importObject('survey')
				const ansData = this.ans.map(a => ({ questionIndex: a.questionIndex, optionIndex: a.optionIndex }))
				await survey.submitAnswer({
					surveyId: this.survey._id,
					answers: ansData,
					dimensionScores,
					matchedType: { name: result.name, desc: result.desc, emoji: result.emoji },
					surveySnapshot: this.survey
				})
			} catch (e) {
				console.error('[answer-quiz] submitAnswer error:', e)
			}

			const colors = this.survey.resultTypes.map(r => r.emojiBg)

			// 预加载图片到微信缓存，结果页秒渲染
			if (imageUrl && !imageUrl.startsWith('cloud://')) {
				await new Promise((resolve) => {
					uni.getImageInfo({
						src: imageUrl,
						success: () => resolve(),
						fail: () => resolve()
					})
				})
			}

			uni.redirectTo({
			url: '/pages-tools/result/result?tag=' + encodeURIComponent(this.tag) +
				'&dims=' + encodeURIComponent(JSON.stringify(dims)) +
				'&scores=' + encodeURIComponent(JSON.stringify(scores)) +
				'&emoji=' + encodeURIComponent(result.emoji) +
				'&image=' + encodeURIComponent(result.image || '') +
				'&rname=' + encodeURIComponent(result.name) +
				'&rdesc=' + encodeURIComponent(result.desc) +
				'&colors=' + encodeURIComponent(JSON.stringify(colors)) +
				'&surveyId=' + encodeURIComponent(this.survey._id)
		})
		}
	}
}
</script>

<style scoped>
/* ============================
   Step 8: 页面 / Frame / 顶部区
   ============================ */
.page {
	width: 100%; min-height: 100vh;
	background: #F3F4F6;
	display: flex; flex-direction: column;
}
.frame {
	width: 100%; min-height: 100vh;
	display: flex; flex-direction: column;
	overflow: hidden;
	position: relative;
}

/* ===== 背景光斑 ===== */
.ambient-layer {
	position: absolute;
	top: 0; right: 0; bottom: 0; left: 0;
	pointer-events: none; z-index: 0;
	overflow: hidden;
}
.orb {
	position: absolute; border-radius: 50%;
	filter: blur(56rpx); opacity: 0.45;
}
.orb-a {
	width: 440rpx; height: 440rpx;
	top: 15%; left: -10%;
	background: radial-gradient(circle, #FED7AA, transparent 70%);
	animation: orbDriftA 12s ease-in-out infinite;
}
.orb-b {
	width: 520rpx; height: 520rpx;
	top: 55%; right: -15%;
	background: radial-gradient(circle, #FBCFE8, transparent 70%);
	animation: orbDriftB 15s ease-in-out -3s infinite;
}
.orb-c {
	width: 360rpx; height: 360rpx;
	bottom: 10%; left: 20%;
	background: radial-gradient(circle, #BFDBFE, transparent 70%);
	animation: orbDriftC 14s ease-in-out -6s infinite;
}

/* ===== 顶部栏 ===== */
.hd {
	padding: 0 48rpx 16rpx;
	position: relative; z-index: 10;
	flex-shrink: 0;
}
.hd-row1 {
	display: flex; align-items: center; gap: 24rpx;
	margin-bottom: 48rpx;
}
.hd-back {
	width: 64rpx; height: 64rpx;
	background: #fff; border-radius: 999rpx;
	display: flex; align-items: center; justify-content: center;
	box-shadow: 0 2rpx 8rpx -2rpx rgba(0,0,0,0.08);
	transition: transform 0.15s;
}
.back-arrow { width: 28rpx; height: 28rpx; }
.hd-back:active { transform: scale(0.95); }
.hd-tag {
	font-size: 28rpx; font-weight: 500;
	color: #9CA3AF; line-height: 1;
	overflow: hidden; white-space: nowrap; text-overflow: ellipsis;
}
.hd-author {
	font-size: 22rpx; flex-shrink: 0;
	background: #F3F4F6; border-radius: 20rpx;
	padding: 4rpx 12rpx;
}
.creator-line { font-size: 22rpx; color: #99A1AF; font-weight: 400; line-height: 1; }
.creator-name { color: #F97316; font-weight: 600; }
.hd-row2 {
	display: flex; justify-content: space-between;
	align-items: flex-end;
	padding: 0 8rpx; margin-bottom: 16rpx;
}
.hd-step { font-size: 24rpx; color: #9CA3AF; font-weight: 700; }
.hd-step .digit-roll {
	display: inline-block;
	color: #F97316;
	transform-origin: center bottom;
}
.digit-roll.a { animation: digitRollInA 0.45s cubic-bezier(0.34,1.45,0.64,1) both; }
.digit-roll.b { animation: digitRollInB 0.45s cubic-bezier(0.34,1.45,0.64,1) both; }
.hd-motto { font-size: 24rpx; color: #9CA3AF; font-weight: 700; }
.hd-motto.motto-a { animation: mottoRollA 0.45s cubic-bezier(0.34,1.45,0.64,1) both; }
.hd-motto.motto-b { animation: mottoRollB 0.45s cubic-bezier(0.34,1.45,0.64,1) both; }

/* ===== 步点 ===== */
.hd-dots {
	display: flex; gap: 16rpx;
	padding: 0 8rpx; margin-bottom: 16rpx;
}
.step-dot {
	width: 12rpx; height: 12rpx;
	border-radius: 50%;
	transition: background 0.3s, transform 0.3s, box-shadow 0.3s;
}
.step-dot.done { transform: scale(1.2); }
.step-dot.current {
	transform: scale(1.35);
	box-shadow: 0 0 20rpx rgba(251,146,60,0.7);
}

/* ===== 进度条 ===== */
.hd-bar {
	height: 12rpx; width: 100%;
	background: #E5E7EB; border-radius: 999rpx;
	overflow: hidden; position: relative;
}
.hd-fill {
	height: 100%; border-radius: 999rpx;
	background: linear-gradient(90deg, #FB923C, #F97316);
	transition: width 0.6s cubic-bezier(0.34, 1.45, 0.64, 1);
}
.hd-glow {
	position: absolute; top: -6rpx;
	width: 28rpx; height: 24rpx;
	transform: translateX(-50%);
	border-radius: 50%;
	background: radial-gradient(circle, rgba(249,115,22,0.7), transparent 70%);
	transition: left 0.6s cubic-bezier(0.34, 1.45, 0.64, 1);
	pointer-events: none;
}
/* 过半脉冲 */
.bar-halfway { animation: barPulse 1.4s ease-in-out 2; }

/* ============================
   Step 9: 答题区
   ============================ */
.stage {
	flex: 1; position: relative;
	min-height: 900rpx; z-index: 0;
}
/* 双槽位卡片 */
.card {
	position: absolute;
	top: 0; right: 0; bottom: 0; left: 0;
	will-change: transform, opacity;
	display: flex; flex-direction: column;
}
.card.out { pointer-events: none; }

/* ===== 题目 ===== */
.q-wrap {
	width: 80%; flex: 1;
	display: flex; align-items: center; justify-content: center;
	padding: 0 64rpx;
	transform: translateY(-47rpx) translateX(12rpx);
}
.q-txt {
	font-size: 46rpx; font-weight: 900; color: #1F2937;
	text-align: center; line-height: 1.375;
	letter-spacing: 0.05em;
	width: 100%;
	word-break: break-all;
}
.char-drop { display: inline; }

/* ===== 选项 ===== */
.opts {
	padding: 0 48rpx 96rpx;
	position: relative; z-index: 10;
}
.opts > .o-wrap + .o-wrap { margin-top: 28rpx; }

.o-wrap {
	position: relative;
	overflow: visible;
	border-radius: 48rpx;
	-webkit-tap-highlight-color: transparent;
	transition: transform 0.18s cubic-bezier(0.34, 1.0, 0.64, 1);
}
.o-press {
	transform: scale(0.95);
	transition: transform 0.05s ease-in;
}

.o-inner {
	position: relative; overflow: hidden;
	width: 100%; padding: 40rpx 0;
	border-radius: 48rpx;
	background: #fff;
	border: 2rpx solid transparent;
	box-shadow: 0 2rpx 8rpx -2rpx rgba(0,0,0,0.06);
	display: flex; align-items: center; justify-content: center;
	transition:
		background-color 0.3s ease-out,
		border-color 0.3s ease-out,
		color 0.3s ease-out,
		box-shadow 0.3s ease-out,
		transform 0.3s ease-out;
	cursor: pointer;
}

/* 字母标 */
.o-letter {
	position: absolute; left: 40rpx; top: 50%;
	transform: translateY(-50%);
	width: 56rpx; height: 56rpx;
	border-radius: 50%;
	background: #FFF7ED; color: #F97316;
	font-size: 24rpx; font-weight: 700;
	display: flex; align-items: center; justify-content: center;
	transition: background 0.3s ease-out, color 0.3s ease-out;
	pointer-events: none;
}

/* 选项文字 */
.o-txt {
	position: relative; z-index: 2;
	color: #374151;
	font-size: 34rpx; font-weight: 700;
	transition: color 0.3s ease-out;
	line-height: 1.2;
}

/* 选中态 */
.o-on {
	background: #F97316;
	border-color: #F97316;
	transform: translateY(-8rpx);
	box-shadow:
		0 20rpx 56rpx -12rpx rgba(249,115,22,0.55),
		0 0 0 8rpx rgba(249,115,22,0.2);
}
.o-on .o-txt { color: #111827; font-weight: 900; }
.o-on .o-letter {
	background: rgba(255,255,255,0.25);
	color: #FFFFFF;
}
/* 灰态 */
.o-dim {
	background: rgba(255,255,255,0.6);
	opacity: 0.45;
}
.o-dim .o-txt { color: #9CA3AF; }

/* 确认弹跳 */
.o-confirm { animation: confirmPop 0.32s cubic-bezier(0.34, 1.56, 0.64, 1); }

/* ===== 进场动画 ===== */
.card.in .q-txt {
	animation: qIn 0.3s ease-out 0s both;
}
/* char-drop 通过内联 style 设置 animationDelay */
.card.in .char-drop {
	animation: charDrop 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) both;
}
.card.in .o-inner {
	animation: oIn 0.3s ease-out calc(var(--idx) * 0.06s) both;
}

/* 静止态：entered — 无 animation，自然停在终态（与入场动画 100% 帧一致） */
.card.entered .q-txt,
.card.entered .char-drop,
.card.entered .o-inner {
	/* intentionally empty */
}

/* ===== 离场动画 ===== */
.card.out .q-txt {
	animation: qOut 0.3s ease-out 0s both;
}
.card.out .o-inner {
	animation: oOut 0.3s ease-out calc(var(--idx) * 0.04s) both;
}

/* ===== .o-fx 独立浮层 ===== */
.o-fx {
	position: absolute;
	top: 0; right: 0; bottom: 0; left: 0;
	overflow: visible;
	pointer-events: none;
}

/* ===== 水波纹 ===== */
.ripple-circle {
	position: absolute;
	width: 160rpx; height: 160rpx;
	margin-left: -80rpx; margin-top: -80rpx;
	border-radius: 50%;
	background: rgba(249,115,22,0.35);
	animation: ripple 0.65s cubic-bezier(0.2,0.7,0.4,1) both;
	pointer-events: none;
}

/* ===== 描边环 ===== */
.ring-pulse {
	position: absolute;
	top: 50%; left: 50%;
	width: 120rpx; height: 120rpx;
	margin-left: -60rpx; margin-top: -60rpx;
	border-radius: 50%;
	border: 4rpx solid rgba(249,115,22,0.55);
	animation: ringPulse 0.7s cubic-bezier(0.2,0.7,0.4,1) both;
	pointer-events: none;
}

/* ===== 闲置呼吸 ===== */
.idle-breathe .o-inner {
	animation: idleBreathe 1.8s ease-in-out infinite;
	animation-delay: calc(var(--idx) * 0.18s);
}

/* ===== 粒子迸溅 ===== */
.burst-dot {
	position: absolute;
	top: 50%; left: 50%;
	width: 16rpx; height: 16rpx;
	margin-left: -8rpx; margin-top: -8rpx;
	border-radius: 50%;
	background: #FB923C;
	animation: burstDot 0.55s cubic-bezier(0.22,1,0.36,1) both;
	transform: rotate(var(--angle)) translateY(0) scale(1);
	pointer-events: none;
}

/* ===== 长按充能环 ===== */
.charge-ring {
	position: absolute; left: 50%; top: 50%;
	transform: translate(-50%, -50%);
	width: 56rpx; height: 56rpx;
	border-radius: 50%;
	pointer-events: none;
	z-index: 1;
	border: 4rpx solid rgba(249,115,22,0.35);
	overflow: hidden;
}
.charge-fill {
	position: absolute; top: 0; left: 0;
	width: 100%; height: 100%;
	border-radius: 50%;
	background: #F97316;
	animation: chargeUp 0.6s ease-out forwards;
	transform-origin: center;
}
@keyframes chargeUp {
	0%   { transform: scale(0); opacity: 0.8; }
	80%  { transform: scale(1); opacity: 0.35; }
	100% { transform: scale(1); opacity: 0.25; }
}

/* ============================
   Step 10: 浮层 / 动画
   ============================ */
/* 全屏 flash */
.flash-overlay {
	position: absolute;
	top: 0; right: 0; bottom: 0; left: 0;
	z-index: 60; pointer-events: none;
	background: radial-gradient(circle at 50% 60%, #FB923C, transparent 60%);
	opacity: 0.35;
	animation: flashOverlay 0.22s ease-out both;
}

/* 边缘光晕 */
.edge-glow {
	position: absolute;
	top: 0; right: 0; bottom: 0; left: 0;
	pointer-events: none; z-index: 55;
	animation: edgeGlow 0.6s ease-out forwards;
}

/* 连击徽章 */
.streak-badge {
	position: fixed; top: 256rpx; left: 50%;
	transform: translateX(-50%);
	padding: 16rpx 32rpx; border-radius: 999rpx;
	background: linear-gradient(135deg, #F97316, #EA580C);
	color: #fff; font-size: 28rpx; font-weight: 700;
	box-shadow: 0 20rpx 60rpx -12rpx rgba(249,115,22,0.55);
	z-index: 50;
	animation: streakPop 1.2s cubic-bezier(0.34,1.45,0.64,1) both;
}

/* 纸屑层 */
.confetti-layer {
	position: absolute;
	top: 0; right: 0; bottom: 0; left: 0;
	overflow: hidden; z-index: 40;
	pointer-events: none;
}
.confetti-piece {
	position: absolute; top: -20rpx;
	width: 20rpx; height: 28rpx;
	border-radius: 4rpx;
	animation: confettiDrop 1.4s cubic-bezier(0.2,0.6,0.4,1) both;
}

/* 骨架屏 / 重试层 */
.retry-layer {
	position: fixed; z-index: 100;
	top: 0; right: 0; bottom: 0; left: 0;
	display: flex; flex-direction: column;
	align-items: center; justify-content: center;
	background: #F3F4F6;
}
.skeleton-q {
	width: 640rpx; height: 480rpx;
	background: #E5E7EB; border-radius: 24rpx;
	margin-bottom: 48rpx;
}
.skeleton-opts { display: flex; flex-direction: column; gap: 28rpx; width: 80%; }
.skeleton-o {
	height: 100rpx; background: #E5E7EB;
	border-radius: 48rpx;
	animation: shimmer 1.5s linear infinite;
}
.retry-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.retry-text { font-size: 28rpx; color: #9CA3AF; margin-bottom: 40rpx; }
.retry-btn {
	padding: 24rpx 48rpx; border-radius: 999rpx;
	background: #F97316; color: #fff; font-size: 32rpx; font-weight: 700;
	box-shadow: 0 8rpx 24rpx -8rpx rgba(249,115,22,0.5);
	transition: transform 0.15s;
}
.press-95 { transform: scale(0.95); }
.retry-btn-text { color: #fff; }

/* ============================
   完整 @keyframes
   ============================ */

/* 光斑漂浮三份硬编码 */
@keyframes orbDriftA {
	0%, 100% { transform: translate(0,0) scale(1); }
	50% { transform: translate(80rpx,60rpx) scale(1.15); }
}
@keyframes orbDriftB {
	0%, 100% { transform: translate(0,0) scale(1); }
	50% { transform: translate(-100rpx,80rpx) scale(1.15); }
}
@keyframes orbDriftC {
	0%, 100% { transform: translate(0,0) scale(1); }
	50% { transform: translate(60rpx,-80rpx) scale(1.15); }
}

/* 数字翻滚双 animation-name */
@keyframes digitRollInA {
	0%   { opacity: 0; transform: translateY(28rpx) rotateX(-60deg); }
	100% { opacity: 1; transform: translateY(0) rotateX(0); }
}
@keyframes digitRollInB {
	0%   { opacity: 0; transform: translateY(28rpx) rotateX(-60deg); }
	100% { opacity: 1; transform: translateY(0) rotateX(0); }
}

/* motto 双态翻滚动画 */
@keyframes mottoRollA {
	0%   { opacity: 0; transform: translateY(28rpx) rotateX(-60deg); }
	100% { opacity: 1; transform: translateY(0) rotateX(0); }
}
@keyframes mottoRollB {
	0%   { opacity: 0; transform: translateY(28rpx) rotateX(-60deg); }
	100% { opacity: 1; transform: translateY(0) rotateX(0); }
}

/* 题目入场 */
@keyframes qIn {
	0%   { opacity: 0; transform: translateY(64rpx); }
	100% { opacity: 1; transform: translateY(0); }
}
/* 逐字浮现 */
@keyframes charDrop {
	0%   { opacity: 0; transform: translateY(40rpx) scale(0.85); filter: blur(8rpx); }
	100% { opacity: 1; transform: translateY(0) scale(1); filter: blur(0); }
}
/* 选项入场 */
@keyframes oIn {
	0%   { opacity: 0; transform: translateY(64rpx); }
	100% { opacity: 1; transform: translateY(0); }
}
/* 题目离场 */
@keyframes qOut {
	0%   { opacity: 1; transform: translateY(0); }
	100% { opacity: 0; transform: translateY(-64rpx); }
}
/* 选项离场 */
@keyframes oOut {
	0%   { opacity: 1; transform: translateY(0); }
	100% { opacity: 0; transform: translateY(-32rpx); }
}

/* 确认弹跳 */
@keyframes confirmPop {
	0%   { transform: scale(0.95); }
	55%  { transform: scale(1.04); }
	100% { transform: scale(1); }
}

/* 水波纹 */
@keyframes ripple {
	0%   { opacity: 0.45; transform: translate(-50%,-50%) scale(0); }
	100% { opacity: 0; transform: translate(-50%,-50%) scale(6); }
}
/* 描边环 */
@keyframes ringPulse {
	0%   { opacity: 0.6; transform: scale(0); }
	100% { opacity: 0; transform: scale(4); }
}
/* 粒子迸溅 */
@keyframes burstDot {
	0%   { opacity: 1; transform: rotate(var(--angle)) translateY(0) scale(1); }
	100% { opacity: 0; transform: rotate(var(--angle)) translateY(-80rpx) scale(0.3); }
}

/* 进度条过半脉冲 */
@keyframes barPulse {
	0%, 100% { box-shadow: 0 0 0 0 rgba(249,115,22,0); }
	50% { box-shadow: 0 0 0 12rpx rgba(249,115,22,0.18); }
}

/* 全屏 flash */
@keyframes flashOverlay {
	0%   { opacity: 0.35; }
	100% { opacity: 0; }
}

/* 边缘光晕 */
@keyframes edgeGlow {
	0%   { opacity: 0; box-shadow: inset 0 0 0 0 rgba(249,115,22,0); }
	30%  { opacity: 1; box-shadow: inset 0 0 120rpx 8rpx rgba(249,115,22,0.55); }
	100% { opacity: 0; box-shadow: inset 0 0 0 0 rgba(249,115,22,0); }
}

/* 连击徽章 — 0→1.1→1→0 + rotate(-8°→3°→0°)，1.2s 自动消失 */
@keyframes streakPop {
	0%   { opacity: 0; transform: translateX(-50%) scale(0) rotate(-8deg); }
	40%  { opacity: 1; transform: translateX(-50%) scale(1.1) rotate(3deg); }
	65%  { opacity: 1; transform: translateX(-50%) scale(1) rotate(0deg); }
	100% { opacity: 0; transform: translateX(-50%) scale(0) rotate(0deg); }
}




/* 闲置呼吸 */
@keyframes idleBreathe {
	0%, 100% { transform: translateY(0); }
	50% { transform: translateY(-6rpx); }
}

/* 纸屑下落（每片通过内联 style 设置 rot 硬编码值） */
@keyframes confettiDrop {
	0%   { opacity: 1; transform: translateY(0) rotate(0deg); }
	100% { opacity: 0; transform: translateY(110vh) rotate(720deg); }
}

/* 骨架屏 shimmer */
@keyframes shimmer {
	0%   { opacity: 0.5; }
	50%  { opacity: 1; }
	100% { opacity: 0.5; }
}

/* ===== mock 跳过按钮（临时测试） ===== */
.mock-skip {
	position: fixed; top: 16rpx; right: 16rpx; z-index: 999;
	padding: 4rpx 12rpx;
	background: rgba(249,115,22,0.12);
	color: #F97316; font-size: 20rpx; font-weight: 700;
	border-radius: 16rpx;
	border: 2rpx solid rgba(249,115,22,0.25);
	line-height: 1.6;
}

/* #ifdef H5 */
/* ===== 调试面板 ===== */
.debug-panel {
	position: fixed; bottom: 0; left: 0; right: 0;
	padding: 20rpx 32rpx 40rpx;
	background: rgba(255,255,255,0.96);
	backdrop-filter: blur(16rpx);
	z-index: 999;
	border-top: 2rpx solid rgba(0,0,0,0.06);
	box-shadow: 0 -8rpx 32rpx rgba(0,0,0,0.06);
}
.debug-hd {
	display: flex; align-items: center; justify-content: space-between;
	margin-bottom: 12rpx;
}
.debug-title { font-size: 22rpx; color: #999; font-weight: 600; }
.debug-close {
	width: 36rpx; height: 36rpx; border-radius: 50%;
	background: #f0f0f0; display: flex;
	align-items: center; justify-content: center;
	font-size: 22rpx; color: #999;
}
.debug-row {
	display: flex; align-items: center; gap: 16rpx;
	margin-bottom: 12rpx;
}
.debug-row:last-child { margin-bottom: 0; }
.debug-label { font-size: 24rpx; color: #666; white-space: nowrap; }
.debug-input {
	flex: 1; height: 56rpx; border: 2rpx solid #ddd;
	border-radius: 8rpx; padding: 0 16rpx; font-size: 26rpx;
	background: #fff; color: #333;
}
.debug-btn-wrap {
	position: relative;
}
/* #endif */
</style>
