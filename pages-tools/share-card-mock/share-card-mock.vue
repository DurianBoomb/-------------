<!-- ========== 分享卡片 Mock 预览页 ========== -->
<template>
	<view class="page">
		<view class="top-bar" :style="{ paddingTop: topPad + 'px' }">
			<view class="back-btn" @click="goBack">
				<image class="back-icon" src="/static/left.svg" mode="aspectFit"></image>
			</view>
			<text class="top-title">分享卡片预览</text>
			<view class="spacer"></view>
		</view>

		<!-- 卡片预览区（Canvas CSS 尺寸缩放，内部分辨率不变） -->
		<view class="card-wrap" :style="{ width: displayW + 'px', height: displayH + 'px' }">
			<canvas type="2d" id="shareCardCanvas" class="card-canvas" :style="{ width: displayW + 'px', height: displayH + 'px' }"></canvas>
			<image v-if="previewImage" class="card-preview" :src="previewImage" mode="aspectFit" :style="{ width: displayW + 'px', height: displayH + 'px' }"></image>
		</view>

		<!-- 控制面板 -->
		<view class="ctl-panel" :style="{ width: displayW + 'px' }">
			<text class="ctl-label">当前样本数据</text>
			<view class="ctl-row">
				<text class="ctl-key">标签名</text>
				<text class="ctl-val">{{ mockData.tag }}</text>
			</view>
			<view class="ctl-row">
				<text class="ctl-key">结果名</text>
				<text class="ctl-val">{{ mockData.rname }}</text>
			</view>
			<view class="ctl-row">
				<text class="ctl-key">描述</text>
				<text class="ctl-val desc">{{ mockData.rdesc }}</text>
			</view>

			<view class="ctl-btns">
				<view class="ctl-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="switchSample('short')">短标题</view>
				<view class="ctl-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="switchSample('long')">长标题</view>
				<view class="ctl-btn" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="switchSample('chinese')">中文长名</view>
			</view>

			<!-- 红色矩形定位调试工具 -->
			<view class="rect-ctl">
				<text class="rect-title">红色矩形定位（中心坐标 + 宽高）</text>
				<view class="rect-step-row">
					<text class="rect-step-label">步进</text>
					<view class="step-group">
						<view class="step-btn" :class="{ active: rectStep === 1 }" hover-class="press-95" @click="setStep(1)">±1</view>
						<view class="step-btn" :class="{ active: rectStep === 5 }" hover-class="press-95" @click="setStep(5)">±5</view>
						<view class="step-btn" :class="{ active: rectStep === 10 }" hover-class="press-95" @click="setStep(10)">±10</view>
						<view class="step-btn" :class="{ active: rectStep === 20 }" hover-class="press-95" @click="setStep(20)">±20</view>
					</view>
				</view>
				<view class="rect-ctrl-row">
					<text class="rect-ctrl-label">中心X</text>
					<view class="step-group">
						<view class="step-btn" hover-class="press-95" @click="moveRect('x', -rectStep)">-{{rectStep}}</view>
						<text class="rect-val">{{rect.x}}</text>
						<view class="step-btn" hover-class="press-95" @click="moveRect('x', rectStep)">+{{rectStep}}</view>
					</view>
				</view>
				<view class="rect-ctrl-row">
					<text class="rect-ctrl-label">中心Y</text>
					<view class="step-group">
						<view class="step-btn" hover-class="press-95" @click="moveRect('y', -rectStep)">-{{rectStep}}</view>
						<text class="rect-val">{{rect.y}}</text>
						<view class="step-btn" hover-class="press-95" @click="moveRect('y', rectStep)">+{{rectStep}}</view>
					</view>
				</view>
				<view class="rect-ctrl-row">
					<text class="rect-ctrl-label">宽度</text>
					<view class="step-group">
						<view class="step-btn" hover-class="press-95" @click="moveRect('w', -rectStep)">-{{rectStep}}</view>
						<text class="rect-val">{{rect.w}}</text>
						<view class="step-btn" hover-class="press-95" @click="moveRect('w', rectStep)">+{{rectStep}}</view>
					</view>
				</view>
				<view class="rect-ctrl-row">
					<text class="rect-ctrl-label">高度</text>
					<view class="step-group">
						<view class="step-btn" hover-class="press-95" @click="moveRect('h', -rectStep)">-{{rectStep}}</view>
						<text class="rect-val">{{rect.h}}</text>
						<view class="step-btn" hover-class="press-95" @click="moveRect('h', rectStep)">+{{rectStep}}</view>
					</view>
				</view>
				<view class="rect-shell">
					<text>w={{rect.w}} h={{rect.h}} x={{rect.x}} y={{rect.y}}</text>
				</view>
			</view>

			<view class="ctl-btn ctl-btn-primary" hover-class="press-95" :hover-start-time="0" :hover-stay-time="150" @click="redraw">重新绘制</view>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			topPad: 48,
			cardW: 500,
			cardH: 400,
			displayW: 500,
			displayH: 400,
			previewImage: '',
			// 默认样本数据
			mockData: {
				tag: '群友成分鉴定',
				rname: '社交悍匪',
				rdesc: '你不是在群聊，你是在群聊里开演唱会。群友的每一条消息都是你的伴舞。'
			},
			// 红色矩形调试参数
			rect: { x: 250, y: 200, w: 180, h: 180 },
			rectStep: 1
		}
	},
	onLoad() {
		try { const menu = uni.getMenuButtonBoundingClientRect(); this.topPad = menu.top } catch (e) {}
		const sys = uni.getSystemInfoSync()
		const screenW = sys.windowWidth
		// 留 32rpx≈16px 边距
		const scale = Math.min(1, (screenW - 32) / this.cardW)
		this.displayW = Math.round(this.cardW * scale)
		this.displayH = Math.round(this.cardH * scale)
		this.$nextTick(() => {
			setTimeout(() => this.draw(), 300)
		})
	},
	methods: {
		goBack() {
			uni.navigateBack({ delta: 1 })
		},

		setStep(v) {
			this.rectStep = v
		},

		moveRect(key, delta) {
			this.rect[key] = Math.round(this.rect[key] + delta)
			if (this.rect.w < 1) this.rect.w = 1
			if (this.rect.h < 1) this.rect.h = 1
			this.redraw()
		},

		switchSample(type) {
			const samples = {
				short: {
					tag: 'MBTI性格',
					rname: 'INFP',
					rdesc: '调停者型人格，理想主义与创造力的化身。'
				},
				long: {
					tag: '你的隐藏人格是什么',
					rname: '超级无敌宇宙第一究极社交恐怖分子',
					rdesc: '你在社交场合的表现堪称炸裂级别，任何群聊只要有你在就会自动变成你的主场。群友们纷纷表示自从你来了之后群活跃度提升了300%。'
				},
		chinese: {
				tag: '群友成分鉴定',
				rname: '潜水观察员',
				rdesc: '你不说话不代表你不存在，你只是选择了一种更优雅的参与方式——暗中观察所有人的一举一动，然后在心里默默打分。',
				image: '/static/搬屎专员.jpg'
			}
			}
			if (samples[type]) {
				this.mockData = samples[type]
				this.previewImage = ''
				this.$nextTick(() => {
					setTimeout(() => this.draw(), 200)
				})
			}
		},

		redraw() {
			this.previewImage = ''
			this.$nextTick(() => {
				setTimeout(() => this.draw(), 100)
			})
		},

		draw() {
			const query = uni.createSelectorQuery().in(this)
			query.select('#shareCardCanvas').fields({ node: true, size: true }).exec(async res => {
				if (!res[0] || !res[0].node) return
				const canvas = res[0].node
				const ctx = canvas.getContext('2d')
				const dpr = uni.getSystemInfoSync().pixelRatio
				const W = this.cardW, H = this.cardH
				canvas.width = W * dpr
				canvas.height = H * dpr
				ctx.scale(dpr, dpr)

			const foxImg = await this._loadImage(canvas, '/static/给狐狸.png')
			const resultImg = await this._loadImage(canvas, '/static/熬夜守群人A.png')
			this._drawShareCard(ctx, W, H, foxImg, resultImg)

				// 转 tempFilePath 用于预览
				uni.canvasToTempFilePath({
					canvas,
					success: (r) => {
						this.previewImage = r.tempFilePath
					},
					fail: (e) => {
						console.error('[share-card-mock] canvasToTempFilePath fail:', e)
					}
				}, this)
			})
		},

		_drawShareCard(ctx, W, H, foxImg, resultImg) {
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

			// ====== 3. 结果形象图（熬夜守群人） ======
			if (resultImg) {
				const imgW = 180, imgH = 180
				const imgX = 385 - imgW / 2, imgY = 120 - imgH / 2
				ctx.drawImage(resultImg, imgX, imgY, imgW, imgH)
			}

			// ====== 4. 左 pill ======
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
			const mainTitle = this.mockData.rname || ''
			ctx.textAlign = 'left'
			ctx.textBaseline = 'top'
			ctx.fillStyle = '#1F2937'
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
			const desc = this.mockData.rdesc || ''
			ctx.fillStyle = '#6B7280'
			ctx.font = '400 16px sans-serif'
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

			ctx.textBaseline = 'middle'
			ctx.textAlign = 'left'
			ctx.fillStyle = '#FFFFFF'
			ctx.font = '28px sans-serif'
			ctx.fillText('👉', 56, 332)
			const tagName = this.mockData.tag || ''
			const ctaText = '来看看「' + tagName + '」'
			ctx.font = '700 20px sans-serif'
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

			// ====== 10. 红色矩形（调试定位用） ======
			const r = this.rect
			ctx.strokeStyle = 'rgba(255,0,0,0.85)'
			ctx.lineWidth = 2
			ctx.setLineDash([6, 4])
			ctx.strokeRect(r.x - r.w / 2, r.y - r.h / 2, r.w, r.h)
			ctx.setLineDash([])

			// 中心十字
			ctx.strokeStyle = 'rgba(255,0,0,0.6)'
			ctx.lineWidth = 1
			ctx.beginPath()
			ctx.moveTo(r.x - 8, r.y)
			ctx.lineTo(r.x + 8, r.y)
			ctx.moveTo(r.x, r.y - 8)
			ctx.lineTo(r.x, r.y + 8)
			ctx.stroke()

			// 左上角标注坐标
			ctx.fillStyle = 'rgba(255,0,0,0.85)'
			ctx.font = 'bold 11px sans-serif'
			ctx.textAlign = 'left'
			ctx.textBaseline = 'bottom'
			const label = `${r.w}×${r.h} @(${r.x},${r.y})`
			ctx.fillText(label, r.x - r.w / 2, r.y - r.h / 2 - 4)
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
		}
	}
}
</script>

