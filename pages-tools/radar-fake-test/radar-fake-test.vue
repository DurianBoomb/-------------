<template>
	<view class="page">
		<view class="back-btn" :style="{ top: topPad + 'px' }" hover-class="btn-press" @click="goBack">
			<text>←</text>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="container">
				<text class="title">雷达图造假验收</text>
				<text class="subtitle">设置6维原始分 → 生成假雷达图</text>

				<!-- 雷达图画布 -->
				<view class="radar-area">
					<canvas type="2d" id="radarCanvas" class="radar-canvas"></canvas>
				</view>

				<!-- 维度滑块 -->
				<view class="sliders-card">
					<text class="sec-title">原始分设置（模拟答题 raw）</text>
					<view class="slider-row" v-for="(dim, i) in dimLabels" :key="dim">
						<view class="slider-hd">
							<text class="dim-label">{{ dim }}</text>
							<text class="dim-val">{{ rawScores[i] }}</text>
						</view>
						<slider
							class="dim-slider"
							:value="rawScores[i]"
							:min="0" :max="100" :step="1"
							activeColor="#F97316"
							backgroundColor="#E5E7EB"
							block-size="20"
							@change="e => onSliderChange(i, e)"
						/>
					</view>
				</view>

				<!-- 结果类型配置 -->
				<view class="config-card">
					<text class="sec-title">结果类型配置</text>

					<view class="config-row">
						<text class="config-label">主维度（match）</text>
						<picker :range="dimLabels" :value="mainDimIdx" @change="onMainDimChange">
							<view class="picker">{{ dimLabels[mainDimIdx] }} ▾</view>
						</picker>
					</view>

					<view class="config-row">
						<text class="config-label">结果类型名</text>
						<input class="config-input" v-model="resultName" placeholder="如：社交达人" />
					</view>

					<view class="config-row">
						<text class="config-label">种子分桶</text>
						<text class="config-hint">rawSum={{ rawSum }} → bucket={{ bucket }}</text>
					</view>
				</view>

				<!-- 生成按钮 -->
				<view class="gen-btn" hover-class="btn-press" @click="generate">
					<text>▶ 生成假雷达图</text>
				</view>

				<!-- 对比表 -->
				<view class="compare-card" v-if="fakeScores.length">
					<text class="sec-title">对比：Raw → Fake</text>
					<view class="compare-row compare-header">
						<text class="compare-label">维度</text>
						<text class="compare-val">Raw</text>
						<text class="compare-val fake">Fake</text>
						<text class="compare-diff">差值</text>
					</view>
					<view class="compare-row" v-for="(dim, i) in dimLabels" :key="dim" :class="{ 'is-main': i === mainDimIdx }">
						<text class="compare-label">{{ dim }}</text>
						<text class="compare-val">{{ rawScores[i] }}</text>
						<text class="compare-val fake" :class="{ 'main-mark': i === mainDimIdx }">{{ fakeScores[i] }}</text>
						<text class="compare-diff">{{ fakeScores[i] - rawScores[i] >= 0 ? '+' : '' }}{{ fakeScores[i] - rawScores[i] }}</text>
					</view>
				</view>

				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
const DIM_LABELS = ['社交力', '冒险心', '智力值', '创意度', '共情力', '抗压性']

