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

			// ====== 前置资格检查（去重 + 槽位 + 每日上限，广告之前） ======
			try {
				const ps = uniCloud.importObject('pin-system')
				const checkRes = await ps.checkPinEligibility({ surveyId: sid })
				if (checkRes.errCode !== 0) {
					uni.showToast({ title: checkRes.errMsg || '操作失败', icon: 'none' })
					return
				}
			} catch (e) {
				console.error('[pin-terminal-entry] checkPinEligibility error:', e)
				uni.showToast({ title: '网络异常，请重试', icon: 'none' })
				return
			}

			// ====== 暂时无广告接入：跳过广告，直接走业务逻辑 ======
			uni.showToast({ title: '现在还没有广告，便宜你了', icon: 'none' })
			this._callHandleAdReward(sid, 20000)

			// ====== 原广告逻辑（后续恢复） ======
			// if (wx && wx.createRewardedVideoAd) {
			// 	this._playRealAd(sid)
			// } else {
			// 	showLoading('广告播放中...')
			// 	await this._simulateAdPlay()
			// 	this._callHandleAdReward(sid, 0)
			// }
		},

		// 真实激励视频广告播放 + isEnded 校验（阶段七防刷）
		/*
		_playRealAd(sid) {
			const videoAd = wx.createRewardedVideoAd({ adUnitId: '' }) // 上线前填入真实广告位 ID
			const adStartTime = Date.now()
			let videoAdReady = false

			const _onLoad = () => {
				videoAdReady = true
				videoAd.show()
			}
			const _onError = (err) => {
				console.warn('[pin-terminal-entry] 广告加载失败，降级处理:', err)
				uni.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' })
			}
			const _onClose = (res) => {
				const adDuration = Date.now() - adStartTime
				if (res && res.isEnded) {
					this._callHandleAdReward(sid, adDuration)
				} else {
					uni.showToast({ title: '看完广告才能获得奖励哦', icon: 'none' })
				}
			}

			videoAd.onLoad(_onLoad)
			videoAd.onError(_onError)
			videoAd.onClose(_onClose)

			// 10 秒超时兜底
			setTimeout(() => {
				if (videoAdReady) return
				videoAd.offLoad(_onLoad)
				videoAd.offError(_onError)
				videoAd.offClose(_onClose)
				uni.showToast({ title: '广告加载超时', icon: 'none' })
			}, 10000)
		},
		*/

		// 统一调用云对象 handleAdReward（带重试，传 adDuration 用于服务端时长校验兜底）
		async _callHandleAdReward(sid, adDuration, retryLeft = 1) {
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

				if (retryLeft > 0) {
					console.warn(`[pin-terminal-entry] 调用失败，剩余重试 ${retryLeft} 次`)
					return await this._callHandleAdReward(sid, adDuration, retryLeft - 1)
				}

				uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
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
		/*
		_simulateAdPlay() {
			return new Promise((resolve) => {
				setTimeout(resolve, 1500)
			})
		}
		*/
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
