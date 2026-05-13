<template>
	<view class="content">

		<!--  关键字 -->
		<view class="keyWordV">
			<!-- 词云图 -->
			<qiun-data-charts type="word" :chartData="chartsDataWord1" />

		</view>
		
		<!--  图片视图 -->
		<view class="chartV">
			
			<!-- 多重圆弧进度条 -->
			<qiun-data-charts type="arcbar"
				:opts="{title:{name:'360分' ,color:'#7E45FF',fontSize:24,offsetY:-12,fontWeight:600},subtitle:{name:'各科成绩总评分',color:'#666666',fontSize:14,offsetY:-6}}"
				:chartData="chartData" />
		
		</view>
	</view>
</template>

<script>
	export default {
		data() {
			return {
				chartsDataWord1: {},
				chartData:{},
				colorsArr : ['#1890FF', '#FAC858', '#7021FF', '#FF6216'],
				
			}
		},
		mounted() {

			this.initEchartData();
		},
		methods: {

			initEchartData() {
				// 关键词云图
				let tmpArr = ['开朗', '大方', '活泼', '善良', '勇敢', '热情', '思维敏捷', '刚强', '忠于祖国', '热爱集体', '关心他人', '乐于助人', '大公无私',
					'正直', '诚实', '文明礼貌', '勤劳节俭', '认真负责', '谦虚谨慎'
				];

				let dataArr = [];
				for (let i = 0; i < tmpArr.length; i++) {

					let tmpDict = {};
					let myTextSize =  (30 -  i) > 9 ? (30 -   i): 10
					tmpDict = {
						"name": tmpArr[i],
						"textSize": myTextSize,
					}
					dataArr.push(tmpDict);

				}
				this.chartsDataWord1 = {
					"series": dataArr
				};
				
				this.chartData = {
					"series": [{
						
						"data": '0.99',
						"color":  this.colorsArr[0]						
,
						
					},
					{
						
						"data": '0.69',
						"color":  this.colorsArr[1]						
,
						
					},
					{
						
						"data": '0.69',
						"color":  this.colorsArr[2]						
,
						
					},
					{
						
						"data": '0.59',
						"color":  this.colorsArr[3]						
,
						
					}]
				}

			}

		}
	}
</script>

<style>
	.content {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
	}

	.keyWordV {

		display: flex;
		margin-left: 12px;
		width: calc((100vw - 24px));
		height: 240px;


	}
	.chartV {
	
		display: flex;
		padding: 6px 8px;
		width: 76vw;
		height:76vw;
	
	
	}
</style>