<!-- ========== 绿色通道闪屏组件（骨架） ========== -->
<template>
	<view v-if="visible" class="gcs-overlay" @click="dismiss">
		<view class="gcs-box">
			<view class="gcs-border"></view>
			<text class="gcs-icon">🟢</text>
			<text class="gcs-title">绿色通道</text>
			<text class="gcs-sub">小绿人进场动画 · 待设计</text>
			<view class="gcs-logs">
				<text class="gcs-log">[系统] 检测到新用户绿色通道资格 ✓</text>
				<text class="gcs-log">[系统] 正在跳过候场区...</text>
				<text class="gcs-log">[系统] → 您的模板已进入置顶池！</text>
			</view>
		</view>
	</view>
</template>

<script>
export default {
	props: {
		visible: { type: Boolean, default: false }
	},
	watch: {
		visible(val) {
			if (val) {
				this.autoDismiss()
			}
		}
	},
	methods: {
		autoDismiss() {
			setTimeout(() => {
				this.$emit('close')
			}, 2000)
		},
		dismiss() {
			this.$emit('close')
		}
	}
}
</script>

<style>
.gcs-overlay {
	position: fixed; inset: 0; z-index: 999;
	background: rgba(0,0,0,0.6);
	display: flex; align-items: center; justify-content: center;
}
.gcs-box {
	width: 560rpx; background: #0B3D0B; border-radius: 40rpx;
	padding: 60rpx 40rpx; text-align: center; position: relative;
	overflow: hidden;
}
.gcs-border {
	position: absolute; inset: 6rpx;
	border: 4rpx dashed #22C55E; border-radius: 36rpx;
	opacity: 0.6;
}
.gcs-icon { font-size: 72rpx; display: block; margin-bottom: 16rpx; }
.gcs-title { font-size: 40rpx; font-weight: 800; color: #22C55E; display: block; }
.gcs-sub { font-size: 24rpx; color: #86EFAC; display: block; margin-top: 8rpx; opacity: 0.7; }
.gcs-logs { margin-top: 32rpx; text-align: left; }
.gcs-log {
	display: block; font-size: 22rpx; color: #4ADE80; line-height: 2;
	font-family: monospace;
}
.gcs-log:last-child { color: #22C55E; font-weight: 600; }
</style>
