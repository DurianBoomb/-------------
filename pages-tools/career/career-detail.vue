<!-- ========== 战绩单详情页（完整版） ========== -->
<template>
	<view class="page">
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">战绩单详情</text>
				<view class="hd-actions">
					<view class="hd-share" hover-class="press-9" @click="onShare">
						<text class="hd-share-icon">📤</text>
					</view>
				</view>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
				<!-- 加载态 -->
		<view v-if="loading" class="loading-state">
					<text class="loading-txt">正在加载档案...</text>
				</view>

				<!-- 错误态 -->
				<view v-else-if="error" class="error-state">
					<text class="error-icon">⚠️</text>
					<text class="error-txt">{{ error }}</text>
				</view>

				<!-- 档案证书 -->
				<view v-else class="cert-card">
					<view class="cert-header">
						<view class="cert-badge-row">
							<image class="cert-stamp" src="/static/给狐狸.png" mode="aspectFit"></image>
							<view class="cert-badge-text">
								<text class="cert-badge">15分钟名气管理局</text>
								<text class="cert-sub">临时名人档案</text>
							</view>
						</view>
						<text class="cert-number">档案编号：{{ record.archiveNumber || '待编' }}</text>
					</view>

					<view class="cert-divider"></view>

					<view class="cert-body">
						<!-- 首秀角标 -->
						<view v-if="record.careerNumber === 1" class="cert-debut-badge">★ 首秀认证</view>

						<!-- 暴击高亮 -->
						<view v-if="record.bonusTriggered" class="cert-bonus-badge">
							<text>⚡ 数据暴击 ×{{ record.bonusMultiplier ? record.bonusMultiplier.toFixed(1) : '1.5' }}</text>
						</view>

						<view class="cert-title-row">
							<text class="cert-quote">「</text>
							<text class="cert-title">{{ record.surveyTitle || '未知问卷' }}</text>
							<text class="cert-quote">」</text>
						</view>

						<view class="cert-honor-row">
							<text class="cert-honor-icon">🏆</text>
							<text class="cert-honor">{{ (record.honor && record.honor.name) || '内容创作者' }}</text>
						</view>
						<text class="cert-honor-desc">{{ (record.honor && record.honor.desc) || '' }}</text>

						<view class="cert-stats">
							<view class="cert-stat-item">
								<text class="cert-stat-num">{{ formatNum(record.stats && record.stats.views) }}</text>
								<text class="cert-stat-label">驻足注视</text>
							</view>
							<view class="cert-stat-item">
								<text class="cert-stat-num">{{ formatNum(record.stats && record.stats.clicks) }}</text>
								<text class="cert-stat-label">好奇打开</text>
							</view>
							<view class="cert-stat-item">
								<text class="cert-stat-num">{{ formatNum(record.stats && record.stats.favorites) }}</text>
								<text class="cert-stat-label">决定存档</text>
							</view>
						</view>

						<view class="cert-comment">
							<text class="cert-comment-label">📋 档案附注</text>
							<text class="cert-comment-txt">{{ record.comment || '暂无附注。' }}</text>
						</view>
					</view>

					<view class="cert-divider"></view>

					<view class="cert-footer">
						<text class="cert-date">签发日期：{{ formatDate(record.createdAt) }}</text>
						<text class="cert-permanent">有效期：本档案自签发之日起永久有效</text>
					</view>
				</view>

				<!-- 分享按钮 -->
				<view class="share-btn" hover-class="press-95" @click="onShare">
					<text class="share-btn-txt">📤 分享战绩单</text>
				</view>

				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>

		<!-- 分享长图 Canvas（隐藏） -->
		<canvas type="2d" id="shareCanvas"
			style="width:500px;height:720px;position:fixed;left:-9999px;top:-9999px;pointer-events:none;">
		</canvas>
	</view>
</template>

