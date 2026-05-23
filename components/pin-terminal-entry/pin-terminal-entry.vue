<!-- ========== 看广告置顶入口按钮组件（阶段四：接 handleAdReward） ========== -->
<template>
	<view class="pte-wrap" hover-class="press-95" @click="onClick">
		<view class="pte-icon">
			<text>📺</text>
		</view>
		<view class="pte-info">
			<text class="pte-title">看广告 · 置顶问卷</text>
			<text class="pte-desc">15分钟精选曝光</text>
		</view>
		<text class="pte-arrow">→</text>
	</view>
</template>

<script>
import { showLoading, hideLoading } from '@/common/loading.js'
export default {
	props: {
		// 父组件可传入问卷ID（如从当前页面的问卷列表选择）
		surveyId: { type: String, default: '' }
	},
	methods: {
		async onClick() {
			// 如果没有传入 surveyId，弹窗让用户输入
			let sid = this.surveyId
			if (!sid) {
				sid = await this._promptSurveyId()
				if (!sid) return
			}

			// 尝试接入微信激励视频广告 SDK
			if (wx && wx.createRewardedVideoAd) {
				this._playRealAd(sid)
			} else {
				// 降级：非微信环境（HBuilder 模拟器 / 开发调试）走模拟广告
				showLoading('广告播放中...')
				await this._simulateAdPlay()
				this._callHandleAdReward(sid, 0)
			}
		},

		// 真实激励视频广告播放 + isEnded 校验（阶段七防刷）
		_playRealAd(sid) {
			const videoAd = wx.createRewardedVideoAd({ adUnitId: '' }) // 上线前填入真实广告位 ID
			const adStartTime = Date.now()

			videoAd.onLoad(() => {
				videoAd.show()
			})

			videoAd.onError((err) => {
				// 广告加载失败，降级：直接调云对象（不阻塞用户）
				console.warn('[pin-terminal-entry] 广告加载失败，降级处理:', err)
				uni.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' })
			})

			videoAd.onClose((res) => {
				const adDuration = Date.now() - adStartTime
				if (res && res.isEnded) {
					// 完整看完广告 → 调用云对象
					this._callHandleAdReward(sid, adDuration)
				} else {
					// 提前关闭 → 不给奖励
					uni.showToast({ title: '看完广告才能获得奖励哦', icon: 'none' })
				}
			})
		},

		// 统一调用云对象 handleAdReward（传 adDuration 用于服务端时长校验兜底）
		async _callHandleAdReward(sid, adDuration) {
			showLoading('处理中...')
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.handleAdReward({ scene: 'first_pin', surveyId: sid, adDuration })
				hideLoading()

				if (res.errCode !== 0) {
					uni.showToast({ title: res.errMsg || '操作失败', icon: 'none' })
					return
				}

				if (res.action === 'direct_entry') {
					if (res.greenChannel) {
						this.$emit('green-channel', { pinData: res.pinData })
					}
					uni.showToast({ title: '置顶成功！', icon: 'success' })
					this.$emit('pinned', { action: 'direct_entry', pinData: res.pinData })
				} else if (res.action === 'enter_queue') {
					uni.showToast({ title: '已进入候场区', icon: 'success' })
					this.$emit('pinned', { action: 'enter_queue', queueData: res.queueData })
					setTimeout(() => {
						uni.navigateTo({ url: '/pages-tools/career/career-history' })
					}, 800)
				}
			} catch (e) {
				hideLoading()
				console.error('[pin-terminal-entry] handleAdReward error:', e)
				uni.showToast({ title: '网络异常，请重试', icon: 'none' })
			}
		},

		// 弹窗让用户选择问卷（MVP 简易版：输入 surveyId）
		_promptSurveyId() {
			return new Promise((resolve) => {
				uni.showModal({
					title: '选择问卷',
					content: '输入问卷ID置顶',
					editable: true,
					placeholderText: '请输入 surveyId',
					success: (r) => {
						if (r.confirm && r.content) {
							resolve(r.content.trim())
						} else {
							resolve('')
						}
					}
				})
			})
		},

		// 模拟广告播放延迟（生产环境替换为真实激励视频广告）
		_simulateAdPlay() {
			return new Promise((resolve) => {
				setTimeout(resolve, 1500)
			})
		}
	}
}
</script>

<style>
.pte-wrap {
	background: linear-gradient(90deg, #FFFBEB 0%, #FEF3C7 100%);
	border: 2rpx solid #FDE68A; border-radius: 24rpx;
	padding: 20rpx 24rpx; display: flex; align-items: center; gap: 16rpx;
	margin-bottom: 16rpx;
}
.pte-icon {
	width: 72rpx; height: 72rpx; background: white; border-radius: 20rpx;
	display: flex; align-items: center; justify-content: center;
	font-size: 36rpx; box-shadow: 0 1rpx 3rpx rgba(0,0,0,.08); flex-shrink: 0;
}
.pte-info { flex: 1; min-width: 0; }
.pte-title { font-size: 28rpx; font-weight: 700; color: #92400E; display: block; }
.pte-desc { font-size: 22rpx; color: #B45309; display: block; margin-top: 4rpx; }
.pte-arrow { font-size: 28rpx; color: #B45309; font-weight: 700; }

.press-95 { transform: scale(0.95); transition: transform 0.1s; }
</style>
