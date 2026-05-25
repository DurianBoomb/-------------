<!-- ========== 结果页 ========== -->
<template>
	<view class="page">
		<view class="back-btn" :style="{ top: topPad + 'px' }" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="100" @click="goHome">
			<image class="back-icon" src="/static/left.svg" mode="aspectFit"></image>
		</view>
		<!-- 隐藏 Canvas：用于生成分享图 -->
		<canvas type="2d" id="shareCanvas" class="share-canvas"></canvas>

		<scroll-view class="body" scroll-y :scroll-top="st">
			<view class="body-inner">
				<view class="anim-res-1">
			<view class="emoji-circle">
				<image v-if="resultImage" class="emoji-img" :src="resultImage" mode="aspectFit"></image>
				<text v-else class="emoji-txt">{{ emoji }}</text>
			</view>
					<text class="title-main">你被确诊为</text>
					<view class="badge">
						<text class="badge-txt">{{ rname }}</text>
					</view>
				</view>
				<view class="scroll-hint">
					<image class="scroll-arrow" src="/static/down——double.svg" mode="aspectFit"></image>
				</view>
			<view class="radar-area anim-res-2" :style="{ width: _px(radarSize) + 'px', height: _px(radarSize) + 'px' }">
				<canvas type="2d" id="radarCanvas" class="radar-canvas" :style="{ width: _px(radarSize) + 'px', height: _px(radarSize) + 'px' }"></canvas>
			</view>
				<view class="desc-card anim-res-3">
					<text class="desc-quote">"</text>
					<text class="desc-txt">{{ rdesc }}</text>
					<text class="creator-line" v-if="creatorNickname">—— 来自 <text class="creator-name">{{ creatorNickname }}</text> 的创作</text>
				</view>
				<view class="mini-tags anim-res-4" v-if="miniTags.length">
					<text class="mini-tags-title">🎲 继续发疯</text>
					<view class="mini-tags-grid">
						<view v-for="t in miniTags" :key="t._id"
							:class="['mini-tag', 'mini-' + (t.rarity || 'common')]"
							hover-class="tag-press"
							:hover-start-time="0" :hover-stay-time="150"
							@click="goMiniQuiz(t.name)"
						>
							<text>{{ t.name }}</text>
						</view>
					</view>
				</view>
			<view class="bottom-spacer"></view>
			</view>
		</scroll-view>

		<view class="footer anim-res-4">
			<view class="footer-inner">
				<button class="btn-share" open-type="share" hover-class="btn-press">
					<image class="share-icon" src="/static/share.svg" mode="aspectFit"></image><text>分享给朋友</text>
				</button>
			</view>
			<text class="footer-tag">测着玩的，别当真 😅</text>
		</view>
	</view>
</template>

