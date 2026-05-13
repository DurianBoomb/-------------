<template>
	<view class="about">
		<view class="box">
			<image class="logoImg" :src="about.logo"></image>
			<text class="tip appName">{{about.appName}}</text>
			<text class="tip">{{about.slogan}}</text>
				<view @click="download" id="download">
				<text class="download-text">{{$t('invite.download')}}</text>
			</view>
			<text class="tip">version {{about.version}}</text>
		</view>
		<view class="copyright">
			<text class="hint">{{about.company}}</text>
		</view>
		
	</view>
</template>
<script>
	export default {
		computed: {
			uniStarterConfig() {
				return getApp().globalData.config
			}
		},
		data() {
			return {
				about: {},
				code: "",
				isIos: "",
					downloadUrl: {
					"ios": "",
					"android": ""
				}
			};
		},
		created() {
			this.about = this.uniStarterConfig.about
			this.downloadUrl = this.uniStarterConfig.download
			this.year = (new Date).getFullYear()

			//判断是否在微信中打开
			var userAgent = navigator.userAgent;
			var ua = userAgent.toLowerCase();
			this.isWeixin = ua.indexOf('micromessenger') != -1;
			//判断是否在ios或者安卓打开
			this.isIos = !!userAgent.match(/\(i[^;]+;( U;)? CPU.+Mac OS X/);
		},
		onLoad({
			code
		}) {
			this.code = code
			document.getElementById("openApp").style.display = 'none'
			document.getElementsByTagName("body")[0].style = ""
		},
		methods: {
			download() {
				if (this.code) {
					uni.setClipboardData({
						data: this.code,
						complete: (e) => {
							console.log(e);
							uni.hideToast()
							/* 以下临时解决setClipboardData h5端样式和键盘弹出端错误解决方案，后续会直接内置*/
							document.getElementById("#clipboard").style.top = '-999px';
							uni.hideKeyboard()
						}
					})
				}

				if (this.isIos) {
					window.location.href = this.downloadUrl.ios
				} else {
					if (this.isWeixin) {
						// 微信内直接跳转
					} else {
						window.location.href = this.downloadUrl.android
					}
				}
			}
		}
	}
</script>
<style lang="scss">
	/* #ifndef APP-NVUE */
	view {
		display: flex;
		box-sizing: border-box;
		flex-direction: column;
	}

	/* #endif */
	.about {
		width: 750rpx;
		flex-direction: column;
	}

	.box {
		margin-top: 100px;
		flex-direction: column;
		justify-content: center;
		align-items: center;
	}

	.logoImg {
		margin-bottom: 10upx;
		width: 160upx;
		height: 160upx;
		border-radius: 15px;
	}

	.tip {
		font-size: 24rpx;
		margin-top: 10px;
	}

	.appName {
		margin-top: 20px;
		font-size: 42rpx;
		font-weight: 500;
	}

	.copyright {
		width: 750upx;
		font-size: 32rpx;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		bottom: 20px;
		left: 0;
		position: fixed;
	}

	.hint {
		color: #999999;
		font-size: 26rpx;
	}

	#download {
		background-color: #2A9839;
		color: #FFFFFF;
		margin: 55rpx;
		padding: 5px;
		height: 30px;
		width: 160rpx;
		border-radius: 100px;
		flex-direction: row;
		align-items: center;
		justify-content: center;
	}

	.download-text {
		font-size: 32rpx;
	}
</style>
