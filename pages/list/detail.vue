<template>
	<view class="product-page">
		<!-- #ifdef APP-PLUS -->
		<uni-nav-bar :statusBar="true" :border="false"></uni-nav-bar>
		<!-- #endif -->
		<unicloud-db v-slot:default="{data, loading, error, options}" :options="formData" :collection="colList"
			:getone="true" :manual="true" ref="detail"
			foreignKey="opendb-news-articles.user_id" @load="loadData">
			<template v-if="!loading && data">
				<!-- 商品轮播图 -->
				<view class="product-banner">
					<swiper class="product-swiper" :indicator-dots="productImages.length > 1" indicator-color="rgba(255,255,255,0.5)"
						indicator-active-color="#fff" :autoplay="true" :interval="3000" :circular="true"
						@change="onSwiperChange">
						<swiper-item v-for="(img, index) in productImages" :key="index">
							<image class="product-img" :src="img" mode="aspectFit" @click="previewImage(index)"></image>
						</swiper-item>
					</swiper>
					<view class="swiper-count" v-if="productImages.length > 1">{{swiperCurrent + 1}}/{{productImages.length}}</view>
				</view>
				<!-- 商品价格信息 -->
				<view class="product-info">
					<view class="price-row">
						<text class="price-symbol">¥</text>
						<text class="price-value">{{data.price || '0.00'}}</text>
						<text class="price-origin" v-if="data.original_price">¥{{data.original_price}}</text>
					</view>
					<view class="product-title">{{ title }}</view>
					<view class="product-desc">{{data.excerpt}}</view>
				</view>
				<!-- 商品规格 -->
				<view class="product-specs">
					<view class="spec-item" v-if="data.specs && data.specs.length" @click="showSpecPopup = true">
						<text class="spec-label">规格</text>
						<text class="spec-value">请选择商品规格</text>
						<text class="spec-arrow">›</text>
					</view>
					<view class="spec-item">
						<text class="spec-label">运费</text>
						<text class="spec-value">{{data.freight > 0 ? '¥' + data.freight : '包邮'}}</text>
					</view>
					<view class="spec-item">
						<text class="spec-label">销量</text>
						<text class="spec-value">{{data.sales_count || 0}}件</text>
					</view>
				</view>
				<!-- 商品详情 -->
				<view class="product-detail-section">
					<view class="section-title">商品详情</view>
					<view class="product-detail-content">
						<rich-text :nodes="data.content"></rich-text>
					</view>
				</view>
			</template>
		</unicloud-db>

	</view>
</template>

