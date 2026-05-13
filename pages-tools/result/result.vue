<!-- ========== 结果页 ========== -->
<template>
	<view class="page">
		<view class="back-btn" :style="{ top: topPad + 'px' }" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="100" @click="goHome">
			<text>←</text>
		</view>
		<scroll-view class="body" scroll-y>
			<view class="body-inner">
				<view class="emoji-circle">
					<text class="emoji-txt">{{ emoji }}</text>
				</view>
				<text class="title-main">你被确诊为</text>
				<view class="badge">
					<text class="badge-txt">{{ rname }}</text>
				</view>
				<view class="radar-area">
					<canvas type="2d" id="radarCanvas" class="radar-canvas"></canvas>
				</view>
				<view class="desc-card">
					<text class="desc-quote">"</text>
					<text class="desc-txt">{{ rdesc }}</text>
				</view>
				<view class="vote-area">
					<view class="fav-btn" :class="{ 'fav-active': favorited }" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="100" @click="toggleFav">
						<text class="fav-icon">{{ favorited ? '⭐' : '☆' }}</text>
						<text class="fav-label">{{ favorited ? '已收藏' : '收藏' }}</text>
					</view>
					<text class="vote-label">这个结果你觉得准吗？</text>
					<view class="vote-btns">
						<view class="vote-btn like" :class="{ 'vote-active': userVote === 'like' }" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="100" @click="doVote('like')">
							<text>👍</text>
							<text class="vote-count">{{ voteStats.likes }}</text>
						</view>
						<view class="vote-btn dislike" :class="{ 'vote-active': userVote === 'dislike' }" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="100" @click="doVote('dislike')">
							<text>👎</text>
							<text class="vote-count">{{ voteStats.dislikes }}</text>
						</view>
					</view>
				</view>
				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>
		<view class="footer">
			<view class="footer-inner">
				<view class="btn-retry" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="150" @click="retry">
					<text>🔄</text><text>再来一次</text>
				</view>
				<view class="btn-share" hover-class="btn-press" :hover-start-time="0" :hover-stay-time="150" @click="shareResult">
					<text>↗</text><text>分享给朋友</text>
				</view>
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
			rname: '纯正淀粉肠',
			rdesc: '别挣扎了，你骨子里就是根5块钱的淀粉肠。',
			colors: [],
			tag: '',
			userVote: null,
			voteStats: { likes: 0, dislikes: 0 },
			favorited: false,
			topPad: 48
		}
	},
	onLoad(o) {
		try { const menu = uni.getMenuButtonBoundingClientRect(); this.topPad = menu.top } catch (e) {}
		if (o.tag) this.tag = decodeURIComponent(o.tag)
		if (o.scores) this.scores = JSON.parse(decodeURIComponent(o.scores))
		if (o.dims) this.labels = JSON.parse(decodeURIComponent(o.dims))
		if (o.emoji) this.emoji = decodeURIComponent(o.emoji)
		if (o.rname) this.rname = decodeURIComponent(o.rname)
		if (o.rdesc) this.rdesc = decodeURIComponent(o.rdesc)
		if (o.colors) this.colors = JSON.parse(decodeURIComponent(o.colors))
	},
	onReady() {
		this.$nextTick(() => {
			this.initRadar()
			this.loadVoteInfo()
		})
	},
	methods: {
		initRadar() {
			const q = uni.createSelectorQuery().in(this)
			q.select('#radarCanvas').fields({ node: true, size: true }).exec(res => {
				if (!res[0] || !res[0].node) return
				const canvas = res[0].node
				const ctx = canvas.getContext('2d')
				const dpr = uni.getSystemInfoSync().pixelRatio
				canvas.width = res[0].width * dpr
				canvas.height = res[0].height * dpr
				ctx.scale(dpr, dpr)
				this.drawRadar(canvas, ctx, this.scores, this.labels)
			})
		},

		drawRadar(canvas, ctx, scores, labels) {
			const sys = uni.getSystemInfoSync()
			const px = r => (r / 750) * sys.windowWidth
			const cw = px(650), ch = px(560)
			const cx = cw / 2, cy = ch / 2 + px(10)
			const R = px(170)
			const n = labels.length, step = Math.PI * 2 / n, start = -Math.PI / 2
			const eb = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2) }
			const dur = 600
			let t0 = null

			// 颜色处理：传入了就用对应维度颜色，否则自动生成
			const colors = this.colors.length >= n ? this.colors : this.genPalette(n)
			const mainColor = colors[0] || '#F97316'

			const frame = (ts) => {
				if (!t0) t0 = ts
				const p = Math.min((ts - t0) / dur, 1)
				const ep = eb(p)

				ctx.clearRect(0, 0, cw, ch)

				// 网格 + 轴线
				ctx.strokeStyle = '#E5E7EB'
				ctx.lineWidth = px(2)
				for (let lv = 1; lv <= 4; lv++) {
					const r = R * (lv / 4)
					ctx.beginPath()
					for (let i = 0; i < n; i++) {
						const a = start + i * step
						const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r
						i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
					}
					ctx.closePath(); ctx.stroke()
				}
				for (let i = 0; i < n; i++) {
					const a = start + i * step
					ctx.beginPath(); ctx.moveTo(cx, cy)
					ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke()
				}

				// 标签 + 分数（使用对应维度颜色）
				ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
				for (let i = 0; i < n; i++) {
					const a = start + i * step
					const tr = R + px(45)
					let x = cx + Math.cos(a) * tr, y = cy + Math.sin(a) * tr
					if (a === start) y -= px(10)
					ctx.fillStyle = '#6B7280'
					ctx.font = `${px(24)}px sans-serif`
					ctx.fillText(labels[i], x, y - px(16))
					ctx.fillStyle = colors[i]
					ctx.font = `bold ${px(32)}px sans-serif`
					ctx.fillText(scores[i] + '', x, y + px(16))
				}

				// 数据图层（使用主色）
				ctx.beginPath()
				for (let i = 0; i < n; i++) {
					const a = start + i * step
					const vr = R * (scores[i] / 100) * ep
					const x = cx + Math.cos(a) * vr, y = cy + Math.sin(a) * vr
					i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
				}
				ctx.closePath()
				ctx.fillStyle = this.hexAlpha(mainColor, 0.15); ctx.fill()
				ctx.strokeStyle = mainColor; ctx.lineWidth = px(4); ctx.lineJoin = 'round'; ctx.stroke()

				// 顶点圆圈（使用对应维度颜色）
				for (let i = 0; i < n; i++) {
					const a = start + i * step
					const vr = R * (scores[i] / 100) * ep
					const x = cx + Math.cos(a) * vr, y = cy + Math.sin(a) * vr
					ctx.beginPath(); ctx.arc(x, y, px(6), 0, Math.PI * 2)
					ctx.fillStyle = '#FFFFFF'; ctx.fill()
					ctx.lineWidth = px(4); ctx.strokeStyle = colors[i]; ctx.stroke()
				}

				if (p < 1) canvas.requestAnimationFrame(frame)
			}
			canvas.requestAnimationFrame(frame)
		},

		// 将 hex 颜色转为 rgba，带透明度
		hexAlpha(hex, a) {
			const c = hex.replace('#', '')
			const r = parseInt(c.substring(0, 2), 16)
			const g = parseInt(c.substring(2, 4), 16)
			const b = parseInt(c.substring(4, 6), 16)
			return `rgba(${r},${g},${b},${a})`
		},

		// 兜底调色板：根据维度数自动生成均匀分布的色相
		genPalette(n) {
			const palette = ['#F97316', '#8B5CF6', '#06B6D4', '#22C55E', '#EF4444', '#F59E0B', '#EC4899']
			if (n <= palette.length) return palette.slice(0, n)
			return Array.from({ length: n }, (_, i) => {
				const h = (i * 360 / n) % 360
				return `hsl(${h}, 80%, 55%)`
			})
		},

		goHome() {
			uni.reLaunch({ url: '/pages-tools/quiz-home/quiz-home' })
		},
		shareResult() {},
		retry() {
			uni.redirectTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(this.tag) })
		},

		async loadVoteInfo() {
			if (!this.tag) return
			try {
				const survey = uniCloud.importObject('survey')
				const [statRes, voteRes, favRes] = await Promise.all([
					survey.getVoteStats({ tagName: this.tag }),
					survey.getUserVote({ tagName: this.tag }),
					survey.checkFavorites({ tagNames: [this.tag] }).catch(() => ({}))
				])
				if (statRes.errCode === 0) this.voteStats = statRes.data
				if (voteRes.errCode === 0) this.userVote = voteRes.data.voted
				if (favRes.errCode === 0) this.favorited = !!favRes.data[this.tag]
			} catch (e) { console.error('[result] loadVoteInfo:', e) }
		},

		async toggleFav() {
			if (!this.tag) return
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.toggleFavorite({ tagName: this.tag })
				if (res.errCode === 0) this.favorited = res.data.favorited
			} catch (e) { console.error('[result] toggleFav:', e) }
		},

		async doVote(type) {
			if (!this.tag) return
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.voteTag({ tagName: this.tag, type })
				if (res.errCode === 0) {
					this.userVote = res.data.voted
					// 刷新统计
					const statRes = await survey.getVoteStats({ tagName: this.tag })
					if (statRes.errCode === 0) this.voteStats = statRes.data
				}
			} catch (e) { console.error('[result] doVote:', e) }
		}
	}
}
</script>