export default {
	data() {
		return {
			topPad: 48,
			dimLabels: DIM_LABELS,
			rawScores: [67, 45, 80, 33, 55, 72],
			mainDimIdx: 2,
			resultName: '智者',
			fakeScores: [],
			_radarCanvas: null,
			_radarCtx: null,
		}
	},
	computed: {
		rawSum() {
			return this.rawScores.reduce((a, b) => a + b, 0)
		},
		bucket() {
			return Math.floor(this.rawSum / 20)
		},
	},
	onLoad() {
		try { const menu = uni.getMenuButtonBoundingClientRect(); this.topPad = menu.top } catch (e) {}
	},
	onReady() {
		this.$nextTick(() => this.initRadar())
	},
	methods: {
		onSliderChange(i, e) {
			this.rawScores[i] = e.detail.value
		},
		onMainDimChange(e) {
			this.mainDimIdx = e.detail.value
		},

		// ====== 雷达图初始化（与 radar-test.vue 一致） ======
		initRadar() {
			if (typeof window !== 'undefined' && document) {
				const el = document.getElementById('radarCanvas')
				if (el) { this._setupCanvas(el); return }
			}
			const q = uni.createSelectorQuery().in(this)
			q.select('#radarCanvas').fields({ node: true, size: true }).exec(res => {
				if (!res[0] || !res[0].node) return
				this._setupCanvas(res[0].node)
			})
		},
		_setupCanvas(canvas) {
			const ctx = canvas.getContext('2d')
			const dpr = uni.getSystemInfoSync().pixelRatio
			const SIZE = 280
			canvas.width = SIZE * dpr
			canvas.height = SIZE * dpr
			ctx.scale(dpr, dpr)
			this._radarCanvas = canvas
			this._radarCtx = ctx
		},

		// ====== 生成假数据 ======
		generate() {
			// 构建模拟的 resultType
			const resultType = {
				name: this.resultName || '默认结果',
				match: this.dimLabels[this.mainDimIdx]
			}
			const raw = [...this.rawScores]
			this.fakeScores = this.generateFakeScores(raw, resultType, this.dimLabels)

			// 重播雷达图
			if (this._radarCanvas && this._radarCtx) {
				this.startRadarAnim(this._radarCanvas, this._radarCtx, this.fakeScores, this.dimLabels)
			}
		},

		// ====== 4 个造假工具函数（来自 answer-quiz.vue） ======

		hashString(str) {
			let hash = 5381
			for (let i = 0; i < str.length; i++) {
				hash = ((hash << 5) + hash + str.charCodeAt(i)) | 0
			}
			return hash >>> 0
		},

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

		boxMuller(rng, mean, stddev) {
			let u1, u2
			do { u1 = rng() } while (u1 === 0)
			u2 = rng()
			const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
			return mean + z * stddev
		},

		generateFakeScores(raw, resultType, dims) {
			const rawSum = raw.reduce((a, b) => a + b, 0)
			const bucket = Math.floor(rawSum / 20)
			const seedStr = resultType.name + '_' + bucket
			const seed = this.hashString(seedStr)

			const mainIdx = dims.indexOf(resultType.match)
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

		// ====== 雷达图动画（与 radar-test.vue / result.vue 完全一致） ======
		startRadarAnim(canvas, ctx, scores, labels) {
			const SIZE = 280, CENTER = 140, RADIUS = 90
			const N = labels.length, ANGLE_STEP = (Math.PI * 2) / N, START_ANGLE = -Math.PI / 2
			const DURATION = 1900, START_DELAY = 450

			const sub = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)))
			const easeOutCubic = x => 1 - Math.pow(1 - x, 3)
			const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }
			const easeOutElastic = (x) => { if (x === 0 || x === 1) return x; const c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1 }

			const frac = (i, N) => N <= 1 ? 0 : i / (N - 1)
			const win = (i, N, startBase, startSpan, dur) => { const a = startBase + frac(i, N) * startSpan; return [a, a + dur] }
			const getPoint = (val, idx) => { const r = (val / 100) * RADIUS; const angle = idx * ANGLE_STEP + START_ANGLE; return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) } }

			const _raf = (cb) => typeof canvas.requestAnimationFrame === 'function' ? canvas.requestAnimationFrame(cb) : setTimeout(cb, 17)
			const _caf = (id) => typeof canvas.cancelAnimationFrame === 'function' ? canvas.cancelAnimationFrame(id) : clearTimeout(id)

			const drawGrids = (t) => {
				;[25, 50, 75, 100].forEach((level, idx) => {
					const local = sub(t, idx * 0.06, idx * 0.06 + 0.35)
					const s = easeOutBack(local)
					if (s <= 0) return
					ctx.beginPath()
					for (let i = 0; i < N; i++) { const p = getPoint(level * s, i); i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y) }
					ctx.closePath()
					ctx.setLineDash(level === 100 ? [] : [3, 3])
					ctx.strokeStyle = '#E5E7EB'
					ctx.lineWidth = 1
					ctx.globalAlpha = Math.min(1, local * 2.5)
					ctx.stroke()
				})
				ctx.setLineDash([])
				ctx.globalAlpha = 1
			}

			const drawAxes = (t) => {
				for (let i = 0; i < N; i++) {
					const [a, b] = win(i, N, 0.10, 0.15, 0.30)
					const local = sub(t, a, b)
					if (local <= 0) continue
					const end = getPoint(100 * easeOutCubic(local), i)
					ctx.beginPath()
					ctx.moveTo(CENTER, CENTER)
					ctx.lineTo(end.x, end.y)
					ctx.strokeStyle = '#E5E7EB'
					ctx.lineWidth = 1
					ctx.globalAlpha = Math.min(1, local * 3)
					ctx.stroke()
				}
				ctx.globalAlpha = 1
			}

			const drawShockwave = (t) => {
				const shockT = sub(t, 0.28, 0.62)
				if (shockT <= 0 || shockT >= 1) return
				ctx.beginPath()
				ctx.arc(CENTER, CENTER, shockT * RADIUS * 1.15, 0, Math.PI * 2)
				ctx.strokeStyle = '#FB923C'
				ctx.lineWidth = 2
				ctx.globalAlpha = (1 - shockT) * 0.55
				ctx.stroke()
				ctx.globalAlpha = 1
			}

			const computePoints = (t) => scores.map((s, i) => {
				const [a, b] = win(i, N, 0.30, 0.25, 0.40)
				const eased = easeOutBack(sub(t, a, b))
				const r = (s / 100) * RADIUS * eased
				const angle = i * ANGLE_STEP + START_ANGLE
				return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) }
			})

			const drawTrails = (t, points) => {
				for (let i = 0; i < N; i++) {
					const [a, b] = win(i, N, 0.30, 0.25, 0.45)
					const local = sub(t, a, b)
					const opacity = Math.sin(local * Math.PI) * 0.55
					if (opacity <= 0.02) continue
					ctx.beginPath()
					ctx.moveTo(CENTER, CENTER)
					ctx.lineTo(points[i].x, points[i].y)
					ctx.strokeStyle = '#FB923C'
					ctx.lineWidth = 1.5
					ctx.lineCap = 'round'
					ctx.globalAlpha = opacity
					ctx.stroke()
				}
				ctx.globalAlpha = 1; ctx.lineCap = 'butt'
			}

			const drawFill = (t, points) => {
				ctx.globalAlpha = sub(t, 0.42, 0.8)
				ctx.beginPath()
				for (let i = 0; i < N; i++) { i === 0 ? ctx.moveTo(points[i].x, points[i].y) : ctx.lineTo(points[i].x, points[i].y) }
				ctx.closePath()
				ctx.fillStyle = 'rgba(249, 115, 22, 0.2)'
				ctx.fill()
				ctx.globalAlpha = 1
			}

			const drawStroke = (t, points) => {
				ctx.globalAlpha = sub(t, 0.42, 0.72)
				ctx.beginPath()
				for (let i = 0; i < N; i++) { i === 0 ? ctx.moveTo(points[i].x, points[i].y) : ctx.lineTo(points[i].x, points[i].y) }
				ctx.closePath()
				ctx.strokeStyle = '#F97316'
				ctx.lineWidth = 3
				ctx.lineJoin = 'round'
				ctx.stroke()
				ctx.globalAlpha = 1; ctx.lineJoin = 'miter'
			}

			const drawFlash = (t, points) => {
				const flashT = sub(t, 0.78, 0.95)
				const opacity = Math.sin(flashT * Math.PI) * 0.85
				if (opacity <= 0.02) return
				ctx.globalAlpha = opacity
				ctx.beginPath()
				for (let i = 0; i < N; i++) { i === 0 ? ctx.moveTo(points[i].x, points[i].y) : ctx.lineTo(points[i].x, points[i].y) }
				ctx.closePath()
				ctx.strokeStyle = '#FFFFFF'
				ctx.lineWidth = 3
				ctx.lineJoin = 'round'
				ctx.stroke()
				ctx.globalAlpha = 1; ctx.lineJoin = 'miter'
			}

			const drawDots = (t, points) => {
				for (let i = 0; i < N; i++) {
					const [a, b] = win(i, N, 0.68, 0.14, 0.28)
					const local = sub(t, a, b)
					const pop = easeOutElastic(local)
					if (pop <= 0) continue
					ctx.beginPath()
					ctx.arc(points[i].x, points[i].y, 9 * pop, 0, Math.PI * 2)
					ctx.fillStyle = '#F97316'
					ctx.globalAlpha = (1 - local) * 0.35
					ctx.fill()
					ctx.beginPath()
					ctx.arc(points[i].x, points[i].y, 4 * pop, 0, Math.PI * 2)
					ctx.fillStyle = '#FFFFFF'
					ctx.globalAlpha = 1
					ctx.fill()
					ctx.lineWidth = 2; ctx.strokeStyle = '#F97316'
					ctx.stroke()
				}
				ctx.globalAlpha = 1
			}

			const drawScores = (t) => {
				for (let i = 0; i < N; i++) {
					const [a, b] = win(i, N, 0.52, 0.18, 0.35)
					const local = sub(t, a, b)
					if (local <= 0) continue
					const display = Math.round(scores[i] * easeOutCubic(local))
					const r = Math.max((scores[i] / 100) * RADIUS - 16, 22)
					const angle = i * ANGLE_STEP + START_ANGLE
					const x = CENTER + r * Math.cos(angle)
					const y = CENTER + r * Math.sin(angle) + 4
					ctx.fillStyle = '#F97316'
					ctx.font = '900 11px sans-serif'
					ctx.textAlign = 'center'
					ctx.textBaseline = 'alphabetic'
					ctx.globalAlpha = Math.min(1, local * 2)
					ctx.fillText(display + '', Math.round(x), Math.round(y))
				}
				ctx.globalAlpha = 1
			}

			const drawLabels = (t) => {
				for (let i = 0; i < N; i++) {
					const [a, b] = win(i, N, 0.82, 0.10, 0.16)
					const local = sub(t, a, b)
					if (local <= 0) continue
					const p = getPoint(123, i)
					if (p.x < CENTER - 10) ctx.textAlign = 'right'
					else if (p.x > CENTER + 10) ctx.textAlign = 'left'
					else ctx.textAlign = 'center'
					ctx.fillStyle = '#6B7280'
					ctx.font = 'bold 12px sans-serif'
					ctx.textBaseline = 'alphabetic'
					ctx.globalAlpha = local
					ctx.fillText(labels[i], Math.round(p.x), Math.round(p.y + 4))
				}
				ctx.globalAlpha = 1; ctx.textAlign = 'start'
			}

			const drawFrame = (t) => {
				ctx.clearRect(0, 0, SIZE, SIZE)
				ctx.globalAlpha = 1; ctx.setLineDash([]); ctx.lineCap = 'butt'; ctx.lineJoin = 'miter'; ctx.textAlign = 'start'; ctx.textBaseline = 'alphabetic'
				drawGrids(t)
				drawAxes(t)
				drawShockwave(t)
				const points = computePoints(t)
				drawTrails(t, points)
				drawFill(t, points)
				drawStroke(t, points)
				drawFlash(t, points)
				drawDots(t, points)
				drawScores(t)
				drawLabels(t)
			}

			let raf = 0, startTs = 0, t = 0
			const tick = (now) => {
				if (!startTs) startTs = now
				const elapsed = now - startTs - START_DELAY
				if (elapsed < 0) { raf = _raf(tick); return }
				t = Math.min(1, elapsed / DURATION)
				drawFrame(t)
				if (t < 1) raf = _raf(tick)
			}

			_caf(raf)
			startTs = 0; t = 0
			raf = _raf(tick)
		},

		goBack() {
			uni.navigateBack()
		}
	}
}
</script>

