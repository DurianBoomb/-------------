<!-- ========== 候场终端半屏面板组件 ========== -->
<template>
	<view v-if="visible" class="qt-overlay" @tap="onOverlayTap">
		<view class="qt-panel" @tap.stop>
			<!-- 顶部标题栏 -->
			<view class="qt-header">
				<text class="qt-header-title">☗ 系统监控终端</text>
				<view class="qt-header-close" hover-class="press-95" @tap="onClose">
					<text class="qt-close-x">✕</text>
				</view>
			</view>

			<!-- 日志滚动画板 -->
			<scroll-view class="qt-logs" scroll-y :scroll-top="scrollTop" :style="{ height: logAreaHeight + 'px' }" @tap="onLogTap">
				<view class="qt-logs-inner">
					<view class="qt-log-row" v-for="(line, idx) in displayedLogs" :key="idx">
						<text class="qt-log-time">{{ formatTime(idx) }}</text>
						<text class="qt-log-arrow">▸</text>
						<text class="qt-log-prefix" v-if="line.prefix">{{ line.prefix }}</text>
						<text class="qt-log-text">{{ line.text || line }}</text>
					</view>
				</view>
			</scroll-view>

			<!-- 底部操作栏 -->
			<view class="qt-footer">
				<text v-if="queueCompleted" class="qt-footer-txt qt-footer-done">✓ 入池完成</text>
				<text v-else class="qt-footer-txt">{{ statusText }}</text>
				<view v-if="!queueCompleted" class="qt-accel-btn" hover-class="press-95" @tap="onAccel">
					<text class="qt-accel-txt">{{ accelBtnText }}</text>
				</view>
			</view>
		</view>
	</view>
</template>

<script>
/**
 * 哑终端：只展示后端返回的可见行，不计算时间
 * 每 3 秒轮询 getQueueStatus 获取最新可展示行
 */
