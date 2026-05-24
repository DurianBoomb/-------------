<!-- ========== 问卷预览页（生成后跳转） ========== -->
<template>
	<view class="page">
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">问卷预览</text>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
				<!-- 标签信息 -->
				<view class="section">
					<view class="section-header">
						<text class="section-icon">🏷️</text>
						<text class="section-title">标签信息</text>
					</view>
					<view class="info-card">
						<view class="info-row">
							<text class="info-label">标签名</text>
							<text class="info-value">{{ tagName }}</text>
						</view>
						<view class="info-row" v-if="tagDesc">
							<text class="info-label">描述</text>
							<text class="info-value">{{ tagDesc }}</text>
						</view>
						<view class="info-row">
							<text class="info-label">标题</text>
							<text class="info-value">{{ title }}</text>
						</view>
					</view>
				</view>

				<!-- 维度 -->
				<view class="section">
					<view class="section-header">
						<text class="section-icon">📊</text>
						<text class="section-title">维度（{{ dims.length }} 个）</text>
					</view>
					<view class="dims-wrap">
						<view v-for="(d, i) in dims" :key="i" class="dim-tag">{{ d }}</view>
					</view>
				</view>

				<!-- 题目列表 -->
				<view class="section">
					<view class="section-header">
						<text class="section-icon">❓</text>
						<text class="section-title">题目（{{ qs.length }} 题）</text>
					</view>
					<view v-for="(q, i) in qs" :key="i" class="q-card">
						<view class="q-num">{{ i + 1 }}</view>
						<view class="q-body">
							<text class="q-title">{{ q.title }}</text>
							<text class="q-dim">📊 {{ q.dim }}</text>
						</view>
					</view>
				</view>

				<!-- 结果类型 -->
				<view class="section">
					<view class="section-header">
						<text class="section-icon">🎯</text>
						<text class="section-title">结果类型（{{ resultTypes.length }} 种）</text>
					</view>
					<view v-for="(rt, i) in resultTypes" :key="i" class="rt-card" :style="{ borderLeftColor: rt.emojiBg || '#F3F4F6' }">
						<view class="rt-header">
							<text class="rt-emoji">{{ rt.emoji }}</text>
							<text class="rt-name">{{ rt.name }}</text>
							<text class="rt-badge">{{ rt.match }}</text>
						</view>
						<text class="rt-desc">{{ rt.desc }}</text>
					</view>
				</view>

				<!-- 操作按钮 -->
				<view class="action-area">
					<view class="btn-row">
						<view class="btn-secondary" hover-class="press-95" @click="regenerate">
							<text>🔄 重新生成</text>
						</view>
						<button class="btn-secondary btn-share" open-type="share" hover-class="press-95">
							<text>↗ 分享</text>
						</button>
					</view>
					<view class="btn-primary" hover-class="press-95" @click="goQuiz">
						<text>开始答题</text>
					</view>
				</view>

				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { showLoading, hideLoading } from '@/common/loading.js'