<script>
export default {
		data() {
		return {
			scores: [85, 90, 40, 75, 80],
			labels: ['淀粉肠指数', '加肉程度', '社交油腻度', '性价比', '抗造性'],
		emoji: '🌭',
		resultImage: '',
		rname: '纯正淀粉肠',
			rdesc: '别挣扎了，你骨子里就是根5块钱的淀粉肠。',
			colors: [],
			tag: '',
			surveyId: '',
			radarSize: 760,

			creatorNickname: '',
			creatorId: '',  // 问卷创建者 ID，空值表示官方问卷
			isCreator: false, // 当前用户是否是问卷创建者
			topPad: 48,
			shareImagePath: '',
			miniTags: [],
			st: 0,

	
		}
	},
	async onLoad(o) {
		try { const menu = uni.getMenuButtonBoundingClientRect(); this.topPad = menu.top } catch (e) {}
		if (o.tag) this.tag = decodeURIComponent(o.tag)
		if (o.scores) this.scores = JSON.parse(decodeURIComponent(o.scores))
		if (o.dims) this.labels = JSON.parse(decodeURIComponent(o.dims))
		if (o.emoji) this.emoji = decodeURIComponent(o.emoji)
		if (o.rname) this.rname = decodeURIComponent(o.rname)
		if (o.rdesc) this.rdesc = decodeURIComponent(o.rdesc)
		if (o.colors) this.colors = JSON.parse(decodeURIComponent(o.colors))
		if (o.surveyId) this.surveyId = decodeURIComponent(o.surveyId)
		if (o.image) {
			this.resultImage = decodeURIComponent(o.image)
		}
	},
	onReady() {
		this.$nextTick(() => {
			this.initRadar()
			this.loadCreatorInfo()
			this.initShareCanvas()
			this.loadMiniTags()
			// 微滚动触发 Canvas 2D 在 scroll-view 内重新布局
			setTimeout(() => { this.st = 1 }, 100)
		})
	},

	onShow() {
		if (this._radarCanvas && this._radarCtx) {
			const SIZE = Math.round(this.radarSize / 2)
			this.startRadarAnim(this._radarCanvas, this._radarCtx, this.scores, this.labels, SIZE)
		}
	},

	onShareAppMessage() {
		return {
			title: '来看看「' + (this.rname || '结果') + '」',
			path: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(this.tag),
			imageUrl: this.shareImagePath || '/static/share-banner.png'
		}
	},
	methods: {
		_px(r) { try { return uni.upx2px(r) } catch (e) { return r } },
		initRadar() {
			// H5: 直接通过 DOM 获取 canvas 元素
			if (typeof window !== 'undefined' && document) {
				const el = document.getElementById('radarCanvas')
				if (el) { this._setupCanvas(el); return }
			}
			// 小程序: 通过 SelectorQuery 获取 Canvas 2D 节点
			const q = uni.createSelectorQuery().in(this)
			q.select('#radarCanvas').fields({ node: true, size: true }).exec(res => {
				if (!res[0] || !res[0].node) return
				this._setupCanvas(res[0].node)
			})
		},
		adjustRadarSize(delta) {
			this.radarSize = Math.max(400, Math.min(700, this.radarSize + delta))
			this.$nextTick(() => this.initRadar())
		},


		_setupCanvas(canvas) {
			const ctx = canvas.getContext('2d')
			const dpr = uni.getSystemInfoSync().pixelRatio
			const SIZE = Math.round(this.radarSize / 2)
			canvas.width = SIZE * dpr
			canvas.height = SIZE * dpr
			ctx.scale(dpr, dpr)
			this._radarCanvas = canvas
			this._radarCtx = ctx
			this.startRadarAnim(canvas, ctx, this.scores, this.labels, SIZE)
		},

		startRadarAnim(canvas, ctx, scores, labels, SIZE) {
			const CENTER = SIZE / 2, RADIUS = Math.round(SIZE * 0.28)
			const N = labels.length, ANGLE_STEP = (Math.PI * 2) / N, START_ANGLE = -Math.PI / 2
			const DURATION = 1900, START_DELAY = 450

			// 缓动函数
			const sub = (x, a, b) => Math.max(0, Math.min(1, (x - a) / (b - a)))
			const easeOutCubic = x => 1 - Math.pow(1 - x, 3)
			const easeOutBack = (x) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2) }
			const easeOutElastic = (x) => { if (x === 0 || x === 1) return x; const c4 = (2 * Math.PI) / 3; return Math.pow(2, -10 * x) * Math.sin((x * 10 - 0.75) * c4) + 1 }

			// 时间窗机制
			const frac = (i, N) => N <= 1 ? 0 : i / (N - 1)
			const win = (i, N, startBase, startSpan, dur) => { const a = startBase + frac(i, N) * startSpan; return [a, a + dur] }

			// 坐标
			const getPoint = (val, idx) => { const r = (val / 100) * RADIUS; const angle = idx * ANGLE_STEP + START_ANGLE; return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) } }

			// rAF 降级：微信小程序 Canvas 2D 可能不直接支持 canvas.requestAnimationFrame
			const _raf = (cb) => typeof canvas.requestAnimationFrame === 'function' ? canvas.requestAnimationFrame(cb) : setTimeout(cb, 17)
			const _caf = (id) => typeof canvas.cancelAnimationFrame === 'function' ? canvas.cancelAnimationFrame(id) : clearTimeout(id)

			// Layer 1: 网格 (4圈五边形)
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

			// Layer 2: 轴线
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

			// Layer 3: 冲击波
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

			// 数据点实时位置 (Layer 4-9 共用)
			const computePoints = (t) => scores.map((s, i) => {
				const [a, b] = win(i, N, 0.30, 0.25, 0.40)
				const eased = easeOutBack(sub(t, a, b))
				const r = (s / 100) * RADIUS * eased
				const angle = i * ANGLE_STEP + START_ANGLE
				return { x: CENTER + r * Math.cos(angle), y: CENTER + r * Math.sin(angle) }
			})

			// Layer 4: 拖尾
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

			// Layer 5: 数据填充
			const drawFill = (t, points) => {
				ctx.globalAlpha = sub(t, 0.42, 0.8)
				ctx.beginPath()
				for (let i = 0; i < N; i++) { i === 0 ? ctx.moveTo(points[i].x, points[i].y) : ctx.lineTo(points[i].x, points[i].y) }
				ctx.closePath()
				ctx.fillStyle = 'rgba(249, 115, 22, 0.2)'
				ctx.fill()
				ctx.globalAlpha = 1
			}

			// Layer 6: 数据描边
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

			// Layer 7: 白闪高光
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

			// Layer 8: 顶点弹性弹出 + 光晕
			const drawDots = (t, points) => {
				for (let i = 0; i < N; i++) {
					const [a, b] = win(i, N, 0.68, 0.14, 0.28)
					const local = sub(t, a, b)
					const pop = easeOutElastic(local)
					if (pop <= 0) continue
					// 光晕
					ctx.beginPath()
					ctx.arc(points[i].x, points[i].y, 9 * pop, 0, Math.PI * 2)
					ctx.fillStyle = '#F97316'
					ctx.globalAlpha = (1 - local) * 0.35
					ctx.fill()
					// 实心圆
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

			// Layer 9: 分数数字滚动
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

			// Layer 10: 维度标签淡入（每4字自动换行）
			const drawLabel = (text, x, y) => {
				const lines = text.match(/.{1,4}/g) || [text]
				const lineH = 15
				const startY = y - (lines.length - 1) * lineH / 2
				lines.forEach((line, li) => {
					ctx.fillText(line, Math.round(x), Math.round(startY + li * lineH))
				})
			}
			const drawLabels = (t) => {
				for (let i = 0; i < N; i++) {
					const [a, b] = win(i, N, 0.82, 0.10, 0.16)
					const local = sub(t, a, b)
					if (local <= 0) continue
					const p = getPoint(115, i)
					if (p.x < CENTER - 10) ctx.textAlign = 'right'
					else if (p.x > CENTER + 10) ctx.textAlign = 'left'
					else ctx.textAlign = 'center'
					ctx.fillStyle = '#6B7280'
					ctx.font = 'bold 12px sans-serif'
					ctx.textBaseline = 'alphabetic'
					ctx.globalAlpha = local
					drawLabel(labels[i], p.x, p.y + 4)
				}
				ctx.globalAlpha = 1; ctx.textAlign = 'start'
			}

			// 每帧全量绘制编排
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

			// rAF 主循环
			let raf = 0, startTs = 0, t = 0
			const tick = (now) => {
				if (!startTs) startTs = now
				const elapsed = now - startTs - START_DELAY
				if (elapsed < 0) { raf = _raf(tick); return }
				t = Math.min(1, elapsed / DURATION)
				drawFrame(t)
				if (t < 1) raf = _raf(tick)
			}

			// 启动（cancel旧帧 + 重置）
			_caf(raf)
			startTs = 0; t = 0
			raf = _raf(tick)
		},

		// ====== 分享图 ======

		initShareCanvas() {
			const query = uni.createSelectorQuery().in(this)
			query.select('#shareCanvas').fields({ node: true, size: true }).exec(async res => {
				if (!res[0] || !res[0].node) return
				const canvas = res[0].node
				const ctx = canvas.getContext('2d')
				const dpr = uni.getSystemInfoSync().pixelRatio
				const W = 500, H = 400
				canvas.width = W * dpr
				canvas.height = H * dpr
				ctx.scale(dpr, dpr)

				const foxImg = await this._loadImage(canvas, '/static/给狐狸.png')

				this._drawShareCard(ctx, W, H, foxImg)

				uni.canvasToTempFilePath({
					canvas,
					success: (r) => {
						this.shareImagePath = r.tempFilePath
					},
					fail: () => {}
				}, this)
			})
		},

		_drawShareCard(ctx, W, H, foxImg) {
			// ====== 1. 背景渐变 ======
			const bgGrad = ctx.createLinearGradient(0, 0, 0, H)
			bgGrad.addColorStop(0, '#FFF7ED')
			bgGrad.addColorStop(1, '#FFEAD5')
			ctx.fillStyle = bgGrad
			ctx.fillRect(0, 0, W, H)

			// ====== 2. 装饰色斑 ======
			ctx.beginPath()
			ctx.arc(520, -40, 170, 0, Math.PI * 2)
			ctx.fillStyle = 'rgba(251,146,60,0.20)'
			ctx.fill()
			ctx.beginPath()
			ctx.arc(-30, 420, 130, 0, Math.PI * 2)
			ctx.fillStyle = 'rgba(252,211,77,0.22)'
			ctx.fill()

			// 小圆点
			const dots = [
				{ x: 52, y: 96, r: 3, color: '#F97316' },
				{ x: 458, y: 118, r: 4, color: '#FB923C' },
				{ x: 78, y: 348, r: 3, color: '#FCD34D' },
				{ x: 432, y: 372, r: 3, color: '#F97316' },
			]
			dots.forEach(d => {
				ctx.beginPath()
				ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2)
				ctx.fillStyle = d.color
				ctx.fill()
			})

			// ====== 3. 左 pill ======
			this._roundRect(ctx, 32, 32, 124, 36, 18)
			ctx.fillStyle = '#1F2937'
			ctx.fill()
			ctx.font = '600 14px sans-serif'
			const brandText = '大狐狸出品'
			const brandW = ctx.measureText(brandText).width
			const foxW = 22, gap = 4
			const startX = 32 + (124 - (foxW + gap + brandW)) / 2
			if (foxImg) {
				ctx.drawImage(foxImg, startX, 38, foxW, 22)
			}
			ctx.fillStyle = '#FFFFFF'
			ctx.textAlign = 'left'
			ctx.textBaseline = 'middle'
			ctx.fillText(brandText, startX + foxW + gap, 50)

			// ====== 4. 右 pill ======
			this._roundRect(ctx, 360, 32, 108, 36, 18)
			ctx.fillStyle = 'rgba(255,255,255,0.70)'
			ctx.fill()
			ctx.strokeStyle = '#F97316'
			ctx.lineWidth = 1.5
			ctx.stroke()
			ctx.fillStyle = '#F97316'
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.font = '600 13px sans-serif'
			ctx.fillText('🔥 趣味测试', 414, 50)

			// ====== 5. 今日确诊 ======
			this._roundRect(ctx, 38, 120, 84, 26, 13)
			ctx.fillStyle = '#F97316'
			ctx.fill()
			ctx.fillStyle = '#FFFFFF'
			ctx.textAlign = 'center'
			ctx.textBaseline = 'middle'
			ctx.font = '700 13px sans-serif'
			ctx.fillText('今日确诊', 80, 133)

		// ====== 6. 主标题：结果名 ======
		const mainTitle = this.rname || ''
			ctx.textAlign = 'left'
			ctx.textBaseline = 'top'
			ctx.fillStyle = '#1F2937'
			// 先测完整宽度，按字数选字号
			const titleSizes = [
				{ maxLen: 8, size: 48 },
				{ maxLen: 12, size: 40 },
				{ maxLen: Infinity, size: 32 },
			]
			let tSize = 48
			for (const t of titleSizes) {
				if (mainTitle.length <= t.maxLen) { tSize = t.size; break }
			}
			while (tSize > 32) {
				ctx.font = `900 ${tSize}px sans-serif`
				if (ctx.measureText(mainTitle).width <= 420) break
				const idx = titleSizes.findIndex(ti => ti.size === tSize)
				tSize = idx < titleSizes.length - 1 ? titleSizes[idx + 1].size : 32
			}
			ctx.font = `900 ${tSize}px sans-serif`
			ctx.fillText(mainTitle, 38, 158)

			// ====== 7. 副标题：描述 ======
			const desc = this.rdesc || ''
			ctx.fillStyle = '#6B7280'
			ctx.font = '400 16px sans-serif'
			// 超长截断
			let dispDesc = desc
			if (ctx.measureText(desc).width > 420) {
				let s = desc
				while (s.length > 0) {
					const test = s.slice(0, -1) + '…'
					if (ctx.measureText(test).width <= 420) { dispDesc = test; break }
					s = s.slice(0, -1)
				}
			}
			ctx.fillText(dispDesc, 38, 222)

			// ====== 8. 分隔线 + 菱形 ======
			ctx.strokeStyle = '#FCD34D'
			ctx.lineWidth = 2
			ctx.beginPath()
			ctx.moveTo(38, 274)
			ctx.lineTo(220, 274)
			ctx.stroke()
			ctx.beginPath()
			ctx.moveTo(260, 274)
			ctx.lineTo(462, 274)
			ctx.stroke()
			ctx.save()
			ctx.translate(240, 274)
			ctx.rotate(Math.PI / 4)
			ctx.fillStyle = '#F97316'
			ctx.fillRect(-5, -5, 10, 10)
			ctx.restore()

			// ====== 9. CTA 按钮 ======
			this._roundRect(ctx, 32, 296, 436, 72, 24)
			const ctaGrad = ctx.createLinearGradient(32, 332, 468, 332)
			ctaGrad.addColorStop(0, '#FB923C')
			ctaGrad.addColorStop(1, '#EA580C')
			ctx.fillStyle = ctaGrad
			ctx.fill()

			// CTA 内容
			ctx.textBaseline = 'middle'
			ctx.textAlign = 'left'
			ctx.fillStyle = '#FFFFFF'
			ctx.font = '28px sans-serif'
			ctx.fillText('👉', 56, 332)
			const tagName = this.tag || ''
			const ctaText = '来看看「' + tagName + '」'
			ctx.font = '700 20px sans-serif'
			// 超长截断
			let dispCta = ctaText
			if (ctx.measureText(ctaText).width > 320) {
				const prefix = '来看看「'
				const suffix = '」'
				let t = tagName
				while (t.length > 0) {
					const test = prefix + t.slice(0, -1) + '…' + suffix
					if (ctx.measureText(test).width <= 320) { dispCta = test; break }
					t = t.slice(0, -1)
				}
			}
			ctx.fillText(dispCta, 96, 332)
			ctx.font = '700 32px sans-serif'
			ctx.fillText('›', 440, 332)
		},

		_roundRect(ctx, x, y, w, h, r) {
			ctx.beginPath()
			ctx.moveTo(x + r, y)
			ctx.arcTo(x + w, y, x + w, y + h, r)
			ctx.arcTo(x + w, y + h, x, y + h, r)
			ctx.arcTo(x, y + h, x, y, r)
			ctx.arcTo(x, y, x + w, y, r)
			ctx.closePath()
		},

		_loadImage(canvas, src) {
			return new Promise(resolve => {
				const img = canvas.createImage()
				img.onload = () => resolve(img)
				img.onerror = () => resolve(null)
				img.src = src
			})
		},

		goHome() {
			uni.navigateBack()
		},
		retry() {
			uni.redirectTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(this.tag) })
		},

		async loadMiniTags() {
			const survey = uniCloud.importObject('survey')
			try {
				const res = await survey.getTagList({ pageSize: 30, sortBy: 'random' })
				if (res.errCode !== 0 || !res.data) return
				const list = (res.data.list || []).filter(t => t.name !== this.tag)
				this.miniTags = this.limitRows(list, 3)
			} catch (e) { console.error('[result] loadMiniTags:', e) }
		},
		limitRows(tags, maxRows) {
			const availableWidth = 750 - 96
			const gap = 16
			const cfg = {
				common: { fontSize: 22, hPad: 10 },
				rare: { fontSize: 22, hPad: 10 },
				mythic: { fontSize: 22, hPad: 10 },
				epic: { fontSize: 26, hPad: 12 },
				legendary: { fontSize: 26, hPad: 12 },
				darkgold: { fontSize: 28, hPad: 14 }
			}
			let rows = 0, rowWidth = 0
			const result = []
			for (const tag of tags) {
				const c = cfg[tag.rarity] || cfg.common
				const tw = c.hPad * 2 + tag.name.length * c.fontSize * 0.85
				if (rowWidth + tw + (result.length > 0 && rowWidth > 0 ? gap : 0) > availableWidth) {
					rows++
					if (rows >= maxRows) break
					rowWidth = tw
				} else {
					rowWidth += tw + (rowWidth > 0 ? gap : 0)
				}
				result.push(tag)
			}
			return result
		},
		goMiniQuiz(tag) {
			uni.navigateTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(tag) })
		},

		async loadCreatorInfo() {
			if (!this.surveyId) return
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getSurveyDetail({ surveyId: this.surveyId })
				if (res.errCode === 0) {
					this.creatorNickname = res.data.creatorNickname || ''
					this.creatorId = res.data.creatorId || ''
					this.isCreator = !!res.data.isCreator
				}
			} catch (e) { console.error('[result] loadCreatorInfo:', e) }
		},

	}
}
</script>