<script>
import { showLoading, hideLoading } from '@/common/loading.js'
export default {
	data() {
		return {
			careerId: '',
			record: {},
			loading: true,
			error: ''
		}
	},
	onLoad(query) {
		// 接收路由参数：careerId
		if (query && query.careerId) {
			this.careerId = query.careerId
			this.loadRecord()
		} else {
			this.loading = false
			this.error = '缺少档案编号'
		}
	},
	methods: {
		async loadRecord() {
			this.loading = true
			this.error = ''
			try {
				const db = uniCloud.database()
				const res = await db.collection('career-records').doc(this.careerId).get()
				if (res.data && res.data.length > 0) {
					this.record = res.data[0]
				} else {
					this.error = '未找到该档案'
				}
			} catch (e) {
				console.error('[career-detail] load error:', e)
				this.error = '加载失败: ' + (e.message || '')
			} finally {
				this.loading = false
			}
		},

		formatNum(val) {
			if (typeof val !== 'number') return '--'
			if (val >= 10000) return (val / 10000).toFixed(1) + '万'
			return val.toLocaleString()
		},

		formatDate(ts) {
			if (!ts) return '未知'
			const d = new Date(ts)
			const y = d.getFullYear()
			const m = String(d.getMonth() + 1).padStart(2, '0')
			const day = String(d.getDate()).padStart(2, '0')
			const h = String(d.getHours()).padStart(2, '0')
			const min = String(d.getMinutes()).padStart(2, '0')
			return `${y}年${m}月${day}日 ${h}:${min}`
		},

		async onShare() {
			if (!this.record._id) {
				uni.showToast({ title: '档案数据尚未加载', icon: 'none' })
				return
			}
			showLoading('生成分享图...')
			try {
				const tempPath = await this.drawShareImage()
				hideLoading()
				if (tempPath) {
					uni.saveImageToPhotosAlbum({
						filePath: tempPath,
						success: () => { uni.showToast({ title: '已保存到相册', icon: 'success' }) },
						fail: (err) => {
							const msg = err.errMsg || ''
							if (msg.includes('cancel') || msg.includes('deny')) {
								uni.showToast({ title: '需要授权才能保存', icon: 'none' })
							} else {
								uni.showToast({ title: '保存失败，请重试', icon: 'none' })
							}
						}
					})
				}
			} catch (e) {
				hideLoading()
				console.error('[career-detail] drawShareImage error:', e)
				uni.showToast({ title: '生成失败: ' + (e.message || ''), icon: 'none' })
			}
		},

		/**
		 * Canvas 2D 绘制红头文件风格分享长图 500×720
		 */
		drawShareImage() {
			return new Promise((resolve, reject) => {
				const query = uni.createSelectorQuery().in(this)
				query.select('#shareCanvas').node((res) => {
					if (!res || !res.node) { reject(new Error('Canvas 节点不存在')); return }
					const canvas = res.node
					const ctx = canvas.getContext('2d')
					const sys = uni.getSystemInfoSync()
					const dpr = sys.pixelRatio || 2
					const W = 500, H = 720
					canvas.width = W * dpr
					canvas.height = H * dpr
					ctx.scale(dpr, dpr)

					const rec = this.record
					const FONT = '"PingFang SC","Noto Sans SC",sans-serif'
					const FONT_MONO = 'monospace,' + FONT

					// 1. 背景
					ctx.fillStyle = '#FEFCF8'
					ctx.fillRect(0, 0, W, H)

					// 2. 顶部红头
					const grad = ctx.createLinearGradient(0, 0, W, 0)
					grad.addColorStop(0, '#991B1B'); grad.addColorStop(1, '#B91C1C')
					ctx.fillStyle = grad
					ctx.fillRect(0, 0, W, 140)

					ctx.fillStyle = '#FFFFFF'
					ctx.font = 'bold 26px ' + FONT
					ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
					ctx.fillText('15分钟名气管理局', W / 2, 56)

					ctx.font = '18px ' + FONT
					ctx.fillStyle = 'rgba(255,255,255,.85)'
					ctx.fillText('临 时 名 人 档 案', W / 2, 88)

					ctx.font = '13px ' + FONT_MONO
					ctx.fillStyle = 'rgba(255,255,255,.7)'
					ctx.fillText('档案编号：' + (rec.archiveNumber || '待编'), W / 2, 118)

					let y = 160

					// 3. 发证日期
					ctx.font = '12px ' + FONT
					ctx.fillStyle = '#6B7280'
					ctx.textAlign = 'left'; ctx.textBaseline = 'top'
					const dateStr = this.formatDate(rec.createdAt)
					ctx.fillText('发证日期：' + dateStr, 36, y); y += 18
					ctx.fillText('有效期：本档案自签发之日起永久有效', 36, y); y += 32

					// 4. 问卷标题
					ctx.textAlign = 'center'
					ctx.fillStyle = '#9CA3AF'
					ctx.font = '13px ' + FONT
					ctx.fillText('经本局鉴定，以下问卷在置顶期间获得如下注视：', W / 2, y); y += 28

					const title = rec.surveyTitle || '未知问卷'
					ctx.font = 'bold 20px ' + FONT
					ctx.fillStyle = '#1F2937'
					ctx.fillText('《' + title + '》', W / 2, y); y += 36

					// 5. 荣誉称号
					const honorName = rec.honor?.name || '内容创作者'
					ctx.font = 'bold 22px ' + FONT
					ctx.fillStyle = '#B91C1C'
					ctx.fillText('🏆 ' + honorName, W / 2, y); y += 38

					// 6. 三项核心数据
					const stats = rec.stats || {}
					const items = [
						{ label: '驻足注视', value: stats.views || 0 },
						{ label: '好奇打开', value: stats.clicks || 0 },
						{ label: '决定存档', value: stats.favorites || 0 }
					]
					const iw = 130, ig = (W - 60 - iw * 3) / 2
					for (let i = 0; i < 3; i++) {
						const x = 30 + i * (iw + ig)
						ctx.fillStyle = '#FFF7ED'
						ctx.fillRect(x, y, iw, 72)
						ctx.font = 'bold 28px ' + FONT_MONO
						ctx.fillStyle = '#EA580C'
						ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
						const valStr = typeof items[i].value === 'number' ? items[i].value.toLocaleString() : '--'
						ctx.fillText(valStr, x + iw / 2, y + 30)
						ctx.font = '12px ' + FONT
						ctx.fillStyle = '#9A3412'
						ctx.fillText(items[i].label, x + iw / 2, y + 56)
					}
					y += 86

					// 7. 暴击标记
					if (rec.bonusTriggered) {
						const multi = rec.bonusMultiplier ? rec.bonusMultiplier.toFixed(1) : '1.5'
						ctx.fillStyle = '#7C3AED'
						ctx.fillRect(160, y, 180, 28)
						ctx.font = 'bold 14px ' + FONT
						ctx.fillStyle = '#FFFFFF'
						ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
						ctx.fillText('⚡ 数据暴击 ×' + multi, W / 2, y + 14)
						y += 38
					}

					// 8. 称号描述（自动换行）
					const honorDesc = rec.honor?.desc || ''
					if (honorDesc) {
						ctx.font = '13px ' + FONT
						ctx.fillStyle = '#4B5563'
						ctx.textAlign = 'center'; ctx.textBaseline = 'top'
						const lines = this._wrapText(ctx, honorDesc, 420)
						for (const l of lines) { ctx.fillText(l, W / 2, y); y += 22 }
						y += 8
					}

					// 9. 附注（自动换行）
					const comment = rec.comment || ''
					if (comment) {
						ctx.fillStyle = '#F3F4F6'
						ctx.fillRect(30, y, 440, 2)
						y += 14
						ctx.font = '11px ' + FONT
						ctx.fillStyle = '#6B7280'
						ctx.textAlign = 'left'; ctx.textBaseline = 'top'
						const paras = comment.split('\n')
						for (const para of paras) {
							if (!para.trim()) { y += 8; continue }
							const lines = this._wrapText(ctx, para, 420)
							for (const l of lines) { ctx.fillText(l, 36, y); y += 17 }
						}
					}

					// 10. 红章
					y = Math.max(y + 16, 600)
					ctx.save()
					ctx.translate(390, y + 36)
					ctx.rotate(12 * Math.PI / 180)
					ctx.beginPath(); ctx.arc(0, 0, 46, 0, Math.PI * 2)
					ctx.strokeStyle = '#DC2626'; ctx.lineWidth = 3; ctx.stroke()
					ctx.font = '26px sans-serif'
					ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
					ctx.fillStyle = '#DC2626'
					ctx.fillText('★', 0, -4)
					ctx.font = '11px ' + FONT
					ctx.fillText('名气管理局', 0, 26)
					ctx.restore()

					// 11. 底部引导
					ctx.font = '12px ' + FONT
					ctx.fillStyle = '#9CA3AF'
					ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
					ctx.fillText('扫码生成你的15分钟名人档案', W / 2, 702)
					ctx.font = '10px ' + FONT
					ctx.fillStyle = '#D1D5DC'
					ctx.fillText('快乐大狐狸工具集 · 15分钟名气管理局', W / 2, 714)

					// 导出
					uni.canvasToTempFilePath({
						canvas, x: 0, y: 0,
						width: W * dpr, height: H * dpr,
						destWidth: W * dpr, destHeight: H * dpr,
						fileType: 'png', quality: 1
					}, this).then(res => {
						resolve(res.tempFilePath)
					}).catch(err => {
						reject(err)
					})
				}).exec()
			})
		},

		/** Canvas 文字自动换行辅助：measureText 按宽度换行 */
		_wrapText(ctx, text, maxWidth) {
			const lines = []
			let line = ''
			for (const ch of text) {
				const test = line + ch
				if (ctx.measureText(test).width > maxWidth) { lines.push(line); line = ch }
				else line = test
			}
			if (line) lines.push(line)
			return lines
		},

		goBack() { uni.navigateBack() }
	}
}
</script>

