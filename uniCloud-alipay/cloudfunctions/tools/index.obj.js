const db = uniCloud.database()
const toolsCol = db.collection('tools')
const surveysCol = db.collection('surveys')
const surveyAnswersCol = db.collection('survey-answers')

/**
 * 归一化各维度原始得分到百分制（0-100）
 * @param {Array} questions - 题目数组，每项含 dimensionIndex、options（{score}）
 * @param {Array} dimensions - 维度数组
 * @param {Object} rawScores - 各维度原始得分 { dIndex: number }
 * @returns {Object} 各维度百分制得分 { dIndex: number }
 */
function normalizeDimensionScores(questions, dimensions, rawScores) {
  const normalized = {}
  dimensions.forEach((_, dIndex) => {
    const dimQuestions = questions.filter(q => q.dimensionIndex === dIndex)
    if (dimQuestions.length === 0) {
      normalized[dIndex] = 0
      return
    }
    const maxScore = dimQuestions.reduce((sum, q) => {
      const opts = q.options || []
      const highest = opts.length > 0 ? Math.max(...opts.map(o => Number(o.score) || 0)) : 0
      return sum + highest
    }, 0)
    const minScore = dimQuestions.reduce((sum, q) => {
      const opts = q.options || []
      const lowest = opts.length > 0 ? Math.min(...opts.map(o => Number(o.score) || 0)) : 0
      return sum + lowest
    }, 0)
    const raw = rawScores[dIndex] || 0
    const range = maxScore - minScore
    normalized[dIndex] = range > 0 ? Math.round(((raw - minScore) / range) * 100) : 0
  })
  return normalized
}

