<!-- ========== 工具集首页 ========== -->release测试
<template>
	<view class="page">
		<!-- 顶部品牌区 -->
		<view class="header">
			<view class="brand">
				<image class="brand-emoji" src="/static/给狐狸.png" mode="aspectFit"></image>
				<view class="brand-text">
					<text class="brand-title">快乐大狐狸</text>
					<text class="brand-subtitle">一个小工具箱</text>
				</view>
			</view>
		</view>

		<scroll-view class="body" scroll-y>
			<view class="body-inner">
			<view class="tool-grid" :key="gridKey">
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

				<!-- mock：结果页 desc-card + 作者行预览 -->
				<view class="mock-section">
					<text class="mock-label">📱 结果页预览</text>
					<view class="mock-desc-card">
						<text class="mock-quote">"</text>
						<text class="mock-desc-txt">别挣扎了，你骨子里就是根5块钱的淀粉肠。</text>
						<text class="mock-creator-line">—— 来自 <text class="mock-creator-name">张三</text> 的创作</text>
					</view>
				</view>

				<!-- 置顶系统测试入口（mock 测试用） -->
				<view class="dev-section">
					<text class="mock-label">🔧 开发测试</text>
					<view class="dev-row">
						<view class="dev-btn dev-btn-sm" hover-class="press-95" @click="goPage('/pages-tools/career/career-detail')">
							<text class="dev-btn-txt">战绩单详情</text>
						</view>
						<view class="dev-btn dev-btn-sm" hover-class="press-95" @click="goPage('/pages-tools/career/career-history')">
							<text class="dev-btn-txt">历史档案</text>
						</view>
						<view class="dev-btn dev-btn-sm" hover-class="press-95" @click="goRadarFakeTest">
							<text class="dev-btn-txt">雷达图验收</text>
						</view>
						<view class="dev-btn dev-btn-sm" hover-class="press-95" @click="goImageDebug">
							<text class="dev-btn-txt">图片调试</text>
						</view>
					<view class="dev-btn dev-btn-sm" hover-class="press-95" @click="goPage('/pages-tools/pin-migration-test/pin-migration-test')">
						<text class="dev-btn-txt">迁移验证</text>
					</view>
					<view class="dev-btn dev-btn-sm" hover-class="press-95" @click="goPage('/pages-tools/pin-dashboard/pin-dashboard')">
						<text class="dev-btn-txt">置顶监控</text>
					</view>
					<view class="dev-btn dev-btn-sm" hover-class="press-95" @click="goPage('/pages-tools/slot-fix-test/slot-fix-test')">
						<text class="dev-btn-txt">槽位修复测试</text>
					</view>
					<view class="dev-btn dev-btn-sm dev-btn-accent" hover-class="press-95" @click="goPage('/pages-tools/pin-e2e-test/pin-e2e-test')">
						<text class="dev-btn-txt">一键全测</text>
					</view>
					<view class="dev-btn dev-btn-sm dev-btn-accent" hover-class="press-95" @click="goPage('/pages-tools/phase1-test/phase1-test')">
						<text class="dev-btn-txt">阶段一测试</text>
					</view>
					</view>
				</view>

				<!-- 暗金标签验收 -->
				<view class="dev-section">
					<text class="mock-label">🔬 暗金标签验收</text>
					<view class="tag-accept-row">
						<view class="tag-wrapper-accept" hover-class="tag-press-accept" @click="goDarkgoldQuiz">
							<view class="tag-inner tag-darkgold">
								<text>群友成分鉴定</text>
								<text class="sparkle-tail">✨</text>
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
export default {
	data() {
		return {
			gridKey: 0,
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
		this.gridKey++
	},
	methods: {
		openTool(tool) { uni.navigateTo({ url: tool.route }) },
		goRadarFakeTest() { uni.navigateTo({ url: '/pages-tools/radar-fake-test/radar-fake-test' }) },
		goImageDebug() { uni.navigateTo({ url: '/pages-tools/image-debug/image-debug' }) },
		goDarkgoldQuiz() { uni.navigateTo({ url: '/pages-tools/answer-quiz/answer-quiz?tag=' + encodeURIComponent('群友成分鉴定') }) },
		goPage(url) { uni.navigateTo({ url }) }
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
.brand-emoji { width: 72rpx; height: 72rpx; animation: foxBreathe 3.5s ease-in-out infinite; }
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

/* ====== mock：结果页预览 ====== */
.mock-section { margin-top: 48rpx; }
.mock-label { font-size: 24rpx; color: #99A1AF; font-weight: 500; display: block; margin-bottom: 16rpx; }
.mock-desc-card {
	background: #FFFFFF; border-radius: 28rpx; padding: 36rpx 32rpx;
	box-shadow: 0 2rpx 8rpx rgba(0,0,0,0.06);
	position: relative;
}
.mock-quote {
	position: absolute; top: 6rpx; left: 18rpx;
	font-size: 56rpx; color: #E5E9F0; font-weight: 700; line-height: 1;
}
.mock-desc-txt { font-size: 30rpx; color: #4A5565; font-weight: 500; line-height: 1.8; text-align: justify; letter-spacing: 0.76rpx; }
.mock-creator-line { display: block; font-size: 24rpx; color: #99A1AF; margin-top: 24rpx; text-align: right; font-weight: 400; }
.mock-creator-name { color: #F97316; font-weight: 600; }

/* ====== 底部 spacer ====== */
.dev-section { margin-top: 32rpx; }
.dev-row { display: flex; flex-wrap: wrap; gap: 12rpx; }
.dev-btn {
	background: #1E2939; border-radius: 24rpx; padding: 20rpx 32rpx;
	display: flex; align-items: center; justify-content: center; flex: 1;
}
.dev-btn-sm { padding: 14rpx 20rpx; }
.dev-btn-accent { background: linear-gradient(135deg, #4a90d9, #357abd); }
.dev-btn-txt { font-size: 24rpx; color: white; font-weight: 600; white-space: nowrap; }
.press-95 { transform: scale(0.95); }

.bottom-spacer { height: 60rpx; width: 100%; }

/* ====== 动画 ====== */
@keyframes foxBreathe { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-6rpx); } }

/* Figma: elastic slide-up */
@keyframes slideUpElastic {
	0% { opacity: 0; transform: translateY(120rpx); }
	100% { opacity: 1; transform: translateY(0); }
}

/* ====== 暗金标签验收样式 ====== */
.tag-accept-row {
	display: flex; flex-wrap: wrap; gap: 20rpx;
}
.tag-wrapper-accept { transition: transform 0.1s ease-out; }
.tag-press-accept { transform: scale(0.9); }
.tag-inner {
	border-radius: 40rpx;
	box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,0.1);
	max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.tag-darkgold {
	padding: 26rpx 44rpx;
	font-size: 46rpx;
	font-weight: 900;
	background: #1A1A1A;
	color: #C9A84C;
	border: 2rpx solid #C9A84C;
	text-shadow: 0 0 8rpx rgba(201, 168, 76, 0.5), 0 0 16rpx rgba(201, 168, 76, 0.3);
	animation: glowBreath 3s ease-in-out infinite;
}
.sparkle-tail {
	font-size: 32rpx;
	animation: sparkle 2s ease-in-out infinite;
}

@keyframes glowBreath {
	0%, 100% {
		box-shadow: 0 0 12rpx rgba(201, 168, 76, 0.3), 0 0 24rpx rgba(201, 168, 76, 0.1);
		border-color: #C9A84C;
	}
	50% {
		box-shadow: 0 0 28rpx rgba(201, 168, 76, 0.6), 0 0 56rpx rgba(201, 168, 76, 0.25);
		border-color: #E6C85C;
	}
}

@keyframes sparkle {
	0%, 100% { opacity: 0.4; transform: scale(0.8); }
	50% { opacity: 1; transform: scale(1.1); }
}


</style>
