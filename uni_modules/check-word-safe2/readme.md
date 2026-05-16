# check-word-safe 插件说明文档

## 一、插件简介

`check-word-safe` 是一款专为过滤、识别、匹配中文敏感词而设计的 uni-app 插件，敏感词库不断更新。

## 二、使用示例

### 初始化插件

``` js
import { checkSafeWord } from '@/uni_modules/check-word-safe/js_sdk/index.js'
export default {
  data() {
	return {
			
	}
  },
  mounted(){
	//自带默认敏感词过滤体系
	let result = checkSafeWord.filter("我是一个粉刷匠，粉刷本领强，会练炸弹！！我还会色诱，超级喜欢包二奶");
	let noSafeWord = checkSafeWord.match("我是一个粉刷匠，粉刷本领强，会练炸弹！！我还会色诱，超级喜欢包二奶");
	let checkSafe = checkSafeWord.verify("我是一个粉刷匠，粉刷本领强，会练炸弹！！我还会色诱，超级喜欢包二奶");
		
	console.log('默认敏感词结果：',result); //默认敏感词结果： 我是一个粉刷匠，粉刷本领强，会练***！！我还会**，超级喜欢***
	console.log('包含的敏感词列表：',noSafeWord); //['法轮', '炸弹', '轮功', '色诱', '包二奶']
	console.log('文本是否包含敏感词：',checkSafe); //true
		
	//可新增自定义敏感词列表
	checkSafeWord.addWords(['粉刷匠']);
	result = checkSafeWord.filter("我是一个粉刷匠，粉刷本领强，会练炸弹！！我还会色诱，超级喜欢包二奶");
	console.log('自定义敏感词结果：',result);//自定义敏感词结果： 我是一个***，粉刷本领强，会练***！！我还会**，超级喜欢***
		
	//可清空敏感词列表
	checkSafeWord.clearWords();
	result = checkSafeWord.filter("我是一个粉刷匠，粉刷本领强，会练炸弹！！我还会色诱，超级喜欢包二奶");
	console.log('清空敏感词结果：',result);//清空敏感词结果： 我是一个粉刷匠，粉刷本领强，会练炸弹！！我还会色诱，超级喜欢包二奶
  }
}
```

## 二、API
### 使用方法及参数

|方法|参数|说明|
|-|-|-|
|filter|String|将文本中的敏感词替换为安全字符*|
|match|String|匹配文本中的敏感词并返回结果列表|
|verify|String|校验文本是否包含敏感词|
|addWords|Array|添加自定义敏感词列表|
|clearWords|void|清空所有敏感词|
