<!-- ========== 收藏列表页 ========== -->
<template>
	<view class="page">
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">我的收藏</text>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
				<view v-if="loading" class="empty-state">
					<text class="empty-icon">⏳</text>
					<text class="empty-txt">加载中...</text>
				</view>
			<view v-if="list.length === 0" class="empty-state">
					<text class="empty-icon">⭐</text>
					<text class="empty-txt">还没有收藏，去逛一逛吧 🧐</text>
				</view>
				<view v-else class="fav-list">
					<view v-for="(item, idx) in list" :key="idx" class="fav-card" hover-class="press-98" :hover-start-time="0" :hover-stay-time="150" @click="goQuiz(item.tagName)">
						<view class="fav-info">
							<text class="fav-name">{{ item.tagName }}</text>
							<text class="fav-time">{{ fmtTime(item.createdAt) }}</text>
						</view>
						<view class="fav-arrow">▶</view>
					</view>
				</view>
				<view class="bottom-spacer"></view>
			</view>
		</scroll-view>
	</view>
</template>

<script>
export default {
	data() {
		return { loading: true, list: [] }
	},
	onLoad() { this.loadFavs() },
	methods: {
		async loadFavs() {
			this.loading = true
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getFavorites()
				if (res.errCode === 0 && res.data) { this.list = res.data }
			} catch (e) {
				console.error('[favorites] load error:', e)
			}
			this.loading = false
		},
		fmtTime(ts) {
			if (!ts) return ''
			const d = new Date(ts)
			const pad = n => (n + '').padStart(2, '0')
			return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`
		},
		goQuiz(tag) {
			uni.navigateTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(tag) })
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
.fav-card { display: flex; align-items: center; background: white; border-radius: 32rpx; padding: 24rpx; gap: 16rpx; margin-bottom: 16rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1); }
.fav-info { flex: 1; min-width: 0; }
.fav-name { font-size: 30rpx; font-weight: 700; color: #1E2939; display: block; }
.fav-time { font-size: 22rpx; color: #99A1AF; display: block; margin-top: 4rpx; }
.fav-arrow { font-size: 20rpx; color: #D1D5DC; flex-shrink: 0; }
.bottom-spacer { height: 60rpx; }
</style>
