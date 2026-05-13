# Quiz-Home 页面布局问题咨询

## 当前现象
小程序中标签池（tag-grid）出现两个问题：

1. **标签贴右边**：某些行的最后一个标签紧贴右侧边缘
2. **最后一排被截断**：底部标签显示不完整

## 当前代码结构

```vue
<scroll-view class="body" scroll-y>
  <!-- 标签池 -->
  <view class="tag-grid">
    <view v-for="tag in processedTags" class="tag-wrapper">
      <view class="tag-inner">{{ tag.name }}</view>
    </view>
  </view>
</scroll-view>
```

```css
.body {
  padding: 40rpx 40rpx 0;  /* 左右 40rpx (= 20px) */
}
.tag-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 20rpx;  /* 10px */
}
.tag-inner {
  border-radius: 40rpx;
  padding: 14rpx 24rpx;  /* 固定padding，文字长度不同导致总宽度不同 */
  font-size: 28rpx;
}
```

## 问题分析

**Figma 设计特点：**
- 使用绝对定位（`left: xxxpx`, `width: xxxpx`）
- 每个标签位置固定，不会换行错乱

**我们的实现：**
- 使用 `flex-wrap: wrap` 流式布局
- 标签宽度由内容决定（padding + 文字长度）
- 在小屏幕上换行时机难以预测

## 核心问题

1. **流式布局 vs 固定布局**：Figma 是绝对定位，我们是 flex 流式，如何对齐？
2. **最后一排截断**：`scroll-view` 内的 `flex-wrap` 容器高度计算是否有坑？
3. **右边距不足**：是否与微信小程序的滚动条占位有关？

## 请 Figma 回答

1. 你的设计图中标签位置是固定的，但我的实现是流式布局。这是否意味着我应该：
   - A. 保持流式，接受换行不确定性
   - B. 改成固定布局（如每行3个，固定宽度）
   - C. 其他方案？

2. 最后一排被截断的可能原因？

3. 微信小程序 flex-wrap 布局的最佳实践是什么？
