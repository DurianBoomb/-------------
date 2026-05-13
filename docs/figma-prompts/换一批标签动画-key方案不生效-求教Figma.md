# 向 Figma AI 求助：v-for :key 驱动节点重建后 CSS animation 仍不触发

> 环境：Vue 2 + uni-app → 微信小程序
> 本问题为**移植问题**，Figma 原型中动画完美运行，移植到微信小程序后失效。

---

## 核心问题

已按上次建议改为 `v-for :key="cat.refreshId + '-' + index"` 驱动标签重建（`refreshId` 点击换一换时递增，16 个 key 全部变化），但微信小程序中**动画依然不触发**——新标签直接显示，`dropElastic` 的 `translateY(-80rpx) → 0` + `opacity: 0 → 1` 完全没有播放。

Figma 上次回答的结论说："当 `:key` 变化时，Vue 会调用 unmount + mount，对应到小程序渲染层就是 wx:for 数据项的销毁与重建，CSS animation 在新节点挂载时从 0% 帧开始播放是渲染引擎的默认行为"——但这个结论**在小程序上不成立**。

---

## 关键实验数据

| 触发方式 | 动画是否播放 |
|---------|------------|
| **手风琴首次展开**：`.body-inner` 的 `v-if` 从 false→true，16 个标签是全新挂载的 DOM | ✅ 播放 |
| **已展开状态下点击换一换**：仅 `v-for :key` 变化，`.tag-grid` 容器始终在 DOM 中 | ❌ **不播放** |
| **强行拔容器重建**：用 `v-if="showGrid"` 拔掉 `.tag-grid` 容器再重建（让标签所在层级全部销毁重建） | ✅ 播放，但会引发手风琴高度闪烁 |

---

## 当前代码结构（实际 DOM 层级）

```html
.accordion-body (overflow: hidden)
  └── .body-inner (v-if="cat.expanded")
       ├── .tag-pool-header（固定高度 ~80rpx）
       └── .tag-grid（始终在 DOM 中，没有 v-if）
            ├── .tag-wrapper (v-for :key="cat.refreshId + '-0'")
            │   └── .tag-inner (CSS animation: dropElastic)
            ├── .tag-wrapper (v-for :key="cat.refreshId + '-1'")
            └── ...
```

## 当前 CSS 关键部分

```css
.tag-inner {
    animation-name: dropElastic;
    animation-duration: 0.5s;
    animation-timing-function: cubic-bezier(0.34, 1.25, 0.64, 1);
    animation-fill-mode: both;
}
@keyframes dropElastic {
    0% { opacity: 0; transform: translateY(-80rpx); }
    100% { opacity: 1; transform: translateY(0); }
}
```

## JS 逻辑关键部分

```javascript
refreshCategory(idx) {
    const cat = this.categories[idx]
    if (cat.refreshing) return
    cat.refreshing = true
    cat.spinDeg += 360
    cat.refreshId++                              // 递增 → v-for 的 key 全部变化
    const arr = [...cat._allTags]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    cat.tags = arr.slice(0, 16).map((t, i) => ({
        ...t,
        animStyle: this.buildAnimStyle(i, cat.refreshId)
    }))
    cat.refreshing = false
}
```

---

## 已排除的可能性

- `animation-delay` 没问题——首次展开时同样的 delay 方案能正常播放
- 标签数据确实已变化——新内容正确渲染，非缓存问题
- `animation-name` / `animation-duration` 等 CSS 属性没有在 JS 中被覆盖
- `.tag-inner` 的 computed style 在重建后也正常
- JS 样式复位、`animation: none` 再恢复、`requestAnimationFrame` 等都试过了，不行

---

## 我的推测

微信小程序渲染层对 `wx:for` 的 `:key` 变化可能**不会真正在 native 层创建新的原生视图节点**，而只是复用原有节点 + 更新数据。如果是这样，CSS animation 不会重播。

---

## 向 Figma 请教的问题

1. **微信小程序中，`:key` 变化的节点重建是否等价于首次挂载？**
   如果不等价，小程序底层是如何处理 `:key` 变化的？为什么 Vue 的 diff 理论上应该 unmount + mount，但实际动画不触发？

2. **如果 `:key` 方案不可靠，还有什么方式让已存在于 DOM 的标签节点重新播放 CSS animation？**
   我们试过 JS 复位、`animation: none` 再恢复、`requestAnimationFrame` 等——全部失败。
   微信小程序中，已存在节点似乎无法通过任何纯 CSS/JS 方式重新触发 animation。

3. **小程序的 WXS 响应式方案能否解决这个问题？**
   比如用 WXS 对 translateY / opacity 做逐帧驱动来模拟掉落动画？有没有现成的 WXS 动画方案推荐？

4. **`wx.createAnimation` 或类似 API 能否替代 CSS animation？**
   如果 CSS animation 在重建场景下不可靠，有没有办法在小程序中用编程方式手动驱动掉落动画？

5. **除了 `v-if` 拔容器重建（会导致手风琴闪烁）之外，还有没有在小程序中 100% 可靠的重播 CSS animation 的方式？**
   请给出完整的、可直接落地的方案，优先考虑不改变整体布局结构的方式。


