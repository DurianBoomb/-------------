/**
 * 问卷工具函数模块
 * 提供分值归一化、最近邻匹配、覆盖检测三项核心功能
 * 
 * 数据模型说明（新）：
 *   Option.scores = [{ dIndex, value }]   — 选项可关联多个维度
 *   Question 无 dimensionIndex             — 题目不绑定维度
 *   ResultType.prototypes = [number]       — 各维度的原型值 (0-100)
 * 
 * 如需切回旧算法（范围匹配），参考 common/survey-algorithm.md
 */

/**
 * 计算各维度的归一化百分制得分（新：选项级多维分值）
 * @param {Array} questions - 题目数组，每项含 title、options（[{ text, scores: [{ dIndex, value }] }]）
 * @param {Array} dimensions - 维度数组
 * @param {Object} rawScores - 各维度原始得分 { dIndex: number }
 * @returns {Object} 各维度百分制得分 { dIndex: number }
 */
export function normalizeDimensionScores(questions, dimensions, rawScores) {
  const normalized = {}

  dimensions.forEach((_, dIndex) => {
    const raw = rawScores[dIndex] || 0

    // 计算该维度所有题目的最大可能分和最小可能分
    let maxPossible = 0
    let minPossible = 0
    let hasValidOption = false

    for (const q of questions) {
      const opts = q.options || []
      let qMax = 0
      let qMin = 0
      let hasDimOption = false

      for (const opt of opts) {
        const match = (opt.scores || []).find(s => s.dIndex === dIndex)
        if (match) {
          hasDimOption = true
          const val = Number(match.value) || 0
          if (val > qMax) qMax = val
          if (val < qMin) qMin = val
        }
      }

      if (hasDimOption) {
        hasValidOption = true
        maxPossible += qMax
        minPossible += qMin
      }
    }

    if (!hasValidOption) {
      normalized[dIndex] = 0
      return
    }

    const range = maxPossible - minPossible
    normalized[dIndex] = range > 0
      ? Math.round(((raw - minPossible) / range) * 100)
      : 50 // 无范围变化时取中值
  })

  return normalized
}

/**
 * 最近邻匹配：计算用户得分向量与每个结果类型原型向量的欧几里得距离
 * @param {Object} normalizedScores - 归一化得分 { dIndex: number }
 * @param {Array} resultTypes - 结果类型数组 [{ name, desc, prototypes: [number] }]
 * @param {Array} dimensions - 维度数组
 * @returns {Object|null} { type, distance, confidence } 或 null（无结果类型时）
 */
export function nearestNeighborMatch(normalizedScores, resultTypes, dimensions) {
  if (!resultTypes || resultTypes.length === 0) return null
  if (!dimensions || dimensions.length === 0) {
    return { type: resultTypes[0], distance: 0, confidence: 1 }
  }

  let bestType = resultTypes[0]
  let bestDistance = Infinity
  let bestConfidence = 0

  const maxPossibleDistance = 100 * Math.sqrt(dimensions.length)

  for (const type of resultTypes) {
    if (!type.prototypes || type.prototypes.length < dimensions.length) continue

    let sumSquared = 0
    for (let d = 0; d < dimensions.length; d++) {
      const userScore = normalizedScores[d] || 0
      const protoScore = Number(type.prototypes[d]) || 0
      const diff = userScore - protoScore
      sumSquared += diff * diff
    }

    const distance = Math.sqrt(sumSquared)
    const confidence = maxPossibleDistance > 0
      ? Math.max(0, Math.round((1 - distance / maxPossibleDistance) * 100)) / 100
      : 0

    if (distance < bestDistance) {
      bestDistance = distance
      bestType = type
      bestConfidence = confidence
    }
  }

  return {
    type: bestType,
    distance: Math.round(bestDistance * 100) / 100,
    confidence: bestConfidence
  }
}


