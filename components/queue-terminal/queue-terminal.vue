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
						<text class="qt-log-text">{{ line }}</text>
					</view>
					<view v-if="isTyping" class="qt-log-row qt-cursor-row">
						<text class="qt-log-time">{{ formatTime(displayedLogs.length) }}</text>
						<text class="qt-log-arrow">▸</text>
						<text class="qt-log-text qt-blink">_</text>
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
export default {
	name: 'QueueTerminal',
	props: {
		visible: { type: Boolean, default: false },
		queueId: { type: String, default: '' }
	},
	data() {
		return {
			allLogs: [],
			displayedLogs: [],
			isTyping: false,
			scrollTop: 99999,
			logAreaHeight: 400,
			pollTimer: null,
			typeTimer: null,
			typeIndex: 0,
			queueCompleted: false,
			currentPhase: 'queuing',
			acceleratedCount: 0,
			maxAccelCount: 3,
			accelLoading: false,
			statusText: '系统处理中...'
		}
	},
	computed: {
		accelBtnText() {
			if (this.accelLoading) return '加速中...'
			if (this.acceleratedCount >= this.maxAccelCount) return '已加速完毕'
			const remaining = this.maxAccelCount - this.acceleratedCount
			return `看广告加速 (剩余 ${remaining} 次)`
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
			this.allLogs = []
			this.displayedLogs = []
			this.queueCompleted = false
			this.currentPhase = 'queuing'
			this.acceleratedCount = 0
			this.typeIndex = 0
			await this.fetchStatus()
			this.startPoll()
		},
		cleanup() {
			if (this.pollTimer) clearInterval(this.pollTimer)
			if (this.typeTimer) clearInterval(this.typeTimer)
			this.pollTimer = null
			this.typeTimer = null
			this.isTyping = false
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
				if (r.status === 'completed') {
					this.queueCompleted = true
					this.currentPhase = 'ready'
					this.statusText = '入池完成'
					this.allLogs = LOG_TEMPLATES.ready || []
					this.startTyping()
					setTimeout(() => { this.$emit('completed', { poolResult: r.poolResult }) }, 1500)
					return
				}
				if (r.status === 'auto_pool_failed') {
					this.statusText = '自动入池失败，下轮重试'
					this.allLogs = (r.logs || []).concat([r.errMsg || '[系统] 自动入池异常'])
					this.currentPhase = 'ready'
					this.startTyping()
					return
				}
				this.currentPhase = r.currentPhase || 'queuing'
				this.acceleratedCount = r.acceleratedCount || 0
				this.maxAccelCount = r.maxAccelCount || 3
				this.allLogs = r.logs || []
				this.statusText = `处理中 · ${this.currentPhase}`
				this.startTyping()
			} catch (e) {
				this.statusText = '网络异常'
				console.error('[queue-terminal] fetchStatus error:', e)
			}
		},
		startTyping() {
			if (this.typeTimer) clearInterval(this.typeTimer)
			this.typeIndex = this.displayedLogs.length
			this.isTyping = true
			this.typeTimer = setInterval(() => {
				if (this.typeIndex < this.allLogs.length) {
					this.displayedLogs.push(this.allLogs[this.typeIndex])
					this.typeIndex++
					this.$nextTick(() => { this.scrollTop = 99999 })
				} else {
					this.isTyping = false
					if (this.typeTimer) clearInterval(this.typeTimer)
					this.typeTimer = null
				}
			}, 800)
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
			}, 10000)
		},
		async onAccel() {
			if (this.accelLoading || this.queueCompleted) return
			// 触发激励视频广告
			try {
				const ps = uniCloud.importObject('pin-system')
				if (wx && wx.createRewardedVideoAd) {
					const videoAd = wx.createRewardedVideoAd({ adUnitId: '' }) // 填入实际广告位 ID
					const adStartTime = Date.now()
					videoAd.onLoad(() => {})
					videoAd.onError(() => {
						// 广告加载失败，直接调用（降级，adDuration=0）
						this._doAccel(ps, 0)
					})
					videoAd.onClose((res) => {
						const adDuration = Date.now() - adStartTime
						if (res && res.isEnded) {
							this._doAccel(ps, adDuration)
						} else {
							uni.showToast({ title: '看完广告才能加速哦', icon: 'none' })
						}
					})
					videoAd.show().catch(() => {
						this._doAccel(ps, 0)
					})
				} else {
					this._doAccel(ps, 0)
				}
			} catch (e) {
				console.error('[queue-terminal] ad error:', e)
				this._doAccel(uniCloud.importObject('pin-system'), 0)
			}
		},
		async _doAccel(ps, adDuration) {
			this.accelLoading = true
			try {
				const res = await ps.handleAdReward({ scene: 'queue_accel', queueId: this.queueId, adDuration })
				if (res.errCode === 0) {
					// 加速成功，立即刷新状态
					await this.fetchStatus()
				} else if (res.errCode === 'QUEUE_NOT_FOUND' || (res.pinData && res.pinData._id)) {
					// 已经入池
					this.queueCompleted = true
					this.statusText = '入池完成'
					this.$emit('completed', { poolResult: res })
				} else {
					uni.showToast({ title: res.errMsg || '加速失败', icon: 'none' })
				}
			} catch (e) {
				uni.showToast({ title: '加速调用失败', icon: 'none' })
				console.error('[queue-terminal] _doAccel error:', e)
			}
			this.accelLoading = false
		},
		onClose() {
			this.$emit('close')
		},
		onOverlayTap() {
			// 点击背景不关闭
		},
		onLogTap() {
			// 点击日志区域不关闭
		},
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

// 本地日志模板兜底
const LOG_TEMPLATES = {
	queuing: ['[系统] 已进入候场区...', '[系统] 正在排队...', '[系统] 等待分配处理节点'],
	inspecting: ['[系统] 质量检测中...', '[质检] 含梗量检测通过 ✓', '[质检] 趣味指数评估：优秀'],
	pushing: ['[系统] 推送至推荐系统...', '[推送] 分配初始曝光权重...', '[推送] 加入推荐列表 ✓'],
	ready: ['[系统] → 入池完成！', '[系统] 即将收到战绩单']
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
.qt-log-text { font-size: 22rpx; color: #4ADE80; font-family: monospace; white-space: pre-wrap; word-break: break-all; }
.qt-blink { animation: blink 1s step-end infinite; }
@keyframes blink { 0%, 100% { opacity: 1; } 50% { opacity: 0; } }
.qt-cursor-row { opacity: 0.7; }

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
