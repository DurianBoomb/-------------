<template>
	<view class="page">
		<view class="back-btn" :style="{ top: topPad + 'px' }" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="100" @click="goBack">
			<text>←</text>
		</view>
		<view class="container">
			<text class="title">雷达图预览</text>
			<text class="subtitle">测试不同维度的入场动画效果</text>

			<view class="radar-area">
				<canvas type="2d" id="radarCanvas" class="radar-canvas"></canvas>
			</view>

			<view class="controls">
				<view class="ctrl-row">
					<text class="label">维度数:</text>
					<view class="seg-control">
						<view v-for="n in dimOptions" :key="n"
							class="seg-item" :class="{ active: dimCount === n }"
							@click="setDimCount(n)">{{ n }}</view>
					</view>
				</view>
				<view class="ctrl-row">
					<text class="label">数据:</text>
					<view class="presets">
						<view class="preset-btn" :class="{ active: dataPreset === 'balanced' }" @click="setPreset('balanced')">均衡</view>
						<view class="preset-btn" :class="{ active: dataPreset === 'spiky' }" @click="setPreset('spiky')">尖刺</view>
						<view class="preset-btn" :class="{ active: dataPreset === 'weak' }" @click="setPreset('weak')">偏弱</view>
					</view>
				</view>
				<view class="ctrl-row">
					<view class="replay-btn" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="100" @click="replay">▶ 重播动画</view>
				</view>
			</view>

			<view class="data-table" v-if="scores.length">
				<view class="table-row" v-for="(s, i) in scores" :key="i">
					<text class="table-label">{{ labels[i] }}</text>
					<view class="table-bar-wrap">
						<view class="table-bar" :style="{ width: s + '%' }"></view>
					</view>
					<text class="table-val">{{ s }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
const DIM_LABELS_POOL = [
	'淀粉肠指数', '加肉程度', '社交油腻度', '性价比', '抗造性',
	'回甘度', '后劲', '颜值', '亲民度', '上头指数'
]

export default {
	data() {
		return {
			topPad: 48,
			dimCount: 5,
			dimOptions: [3, 4, 5, 6, 8, 10],
			labels: DIM_LABELS_POOL.slice(0, 5),
			scores: [78, 92, 35, 68, 85],
			dataPreset: 'balanced',
			_radarCanvas: null,
			_radarCtx: null,
		}
	},
	onLoad() {
		try { const menu = uni.getMenuButtonBoundingClientRect(); this.topPad = menu.top } catch (e) {}
	},
	onReady() {
		this.$nextTick(() => this.initRadar())
	},
	methods: {
		setDimCount(n) {
			this.dimCount = n
			this.labels = DIM_LABELS_POOL.slice(0, n)
			this.setPreset(this.dataPreset)
		},
		setPreset(name) {
			this.dataPreset = name
			const n = this.dimCount
			switch (name) {
				case 'balanced':
					this.scores = Array.from({ length: n }, () => 40 + Math.round(Math.random() * 50))
					break
				case 'spiky':
					this.scores = Array.from({ length: n }, (_, i) => i % 2 === 0 ? 85 + Math.round(Math.random() * 15) : 20 + Math.round(Math.random() * 20))
					break
				case 'weak':
					this.scores = Array.from({ length: n }, () => 25 + Math.round(Math.random() * 25))
					break
			}
			this.$nextTick(() => this.replay())
		},
		initRadar() {
			// H5: 直接通过 DOM 获取 canvas 元素
			if (typeof window !== 'undefined' && document) {
				const el = document.getElementById('radarCanvas')
				if (el) {
					console.log('[radar] H5 mode, canvas found:', el)
					this._setupCanvas(el)
					return
				}
				console.warn('[radar] H5 mode, canvas element NOT FOUND by id')
			}
			// 小程序: 通过 SelectorQuery 获取 Canvas 2D 节点
			const q = uni.createSelectorQuery().in(this)
			q.select('#radarCanvas').fields({ node: true, size: true }).exec(res => {
				if (!res[0] || !res[0].node) {
					console.warn('[radar] SelectorQuery failed to get canvas node')
					return
				}
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
			this.startRadarAnim(canvas, ctx, this.scores, this.labels)
		},
		replay() {
			if (this._radarCanvas && this._radarCtx) {
				this.startRadarAnim(this._radarCanvas, this._radarCtx, this.scores, this.labels)
			}
		},

		// ========== 雷达图动画（与 result.vue 完全一致） ==========
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

			// rAF 降级：微信小程序 Canvas 2D 可能不直接支持 canvas.requestAnimationFrame
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
					const p = getPoint(130, i)
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
	font-size: 28rpx; transition: transform 0.15s;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
}
.btn-press { transform: scale(.96); }

.container { padding: 80rpx 48rpx 48rpx; display: flex; flex-direction: column; align-items: center; }
.title { font-size: 44rpx; font-weight: 900; color: #101828; }
.subtitle { font-size: 26rpx; color: #99A1AF; margin-top: 8rpx; }

.radar-area { width: 560rpx; height: 560rpx; margin-top: 24rpx; }
.radar-canvas { width: 560rpx; height: 560rpx; }

.controls { width: 100%; margin-top: 32rpx; background: #fff; border-radius: 32rpx; padding: 32rpx; }
.ctrl-row { display: flex; align-items: center; gap: 16rpx; margin-bottom: 20rpx; }
.ctrl-row:last-child { margin-bottom: 0; }
.label { font-size: 26rpx; font-weight: 600; color: #6B7280; width: 100rpx; flex-shrink: 0; }

.seg-control { display: flex; gap: 8rpx; flex-wrap: wrap; }
.seg-item {
	padding: 8rpx 24rpx; border-radius: 30rpx; font-size: 26rpx; font-weight: 600;
	background: #F3F4F6; color: #6B7280; transition: all .15s;
}
.seg-item.active { background: #F97316; color: #fff; }

.presets { display: flex; gap: 8rpx; }
.preset-btn {
	padding: 8rpx 24rpx; border-radius: 30rpx; font-size: 26rpx; font-weight: 600;
	background: #F3F4F6; color: #6B7280; transition: all .15s;
}
.preset-btn.active { background: #F97316; color: #fff; }

.replay-btn {
	width: 100%; text-align: center; padding: 20rpx 0; border-radius: 30rpx;
	background: linear-gradient(90deg, #FB923C 0%, #EA580C 100%);
	color: #fff; font-size: 28rpx; font-weight: 700; transition: transform .15s;
}

.data-table { width: 100%; margin-top: 24rpx; background: #fff; border-radius: 32rpx; padding: 24rpx 32rpx; }
.table-row { display: flex; align-items: center; gap: 16rpx; padding: 12rpx 0; border-bottom: 1rpx solid #F3F4F6; }
.table-row:last-child { border-bottom: none; }
.table-label { font-size: 24rpx; color: #6B7280; width: 140rpx; flex-shrink: 0; }
.table-bar-wrap { flex: 1; height: 12rpx; background: #F3F4F6; border-radius: 6rpx; overflow: hidden; }
.table-bar { height: 100%; background: linear-gradient(90deg, #FB923C, #F97316); border-radius: 6rpx; transition: width .3s; }
.table-val { font-size: 24rpx; font-weight: 700; color: #F97316; width: 48rpx; text-align: right; }
</style>