export default {
	data() {
		return {
			surveyId: '',
			tagName: '',
			tagDesc: '',
			title: '',
			dims: [],
			qs: [],
			resultTypes: []
		}
	},
	onShareAppMessage() {
		return {
			title: '来看看「' + (this.title || this.tagName) + '」',
			path: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(this.tagName) + '&surveyId=' + this.surveyId
		}
	},
	onLoad(o) {
		if (o.surveyId) this.surveyId = decodeURIComponent(o.surveyId)
		if (o.tag) this.tagName = decodeURIComponent(o.tag)
		if (o.tagDesc) this.tagDesc = decodeURIComponent(o.tagDesc)
		if (o.title) this.title = decodeURIComponent(o.title)
		if (o.dims) this.dims = JSON.parse(decodeURIComponent(o.dims))
		if (o.qs) this.qs = JSON.parse(decodeURIComponent(o.qs))
		if (o.rts) this.resultTypes = JSON.parse(decodeURIComponent(o.rts))
	},
	methods: {
		async regenerate() {
			const tagName = this.tagName
			const tagDesc = this.tagDesc
			if (!tagName) {
				uni.redirectTo({ url: '/pages-tools/search/search-page' })
				return
			}

			showLoading('AI 正在重新生成...')

			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.generateFromCoze({ tagName, tagDesc })

				hideLoading()

				if (res.errCode === 0) {
					const q = res.data.questionnaire
					uni.redirectTo({
						url: '/pages-tools/survey-preview/survey-preview?' +
							'tag=' + encodeURIComponent(tagName) +
							'&surveyId=' + encodeURIComponent(res.data.surveyId) +
							'&title=' + encodeURIComponent(q.title || '') +
							'&tagDesc=' + encodeURIComponent(q.tagDesc || '') +
							'&dims=' + encodeURIComponent(JSON.stringify(q.dims || [])) +
							'&qs=' + encodeURIComponent(JSON.stringify(q.qs || [])) +
							'&rts=' + encodeURIComponent(JSON.stringify(q.resultTypes || []))
					})
			} else if (res.errCode === 'AUTH_ERROR') {
				uni.showModal({
					title: '请先登录',
					content: '重新生成需要登录账号',
					success: (r) => {
						if (r.confirm) {
							uni.navigateTo({ url: '/pages/ucenter/login/login' })
						}
					}
				})
			} else if (res.errCode === 'COZE_QUOTA_EXHAUSTED') {
				uni.showModal({
					title: 'AI 额度已用完',
					content: '当前 AI 生成额度已耗尽，您可以：\n1. 等待每日额度重置\n2. 联系开发者获取更多额度',
					showCancel: false,
					confirmText: '知道了'
				})
			} else {
				uni.showToast({ title: res.errMsg || '生成失败，请稍后重试', icon: 'none' })
			}
			} catch (e) {
				hideLoading()
				console.error('[survey-preview] regenerate error:', e)
				uni.showToast({ title: '网络异常，请稍后重试', icon: 'none' })
			}
		},
		goQuiz() {
			let url = '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(this.tagName)
			if (this.surveyId) url += '&surveyId=' + this.surveyId
			uni.navigateTo({ url })
		},
		goBack() { uni.navigateBack() }
	}
}
</script>

