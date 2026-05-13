<!-- ========== 工具集首页 ========== -->
<template>
	<view class="page">
		<!-- 顶部品牌区 -->
		<view class="header">
			<view class="brand">
				<text class="brand-emoji">🦊</text>
				<view class="brand-text">
					<text class="brand-title">快乐大狐狸</text>
					<text class="brand-subtitle">一个小工具箱</text>
				</view>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
	<view class="tool-grid" v-if="showGrid">
					<view
						v-for="(tool, idx) in tools" :key="tool.id"
						class="card-wrapper"
						hover-class="jelly-press"
						:hover-start-time="0" :hover-stay-time="150"
						@click="openTool(tool)"
					>
						<view class="card-inner" :style="{ animationDelay: (0.1 + idx * 0.05) + 's' }">
							<view class="tool-emoji">
								<text>{{ tool.emoji }}</text>
							</view>
							<text class="tool-name">{{ tool.name }}</text>
							<text class="tool-desc">{{ tool.desc }}</text>
						</view>
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
		return {
			showGrid: true,
			isFirstShow: true,
			tools: [
				{
					id: 'quiz',
					name: '趣味测试',
					emoji: '📝',
					desc: '测着玩的，别当真',
					route: '/pages-tools/quiz-home/quiz-home'
				}
			]
		}
	},
	onShow() {
		// 跳过首次（首次加载时 created 已渲染好，动画自然播放）
		if (this.isFirstShow) {
			this.isFirstShow = false
			return
		}
		// 后续每次页面显示时重建卡片 DOM，重新触发入场动画
		this.showGrid = false
		this.$nextTick(() => {
			this.showGrid = true
		})
	},
	methods: {
		openTool(tool) { uni.navigateTo({ url: tool.route }) }
	}
}
</script>

<style>
.page { width: 100%; min-height: 100vh; background: #F7F8FA; display: flex; flex-direction: column; }

/* ====== 品牌头 ====== */
.header {
	display: flex; justify-content: space-between; align-items: flex-start;
	padding: 128rpx 48rpx 0;
}
.brand { display: flex; align-items: flex-start; gap: 14rpx; }
.brand-emoji { font-size: 72rpx; animation: foxBreathe 3.5s ease-in-out infinite; }
.brand-text { display: flex; flex-direction: column; }
.brand-title { font-size: 44rpx; font-weight: 700; color: #101828; }
.brand-subtitle {
	font-size: 26rpx; color: #6A7282; font-weight: 500;
	letter-spacing: 0.64rpx; margin-top: 6rpx;
}


/* ====== 果冻按压（Figma 规格） ====== */
.card-wrapper { transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.jelly-press { transform: scale(0.95); transition: transform 0.05s ease-in; }

/* ====== 滚动容器 ====== */
.body { flex: 1; }
.body-inner { padding: 48rpx 40rpx 0; }

/* ====== 工具卡片网格 ====== */
.tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16rpx; }

/* 外层：按压缩放 / 内层：弹性上滑入场 */
.card-inner {
	background: #FFF7ED; border-radius: 48rpx;
	padding: 42rpx 24rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1), 0 1rpx 3rpx rgba(0,0,0,0.1);
	outline: 1rpx solid rgba(0,0,0,0.05);
	text-align: center;
	animation-name: slideUpElastic;
	animation-duration: 0.7s;
	animation-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
	animation-fill-mode: both;
}
.tool-emoji {
	width: 110rpx; height: 120rpx;
	display: flex; align-items: center; justify-content: center;
	font-size: 80rpx; margin: 0 auto 24rpx;
	box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.15);
}
.tool-name { font-size: 32rpx; font-weight: 700; color: #1E2939; display: block; }
.tool-desc {
	font-size: 22rpx; color: #6A7282; font-weight: 500; display: block;
	margin-top: 6rpx;
}

/* ====== 底部 spacer ====== */
.bottom-spacer { height: 60rpx; width: 100%; }

/* ====== 动画 ====== */
@keyframes foxBreathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6rpx); } }

/* Figma: elastic slide-up */
@keyframes slideUpElastic {
	0% { opacity: 0; transform: translateY(120rpx); }
	100% { opacity: 1; transform: translateY(0); }
}
</style>