<style scoped>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; position: relative; }
.back-btn {
	position: fixed; left: 24rpx; z-index: 100;
	width: 64rpx; height: 64rpx; border-radius: 50%;
	background: #fff; color: #364153;
	display: flex; align-items: center; justify-content: center;
	font-size: 28rpx; transition: transform 0.15s;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
}
.body { flex: 1; }
.body-inner { padding: 48rpx 48rpx 0; display: flex; flex-direction: column; align-items: center; }
.emoji-circle {
	width: 192rpx; height: 192rpx; background: #fff; border-radius: 50%;
	display: flex; align-items: center; justify-content: center;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	outline: 5rpx solid #FFF7ED; outline-offset: -5rpx;
}
.emoji-txt { font-size: 112rpx; }
.title-main { font-size: 60rpx; font-weight: 900; color: #101828; text-align: center; margin-top: 24rpx; }
.badge {
	background: #FFEDD4; border-radius: 60rpx; padding: 12rpx 36rpx; margin-top: 16rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	outline: 3rpx solid #FFD6A8; outline-offset: -3rpx;
}
.badge-txt { font-size: 28rpx; color: #CA3500; font-weight: 700; white-space: nowrap; }
.radar-area { width: 650rpx; height: 560rpx; margin-top: 48rpx; }
.radar-canvas { width: 650rpx; height: 560rpx; }
.desc-card {
	width: 100%; background: #fff; border-radius: 48rpx; padding: 50rpx;
	margin-top: 48rpx; position: relative;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	outline: 3rpx solid #F3F4F6; outline-offset: -3rpx;
}
.desc-quote {
	position: absolute; top: -14rpx; left: -6rpx;
	font-size: 160rpx; color: #F9FAFB; font-family: Georgia; line-height: 1; opacity: .5;
}
.desc-txt { font-size: 30rpx; color: #4A5565; font-weight: 500; line-height: 1.8; text-align: justify; letter-spacing: 0.76rpx; }
.vote-area { display: flex; flex-direction: column; align-items: center; margin-top: 40rpx; gap: 16rpx; width: 100%; }
.fav-btn {
	display: flex; align-items: center; gap: 8rpx;
	background: white; border-radius: 60rpx; padding: 14rpx 36rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
	outline: 3rpx solid #F3F4F6; outline-offset: -3rpx;
	font-size: 28rpx; color: #6B7280; font-weight: 500;
	transition: all .15s;
}
.fav-btn.fav-active { background: #FEFCE8; outline-color: #F59E0B; color: #92400E; }
.fav-icon { font-size: 36rpx; }
.fav-label { font-size: 26rpx; font-weight: 600; }
.vote-label { font-size: 26rpx; color: #99A1AF; font-weight: 500; }
.vote-btns { display: flex; gap: 24rpx; }
.vote-btn {
	display: flex; align-items: center; gap: 8rpx;
	background: white; border-radius: 60rpx; padding: 16rpx 36rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
	outline: 3rpx solid #F3F4F6; outline-offset: -3rpx;
	font-size: 28rpx; color: #6B7280; font-weight: 500;
	transition: all .15s;
}
.vote-active.like { background: #F0FFF0; outline-color: #22C55E; color: #166534; }
.vote-active.dislike { background: #FFF0F0; outline-color: #EF4444; color: #991B1B; }
.vote-count { font-size: 24rpx; font-weight: 600; }
.bottom-spacer { height: 200rpx; }
.footer {
	position: fixed; bottom: 0; left: 0; right: 0; padding: 0 24rpx 30rpx;
	background: linear-gradient(0deg, #F7F8FA 0%, #F7F8FA 50%, transparent 100%);
	display: flex; flex-direction: column; align-items: center;
}
.footer-inner { display: flex; gap: 12rpx; width: 100%; padding: 0 24rpx; }
.btn-retry, .btn-share { height: 118rpx; border-radius: 60rpx; display: flex; align-items: center; justify-content: center; gap: 6rpx; font-size: 32rpx; font-weight: 700; }
.btn-retry {
	flex: 0 0 212rpx; background: #fff; color: #364153;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	outline: 3rpx solid #E5E7EB; outline-offset: -3rpx;
}
.btn-share {
	flex: 1; background: linear-gradient(90deg, #FFB900 0%, #FF6900 100%); color: #fff;
	box-shadow: 0 2rpx 4rpx -2rpx rgba(255,105,0,.3), 0 4rpx 6rpx -1rpx rgba(255,105,0,.3);
}
.btn-press { transform: scale(.96); }
.footer-tag { font-size: 24rpx; color: #99A1AF; font-weight: 500; margin-top: 16rpx; }
</style>
