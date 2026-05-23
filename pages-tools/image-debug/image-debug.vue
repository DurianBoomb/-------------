<template>
	<view class="wrap">
		<text class="label">结果页图片/Emoji 调试</text>

		<!-- 预览区 -->
		<view class="preview-box" :style="boxStyle">
			<image
				v-show="mode === 'image'"
				:src="imageUrl"
				mode="aspectFit"
				class="content-img"
			/>
			<text
				v-show="mode === 'emoji'"
				class="content-emoji"
				:style="{ fontSize: Math.round(size * 0.5) + 'rpx' }"
			>{{ emoji }}</text>
		</view>

		<text class="title">你被确诊为</text>
		<view class="badge"><text class="badge-txt">{{ resultName }}</text></view>

		<view class="sep"></view>

		<!-- 模式切换 -->
		<view class="btns">
			<view 
				class="btn" 
				:class="{ active: mode === 'image' }"
				@click="mode = 'image'"
			>图片模式</view>
			<view 
				class="btn" 
				:class="{ active: mode === 'emoji' }"
				@click="mode = 'emoji'"
			>Emoji模式</view>
		</view>

		<!-- 尺寸调节 -->
		<view class="ctrl-row">
			<text class="ctrl-label">尺寸: {{ size }}rpx</text>
			<view class="ctrl-btns">
				<text class="cbtn" @click="adjustSize(-20)">-20</text>
				<text class="cbtn" @click="adjustSize(-10)">-10</text>
				<text class="cbtn" @click="adjustSize(10)">+10</text>
				<text class="cbtn" @click="adjustSize(20)">+20</text>
			</view>
		</view>

		<!-- 下移调节 -->
		<view class="ctrl-row">
			<text class="ctrl-label">下移: {{ marginTop }}rpx</text>
			<view class="ctrl-btns">
				<text class="cbtn" @click="adjustMargin(-10)">-10</text>
				<text class="cbtn" @click="adjustMargin(-5)">-5</text>
				<text class="cbtn" @click="adjustMargin(5)">+5</text>
				<text class="cbtn" @click="adjustMargin(10)">+10</text>
			</view>
		</view>

		<!-- 圆角调节 -->
		<view class="ctrl-row">
			<text class="ctrl-label">圆角: {{ radius }}%</text>
			<view class="ctrl-btns">
				<text class="cbtn" @click="adjustRadius(-10)">-10</text>
				<text class="cbtn" @click="adjustRadius(-5)">-5</text>
				<text class="cbtn" @click="adjustRadius(5)">+5</text>
				<text class="cbtn" @click="adjustRadius(10)">+10</text>
			</view>
		</view>

		<!-- 背景开关 -->
		<view class="ctrl-row">
			<text class="ctrl-label">圆形背景</text>
			<view class="ctrl-btns">
				<text class="cbtn" :class="{ active: !showBg }" @click="showBg = false">关闭</text>
				<text class="cbtn" :class="{ active: showBg }" @click="showBg = true">开启</text>
			</view>
		</view>

		<view class="sep"></view>

		<!-- 生成的CSS -->
		<view class="css-box">
			<text class="css-title">CSS代码（直接复制到result.vue）</text>
			<text class="css-code">{{ cssCode }}</text>
		</view>
	</view>
</template>

<script>
export default {
	data() {
		return {
			mode: 'image',
			imageUrl: '/static/给狐狸.png',
			emoji: '🌭',
			resultName: '纯正淀粉肠',
			size: 360,
			marginTop: 0,
			radius: 0,
			showBg: false
		}
	},
	computed: {
		boxStyle() {
			const style = {
				width: this.size + 'rpx',
				height: this.size + 'rpx',
				marginTop: this.marginTop + 'rpx',
				borderRadius: this.radius + '%'
			}
			if (this.showBg) {
				style.background = '#fff'
				style.boxShadow = '0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1)'
			} else {
				style.border = '2rpx dashed #E5E7EB'
			}
			return style
		},
		cssCode() {
			let code = `.emoji-circle {\n`
			code += `  width: ${this.size}rpx;\n`
			code += `  height: ${this.size}rpx;\n`
			code += `  margin-top: ${this.marginTop}rpx;\n`
			code += `  border-radius: ${this.radius}%;\n`
			if (this.showBg) {
				code += `  background: #fff;\n`
				code += `  box-shadow: 0 1rpx 2rpx -1rpx rgba(0,0,0,.1), 0 1rpx 3rpx rgba(0,0,0,.1);\n`
			}
			code += `}\n`
			if (this.mode === 'image') {
				code += `.emoji-img { border-radius: ${this.radius}%; }`
			}
			return code
		}
	},
	methods: {
		adjustSize(delta) {
			this.size = Math.max(100, Math.min(600, this.size + delta))
		},
		adjustMargin(delta) {
			this.marginTop = Math.max(0, Math.min(200, this.marginTop + delta))
		},
		adjustRadius(delta) {
			this.radius = Math.max(0, Math.min(50, this.radius + delta))
		}
	}
}
</script>

<style scoped>
.wrap {
	padding: 60rpx 40rpx 80rpx;
	display: flex; flex-direction: column; align-items: center;
	background: #F7F8FA; min-height: 100vh;
}
.label {
	font-size: 24rpx; color: #9CA3AF; margin-bottom: 30rpx;
}

/* 预览盒子 */
.preview-box {
	display: flex; align-items: center; justify-content: center;
	overflow: hidden;
	transition: all 0.2s;
}
.content-img {
	width: 100%; height: 100%;
}
.content-emoji {
	font-size: 180rpx;
}

/* 标题 */
.title {
	font-size: 60rpx; font-weight: 900; color: #101828;
	margin-top: 24rpx;
}
.badge {
	background: #FFEDD4; border-radius: 60rpx;
	padding: 12rpx 36rpx; margin-top: 16rpx;
}
.badge-txt {
	font-size: 28rpx; color: #CA3500; font-weight: 700;
}

.sep {
	width: 100%; height: 1rpx; background: #E5E7EB;
	margin: 30rpx 0;
}

/* 模式按钮 */
.btns {
	display: flex; gap: 16rpx;
}
.btn {
	padding: 20rpx 40rpx; border-radius: 16rpx;
	font-size: 26rpx; font-weight: 700;
	background: #F3F4F6; color: #6B7280;
	transition: all 0.15s;
}
.btn.active {
	background: #F97316; color: #fff;
}

/* 控制行 */
.ctrl-row {
	width: 100%;
	display: flex; align-items: center; justify-content: space-between;
	margin-top: 20rpx;
}
.ctrl-label {
	font-size: 26rpx; color: #374151; font-weight: 600;
}
.ctrl-btns {
	display: flex; gap: 8rpx;
}
.cbtn {
	padding: 10rpx 16rpx; border-radius: 8rpx;
	font-size: 22rpx; font-weight: 600;
	background: #F3F4F6; color: #4B5563;
}
.cbtn:active {
	background: #E5E7EB;
}
.cbtn.active {
	background: #F97316; color: #fff;
}

/* CSS输出 */
.css-box {
	width: 100%;
	background: #1F2937; border-radius: 12rpx;
	padding: 20rpx;
}
.css-title {
	font-size: 22rpx; color: #9CA3AF; margin-bottom: 12rpx;
	display: block;
}
.css-code {
	font-size: 22rpx; color: #FCD34D;
	font-family: monospace; line-height: 1.6;
	white-space: pre-wrap;
	display: block;
}
</style>