<style scoped>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; }

.back-btn {
	position: fixed; left: 24rpx; z-index: 100;
	width: 64rpx; height: 64rpx; border-radius: 50%;
	background: #fff; color: #364153;
	display: flex; align-items: center; justify-content: center;
	font-size: 28rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
}
.btn-press { transform: scale(.96); }

.body { flex: 1; }
.container { padding: 80rpx 40rpx 48rpx; display: flex; flex-direction: column; align-items: center; }

.title { font-size: 40rpx; font-weight: 900; color: #101828; }
.subtitle { font-size: 24rpx; color: #99A1AF; margin-top: 8rpx; margin-bottom: 24rpx; }

/* 雷达图 */
.radar-area { width: 560rpx; height: 560rpx; }
.radar-canvas { width: 560rpx; height: 560rpx; }

/* 卡片 */
.sec-title { font-size: 26rpx; font-weight: 700; color: #364153; display: block; margin-bottom: 20rpx; }

.sliders-card,
.config-card,
.compare-card {
	width: 100%; background: #fff; border-radius: 32rpx; padding: 28rpx 32rpx; margin-top: 24rpx;
}

/* 滑块行 */
.slider-row { margin-bottom: 16rpx; }
.slider-row:last-child { margin-bottom: 0; }
.slider-hd { display: flex; justify-content: space-between; align-items: center; margin-bottom: 4rpx; }
.dim-label { font-size: 26rpx; font-weight: 600; color: #364153; }
.dim-val { font-size: 24rpx; font-weight: 700; color: #F97316; }
.dim-slider { width: 100%; margin: 0; }

/* 配置 */
.config-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16rpx; }
.config-row:last-child { margin-bottom: 0; }
.config-label { font-size: 26rpx; color: #6B7280; }
.picker {
	font-size: 26rpx; font-weight: 600; color: #F97316; padding: 8rpx 20rpx;
	background: #FFF7ED; border-radius: 16rpx;
}
.config-input {
	font-size: 26rpx; color: #364153; text-align: right;
	padding: 8rpx 16rpx; background: #F3F4F6; border-radius: 16rpx; width: 200rpx;
}
.config-hint { font-size: 22rpx; color: #99A1AF; }

/* 生成按钮 */
.gen-btn {
	width: 100%; text-align: center; padding: 22rpx 0; border-radius: 32rpx;
	background: linear-gradient(90deg, #FB923C 0%, #EA580C 100%);
	color: #fff; font-size: 30rpx; font-weight: 700; margin-top: 24rpx;
}

/* 对比表 */
.compare-row {
	display: flex; align-items: center; padding: 12rpx 0;
	border-bottom: 1rpx solid #F3F4F6;
}
.compare-row:last-child { border-bottom: none; }
.compare-header { border-bottom: 2rpx solid #E5E7EB; padding-bottom: 8rpx; }
.compare-label { font-size: 24rpx; color: #6B7280; flex: 1; }
.compare-val { font-size: 24rpx; color: #364153; width: 80rpx; text-align: center; }
.compare-val.fake { color: #F97316; font-weight: 700; }
.compare-val.main-mark { color: #EA580C; font-size: 26rpx; }
.compare-diff { font-size: 22rpx; color: #99A1AF; width: 80rpx; text-align: center; }
.is-main { background: #FFF7ED; border-radius: 8rpx; padding: 12rpx 8rpx; }
.compare-header .compare-label,
.compare-header .compare-val,
.compare-header .compare-diff { font-weight: 700; color: #99A1AF; font-size: 22rpx; }

.bottom-spacer { height: 60rpx; }
</style>