export default {
	name: 'QueueTerminal',
	props: {
		visible: { type: Boolean, default: false },
		queueId: { type: String, default: '' }
	},
		data() {
		return {
			logLines: [],
			displayedLogs: [],
			scrollTop: 0,
			scrollCounter: 0,
			logAreaHeight: 400,
			pollTimer: null,
			queueCompleted: false,
			currentPhase: 'queuing',
			acceleratedCount: 0,
			maxAccelCount: 3,
			accelLoading: false,
			effectiveElapsed: 0,
			statusText: '系统处理中...'
		}
	},
	computed: {
		accelBtnText() {
			if (this.accelLoading) return '加速中...'
			return '插个队'
		},
		/** 进度暗示：底部文字 */
		progressHint() {
			if (this.queueCompleted) return '✓ 入池完成'
			const totalDuration = this.logLines.reduce((s, l) => s + l.interval, 0)
			if (totalDuration <= 0) return '处理中...'
			const pct = Math.min(99, Math.floor(this.effectiveElapsed / totalDuration * 100))
			// 进度很低时显示自然提示，不暴露百分比
			if (pct <= 0) return '刚进来，正在排队'
			if (pct < 10) return '正在审核你的问卷...'
			if (pct < 30) return '内容审核中...'
			if (pct < 50) return '质量检测中...'
			if (pct < 70) return '推送分发中...'
			if (pct < 90) return '快好了...'
			return '即将完成...'
		}
	},
	watch: {
		visible(val) {
			if (val) {
				this.$nextTick(() => this.init())
			} else {
				this.cleanup()
			}
		}
	},
	methods: {
		async init() {
			this.displayedLogs = []
			this.logLines = []
			this.queueCompleted = false
			this.currentPhase = 'queuing'
			this.acceleratedCount = 0
			this.effectiveElapsed = 0
			this.scrollCounter = 0
			this.scrollTop = 0
			this.accelLoading = false
			await this.fetchStatus()
			this.startPoll()
		},
		cleanup() {
			if (this.pollTimer) clearInterval(this.pollTimer)
			this.pollTimer = null
		},
		/** 递增 scrollTop 确保 scroll-view 每次感知到值变化 */
		scrollToEnd() {
			this.scrollCounter++
			this.scrollTop = this.scrollCounter * 100000 + 99999
		},
		async fetchStatus() {
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.getQueueStatus({ queueId: this.queueId })
				if (res.errCode !== 0) {
					this.statusText = '查询失败'
					return
				}
				const records = res.data.records || []
				if (records.length === 0) {
					this.queueCompleted = true
					this.statusText = '候场记录不存在'
					return
				}
				const r = records[0]

				// 入池完成
				if (r.status === 'completed') {
					this.queueCompleted = true
					this.currentPhase = 'ready'
					this.statusText = '入池完成'
					// 展示最后几行提示完成
					this.displayedLogs = (r.poolResult && r.poolResult.pinData)
						? [{ text: '✓ 入池完成 · 登场光环已生效', interval: 0, prefix: '[系统]' }]
						: []
					setTimeout(() => { this.$emit('completed', { poolResult: r.poolResult }) }, 1500)
					return
				}

				// 自动入池失败
				if (r.status === 'auto_pool_failed') {
					this.statusText = '自动入池失败，下轮重试'
					this.currentPhase = 'ready'
					this.displayedLogs = (r.visibleLines || []).concat([
						{ text: r.errMsg || '[系统] 自动入池异常', interval: 0, prefix: '[系统]' }
					])
					return
				}

				// 正常候场中
				this.currentPhase = r.currentPhase || 'queuing'
				this.acceleratedCount = r.acceleratedCount || 0
				this.maxAccelCount = r.maxAccelCount || 3
				this.effectiveElapsed = r.effectiveElapsed || 0
				this.logLines = r.logLines || []
				// 直接渲染后端返回的可见行（无需打字机动画）
				this.displayedLogs = r.visibleLines || []
				this.statusText = this.progressHint
				this.$nextTick(() => this.scrollToEnd())
			} catch (e) {
				this.statusText = '网络异常'
				console.error('[queue-terminal] fetchStatus error:', e)
			}
		},
		startPoll() {
			if (this.pollTimer) clearInterval(this.pollTimer)
			this.pollTimer = setInterval(() => {
				if (this.queueCompleted) {
					clearInterval(this.pollTimer)
					this.pollTimer = null
					return
				}
				this.fetchStatus()
			}, 3000) // 3 秒轮询
		},
		async onAccel() {
			if (this.accelLoading || this.queueCompleted) return

			// ====== 暂时无广告接入：跳过广告，直接走业务逻辑 ======
			uni.showToast({ title: '现在还没有广告，便宜你了', icon: 'none' })
			const ps = uniCloud.importObject('pin-system')
			this._doAccel(ps, 20000)

			// ====== 原广告逻辑（后续恢复） ======
			// try {
			// 	const ps = uniCloud.importObject('pin-system')
			// 	if (wx && wx.createRewardedVideoAd) {
			// 		const videoAd = wx.createRewardedVideoAd({ adUnitId: '' })
			// 		const adStartTime = Date.now()
			// 		let videoAdReady = false
			// 		const _onLoad = () => { videoAdReady = true; videoAd.show() }
			// 		const _onError = () => { this._doAccel(ps, 0) }
			// 		const _onClose = (res) => {
			// 			const adDuration = Date.now() - adStartTime
			// 			if (res && res.isEnded) {
			// 				this._doAccel(ps, adDuration)
			// 			} else {
			// 				uni.showToast({ title: '看完广告才能加速哦', icon: 'none' })
			// 			}
			// 		}
			// 		videoAd.onLoad(_onLoad)
			// 		videoAd.onError(_onError)
			// 		videoAd.onClose(_onClose)
			// 		// 10 秒超时兜底
			// 		setTimeout(() => {
			// 			if (videoAdReady) return
			// 			videoAd.offLoad(_onLoad)
			// 			videoAd.offError(_onError)
			// 			videoAd.offClose(_onClose)
			// 			this._doAccel(ps, 0)
			// 		}, 10000)
			// 		videoAd.show().catch(() => { this._doAccel(ps, 0) })
			// 	} else {
			// 		this._doAccel(ps, 0)
			// 	}
			// } catch (e) {
			// 	console.error('[queue-terminal] ad error:', e)
			// 	this._doAccel(uniCloud.importObject('pin-system'), 0)
			// }
		},
		async _doAccel(ps, adDuration, retryLeft = 1) {
			this.accelLoading = true
			try {
				const res = await ps.handleAdReward({ scene: 'queue_accel', queueId: this.queueId, adDuration })
				if (res.errCode === 0) {
					if (res.data) {
						if (res.data.visibleLines) {
							this.displayedLogs = res.data.visibleLines
							this.$nextTick(() => this.scrollToEnd())
						}
						this.acceleratedCount = res.data.acceleratedCount || this.acceleratedCount + 1
						this.effectiveElapsed = res.data.effectiveElapsed || this.effectiveElapsed
						this.currentPhase = res.data.currentPhase || this.currentPhase
					}
					this.statusText = this.progressHint
				} else if (res.errCode === 'QUEUE_NOT_FOUND' || (res.pinData && res.pinData._id)) {
					this.queueCompleted = true
					this.statusText = '入池完成'
					this.$emit('completed', { poolResult: res })
				} else {
					uni.showToast({ title: res.errMsg || '加速失败', icon: 'none' })
				}
			} catch (e) {
				if (retryLeft > 0) {
					console.warn(`[queue-terminal] _doAccel 调用失败，剩余重试 ${retryLeft} 次`)
					this.accelLoading = false
					return await this._doAccel(ps, adDuration, retryLeft - 1)
				}
				uni.showToast({ title: '加速调用失败', icon: 'none' })
				console.error('[queue-terminal] _doAccel error:', e)
			}
			this.accelLoading = false
		},
		onClose() { this.$emit('close') },
		onOverlayTap() {},
		onLogTap() {},
		formatTime(idx) {
			const now = new Date()
			const h = String(now.getHours()).padStart(2, '0')
			const m = String(now.getMinutes()).padStart(2, '0')
			const s = String(now.getSeconds()).padStart(2, '0')
			return `${h}:${m}:${s}`
		}
	},
	beforeDestroy() {
		this.cleanup()
	}
}
</script>