module.exports = {
	_before() {
		this.timestamp = Date.now()
		// 云对象中无法直接获取 authInfo，改由客户端传入 uid
	},

	// ==================== 问卷相关方法 ====================
	
	/**
	 * 保存问卷（创建或更新）
	 * @param {Object} data - 问卷数据
	 * @param {string} [data._id] - 问卷ID（更新时提供）
	 * @param {string} data.title - 问卷标题
	 * @param {string} [data.desc] - 问卷描述
	 * @param {string} [data.coverUrl] - 封面图URL
	 * @param {number} [data.status] - 状态：0 草稿 1 已发布 2 已下架
	 * @param {Array} data.dimensions - 维度数组
	 * @param {Array} data.resultTypes - 结果类型数组
	 * @param {Array} data.questions - 题目数组
	 * @returns {Object} 包含 errCode 和 data 的对象
	 */
	async saveSurvey(data) {
		// 检查登录状态（uid 由客户端传入）
		const uid = data._clientUid
		if (!uid) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}

		// 防御：确保 data 为对象
		if (!data || typeof data !== 'object') {
			return { errCode: 'PARAM_ERROR', errMsg: '参数格式错误' }
		}

		// 数据校验
		if (!data.title || typeof data.title !== 'string' || data.title.trim() === '') {
			return { errCode: 'PARAM_ERROR', errMsg: '问卷标题不能为空' }
		}

		if (!data.dimensions || !Array.isArray(data.dimensions) || data.dimensions.length === 0) {
			return { errCode: 'PARAM_ERROR', errMsg: '至少需要一个维度' }
		}

		if (!data.resultTypes || !Array.isArray(data.resultTypes) || data.resultTypes.length === 0) {
			return { errCode: 'PARAM_ERROR', errMsg: '至少需要一个结果类型' }
		}

		if (!data.questions || !Array.isArray(data.questions) || data.questions.length === 0) {
			return { errCode: 'PARAM_ERROR', errMsg: '至少需要一个题目' }
		}

		// 构建问卷数据，剔除 undefined 字段防止 JQL 报错
		const surveyData = {
			title: data.title.trim(),
			desc: (data.desc || '').trim(),
			coverUrl: data.coverUrl || '',
			status: data.status !== undefined ? data.status : 0,
			dimensions: data.dimensions,
			resultTypes: data.resultTypes,
			questions: data.questions,
			forkedFrom: data.forkedFrom || '',
			updatedAt: this.timestamp
		}
		Object.keys(surveyData).forEach(key => {
			if (surveyData[key] === undefined) delete surveyData[key]
		})

		try {
			// 更新问卷
			if (data._id && typeof data._id === 'string') {
				// 检查权限：只有创建者可以更新
				const surveyRes = await surveysCol.doc(data._id).get()
				if (!surveyRes.data || surveyRes.data.length === 0) {
					return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
				}
				if (surveyRes.data[0].creatorId !== uid) {
					return { errCode: 'NO_PERMISSION', errMsg: '无权限修改此问卷' }
				}

				// 更新问卷
				surveyData.stats = {
					questionCount: surveyData.questions ? surveyData.questions.length : 0
				}
				await surveysCol.doc(data._id).update(surveyData)
				return { errCode: 0, errMsg: '保存成功', data: { id: data._id } }
			}
			// 创建问卷
			else {
				surveyData.creatorId = uid
				surveyData.createdAt = this.timestamp
				surveyData.stats = {
					submissionCount: 0,
					avgDuration: 0,
					questionCount: data.questions.length
				}

				const res = await surveysCol.add(surveyData)
				return { errCode: 0, errMsg: '创建成功', data: { id: res.id } }
			}
		} catch (e) {
			console.error('保存问卷失败', e)
			const errMsg = e && typeof e === 'object' && e.message ? e.message : String(e)
			return { errCode: 'SAVE_FAILED', errMsg: '保存失败：' + errMsg }
		}
	},

	/**
	 * 获取问卷列表
	 * @param {Object} params - 查询参数
	 * @param {string} [params.creatorId] - 创建者ID（不提供则查询当前用户）
	 * @param {number} [params.status] - 状态筛选
	 * @param {number} [params.page=1] - 页码
	 * @param {number} [params.pageSize=20] - 每页数量
	 * @returns {Object} 包含 errCode 和 data 的对象
	 */
	async getSurveyList(params = {}) {
		// 检查登录状态（uid 由客户端传入）
		const uid = params._clientUid
		if (!uid) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}

		const creatorId = params.creatorId || uid
		const status = params.status
		const page = params.page || 1
		const pageSize = params.pageSize || 20
		const skip = (page - 1) * pageSize

		// 构建查询条件
		const where = { creatorId }
		if (status !== undefined) where.status = status

		try {
			const [countRes, listRes] = await Promise.all([
				surveysCol.where(where).count(),
				surveysCol.where(where)
					.field({ _id: true, title: true, desc: true, status: true, createdAt: true, updatedAt: true, stats: true })
					.orderBy('updatedAt desc')
					.orderBy('createdAt desc')
					.skip(skip)
					.limit(pageSize)
					.get()
			])

			return {
				errCode: 0,
				data: {
					list: listRes.data,
					total: countRes.total,
					page,
					pageSize,
					totalPage: Math.ceil(countRes.total / pageSize)
				}
			}
		} catch (e) {
			console.error('获取问卷列表失败', e)
			return { errCode: 'QUERY_FAILED', errMsg: '获取问卷列表失败：' + e.message }
		}
	},

	/**
	 * 获取问卷详情
	 * @param {Object} params - 参数
	 * @param {string} params.id - 问卷ID
	 * @returns {Object} 包含 errCode 和 data 的对象
	 */
	async getSurveyDetail(params) {
		if (!params || !params.id) {
			return { errCode: 'PARAM_ERROR', errMsg: '问卷ID不能为空' }
		}

		try {
			const res = await surveysCol.doc(params.id).get()
			if (!res.data || res.data.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
			}

			return { errCode: 0, data: res.data[0] }
		} catch (e) {
			console.error('获取问卷详情失败', e)
			return { errCode: 'QUERY_FAILED', errMsg: '获取问卷详情失败：' + e.message }
		}
	},

	/**
	 * 删除问卷
	 * @param {Object} params - 参数
	 * @param {string} params.id - 问卷ID
	 * @returns {Object} 包含 errCode 和 errMsg 的对象
	 */
	async deleteSurvey(params) {
		// 检查登录状态（uid 由客户端传入）
		const uid = params._clientUid
		if (!uid) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}

		if (!params || !params.id) {
			return { errCode: 'PARAM_ERROR', errMsg: '问卷ID不能为空' }
		}

		try {
			// 检查权限：只有创建者可以删除
			const surveyRes = await surveysCol.doc(params.id).get()
			if (!surveyRes.data || surveyRes.data.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
			}
			if (surveyRes.data[0].creatorId !== uid) {
				return { errCode: 'NO_PERMISSION', errMsg: '无权限删除此问卷' }
			}

			// 删除问卷
			await surveysCol.doc(params.id).remove()
			return { errCode: 0, errMsg: '删除成功' }
		} catch (e) {
			console.error('删除问卷失败', e)
			return { errCode: 'DELETE_FAILED', errMsg: '删除失败：' + e.message }
		}
	},

	/**
	 * 更新问卷状态
	 * @param {Object} params - 参数
	 * @param {string} params.id - 问卷ID
	 * @param {number} params.status - 状态：0 草稿 1 已发布 2 已下架
	 * @returns {Object} 包含 errCode 和 errMsg 的对象
	 */
	async updateSurveyStatus(params) {
		// 检查登录状态（uid 由客户端传入）
		const uid = params._clientUid
		if (!uid) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}

		if (!params || !params.id) {
			return { errCode: 'PARAM_ERROR', errMsg: '问卷ID不能为空' }
		}
		if (params.status === undefined) {
			return { errCode: 'PARAM_ERROR', errMsg: '状态不能为空' }
		}

		try {
			// 检查权限：只有创建者可以更新
			const surveyRes = await surveysCol.doc(params.id).get()
			if (!surveyRes.data || surveyRes.data.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
			}
			if (surveyRes.data[0].creatorId !== uid) {
				return { errCode: 'NO_PERMISSION', errMsg: '无权限修改此问卷' }
			}

			// 更新状态
			await surveysCol.doc(params.id).update({
				status: params.status,
				updatedAt: this.timestamp
			})
			return { errCode: 0, errMsg: '状态更新成功' }
		} catch (e) {
			console.error('更新问卷状态失败', e)
			return { errCode: 'UPDATE_FAILED', errMsg: '状态更新失败：' + e.message }
		}
	},

	async getList({ category, keyword, page = 1, pageSize = 20 } = {}) {
		const where = { status: 1 }
		if (category) where.category = category
		if (keyword) where.name = new RegExp(keyword, 'i')
		const skip = (page - 1) * pageSize
		const [countRes, listRes] = await Promise.all([
			toolsCol.where(where).count(),
			toolsCol.where(where)
				.field({ _id: true, toolId: true, name: true, icon: true, description: true, category: true, pagePath: true, status: true, sort: true, needLogin: true })
				.orderBy('sort asc', 'create_date desc')
				.skip(skip)
				.limit(pageSize)
				.get()
		])
		return {
			errCode: 0,
			data: {
				list: listRes.data,
				total: countRes.total,
				page,
				pageSize,
				totalPage: Math.ceil(countRes.total / pageSize)
			}
		}
	},

	async addTool(data) {
		const userInfo = uniCloud.getCurrentUserInfo()
		if (!userInfo || !userInfo.tokenExpired || userInfo.tokenExpired < this.timestamp) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}
		const toolData = {
			toolId: data.toolId,
			name: data.name,
			icon: data.icon || '',
			description: data.description || '',
			category: data.category || '',
			pagePath: data.pagePath,
			status: data.status !== undefined ? data.status : 0,
			sort: data.sort || 0,
			needLogin: data.needLogin || false,
			create_date: this.timestamp,
			update_date: this.timestamp
		}
		const res = await toolsCol.add(toolData)
		return { errCode: 0, data: { id: res.id } }
	},

	async updateTool({ id, ...data }) {
		if (!id) return { errCode: 'PARAM_IS_NULL', errMsg: '工具ID不能为空' }
		const userInfo = uniCloud.getCurrentUserInfo()
		if (!userInfo || !userInfo.tokenExpired || userInfo.tokenExpired < this.timestamp) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}
		const updateData = { update_date: this.timestamp }
		const allowFields = ['name', 'icon', 'description', 'category', 'pagePath', 'status', 'sort', 'needLogin']
		allowFields.forEach(field => {
			if (data[field] !== undefined) updateData[field] = data[field]
		})
		await toolsCol.doc(id).update(updateData)
		return { errCode: 0, errMsg: '修改成功' }
	},

	async toggleStatus({ id, status }) {
		if (!id) return { errCode: 'PARAM_IS_NULL', errMsg: '工具ID不能为空' }
		if (status === undefined) return { errCode: 'PARAM_IS_NULL', errMsg: '状态不能为空' }
		const userInfo = uniCloud.getCurrentUserInfo()
		if (!userInfo || !userInfo.tokenExpired || userInfo.tokenExpired < this.timestamp) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}
		await toolsCol.doc(id).update({
			status: status ? 1 : 0,
			update_date: this.timestamp
		})
		return { errCode: 0, errMsg: status ? '上架成功' : '下架成功' }
	},

	/**
	 * 审核问卷内容安全（使用 uni-sec-check 插件）
	 * @param {Object} params
	 * @param {string} params.title - 问卷标题
	 * @param {string} [params.desc] - 问卷描述
	 * @param {Array} params.questions - 题目数组 [{ title, options: [{ text }] }]
	 * @param {Array} params.resultTypes - 结果类型数组 [{ name, desc }]
	 * @returns {Object} { errCode, errMsg, summary, details }
	 */
	async reviewSurvey(params) {
		try {
			const UniSecCheck = require('uni-sec-check')
			const uniSecCheck = new UniSecCheck({
				provider: 'mp-weixin',
				requestId: this.getClientInfo().requestId
			})

			// 收集所有待审核的文本项
			const items = []

			// 问卷标题
			if (params.title) {
				items.push({ type: '问卷标题', field: 'title', content: params.title })
			}
			// 问卷描述
			if (params.desc) {
				items.push({ type: '问卷描述', field: 'desc', content: params.desc })
			}
			// 题目
			if (params.questions && Array.isArray(params.questions)) {
				params.questions.forEach((q, qIdx) => {
					if (q.title) {
						items.push({ type: '题目', field: 'question_' + qIdx, content: q.title })
					}
					if (q.options && Array.isArray(q.options)) {
						q.options.forEach((opt, oIdx) => {
							if (opt.text) {
								items.push({ type: '选项', field: 'question_' + qIdx + '_option_' + oIdx, content: opt.text })
							}
						})
					}
				})
			}
			// 结果类型
			if (params.resultTypes && Array.isArray(params.resultTypes)) {
				params.resultTypes.forEach((type, tIdx) => {
					if (type.name) {
						items.push({ type: '结果类型', field: 'resultType_' + tIdx + '_name', content: type.name })
					}
					if (type.desc) {
						items.push({ type: '结果描述', field: 'resultType_' + tIdx + '_desc', content: type.desc })
					}
				})
			}

			if (items.length === 0) {
				return { errCode: 0, summary: 'pass', errMsg: '无可审核内容', details: [] }
			}

			const violations = []
			const ErrorCode = uniSecCheck.ErrorCode

			// 逐条检测
			for (const item of items) {
				try {
					const res = await uniSecCheck.textSecCheck({ content: item.content })
					if (res.errCode === ErrorCode.RISK_CONTENT) {
						violations.push({
							type: item.type,
							content: item.content.length > 30 ? item.content.substring(0, 30) + '...' : item.content,
							suggest: 'risky',
							label: '违规内容'
						})
					}
				} catch (e) {
					// 单条检测失败不影响其他项
					console.error('内容检测异常：', item.field, e.message)
				}
			}

			if (violations.length === 0) {
				return {
					errCode: 0,
					summary: 'pass',
					errMsg: '所有内容均通过安全检测',
					details: []
				}
			}

			return {
				errCode: 0,
				summary: 'risky',
				errMsg: '发现 ' + violations.length + ' 项内容存在风险',
				details: violations
			}
		} catch (e) {
			console.error('审核失败', e)
			return { errCode: -1, errMsg: '审核服务调用失败：' + (e.message || e) }
		}
	},

	/**
	 * 提交问卷答案（供分享作答模式使用）
	 * @param {Object} params
	 * @param {string} params.surveyId - 问卷ID
	 * @param {Array} params.answers - 答案数组 [{ questionIndex, optionIndex }]
	 * @param {number} [params.duration] - 作答时长（秒）
	 * @returns {Object} 包含 errCode、dimensionScores、matchedType
	 */
	async submitAnswer(params) {
		if (!params || !params.surveyId) {
			return { errCode: 'PARAM_ERROR', errMsg: '问卷ID不能为空' }
		}
		if (!params.answers || !Array.isArray(params.answers) || params.answers.length === 0) {
			return { errCode: 'PARAM_ERROR', errMsg: '答案不能为空' }
		}

		try {
			// 1. 加载问卷数据
			const surveyRes = await surveysCol.doc(params.surveyId).get()
			if (!surveyRes.data || surveyRes.data.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
			}
			const survey = surveyRes.data[0]
			const questions = survey.questions || []
			const dimensions = survey.dimensions || []
			const resultTypes = survey.resultTypes || []

			// 2. 构建答案映射 { questionIndex: optionIndex }
			const answerMap = {}
			params.answers.forEach(a => {
				if (a.questionIndex !== undefined && a.optionIndex !== undefined) {
					answerMap[a.questionIndex] = a.optionIndex
				}
			})

			// 3. 计算各维度原始得分
			const dimensionScores = {}
			dimensions.forEach((_, dIndex) => { dimensionScores[dIndex] = 0 })

			questions.forEach(q => {
				const dIndex = q.dimensionIndex
				if (dIndex === undefined || dimensionScores[dIndex] === undefined) return
				const selectedIdx = answerMap[q.index]
				if (selectedIdx !== undefined && q.options && q.options[selectedIdx]) {
					dimensionScores[dIndex] += (q.options[selectedIdx].score || 0)
				}
			})

			// 3.1 归一化为百分制得分
			const normalizedScores = normalizeDimensionScores(questions, dimensions, dimensionScores)

			// 4. 匹配结果类型（使用归一化百分制分数）
			let matchedType = null
			for (const type of resultTypes) {
				if (!type.ranges || type.ranges.length === 0) continue
				const allMatch = type.ranges.every(range => {
					const dIndex = range.dimensionIndex
					const score = normalizedScores[dIndex] || 0
					const min = Number(range.min) || 0
					const max = Number(range.max) || 0
					return score >= min && score <= max
				})
				if (allMatch) {
					matchedType = {
						name: type.name || '',
						desc: type.desc || '',
						imageUrl: type.imageUrl || '',
						typeIndex: type.index
					}
					break
				}
			}
			// 兜底：使用第一个结果类型
			if (!matchedType && resultTypes.length > 0) {
				matchedType = {
					name: resultTypes[0].name || '',
					desc: resultTypes[0].desc || '',
					imageUrl: resultTypes[0].imageUrl || '',
					typeIndex: resultTypes[0].index
				}
			}

			// 5. 获取用户IP并解析城市
			let location = ''
			try {
				const clientInfo = this.getClientInfo()
				const clientIP = clientInfo && clientInfo.clientIP ? clientInfo.clientIP : ''
				if (clientIP) {
					const ipInfo = await uniCloud.getCloudIPInfo(clientIP)
					if (ipInfo && ipInfo.data) {
						location = ipInfo.data.city || ipInfo.data.province || ''
					}
				}
			} catch (e) {
				console.error('IP定位失败', e)
			}

			// 6. 保存答题记录（带location和问卷快照）
			const userId = params._clientUid || ''
			const answersData = params.answers.map(a => ({
				questionIndex: Number(a.questionIndex),
				optionIndex: Number(a.optionIndex)
			}))

			await surveyAnswersCol.add({
				surveyId: params.surveyId,
				userId,
				answers: answersData,
				dimensionScores,
				matchedType,
				duration: params.duration || 0,
				location,
				surveySnapshot: {
					title: survey.title,
					desc: survey.desc,
					dimensions: survey.dimensions,
					resultTypes: survey.resultTypes,
					questions: survey.questions
				},
				createdAt: this.timestamp
			})

			// 7. 更新问卷统计
			const currentStats = survey.stats || {}
			const newCount = (currentStats.submissionCount || 0) + 1
			// 平均时长
			const oldAvg = currentStats.avgDuration || 0
			const oldCount = currentStats.submissionCount || 0
			const newAvg = oldCount > 0
				? Math.round((oldAvg * oldCount + (params.duration || 0)) / newCount)
				: (params.duration || 0)

			await surveysCol.doc(params.surveyId).update({
				'stats.submissionCount': newCount,
				'stats.avgDuration': newAvg,
				updatedAt: this.timestamp
			})

			return {
				errCode: 0,
				errMsg: '提交成功',
				data: {
					dimensionScores,
					matchedType
				}
			}
	} catch (e) {
		console.error('提交答案失败', e)
		return { errCode: 'SUBMIT_FAILED', errMsg: '提交失败：' + (e.message || e) }
	}
},

	/**
	 * 获取当前用户作答过的问卷列表
	 * @param {Object} params - 参数
	 * @param {number} params.page - 页码
	 * @param {number} params.pageSize - 每页条数
	 * @returns {Object} 包含 errCode 和 data 的对象
	 */
	async getMyAnsweredSurveys(params = {}) {
		const uid = params._clientUid
		if (!uid) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}

		const page = params.page || 1
		const pageSize = params.pageSize || 20
		const skip = (page - 1) * pageSize

		try {
			// 1. 查询当前用户的答题记录
			const [countRes, listRes] = await Promise.all([
				surveyAnswersCol.where({ userId: uid }).count(),
				surveyAnswersCol.where({ userId: uid })
					.field({ _id: true, surveyId: true, matchedType: true, duration: true, createdAt: true, surveySnapshot: true })
					.orderBy('createdAt desc')
					.skip(skip)
					.limit(pageSize)
					.get()
			])

			const answers = listRes.data || []

			// 2. 获取关联的问卷标题（逐个查询避免 db.command.in 兼容问题）
			const list = []
			for (const a of answers) {
				let surveyTitle = '未知问卷'
				try {
					const surveyRes = await surveysCol.doc(a.surveyId).field({ title: true }).get()
					if (surveyRes.data && surveyRes.data.length > 0) {
						surveyTitle = surveyRes.data[0].title || '未知问卷'
					}
				} catch (e) {
					console.error('查询问卷标题失败', a.surveyId, e)
				}
				list.push({
					_id: a._id,
					surveyId: a.surveyId,
					surveyTitle,
					matchedType: a.matchedType || null,
					duration: a.duration || 0,
					createdAt: a.createdAt,
					surveySnapshot: a.surveySnapshot || null
				})
			}

			return {
				errCode: 0,
				data: {
					list,
					total: countRes.total,
					page,
					pageSize,
					totalPage: Math.ceil(countRes.total / pageSize)
				}
			}
	} catch (e) {
		console.error('获取作答记录失败', e)
		return { errCode: 'QUERY_FAILED', errMsg: '获取作答记录失败：' + e.message }
	}
},

	/**
	 * 删除作答记录
	 * @param {Object} params
	 * @param {string} params.id - 答题记录ID
	 * @returns {Object} 包含 errCode 和 errMsg 的对象
	 */
	async deleteAnswer(params) {
		const uid = params._clientUid
		if (!uid) {
			return { errCode: 'TOKEN_EXPIRED', errMsg: '请先登录' }
		}
		if (!params || !params.id) {
			return { errCode: 'PARAM_ERROR', errMsg: '记录ID不能为空' }
		}

		try {
			// 校验归属
			const res = await surveyAnswersCol.doc(params.id).get()
			if (!res.data || res.data.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '记录不存在' }
			}
			if (res.data[0].userId !== uid) {
				return { errCode: 'FORBIDDEN', errMsg: '无权删除' }
			}

			await surveyAnswersCol.doc(params.id).remove()
			return { errCode: 0, errMsg: '删除成功' }
		} catch (e) {
			console.error('删除作答记录失败', e)
			return { errCode: 'DELETE_FAILED', errMsg: '删除失败：' + e.message }
		}
	},

	/**
	 * 获取问卷统计数据（作答人数、城市分布、衍生数量）
	 * @param {Object} params
	 * @param {string} params.surveyId - 问卷ID
	 * @returns {Object} { errCode, data: { submissionCount, avgDuration, cityDistribution: [{ city, count }], totalForkCount } }
	 */
	async getSurveyStats(params) {
		if (!params || !params.surveyId) {
			return { errCode: 'PARAM_ERROR', errMsg: '问卷ID不能为空' }
		}

		try {
			// 1. 获取问卷统计
			const surveyRes = await surveysCol.doc(params.surveyId).field({ stats: true, forkedFrom: true, title: true, creatorId: true }).get()
			if (!surveyRes.data || surveyRes.data.length === 0) {
				return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
			}
			const survey = surveyRes.data[0]
			const stats = survey.stats || {}
			const submissionCount = stats.submissionCount || 0
			const avgDuration = stats.avgDuration || 0

			// 2. 查询城市分布（聚合查询）
			const cityRes = await surveyAnswersCol.where({ surveyId: params.surveyId })
				.field({ location: true })
				.get()

			const cityMap = {}
			const answers = cityRes.data || []
			answers.forEach(a => {
				if (a.location) {
					cityMap[a.location] = (cityMap[a.location] || 0) + 1
				}
			})

			const cityDistribution = Object.keys(cityMap)
				.map(city => ({ city, count: cityMap[city] }))
				.sort((a, b) => b.count - a.count)

			// 3. 统计衍生问卷数量
			const forkRes = await surveysCol.where({ forkedFrom: params.surveyId }).count()
			const totalForkCount = forkRes.total || 0

			// 4. 查父问卷信息
			let parentSurvey = null
			if (survey.forkedFrom) {
				const parentRes = await surveysCol.doc(survey.forkedFrom).field({ title: true, creatorId: true }).get()
				if (parentRes.data && parentRes.data.length > 0) {
					const p = parentRes.data[0]
					parentSurvey = { surveyId: survey.forkedFrom, title: p.title, creatorId: p.creatorId }
				}
			}

			return {
				errCode: 0,
				data: {
					submissionCount,
					avgDuration,
					cityDistribution,
					totalForkCount,
					parentSurvey,
					surveyTitle: survey.title,
					creatorId: survey.creatorId
				}
			}
		} catch (e) {
			console.error('获取问卷统计失败', e)
			return { errCode: 'QUERY_FAILED', errMsg: '获取问卷统计失败：' + e.message }
		}
	},

	/**
	 * 获取问卷的Fork谱系树
	 * @param {Object} params
	 * @param {string} params.surveyId - 起始问卷ID
	 * @param {number} [params.maxDepth=50] - 最大递归深度
	 * @returns {Object} { errCode, data: { root: { surveyId, title, creatorId, answerCount, children: [...] } } }
	 */
	async getForkTree(params) {
		if (!params || !params.surveyId) {
			return { errCode: 'PARAM_ERROR', errMsg: '问卷ID不能为空' }
		}

		const maxDepth = params.maxDepth || 50

		try {
			// 递归构建节点
			async function buildNode(surveyId, depth, visited) {
				if (depth > maxDepth || visited.has(surveyId)) return null
				visited.add(surveyId)

				const res = await surveysCol.doc(surveyId).field({ title: true, creatorId: true, stats: true, forkedFrom: true }).get()
				if (!res.data || res.data.length === 0) return null

				const s = res.data[0]
				const node = {
					surveyId,
					title: s.title || '未命名问卷',
					creatorId: s.creatorId || '',
					answerCount: (s.stats && s.stats.submissionCount) || 0,
					forkedFrom: s.forkedFrom || '',
					children: []
				}

				// 查找所有直接子节点
				const childRes = await surveysCol.where({ forkedFrom: surveyId })
					.field({ _id: true })
					.get()

				const childIds = (childRes.data || []).map(c => c._id)
				for (const cid of childIds) {
					const childNode = await buildNode(cid, depth + 1, visited)
					if (childNode) node.children.push(childNode)
				}

				return node
			}

			const root = await buildNode(params.surveyId, 0, new Set())
			if (!root) {
				return { errCode: 'NOT_FOUND', errMsg: '问卷不存在' }
			}

			return { errCode: 0, data: { root } }
		} catch (e) {
			console.error('获取Fork谱系树失败', e)
			return { errCode: 'QUERY_FAILED', errMsg: '获取Fork谱系树失败：' + e.message }
		}
	}
}