<style>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; }
.hd { background: white; padding: 96rpx 40rpx 24rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1); border-radius: 0 0 48rpx 48rpx; }
.hd-row { display: flex; align-items: center; gap: 16rpx; }
.hd-back { width: 64rpx; height: 64rpx; background: #F3F4F6; border-radius: 50%; display: flex; align-items: center; justify-content: center; }
.back-arrow { width: 28rpx; height: 28rpx; }
.hd-title { font-size: 40rpx; font-weight: 700; color: #101828; }
.body { flex: 1; }
.body-inner { padding: 32rpx 40rpx 0; }
.press-9 { transform: scale(.9); }
.press-95 { transform: scale(.95); }

/* ====== 区块 ====== */
.section { margin-bottom: 32rpx; }
.section-header { display: flex; align-items: center; gap: 8rpx; margin-bottom: 16rpx; }
.section-icon { font-size: 28rpx; }
.section-title { font-size: 32rpx; font-weight: 700; color: #1E2939; }

/* ====== 信息卡片 ====== */
.info-card { background: white; border-radius: 32rpx; padding: 24rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1); }
.info-row { display: flex; gap: 12rpx; margin-bottom: 12rpx; }
.info-row:last-child { margin-bottom: 0; }
.info-label { font-size: 26rpx; color: #99A1AF; flex-shrink: 0; width: 80rpx; }
.info-value { font-size: 26rpx; color: #1E2939; font-weight: 500; flex: 1; }

/* ====== 维度标签 ====== */
.dims-wrap { display: flex; flex-wrap: wrap; gap: 12rpx; }
.dim-tag {
	background: #FFF7ED; color: #C2410C; font-size: 24rpx; font-weight: 600;
	padding: 12rpx 24rpx; border-radius: 40rpx; border: 1rpx solid #FFEDD5;
}

/* ====== 题目卡片 ====== */
.q-card {
	display: flex; gap: 16rpx; background: white; border-radius: 32rpx;
	padding: 24rpx; margin-bottom: 12rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
}
.q-num {
	width: 48rpx; height: 48rpx; background: #F97316; border-radius: 50%;
	display: flex; align-items: center; justify-content: center;
	font-size: 22rpx; font-weight: 700; color: white; flex-shrink: 0;
}
.q-body { flex: 1; min-width: 0; }
.q-title { font-size: 26rpx; color: #1E2939; font-weight: 500; display: block; line-height: 1.5; }
.q-dim { font-size: 22rpx; color: #99A1AF; display: block; margin-top: 6rpx; }

/* ====== 结果类型卡片 ====== */
.rt-card {
	background: white; border-radius: 32rpx; padding: 28rpx;
	margin-bottom: 16rpx; border-left: 8rpx solid #F3F4F6;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1);
}
.rt-header { display: flex; align-items: center; gap: 12rpx; margin-bottom: 8rpx; }
.rt-emoji { font-size: 36rpx; }
.rt-name { font-size: 28rpx; font-weight: 700; color: #1E2939; flex: 1; }
.rt-badge {
	font-size: 20rpx; background: #F3F4F6; color: #6B7280;
	padding: 4rpx 12rpx; border-radius: 20rpx; flex-shrink: 0;
}
.rt-desc { font-size: 24rpx; color: #6A7282; line-height: 1.6; }

/* ====== 操作区 ====== */
.action-area { margin-top: 16rpx; }
.btn-row { display: flex; gap: 16rpx; margin-bottom: 16rpx; }
.btn-secondary {
	flex: 1; height: 90rpx; border-radius: 60rpx;
	background: white; color: #364153; font-size: 28rpx; font-weight: 600;
	display: flex; align-items: center; justify-content: center;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	outline: 3rpx solid #E5E7EB; outline-offset: -3rpx;
}
.btn-share {
	margin: 0; padding: 0; border: none; line-height: 1;
}
.btn-share::after { border: none; }
.btn-primary {
	height: 100rpx; border-radius: 60rpx;
	background: linear-gradient(90deg, #FFB900 0%, #FF6900 100%);
	display: flex; align-items: center; justify-content: center;
	font-size: 32rpx; font-weight: 700; color: white;
	box-shadow: 0 2rpx 4rpx -2rpx rgba(255,105,0,.3), 0 4rpx 6rpx -1rpx rgba(255,105,0,.3);
}

.bottom-spacer { height: 60rpx; }

/* ====== 分享进度 Banner ====== */
.share-banner {
	background: linear-gradient(135deg, #FFF7ED, #FFEDD5);
	border-radius: 32rpx; padding: 32rpx;
	margin-bottom: 32rpx;
	border: 2rpx solid #FED7AA;
	display: flex; flex-direction: column; align-items: center; gap: 16rpx;
}
.share-banner-top {
	display: flex; align-items: center; gap: 8rpx;
}
.share-banner-icon { font-size: 36rpx; }
.share-banner-title { font-size: 32rpx; font-weight: 700; color: #C2410C; }
.share-banner-desc { font-size: 24rpx; color: #9A3412; text-align: center; }
.share-progress-wrap {
	display: flex; align-items: center; gap: 16rpx; width: 100%;
}
.share-progress-bar {
	flex: 1; height: 16rpx; background: #FED7AA; border-radius: 999rpx; overflow: hidden;
}
.share-progress-fill {
	height: 100%; border-radius: 999rpx;
	background: linear-gradient(90deg, #FB923C, #F97316);
	transition: width 0.4s ease-out;
}
.share-progress-num { font-size: 24rpx; color: #EA580C; font-weight: 700; white-space: nowrap; }
.share-banner-btn {
	width: 100%; height: 72rpx; border-radius: 48rpx;
	background: linear-gradient(90deg, #FFB900, #FF6900);
	color: #fff; font-size: 28rpx; font-weight: 700;
	display: flex; align-items: center; justify-content: center;
	margin: 0; padding: 0; border: none; line-height: 1;
}
.share-banner-btn::after { border: none; }
.share-banner-done { font-size: 28rpx; color: #16A34A; font-weight: 700; }
</style>
