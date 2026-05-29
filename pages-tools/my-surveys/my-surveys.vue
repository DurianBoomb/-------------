<!-- ========== 已生成问卷列表 ========== -->
<template>
	<view class="page">
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">已生成模板</text>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
				<view v-if="loading" class="empty-state">
					<text class="empty-icon">⏳</text>
					<text class="empty-txt">加载中...</text>
				</view>
				<view v-else-if="needLogin" class="empty-state">
					<text class="empty-icon">🪄</text>
					<text class="empty-txt">登录后才能查看已生成的模板</text>
				</view>
				<view v-else-if="list.length === 0" class="empty-state">
					<text class="empty-icon">🪄</text>
					<text class="empty-txt">还没有生成过模板，去搜索页定制一个吧 🧐</text>
				</view>
				<view v-else class="list">
					<view v-for="(item, idx) in list" :key="idx" class="card">
						<view class="card-main" hover-class="press-98" :hover-start-time="0" :hover-stay-time="150" @click="goQuiz(item.tagName, item.id)">
							<view class="card-info">
								<text class="card-name">{{ item.title }}</text>
								<text class="card-time">{{ fmtTime(item.createdAt) }}</text>
							</view>
						</view>
						<view class="card-actions">
							<view class="card-promote" hover-class="press-95" @click="promoteSurvey(item)">
								<text class="action-txt">看广告置顶</text>
							</view>
							<view class="card-preview" hover-class="press-95" @click="goPreview(item)">
								<text class="action-txt">预览</text>
							</view>
							<view class="card-del" hover-class="press-95" @click="removeSurvey(item, idx)">
								<text class="action-txt">删除</text>
							</view>
						</view>
					</view>
				</view>
				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
import { playAd } from '@/common/ad-utils.js'
export default {
	data() {
		return { loading: true, needLogin: false, list: [] }
	},
	onLoad() { this.loadSurveys() },
	methods: {
		async loadSurveys() {
			this.loading = true
			this.needLogin = false
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getMySurveys()
				if (res.errCode === 0 && res.data) {
					this.list = res.data
				} else if (res.errCode === 'AUTH_ERROR') {
					this.needLogin = true
				}
			} catch (e) {
				console.error('[my-surveys] load error:', e)
			}
			this.loading = false
		},
		fmtTime(ts) {
			if (!ts) return ''
			const d = new Date(ts)
			const pad = n => (n + '').padStart(2, '0')
			return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
		},
		removeSurvey(item, idx) {
			uni.showModal({
				title: '删除模板',
				content: `确定删除「${item.title || item.tagName}」吗？（答题数据不受影响）`,
				success: async (res) => {
					if (!res.confirm) return
					try {
						const survey = uniCloud.importObject('survey')
						await survey.removeSurvey({ surveyId: item.id })
						this.list.splice(idx, 1)
						uni.showToast({ title: '已删除', icon: 'none' })
					} catch (e) {
						console.error('[my-surveys] remove error:', e)
						uni.showToast({ title: '操作失败', icon: 'none' })
					}
				}
			})
		},
		goQuiz(tag, surveyId) {
			let url = '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(tag)
			if (surveyId) url += '&surveyId=' + surveyId
			uni.navigateTo({ url })
		},
		goPreview(item) {
			const qs = item.qs || []
			const dims = item.dims || []
			const rts = item.resultTypes || []
			if (!qs.length || !dims.length) {
				uni.showToast({ title: '模板数据不完整', icon: 'none' })
				return
			}
			uni.navigateTo({
				url: '/pages-tools/survey-preview/survey-preview?' +
					'tag=' + encodeURIComponent(item.tagName) +
					'&surveyId=' + item.id +
					'&title=' + encodeURIComponent(item.title || '') +
					'&tagDesc=' + encodeURIComponent(item.tagDesc || '') +
					'&dims=' + encodeURIComponent(JSON.stringify(dims)) +
					'&qs=' + encodeURIComponent(JSON.stringify(qs)) +
					'&rts=' + encodeURIComponent(JSON.stringify(rts))
			})
		},
		promoteSurvey(item) {
			playAd(item.id)
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
.press-98 { transform: scale(.98); }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-txt { font-size: 28rpx; color: #99A1AF; text-align: center; }
.card { display: flex; align-items: center; background: white; border-radius: 32rpx; padding: 0; margin-bottom: 16rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1); overflow: hidden; }
.card-main { display: flex; align-items: center; flex: 1; padding: 24rpx; gap: 16rpx; }
.card-info { flex: 1; min-width: 0; }
.card-name { font-size: 30rpx; font-weight: 700; color: #1E2939; display: block; }
.card-time { font-size: 22rpx; color: #99A1AF; display: block; margin-top: 4rpx; }
.card-actions {
	display: flex;
	flex-direction: row;
	height: 100%;
	flex-shrink: 0;
}
.action-txt { font-size: 22rpx; font-weight: 600; }
.card-promote {
	display: flex; align-items: center; justify-content: center;
	padding: 12rpx 24rpx; flex: 1;
	background: #FFFBEB; color: #B45309;
}
.card-preview {
	display: flex; align-items: center; justify-content: center;
	padding: 12rpx 24rpx; flex: 1;
	background: #EFF6FF; color: #1D4ED8;
}
.card-del {
	display: flex; align-items: center; justify-content: center;
	padding: 12rpx 24rpx; flex: 1;
	background: #FEF2F2; color: #991B1B;
}
.press-95 { transform: scale(.95); }
.bottom-spacer { height: 60rpx; }
</style>
