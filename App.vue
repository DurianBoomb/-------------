<script>
	import initApp from '@/common/appInit.js';
	import openApp from '@/common/openApp.js';
	// #ifdef H5
		openApp() //创建在h5端全局悬浮引导用户下载app的功能
	// #endif
	import checkIsAgree from '@/pages/uni-agree/utils/uni-agree.js';
	import uniIdPageInit from '@/uni_modules/uni-id-pages/init.js';
	import { store, mutations } from '@/uni_modules/uni-id-pages/common/store.js';
	export default {
		globalData: {
			searchText: '',
			appVersion: {},
			config: {},
			$i18n: {},
			$t: {}
		},
		onLaunch: function() {
			// 全局拦截：任何地方调用 showLoading 后立刻自动关闭
			uni.addInterceptor('showLoading', {
				complete() { uni.hideLoading() }
			})
			console.log('App Launch')
			this.globalData.$i18n = this.$i18n
			this.globalData.$t = str => this.$t(str)
			initApp();
			uniIdPageInit()

			// ★ 微信小程序静默注册（无感登录）
			// #ifdef MP-WEIXIN
			this.silentLogin()
			// #endif

			// #ifdef APP
			//checkIsAgree(); APP端暂时先用原生默认生成的。目前，自定义方式启动vue界面时，原生层已经请求了部分权限这并不符合国家的法规
			// #endif

			// #ifdef H5
			// checkIsAgree(); // 默认不开启。目前全球，仅欧盟国家有网页端同意隐私权限的需要。如果需要可以自己去掉注视后生效
			// #endif

			// #ifdef APP-PLUS
			//idfa有需要的用户在应用首次启动时自己获取存储到storage中
			/*var idfa = '';
			var manager = plus.ios.invoke('ASIdentifierManager', 'sharedManager');
			if(plus.ios.invoke(manager, 'isAdvertisingTrackingEnabled')){
				var identifier = plus.ios.invoke(manager, 'advertisingIdentifier');
				idfa = plus.ios.invoke(identifier, 'UUIDString');
				plus.ios.deleteObject(identifier);
			}
			plus.ios.deleteObject(manager);
			console.log('idfa = '+idfa);*/
			// #endif
		},
		onShow: function() {
			console.log('App Show')
		},
		onHide: function() {
			console.log('App Hide')
		},

		// ★ 微信静默注册（无感登录）
		methods: {
			// #ifdef MP-WEIXIN
			async silentLogin() {
				// token 存在且未过期才跳过；过期了就重新登录
				const token = uni.getStorageSync('uni_id_token')
				const tokenExpired = uni.getStorageSync('uni_id_token_expired') || 0
				if (token && tokenExpired > Date.now()) return
				if (token) {
					uni.removeStorageSync('uni_id_token')
					uni.setStorageSync('uni_id_token_expired', 0)
				}

				try {
					const loginResult = await uni.login({ provider: 'weixin' })
					// 兼容 uni.login 返回 [err, res] 数组或直接返回 res 的情况
					const loginRes = Array.isArray(loginResult) ? loginResult[1] : loginResult
					if (!loginRes || !loginRes.code) {
						console.warn('[静默注册] uni.login 未返回 code')
						return
					}

					const uniIdCo = uniCloud.importObject('uni-id-co', {
						customUI: true
					})
					const res = await uniIdCo.loginByWeixin({ code: loginRes.code })

					if (res.errCode === 0 || res.errCode === 'uni-id-account-exists') {
						mutations.setUserInfo(res.userInfo || {}, { cover: true })
						uni.$emit('uni-id-pages-login-success')
						console.log('[静默注册] 成功', res.type)
					} else {
						console.warn('[静默注册] 登录失败', res.errCode, res.errMsg)
					}
				} catch (e) {
					console.warn('[静默注册] 异常（不影响页面展示）', e.message)
				}
			}
			// #endif
		}
	}
</script>

<style lang="scss">
	/* 注意要写在第一行，同时给style标签加入lang="scss"属性 */
	@import "@/uni_modules/uview-ui/index.scss";
</style>