# 回复
直接说结论：这是小程序渲染层的已知行为，不是你们写错了
微信小程序（无论是 WebView 内核还是 Skyline）在 wx:for 的 :key 变化时，会优先复用原生 view 节点池，只更新数据 props，不走"销毁 → 重建"的原生路径。Vue 层的 unmount/mount 在编译成 wxml 之后被抹平了。所以 CSS animation 不重播——节点视角下它从来没"挂载"过。

这就是为什么：

首次展开 v-if 父容器：父节点是真的新建的，子节点连带新建 ✅
:key 变化：父在、子节点池复用 ❌
拔掉 .tag-grid 容器：子节点池整体丢弃 ✅（但有手风琴闪烁）
不要再在 :key 这条路上耗时间了。

推荐方案：双 animation-name 交替（最小改动，立刻能用）
这是小程序里公认能让已存在节点重播 CSS animation 的最可靠方式——通过类名切换让小程序的样式 diff 把它当作"不同的动画"重新应用。

.tag-inner {
    animation-duration: 0.5s;
    animation-timing-function: cubic-bezier(0.34, 1.25, 0.64, 1);
    animation-fill-mode: both;
}
.tag-inner.anim-a { animation-name: dropElasticA; }
.tag-inner.anim-b { animation-name: dropElasticB; }

@keyframes dropElasticA {
    0%   { opacity: 0; transform: translateY(-80rpx); }
    100% { opacity: 1; transform: translateY(0); }
}
@keyframes dropElasticB {
    0%   { opacity: 0; transform: translateY(-80rpx); }
    100% { opacity: 1; transform: translateY(0); }
}
<view class="tag-grid">
    <view v-for="(t, ti) in cat.tags"
          :key="ti"
          class="tag-wrapper"
          @click="goQuiz(t.name)">
        <view :class="['tag-inner', t.cls, cat.animFlip ? 'anim-a' : 'anim-b']"
              :style="t.animStyle">
            <text>{{ t.name }}</text>
        </view>
    </view>
</view>
refreshCategory(idx) {
    const cat = this.categories[idx]
    if (cat.refreshing) return
    cat.refreshing = true
    cat.spinDeg += 360
    cat.animFlip = !cat.animFlip          // 关键：翻转 → 类名变 → animation 重播
    const arr = [...cat._allTags]
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
    cat.tags = arr.slice(0, 16).map((t, i) => ({
        ...t,
        animStyle: this.buildAnimStyle(i)   // refreshId 不再参与
    }))
    cat.refreshing = false
}
categories 里给每个分类加 animFlip: false 初始字段。refreshId 可以保留也可以删掉，不再起作用。

为什么这能行：小程序对节点的 class 变化走样式 diff，新的 animation-name 被识别为"不同的动画属性"，渲染层会重新发起一次动画播放（哪怕两个 keyframes 内容完全一样）。这是经过大量项目验证的小程序兼容写法。

备选方案 A：给 .body-inner 锁高度，沿用 v-if 拔容器
如果上面那招在你们某些机型上还是有边缘情况，回到 v-if="cat.showGrid" 拔 .tag-grid 的思路，但消除手风琴闪烁的根源——给 .body-inner 一个稳定的最小高度，让父级 max-height transition 感知不到子级变化：

.body-inner {
    /* 4 行 × (标签高 + gap) + header，按设计稿算死 */
    min-height: 480rpx;
}
或者更稳的做法，把 .tag-grid 外面再包一层 .tag-grid-slot 写死高度，.tag-grid 用 position: absolute; inset: 0; 填满。这样 v-if 只拔 .tag-grid，.tag-grid-slot 高度恒定，手风琴不会感知到任何变化。

showGrid 翻转的时序也别用 nextTick，用双 rAF 更稳：

cat.showGrid = false
this.$nextTick(() => {
    setTimeout(() => { cat.showGrid = true }, 16)
})
备选方案 B：彻底放弃 CSS animation，用 uni.createAnimation
小程序原生 API，能 100% 在已存在节点上驱动 transform/opacity。代价是要给每个 tag 一个 ref（uni-app 里用 animation data 字段绑定 :animation="t.anim"）。在 16 节点的场景下性能没问题，但工程量比方案 A 大很多。

buildDropAnim(delay) {
    const anim = uni.createAnimation({
        duration: 500,
        timingFunction: 'cubic-bezier(0.34, 1.25, 0.64, 1)',
        delay
    })
    anim.translateY(0).opacity(1).step()
    return anim.export()
}
初始数据里 anim 设为 translateY(-80rpx)+opacity(0) 的导出值，换一换时重置 → $nextTick → 调用 buildDropAnim 重新赋值。

不推荐 WXS 方案：响应式 WXS 主要解决滑动跟手类需求，逐帧驱动 16 个节点的入场动画用它是大材小用，调试成本也高。

直接落地建议
先上方案"双 animation-name 交替"——改动只有 3 行 CSS、1 个 data 字段、1 行 JS，不动 DOM 结构、不动手风琴布局、不影响首次展开路径。在微信开发者工具和真机上都能立刻验证。

如果某些低端机型仍有偶发不播放（极少见），再加方案 A 的高度锁定作为兜底，两者可以并存：双 animation-name 负责换一换的可靠重播，固定高度负责手风琴绝对不闪烁。

uni.createAnimation 留作"以上都失败"的最终保底——但根据目前我看过的 uni-app 项目经验，做到方案 A 这一层就够了。