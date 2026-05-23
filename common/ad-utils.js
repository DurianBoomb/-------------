// ========== 广告播放公用工具函数 ==========
// 从 pin-terminal-entry.vue 提取，供 result.vue / my-surveys.vue 调用
import { showLoading, hideLoading } from '@/common/loading.js'

let videoAd = null // 模块级缓存微信广告实例

/**
 * 播放激励视频广告 → 调云对象 handleAdReward
 * @param {string} surveyId 问卷ID
 * @returns {Promise<object|null>} 返回 handleAdReward 的结果，或 null（未完整观看）
 *
 * 调用方根据返回处理：
 *   { action: 'direct_entry' }     → toast "置顶成功"
 *   { action: 'enter_queue' }      → toast + 800ms 后跳 career-history
 */
export function playAd(surveyId) {
	if (!surveyId) {
		uni.showToast({ title: '问卷ID不能为空', icon: 'none' })
		return
	}

	if (typeof wx !== 'undefined' && wx.createRewardedVideoAd) {
		_playRealAd(surveyId)
	} else {
		showLoading('广告播放中...')
		simulateAd(surveyId)
	}
}

/**
 * 模拟广告播放（非微信环境调试用）
 */
export async function simulateAd(surveyId) {
	return new Promise((resolve) => {
		setTimeout(() => {
			callHandleAdReward(surveyId, 0)
			resolve()
		}, 1500)
	})
}

// ---------- 内部方法 ----------

function _playRealAd(sid) {
	if (!videoAd) {
		videoAd = wx.createRewardedVideoAd({ adUnitId: '' }) // 上线前填入真实广告位ID
	}
	const adStartTime = Date.now()
	let videoAdReady = false

	videoAd.onLoad(() => {
		videoAdReady = true
		videoAd.show()
	})

	videoAd.onError((err) => {
		console.warn('[ad-utils] 广告加载失败:', err)
		uni.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' })
	})

	videoAd.onClose((res) => {
		const adDuration = Date.now() - adStartTime
		if (res && res.isEnded) {
			callHandleAdReward(sid, adDuration)
		} else {
			uni.showToast({ title: '看完广告才能获得奖励哦', icon: 'none' })
		}
		videoAdReady = false
	})

	// 如果广告 10 秒内既没 ready 也没 close，降级提示
	setTimeout(() => {
		if (videoAdReady) return // 已经正常播放了，不干扰
		videoAd.offLoad()
		videoAd.offError()
		videoAd.offClose()
		uni.showToast({ title: '广告加载超时', icon: 'none' })
	}, 10000)
}

/**
 * 调用云对象 handleAdReward
 * @param {string} sid 问卷ID
 * @param {number} adDuration 广告观看时长（毫秒）
 */
async function callHandleAdReward(sid, adDuration) {
	showLoading('处理中...')
	try {
		const ps = uniCloud.importObject('pin-system')
		const res = await ps.handleAdReward({ scene: 'first_pin', surveyId: sid, adDuration })
		hideLoading()

		if (res.errCode !== 0) {
			uni.showToast({ title: res.errMsg || '操作失败', icon: 'none' })
			return null
		}

		if (res.action === 'direct_entry') {
			uni.showToast({ title: '置顶成功！', icon: 'success' })
		} else if (res.action === 'enter_queue') {
			uni.showToast({ title: '已进入候场区', icon: 'success' })
			setTimeout(() => {
				uni.navigateTo({ url: '/pages-tools/career/career-history' })
			}, 800)
		}

		return res
	} catch (e) {
		hideLoading()
		console.error('[ad-utils] handleAdReward error:', e)
		uni.showToast({ title: '网络异常，请重试', icon: 'none' })
		return null
	}
}
