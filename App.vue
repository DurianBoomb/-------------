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
			// 全局拦截：阻止所有 showLoading 调用
			uni.addInterceptor('showLoading', {
				invoke() { return false }
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
		// loginByWeixin 是幂等的——已注册用户调用只刷新 token，不会重复注册
		methods: {
			// #ifdef MP-WEIXIN
			async silentLogin() {
				// ★ 不再信任本地 storage 的旧 token（副本工程继承了原工程的 token 会导致校验失败）
				// 每次启动都走一次完整的微信登录流程，loginByWeixin 会自动刷新 token
				try {
					const loginResult = await uni.login({ provider: 'weixin' })
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
						// 使用标准 loginSuccess 流程：从数据库拉取完整用户信息
						// showToast:false 避免静默登录弹出 toast
						// autoBack:false  避免静默登录触发页面跳转
						mutations.loginSuccess({ showToast: false, autoBack: false })
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