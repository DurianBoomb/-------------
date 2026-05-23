// ========== loading 工具 ==========
// showLoading 空实现——全局关闭 loading 提示框
// 如需恢复：将 showLoading 替换为注释中的延迟方案即可

export function showLoading() {
	// 不做任何事，不显示 loading
}

export function hideLoading() {
	uni.hideLoading() // 顺手清理可能残留的原生 loading（如 uni_modules 触发的）
}
