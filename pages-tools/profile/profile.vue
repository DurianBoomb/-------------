<!-- ========== 用户画像页 ========== -->
<template>
	<view class="page">
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<image class="back-arrow" src="/static/left.svg" mode="aspectFit"></image>
				</view>
				<text class="hd-title">照照镜子</text>
			</view>
			<text class="hd-subtitle">已确诊 {{ list.length }} 个标签</text>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
				<view v-if="loading" class="empty-state">
					<text class="empty-icon">⏳</text>
					<text class="empty-txt">加载中...</text>
				</view>
			<view v-if="list.length === 0" class="empty-state">
					<text class="empty-icon">📋</text>
					<text class="empty-txt">你还没有诊断过任何标签</text>
					<text class="empty-sub">去首页随便测测吧 🧐</text>
				</view>
				<view v-else class="profile-list">
					<view v-for="(item, idx) in list" :key="idx" class="profile-card" hover-class="press-98" :hover-start-time="0" :hover-stay-time="150" @click="goResult(item)">
						<view class="pc-emoji">
							<text>{{ item.emoji || '📊' }}</text>
						</view>
						<view class="pc-info">
							<text class="pc-tag">{{ item.tagName }}</text>
							<text class="pc-result">{{ item.resultName }}</text>
						</view>
						<view class="pc-arrow">▶</view>
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
	onLoad() { this.loadProfile() },
	methods: {
		async loadProfile() {
			this.loading = true
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getUserProfile()
				if (res.errCode === 0 && res.data) { this.list = res.data }
			} catch (e) {
				console.error('[profile] load error:', e)
			}
			this.loading = false
		},
		goResult(item) {
			uni.navigateTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent(item.tagName) })
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
.hd-subtitle { font-size: 26rpx; color: #99A1AF; font-weight: 500; display: block; margin-top: 8rpx; }
.body { flex: 1; }
.body-inner { padding: 32rpx 40rpx 0; }
.press-9 { transform: scale(.9); }
.press-98 { transform: scale(.98); }
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-txt { font-size: 28rpx; color: #99A1AF; text-align: center; }
.empty-sub { font-size: 24rpx; color: #D1D5DC; margin-top: 8rpx; }
.profile-list { width: 100%; }
.profile-card { display: flex; align-items: center; background: white; border-radius: 32rpx; padding: 24rpx; gap: 16rpx; margin-bottom: 16rpx; box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1); }
.pc-emoji { width: 72rpx; height: 72rpx; background: #FFF7ED; border-radius: 24rpx; display: flex; align-items: center; justify-content: center; font-size: 40rpx; flex-shrink: 0; }
.pc-info { flex: 1; min-width: 0; }
.pc-tag { font-size: 30rpx; font-weight: 700; color: #1E2939; display: block; }
.pc-result { font-size: 24rpx; color: #F97316; font-weight: 600; display: block; margin-top: 4rpx; }
.pc-arrow { font-size: 20rpx; color: #D1D5DC; flex-shrink: 0; }
.bottom-spacer { height: 60rpx; }
</style>