<style>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; }
.hd {
	background: white; padding: 96rpx 40rpx 24rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1); border-radius: 0 0 48rpx 48rpx;
	position: sticky; top: 0; z-index: 10;
}
.hd-row { display: flex; align-items: center; gap: 16rpx; }
.hd-back { width: 64rpx; height: 64rpx; background: #F3F4F6; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.back-arrow { width: 28rpx; height: 28rpx; }
.hd-title { font-size: 40rpx; font-weight: 700; color: #101828; flex: 1; }
.hd-actions { display: flex; gap: 12rpx; }
.hd-share { width: 64rpx; height: 64rpx; background: #FEF3C7; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.hd-share-icon { font-size: 28rpx; }
.press-9 { transform: scale(.9); }
.press-95 { transform: scale(.95); }

.body { flex: 1; }
.body-inner { padding: 32rpx 40rpx 0; }

/* 加载态 & 错误态 */
.loading-state, .error-state { text-align: center; padding: 160rpx 0; }
.loading-txt { font-size: 28rpx; color: #99A1AF; }
.error-icon { font-size: 48rpx; display: block; margin-bottom: 16rpx; }
.error-txt { font-size: 28rpx; color: #EF4444; }

/* ====== 证书卡片 ====== */
.cert-card {
	background: white; border-radius: 32rpx; padding: 36rpx 32rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	border: 2rpx solid #E5E7EB;
	position: relative;
}

.cert-header { text-align: center; margin-bottom: 20rpx; }
.cert-badge-row { display: flex; align-items: center; justify-content: center; gap: 12rpx; margin-bottom: 8rpx; }
.cert-stamp { width: 48rpx; height: 48rpx; }
.cert-badge-text { display: flex; flex-direction: column; }
.cert-badge { font-size: 28rpx; font-weight: 800; color: #B91C1C; letter-spacing: 2rpx; }
.cert-sub { font-size: 20rpx; color: #9B1C1C; opacity: .7; letter-spacing: 4rpx; }
.cert-number { font-size: 22rpx; color: #6B7280; display: block; font-family: monospace; }

.cert-divider {
	height: 2rpx; background: linear-gradient(90deg, transparent, #D1D5DC 20%, #D1D5DC 80%, transparent);
	margin: 20rpx 0;
}

/* 首秀角标 */
.cert-debut-badge {
	position: absolute; top: 36rpx; right: 32rpx;
	background: linear-gradient(135deg, #F59E0B, #F97316);
	color: white; font-size: 20rpx; font-weight: 700;
	padding: 6rpx 16rpx; border-radius: 20rpx;
	transform: rotate(6deg);
}

/* 暴击高亮标记 */
.cert-bonus-badge {
	text-align: center; margin-bottom: 12rpx;
}
.cert-bonus-badge text {
	display: inline-block;
	background: linear-gradient(135deg, #7C3AED, #A855F7);
	color: white; font-size: 20rpx; font-weight: 700;
	padding: 4rpx 16rpx; border-radius: 16rpx;
}

.cert-body { }
.cert-title-row { display: flex; align-items: baseline; justify-content: center; gap: 4rpx; margin-bottom: 20rpx; }
.cert-quote { font-size: 40rpx; color: #D1D5DC; font-weight: 700; line-height: 1; }
.cert-title { font-size: 32rpx; font-weight: 700; color: #101828; text-align: center; }

.cert-honor-row { text-align: center; margin-bottom: 6rpx; }
.cert-honor-icon { font-size: 32rpx; }
.cert-honor { font-size: 30rpx; color: #B91C1C; font-weight: 800; letter-spacing: 2rpx; }
.cert-honor-desc { text-align: center; font-size: 22rpx; color: #6B7280; display: block; margin-bottom: 24rpx; line-height: 1.5; padding: 0 20rpx; }

.cert-stats { display: flex; gap: 12rpx; margin-bottom: 24rpx; }
.cert-stat-item {
	flex: 1; background: linear-gradient(180deg, #FFF7ED, #FFEDD5);
	border-radius: 20rpx; padding: 20rpx 12rpx; text-align: center;
	border: 1rpx solid rgba(249,115,22,.15);
}
.cert-stat-num { font-size: 38rpx; font-weight: 800; color: #EA580C; display: block; font-family: monospace; }
.cert-stat-label { font-size: 20rpx; color: #9A3412; display: block; margin-top: 6rpx; font-weight: 600; }

.cert-comment {
	background: #F9FAFB; border-radius: 16rpx; padding: 16rpx;
	border-left: 6rpx solid #B91C1C;
}
.cert-comment-label { font-size: 22rpx; font-weight: 600; color: #6B7280; display: block; margin-bottom: 8rpx; }
.cert-comment-txt { font-size: 24rpx; color: #4B5563; line-height: 1.8; white-space: pre-wrap; }

.cert-footer { text-align: center; }
.cert-date { font-size: 22rpx; color: #6B7280; display: block; }
.cert-permanent { font-size: 20rpx; color: #9CA3AF; display: block; margin-top: 4rpx; }

/* ====== 分享按钮 ====== */
.share-btn {
	background: linear-gradient(135deg, #1E2939, #334155);
	border-radius: 40rpx; padding: 24rpx;
	text-align: center; margin-top: 32rpx;
	box-shadow: 0 4rpx 12rpx rgba(30,41,57,.3);
}
.share-btn-txt { font-size: 28rpx; color: white; font-weight: 700; }

.bottom-spacer { height: 60rpx; }
</style>
