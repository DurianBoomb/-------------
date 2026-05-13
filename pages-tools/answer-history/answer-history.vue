<!-- ========== 答题历史记录页 ========== -->
<template>
	<view class="page">
		<view class="hd">
			<view class="hd-row">
				<view class="hd-back" hover-class="press-9" :hover-start-time="0" :hover-stay-time="150" @click="goBack">
					<text>←</text>
				</view>
				<text class="hd-title">答题历史</text>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
				<view v-if="loading" class="empty-state">
					<text class="empty-icon">⏳</text>
					<text class="empty-txt">加载中...</text>
				</view>
			<view v-if="list.length === 0" class="empty-state">
					<text class="empty-icon">📭</text>
					<text class="empty-txt">还没有答题记录，去首页测一个吧 🧐</text>
				</view>
				<view v-else class="history-list">
					<view v-for="(item, idx) in list" :key="idx" class="history-card" hover-class="press-98" :hover-start-time="0" :hover-stay-time="150" @click="goResult(item)">
						<view class="hc-left">
							<text class="hc-emoji">{{ item.emoji || '📊' }}</text>
						</view>
						<view class="hc-info">
							<text class="hc-tag">{{ item.tagName }}</text>
							<text class="hc-result">{{ item.resultName }}</text>
							<text class="hc-time">{{ fmtTime(item.createdAt) }}</text>
						</view>
						<view class="hc-arrow">▶</view>
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
	onLoad() { this.loadHistory() },
	onPullDownRefresh() { this.loadHistory().then(() => uni.stopPullDownRefresh()) },
	methods: {
		async loadHistory() {
			this.loading = true
			try {
				const survey = uniCloud.importObject('survey')
				const res = await survey.getAnswerHistory({ pageSize: 100 })
				if (res.errCode === 0 && res.data) {
					this.list = res.data.list || []
				}
			} catch (e) {
				console.error('[answer-history] load error:', e)
			}
			this.loading = false
		},
		fmtTime(ts) {
			if (!ts) return ''
			const d = new Date(ts)
			const pad = n => (n + '').padStart(2, '0')
			return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
		},
		goResult(item) {
			const dimScores = item.scores || {}
			const scores = item.dims.map(d => dimScores[d] || 50)
			const url = '/pages-tools/result/result?' +
				'tag=' + encodeURIComponent(item.tagName) +
				'&dims=' + encodeURIComponent(JSON.stringify(item.dims)) +
				'&scores=' + encodeURIComponent(JSON.stringify(scores)) +
				'&emoji=' + encodeURIComponent(item.emoji || '📊') +
				'&rname=' + encodeURIComponent(item.resultName) +
				'&rdesc=' + encodeURIComponent('')
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
.hd-back { width: 64rpx; height: 64rpx; background: #F3F4F6; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 28rpx; color: #364153; }
.hd-title { font-size: 40rpx; font-weight: 700; color: #101828; }
.body { flex: 1; }
.body-inner { padding: 32rpx 40rpx 0; }
.press-9 { transform: scale(.9); }
.press-98 { transform: scale(.98); }

/* 空状态 */
.empty-state { display: flex; flex-direction: column; align-items: center; padding: 120rpx 0; }
.empty-icon { font-size: 80rpx; margin-bottom: 20rpx; }
.empty-txt { font-size: 28rpx; color: #99A1AF; text-align: center; }
/* 历史列表 */
.history-card {
	display: flex; align-items: center; background: white; border-radius: 32rpx;
	padding: 24rpx; gap: 16rpx; margin-bottom: 16rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
}
.hc-left { flex-shrink: 0; }
.hc-emoji { font-size: 48rpx; display: block; }
.hc-info { flex: 1; min-width: 0; }
.hc-tag { font-size: 30rpx; font-weight: 700; color: #1E2939; display: block; }
.hc-result { font-size: 26rpx; color: #F97316; font-weight: 600; display: block; margin-top: 4rpx; }
.hc-time { font-size: 22rpx; color: #99A1AF; display: block; margin-top: 4rpx; }
.hc-arrow { font-size: 20rpx; color: #D1D5DC; flex-shrink: 0; }
.bottom-spacer { height: 60rpx; }
</style>