<script>
	// #ifdef APP-PLUS
	import UniShare from '@/uni_modules/uni-share/js_sdk/uni-share.js';
	import uniNavBar from '@/uni_modules/uni-nav-bar/components/uni-nav-bar/uni-nav-bar.vue';
	const uniShare = new UniShare()
	// #endif
	const db = uniCloud.database();
	const readNewsLog = db.collection('read-news-log')
	export default {
		// #ifdef APP-PLUS
		components:{
			"uni-nav-bar":uniNavBar
		},
		onBackPress({from}) {
			if(from == 'backbutton'){
				if(uniShare.isShow){
					this.$nextTick(function(){
						console.log(uniShare);
						uniShare.hide()
					})
				}
				return uniShare.isShow;
			}
		},
		// #endif
		data() {
			return {
				id: "",
				title: 'title',
				isFavorite: false,
				showSpecPopup: false,
				productImages: [],
				swiperCurrent: 0,
				formData: {
					noData: '<p style="text-align:center;color:#666">详情加载中...</p>'
				}
			}
		},
		computed: {
			uniStarterConfig() {
				return getApp().globalData.config
			},
			where(){
				//拼接where条件 查询条件 ,更多详见 ：https://uniapp.dcloud.net.cn/uniCloud/unicloud-db?id=jsquery
				return `_id =="${this.id}"`
			},
      colList(){
      	return [
      		db.collection('opendb-news-articles').where(this.where).field('user_id,_id,avatar,images,excerpt,last_modify_date,price,original_price,sales_count,stock,specs,freight,comment_count,like_count,title,content').getTemp(),
          db.collection('uni-id-users').field('_id,nickname').getTemp()
      	]
      }
		},
		onLoad(event) {
			//获取真实新闻id，通常 id 来自上一个页面
			if (event.id) {
				this.id = event.id
			}
			//若上一页传递了标题过来，则设置导航栏标题
			if (event.title) {
				this.title = event.title
				uni.setNavigationBarTitle({
					title: event.title
				})
			}
		},
		onReady() {
			// 开始加载数据，修改 where 条件后才开始去加载 clinetDB 的数据 ，需要等组件渲染完毕后才开始执行 loadData，所以不能再 onLoad 中执行
			if (this.id) { // ID 不为空，则发起查询
				this.$refs.detail.loadData()
			} else {
				uni.showToast({
					icon: 'none',
					title: this.$t('listDetail.newsErr')
				})
			}
		},
		onNavigationBarButtonTap(event) {
			if (event.type == 'share') {
				this.shareClick();
			}
		},
		methods: {
			$log(...args){
				console.log('args',...args,this.id)
			},
			setReadNewsLog(){
				let item = {
					"article_id":this.id,
					"last_time":Date.now()
				},
				readNewsLog = uni.getStorageSync('readNewsLog')||[],
				index = -1;
				readNewsLog.forEach(({article_id},i)=>{
					if(article_id == item.article_id){
						index = i
					}
				})
				if(index === -1){
					readNewsLog.push(item)
				}else{
					readNewsLog.splice(index,1,item)
				}
				uni.setStorageSync('readNewsLog',readNewsLog)
				console.log(readNewsLog);
			},
			setFavorite() {
				if ( uniCloud.getCurrentUserInfo().tokenExpired < Date.now() ){
					return console.log('未登录用户');
				}
				let article_id = this.id,
					last_time = Date.now();
					console.log({article_id,last_time});
					readNewsLog.where(`"article_id" == "${article_id}" && "user_id"==$env.uid`)
						.update({last_time})
						.then(({result:{updated}}) => {
							console.log('updated',updated);
							if (!updated) {
								readNewsLog.add({article_id}).then(e=>{
									console.log(e);
								}).catch(err => {
									console.log(err);
								})
							}
						}).catch(err => {
							console.log(err);
						})
			},
			loadData(data) {
				if (this.title == '' && data[0].title) {
					this.title = data[0].title
					uni.setNavigationBarTitle({
						title: data[0].title
					});
				}
				if (data[0].images && data[0].images.length) {
					this.productImages = data[0].images
				} else {
					this.productImages = data[0].avatar ? [data[0].avatar] : []
				}
				this.setReadNewsLog();
			},
			onSwiperChange(e) {
				this.swiperCurrent = e.detail.current;
			},
			previewImage(index) {
				uni.previewImage({
					current: index,
					urls: this.productImages
				});
			},
			followClick() {
				uni.showToast({
					title:this.$t('listDetail.follow'),
					icon: 'none'
				});
			},
	
			/**
			 * 分享该文章
			 */
			// #ifdef APP-PLUS
			shareClick() {
				let {
					_id,
					title,
					excerpt,
					avatar
				} = this.$refs.detail.dataList
				console.log( JSON.stringify({
					_id,
					title,
					excerpt,
					avatar
				}) );
				uniShare.show({
					content: { //公共的分享类型（type）、链接（herf）、标题（title）、summary（描述）、imageUrl（缩略图）
						type: 0,
						href: this.uniStarterConfig.h5.url + `/#/pages/list/detail?id=${_id}&title=${title}`,
						title: this.title,
						summary: excerpt,
						imageUrl: avatar + '?x-oss-process=image/resize,m_fill,h_100,w_100' //压缩图片解决，在ios端分享图过大导致的图片失效问题
					},
					menus: [{
							"img": "/static/app/sharemenu/wechatfriend.png",
							"text": this.$t('common.wechatFriends'),
							"share": {
								"provider": "weixin",
								"scene": "WXSceneSession"
							}
						},
						{
							"img": "/static/app/sharemenu/wechatmoments.png",
							"text": this.$t('common.wechatBbs'),
							"share": {
								"provider": "weixin",
								"scene": "WXSceneTimeline"
							}
						},
						{
							"img": "/static/app/sharemenu/mp_weixin.png",
							"text": this.$t('common.wechatApplet'),
							"share": {
								provider: "weixin",
								scene: "WXSceneSession",
								type: 5,
								miniProgram: {
									id: this.uniStarterConfig.mp.weixin.id,
									path: `/pages/list/detail?id=${_id}&title=${title}`,
									webUrl: this.uniStarterConfig.h5.url +
										`/#/pages/list/detail?id=${_id}&title=${title}`,
									type: 0
								},
							}
						},
						{
							"img": "/static/app/sharemenu/weibo.png",
							"text": this.$t('common.weibo'),
							"share": {
								"provider": "sinaweibo"
							}
						},
						{
							"img": "/static/app/sharemenu/qq.png",
							"text": "QQ",
							"share": {
								"provider": "qq"
							}
						},
						{
							"img": "/static/app/sharemenu/copyurl.png",
							"text": this.$t('common.copy'),
							"share": "copyurl"
						},
						{
							"img": "/static/app/sharemenu/more.png",
							"text": this.$t('common.more'),
							"share": "shareSystem"
						}
					],
					cancelText: this.$t('common.cancelShare'),
				}, e => { //callback
					console.log(e);
				})
			}
			// #endif
		}
	}