<style scoped>
/* ====== 结果页入场动画 ====== */
@keyframes resDrop {
	0%   { opacity: 0; transform: translateY(-60px); }
	100% { opacity: 1; transform: translateY(0); }
}
@keyframes resScale {
	0%   { opacity: 0; transform: scale(0.5) translateY(-60rpx); }
	100% { opacity: 1; transform: scale(1) translateY(-60rpx); }
}
@keyframes resSlide {
	0%   { opacity: 0; transform: translateY(40px); }
	100% { opacity: 1; transform: translateY(0); }
}
.anim-res-1 { animation: resDrop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0s both; display: flex; flex-direction: column; align-items: center; width: 100%; }
.anim-res-2 { animation: resScale 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.15s both; }
.anim-res-3 { animation: resSlide 0.4s ease-out 0.3s both; }
.anim-res-4 { animation: resSlide 0.3s ease-out 0.45s both; }

.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; position: relative; }
.back-btn {
	position: fixed; left: 24rpx; z-index: 100;
	width: 64rpx; height: 64rpx; border-radius: 50%;
	background: #fff; color: #364153;
	display: flex; align-items: center; justify-content: center;
	font-size: 28rpx; transition: transform 0.15s;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
}
.back-icon { width: 32rpx; height: 32rpx; }
.share-icon { width: 36rpx; height: 36rpx; }
.body { flex: 1; }
.body-inner { padding: 24rpx 48rpx 0; display: flex; flex-direction: column; align-items: center; }
.emoji-circle {
	width: 600rpx; height: 600rpx;
	display: flex; align-items: center; justify-content: center;
}
.emoji-img { width: 600rpx; height: 600rpx; }
.emoji-txt { font-size: 300rpx; line-height: 1; text-align: center; }
.title-main { font-size: 60rpx; font-weight: 900; color: #101828; text-align: center; margin-top: 0; width: 100%; display: block; }
.badge {
	background: #FFEDD4; border-radius: 60rpx; padding: 12rpx 36rpx; margin-top: 4rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	outline: 3rpx solid #FFD6A8; outline-offset: -3rpx;
}
.badge-txt { font-size: 28rpx; color: #CA3500; font-weight: 700; white-space: nowrap; }
.radar-area { align-self: center; display: flex; justify-content: center; }

.desc-card {
	width: 100%; background: #fff; border-radius: 48rpx; padding: 50rpx;
	margin-top: 64rpx; position: relative;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	outline: 3rpx solid #F3F4F6; outline-offset: -3rpx;
}
.desc-quote {
	position: absolute; top: -14rpx; left: -6rpx;
	font-size: 160rpx; color: #F9FAFB; font-family: Georgia; line-height: 1; opacity: .5;
}
.desc-txt { font-size: 30rpx; color: #4A5565; font-weight: 500; line-height: 1.8; text-align: justify; letter-spacing: 0.76rpx; }
.creator-line { display: block; font-size: 24rpx; color: #99A1AF; margin-top: 24rpx; text-align: right; font-weight: 400; }
.creator-name { color: #F97316; font-weight: 600; }
.mini-tags { margin-top: 40rpx; }
.mini-tags-title { font-size: 28rpx; font-weight: 700; color: #1E2939; display: block; margin-bottom: 20rpx; }
.mini-tags-grid { display: flex; flex-wrap: wrap; gap: 16rpx; }
.mini-tag {
	padding: 10rpx 20rpx; border-radius: 40rpx;
	font-size: 22rpx; font-weight: 500;
	background: white; color: #374151;
	border: 1rpx solid #D1D5DC;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.06);
	transition: transform 0.1s;
	white-space: nowrap; max-width: 100%; overflow: hidden; text-overflow: ellipsis;
}
.mini-common { background: #F7F8FA; color: #101828; border-color: #D1D5DC; box-shadow: none; }
.mini-rare { background: white; color: #4FC3F7; border-color: #4FC3F7; }
.mini-mythic { background: white; color: #22C55E; border-color: #22C55E; }
.mini-epic { padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 600; background: white; color: #A855F7; border-color: #A855F7; }
.mini-legendary { padding: 14rpx 24rpx; font-size: 26rpx; font-weight: 600; background: white; color: #EF4444; border-color: #EF4444; }
.mini-darkgold {
	padding: 16rpx 28rpx; font-size: 28rpx; font-weight: 900;
	background: #1A1A1A; color: #C9A84C;
	border-color: #C9A84C;
	text-shadow: 0 0 6rpx rgba(201,168,76,0.5);
	animation: miniDarkgoldGlow 3s ease-in-out infinite;
}
.tag-press { transform: scale(0.94); }

.scroll-hint {
	display: flex;
	justify-content: center;
	align-items: center;
	margin-top: 32rpx;
}
.scroll-arrow {
	width: 44rpx;
	height: 44rpx;
	animation: bounceDown 1.8s ease-in-out infinite;
}
@keyframes bounceDown {
	0%, 100% { transform: translateY(0); opacity: 0.6; }
	50% { transform: translateY(14rpx); opacity: 1; }
}
@keyframes miniDarkgoldGlow {
	0%, 100% { box-shadow: 0 0 8rpx rgba(201,168,76,0.3); border-color: #C9A84C; }
	50% { box-shadow: 0 0 20rpx rgba(201,168,76,0.55); border-color: #E6C85C; }
}
.bottom-spacer { height: 200rpx; }
.footer {
	position: fixed; bottom: 0; left: 0; right: 0; padding: 0 24rpx 30rpx;
	background: linear-gradient(0deg, #F7F8FA 0%, #F7F8FA 50%, transparent 100%);
	display: flex; flex-direction: column; align-items: center;
}
.footer-inner { display: flex; width: 100%; padding: 0 24rpx; }
.btn-share { width: 100%; height: 118rpx; border-radius: 60rpx; display: flex; align-items: center; justify-content: center; gap: 6rpx; font-size: 32rpx; font-weight: 700; background: linear-gradient(90deg, #FFB900 0%, #FF6900 100%); color: #fff; box-shadow: 0 2rpx 4rpx -2rpx rgba(255,105,0,.3), 0 4rpx 6rpx -1rpx rgba(255,105,0,.3); margin: 0; padding: 0; border: none; line-height: 1; }
.btn-share::after { border: none; }
.btn-press { transform: scale(.96); }
.footer-tag { font-size: 24rpx; color: #99A1AF; font-weight: 500; margin-top: 16rpx; }

.share-canvas {
	position: fixed;
	left: -9999px;
	top: -9999px;
	width: 500px;
	height: 400px;
}

</style>
