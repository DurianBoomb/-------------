// ========== 广告播放公用工具函数 ==========
// 从 pin-terminal-entry.vue 提取，供 result.vue / my-surveys.vue 调用
import { showLoading, hideLoading } from '@/common/loading.js'

let videoAd = null // 模块级缓存微信广告实例

/** 保存回调引用，用于正确解绑（微信 offLoad/offError/offClose 必须传入原引用） */
let _onLoadRef = null
let _onErrorRef = null
let _onCloseRef = null

/**
 * 播放激励视频广告 → 调云对象 handleAdReward
 * @param {string} surveyId 问卷ID
 * @returns {Promise<object|null>} 返回 handleAdReward 的结果，或 null（未完整观看/前置检查未通过）
 *
 * 调用方根据返回处理：
 *   { action: 'direct_entry' }     → toast "置顶成功"
 *   { action: 'enter_queue' }      → toast + 800ms 后跳 career-history
 */
export async function playAd(surveyId) {
	if (!surveyId) {
		uni.showToast({ title: '问卷ID不能为空', icon: 'none' })
		return null
	}

	// ====== 前置资格检查：去重 + 槽位 + 每日上限（广告之前） ======
	try {
		const ps = uniCloud.importObject('pin-system')
		const checkRes = await ps.checkPinEligibility({ surveyId })
		if (checkRes.errCode !== 0) {
			uni.showToast({ title: checkRes.errMsg || '操作失败', icon: 'none' })
			return null
		}
	} catch (e) {
		console.error('[ad-utils] checkPinEligibility error:', e)
		uni.showToast({ title: '网络异常，请重试', icon: 'none' })
		return null
	}

	// ====== 暂时无广告接入：跳过广告，直接走业务逻辑 ======
	uni.showToast({ title: '现在还没有广告，便宜你了', icon: 'none' })
	return await callHandleAdRewardWithRetry(surveyId, 20000)

	// ====== 原广告逻辑（后续恢复） ======
	// if (typeof wx !== 'undefined' && wx.createRewardedVideoAd) {
	// 	return _playRealAd(surveyId)
	// } else {
	// 	showLoading('广告播放中...')
	// 	return await simulateAd(surveyId)
	// }
}

/**
 * 模拟广告播放（非微信环境调试用）
 */
/*
export async function simulateAd(surveyId) {
	return new Promise((resolve) => {
		setTimeout(() => {
			callHandleAdRewardWithRetry(surveyId, 0)
			resolve()
		}, 1500)
	})
}
*/

// ---------- 内部方法 ----------

/*
function _playRealAd(sid) {
	if (!videoAd) {
		videoAd = wx.createRewardedVideoAd({ adUnitId: '' }) // 上线前填入真实广告位ID
	}
	const adStartTime = Date.now()
	let videoAdReady = false

	_onLoadRef = () => {
		videoAdReady = true
		videoAd.show()
	}
	_onErrorRef = (err) => {
		console.warn('[ad-utils] 广告加载失败:', err)
		uni.showToast({ title: '广告加载失败，请稍后重试', icon: 'none' })
	}
	_onCloseRef = (res) => {
		const adDuration = Date.now() - adStartTime
		if (res && res.isEnded) {
			callHandleAdRewardWithRetry(sid, adDuration)
		} else {
			uni.showToast({ title: '看完广告才能获得奖励哦', icon: 'none' })
		}
		videoAdReady = false
	}

	videoAd.onLoad(_onLoadRef)
	videoAd.onError(_onErrorRef)
	videoAd.onClose(_onCloseRef)

	// 如果广告 10 秒内既没 ready 也没 close，降级提示
	setTimeout(() => {
		if (videoAdReady) return
		// 传入原回调引用才能正确解绑
		if (_onLoadRef) videoAd.offLoad(_onLoadRef)
		if (_onErrorRef) videoAd.offError(_onErrorRef)
		if (_onCloseRef) videoAd.offClose(_onCloseRef)
		_onLoadRef = _onErrorRef = _onCloseRef = null
		uni.showToast({ title: '广告加载超时', icon: 'none' })
	}, 10000)
}
*/

/**
 * 调用云对象 handleAdReward（带重试）
 * @param {string} sid 问卷ID
 * @param {number} adDuration 广告观看时长（毫秒）
 * @param {number} retryLeft 剩余重试次数（默认 1 次，即最多尝试 2 次）
 */
async function callHandleAdRewardWithRetry(sid, adDuration, retryLeft = 1) {
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

		if (retryLeft > 0) {
			// 静默重试一次
			console.warn(`[ad-utils] 第 1 次调用失败，剩余重试 ${retryLeft} 次，即将重试...`)
			return await callHandleAdRewardWithRetry(sid, adDuration, retryLeft - 1)
		}

		uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
		return null
	}
}