<style scoped>
.page {
	width: 100%;
	min-height: 100vh;
	background: #F3F4F6;
	display: flex;
	flex-direction: column;
	align-items: center;
}

.top-bar {
	width: 100%;
	display: flex;
	align-items: center;
	padding: 16rpx 32rpx;
	box-sizing: border-box;
}
.back-btn {
	width: 64rpx;
	height: 64rpx;
	display: flex;
	align-items: center;
	justify-content: center;
}
.back-icon {
	width: 40rpx;
	height: 40rpx;
}
.top-title {
	flex: 1;
	text-align: center;
	font-size: 32rpx;
	font-weight: 700;
	color: #1F2937;
}
.spacer {
	width: 64rpx;
}

.card-wrap {
	margin-top: 40rpx;
	border-radius: 24rpx;
	overflow: hidden;
	box-shadow: 0 8px 32px rgba(0,0,0,0.12);
}
.card-canvas {
	display: block;
}
.card-preview {
	position: absolute;
	top: 0;
	left: 0;
}

.ctl-panel {
	margin-top: 40rpx;
	padding: 32rpx;
	background: #FFFFFF;
	border-radius: 24rpx;
	box-sizing: border-box;
	box-shadow: 0 2px 12px rgba(0,0,0,0.06);
}
.ctl-label {
	font-size: 28rpx;
	font-weight: 700;
	color: #1F2937;
	margin-bottom: 24rpx;
	display: block;
}
.ctl-row {
	display: flex;
	margin-bottom: 16rpx;
}
.ctl-key {
	width: 140rpx;
	font-size: 24rpx;
	color: #9CA3AF;
	flex-shrink: 0;
}
.ctl-val {
	font-size: 24rpx;
	color: #1F2937;
	flex: 1;
}
.ctl-val.desc {
	line-height: 1.6;
}
.ctl-btns {
	display: flex;
	gap: 16rpx;
	margin-top: 24rpx;
	flex-wrap: wrap;
}
.ctl-btn {
	padding: 16rpx 32rpx;
	border-radius: 16rpx;
	background: #F3F4F6;
	font-size: 24rpx;
	color: #6B7280;
	transition: all 0.15s;
}
.ctl-btn-primary {
	width: 100%;
	margin-top: 16rpx;
	text-align: center;
	background: linear-gradient(135deg, #FB923C, #EA580C);
	color: #FFFFFF;
	font-weight: 700;
	font-size: 28rpx;
	padding: 24rpx;
}
.press-95 {
	transform: scale(0.95);
}

/* 矩形定位工具 */
.rect-ctl {
	margin-top: 24rpx;
	padding-top: 24rpx;
	border-top: 1px solid #E5E7EB;
}
.rect-title {
	font-size: 24rpx;
	font-weight: 700;
	color: #EF4444;
	margin-bottom: 16rpx;
	display: block;
}
.rect-step-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 20rpx;
}
.rect-step-label {
	font-size: 22rpx;
	color: #9CA3AF;
}
.rect-ctrl-row {
	display: flex;
	align-items: center;
	justify-content: space-between;
	margin-bottom: 12rpx;
}
.rect-ctrl-label {
	font-size: 24rpx;
	font-weight: 600;
	color: #374151;
	width: 100rpx;
}
.step-group {
	display: flex;
	align-items: center;
	gap: 12rpx;
}
.step-btn {
	width: 64rpx;
	height: 48rpx;
	border-radius: 12rpx;
	background: #F3F4F6;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 22rpx;
	font-weight: 600;
	color: #6B7280;
	transition: all 0.15s;
}
.step-btn.active {
	background: #FEE2E2;
	color: #EF4444;
}
.rect-val {
	font-size: 26rpx;
	font-weight: 700;
	color: #EF4444;
	min-width: 80rpx;
	text-align: center;
}
.rect-shell {
	margin-top: 16rpx;
	padding: 12rpx 20rpx;
	background: #FEF2F2;
	border-radius: 12rpx;
	font-size: 20rpx;
	color: #DC2626;
	font-family: monospace;
	word-break: break-all;
}
</style>