</script>

<style scoped>
	.product-page {
		padding-bottom: 110rpx;
		background-color: #f5f5f5;
		min-height: 100vh;
	}

	.product-banner {
		position: relative;
		width: 100%;
		height: 750rpx;
		background-color: #fff;
	}

	.product-swiper {
		width: 100%;
		height: 750rpx;
	}

	.swiper-count {
		position: absolute;
		right: 24rpx;
		bottom: 24rpx;
		background: rgba(0, 0, 0, 0.5);
		color: #fff;
		font-size: 24rpx;
		padding: 4rpx 16rpx;
		border-radius: 20rpx;
	}

	.product-img {
		width: 100%;
		height: 750rpx;
	}

	.product-info {
		background-color: #fff;
		padding: 24rpx 30rpx;
		margin-bottom: 20rpx;
	}

	.price-row {
		display: flex;
		align-items: baseline;
		margin-bottom: 16rpx;
	}

	.price-symbol {
		font-size: 28rpx;
		color: #e4393c;
		font-weight: bold;
	}

	.price-value {
		font-size: 52rpx;
		color: #e4393c;
		font-weight: bold;
		margin-left: 4rpx;
	}

	.price-origin {
		font-size: 24rpx;
		color: #999;
		text-decoration: line-through;
		margin-left: 16rpx;
	}

	.product-title {
		font-size: 32rpx;
		color: #333;
		font-weight: bold;
		line-height: 1.5;
		margin-bottom: 10rpx;
	}

	.product-desc {
		font-size: 26rpx;
		color: #999;
		line-height: 1.5;
	}

	.product-specs {
		background-color: #fff;
		padding: 0 30rpx;
		margin-bottom: 20rpx;
	}

	.spec-item {
		display: flex;
		align-items: center;
		padding: 28rpx 0;
		border-bottom: 1rpx solid #f0f0f0;
	}

	.spec-item:last-child {
		border-bottom: none;
	}

	.spec-label {
		font-size: 26rpx;
		color: #999;
		width: 100rpx;
		flex-shrink: 0;
	}

	.spec-value {
		font-size: 26rpx;
		color: #333;
		flex: 1;
	}

	.spec-arrow {
		font-size: 32rpx;
		color: #ccc;
		margin-left: 10rpx;
	}

	.product-detail-section {
		background-color: #fff;
		padding: 30rpx;
	}

	.section-title {
		font-size: 30rpx;
		color: #333;
		font-weight: bold;
		text-align: center;
		padding-bottom: 24rpx;
		border-bottom: 1rpx solid #f0f0f0;
		margin-bottom: 24rpx;
	}

	.product-detail-content {
		font-size: 28rpx;
		color: #333;
		line-height: 1.8;
		overflow: hidden;
	}


</style>