<style>
.qt-overlay {
	position: fixed; inset: 0; z-index: 998;
	background: rgba(0, 0, 0, 0.5);
	display: flex; align-items: flex-end;
}

.qt-panel {
	width: 100%; background: #0A0A0A; border-radius: 32rpx 32rpx 0 0;
	display: flex; flex-direction: column; max-height: 80vh;
}

.qt-header {
	display: flex; align-items: center; justify-content: space-between;
	padding: 28rpx 32rpx 16rpx; border-bottom: 2rpx solid #1A1A2E;
}
.qt-header-title { font-size: 28rpx; font-weight: 700; color: #4ADE80; font-family: monospace; }
.qt-header-close { width: 48rpx; height: 48rpx; display: flex; align-items: center; justify-content: center; }
.qt-close-x { font-size: 28rpx; color: #6B7280; }

.qt-logs { overflow-y: auto; padding: 16rpx 32rpx; background: #050505; }
.qt-logs-inner { padding-bottom: 8rpx; }
.qt-log-row { display: flex; align-items: flex-start; gap: 8rpx; margin-bottom: 6rpx; line-height: 1.7; }
.qt-log-time { font-size: 20rpx; color: #4B5563; font-family: monospace; flex-shrink: 0; min-width: 96rpx; }
.qt-log-arrow { font-size: 20rpx; color: #374151; font-family: monospace; flex-shrink: 0; }
.qt-log-prefix { font-size: 20rpx; color: #6B7280; font-family: monospace; flex-shrink: 0; margin-right: 2rpx; }
.qt-log-text { font-size: 22rpx; color: #4ADE80; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
.qt-footer {
	padding: 20rpx 32rpx 40rpx; border-top: 2rpx solid #1A1A2E;
	display: flex; align-items: center; justify-content: space-between;
}
.qt-footer-txt { font-size: 22rpx; color: #6B7280; font-family: monospace; }
.qt-footer-done { color: #4ADE80; font-weight: 600; }

.qt-accel-btn {
	background: #22C55E; border-radius: 36rpx; padding: 16rpx 32rpx;
}
.qt-accel-txt { font-size: 24rpx; font-weight: 700; color: #0A0A0A; }

.press-95 { opacity: 0.7; }
</style>
