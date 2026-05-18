/**
 * 置顶系统 · 老用户迁移脚本
 *
 * 为所有缺少 career 字段的老用户 uni-id-users 补全默认值。
 * 在 HBuilderX 的数据库控制台运行此脚本，或在云函数中部署执行。
 *
 * 使用方式：
 *   1. 打开 HBuilderX → 菜单"工具" → "uniCloud 控制台" → 选择你的阿里云空间
 *   2. 打开 JQL 查询器或数据库管理界面
 *   3. 将下方代码粘贴运行
 */

const db = uniCloud.database()

async function migrate() {
  const result = await db.collection('uni-id-users').where({
    career: { $exists: false }
  }).update({
    career: {
      exposureCount: 0,
      hasUnread: false,
      unreadCareerIds: [],
      slots: [
        { status: 'idle', surveyId: null, pinId: null, queueId: null },
        { status: 'idle', surveyId: null, pinId: null, queueId: null },
        { status: 'idle', surveyId: null, pinId: null, queueId: null }
      ]
    }
  })

  console.log('迁移完成，受影响的文档数：', result.updated)
  return result
}

// 执行
// migrate().then(res => { console.log('完成', res) }).catch(err => { console.error('失败', err) })
