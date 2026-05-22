<!-- ========== 置顶栏组件（骨架） ========== -->
<template>
	<view class="pin-topbar">
		<view class="ptb-header">
			<text class="ptb-title">🔥 置顶热门</text>
			<text class="ptb-subtitle">你的问卷正在被推荐</text>
		</view>

		<!-- 加载态：骨架屏 -->
		<view v-if="loading" class="ptb-track">
			<view v-for="i in 5" :key="i" class="ptb-card ptb-skeleton">
				<view class="ptb-card-cover ptb-skel-cover"></view>
				<view class="ptb-skel-line ptb-skel-title"></view>
				<view class="ptb-skel-line ptb-skel-author"></view>
			</view>
		</view>

		<!-- 空池态：引导 -->
		<view v-else-if="cards.length === 0" class="ptb-empty">
			<text class="ptb-empty-icon">📭</text>
			<text class="ptb-empty-txt">当前暂无置顶问卷</text>
			<text class="ptb-empty-sub">看广告置顶你的问卷，让它被更多人看见</text>
		</view>

		<!-- 正常态：水平滚动卡片 -->
		<scroll-view v-else class="ptb-track" scroll-x enable-flex>
			<view v-for="(card, idx) in cards" :key="idx" class="ptb-card" hover-class="press-95">
				<view class="ptb-card-cover">
					<image v-if="card.surveyCover" :src="card.surveyCover" class="ptb-card-img" mode="aspectFill" />
					<text v-else class="ptb-card-emoji">📋</text>
					<view v-if="card.isMine" class="ptb-badge">
						<text class="ptb-badge-txt">我</text>
					</view>
					<view v-else-if="isPromotedByMe(card)" class="ptb-badge ptb-badge-promote">
						<text class="ptb-badge-txt">推广</text>
					</view>
					<view v-if="card.haloActive" class="ptb-halo"></view>
				</view>
				<text class="ptb-card-title">{{ card.surveyTitle }}</text>
				<text class="ptb-card-author">{{ card.surveyAuthor || '匿名' }}</text>
			</view>
		</scroll-view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			cards: [],
			loading: true
		}
	},
	computed: {
		currentUid() {
			try {
				const info = uni.getStorageSync('uni-id-pages-userInfo')
				return info?.uid || ''
			} catch (e) { return '' }
		}
	},
	methods: {
		isPromotedByMe(card) {
			return !card.isMine && card.pinType === 'promote' && card.pinnerId === this.currentUid
		},
		async refresh() {
			if (!this.currentUid) {
				this.loading = false
				return
			}
			const hasData = this.cards.length > 0
			if (!hasData) {
				this.loading = true
			}
			let loadingTimer = null
			if (hasData) {
				loadingTimer = setTimeout(() => {
					this.loading = true
				}, 300)
			}
			try {
				const ps = uniCloud.importObject('pin-system')
				const res = await ps.draw({ count: 5 })
				if (loadingTimer) clearTimeout(loadingTimer)
				if (res.errCode === 0 && res.data) {
					this.cards = res.data.items || []
				} else {
					console.warn('[pin-topbar] draw failed:', res)
				}
			} catch (e) {
				if (loadingTimer) clearTimeout(loadingTimer)
				console.error('[pin-topbar] refresh error:', e)
			} finally {
				this.loading = false
			}
		}
	}
}
</script>

<style>
.pin-topbar {
	padding: 0 40rpx 24rpx;
	background: linear-gradient(180deg, #FFFFFF 0%, #F7F8FA 100%);
}
.ptb-header { display: flex; align-items: baseline; gap: 12rpx; margin-bottom: 16rpx; }
.ptb-title { font-size: 28rpx; font-weight: 700; color: #1E2939; }
.ptb-subtitle { font-size: 22rpx; color: #99A1AF; }

.ptb-track { display: flex; flex-direction: row; gap: 16rpx; min-height: 200rpx; }

.ptb-card {
	flex-shrink: 0; width: 180rpx; background: white;
	border-radius: 24rpx; padding: 16rpx 12rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);
	text-align: center; position: relative; overflow: visible;
}
.ptb-card-cover {
	width: 100rpx; height: 100rpx; margin: 0 auto 10rpx;
	background: #FFF7ED; border-radius: 20rpx;
	display: flex; align-items: center; justify-content: center;
	position: relative; overflow: hidden;
}
.ptb-card-img { width: 100%; height: 100%; border-radius: 20rpx; }
.ptb-card-emoji { font-size: 44rpx; }
.ptb-badge {
	position: absolute; top: -4rpx; right: -4rpx;
	background: #F97316; border-radius: 50%;
	width: 32rpx; height: 32rpx;
	display: flex; align-items: center; justify-content: center;
	z-index: 2;
}
.ptb-badge-promote {
	background: #3B82F6;
	width: 44rpx; height: 32rpx;
	border-radius: 16rpx;
}
.ptb-badge-txt { font-size: 18rpx; color: white; font-weight: 700; }
.ptb-halo {
	position: absolute; inset: -6rpx;
	border: 4rpx solid #FBBF24; border-radius: 24rpx;
	animation: haloPulse 1.5s ease-in-out infinite;
	opacity: 0.6; pointer-events: none;
}
.ptb-card-title { font-size: 22rpx; font-weight: 600; color: #1E2939; display: block; overflow: hidden; text-overflow: ellipsis; }
.ptb-card-author { font-size: 18rpx; color: #99A1AF; display: block; margin-top: 4rpx; }

/* 骨架屏 */
.ptb-skeleton { pointer-events: none; }
.ptb-skel-cover { background: #E5E9F0; }
.ptb-skel-line {
	display: block; height: 16rpx; border-radius: 8rpx;
	background: #E5E9F0; margin: 0 auto;
	animation: skelPulse 1.2s ease-in-out infinite;
}
.ptb-skel-title { width: 100rpx; }
.ptb-skel-author { width: 72rpx; margin-top: 8rpx; }

/* 空池 */
.ptb-empty {
	display: flex; flex-direction: column; align-items: center;
	padding: 32rpx 0; gap: 8rpx;
}
.ptb-empty-icon { font-size: 48rpx; }
.ptb-empty-txt { font-size: 26rpx; font-weight: 600; color: #6A7282; }
.ptb-empty-sub { font-size: 22rpx; color: #99A1AF; }

.press-95 { transform: scale(0.95); transition: transform 0.1s; }

@keyframes haloPulse {
	0%, 100% { opacity: 0.3; }
	50% { opacity: 0.8; }
}
@keyframes skelPulse {
	0%, 100% { opacity: 0.4; }
	50% { opacity: 0.8; }
}
</style>
