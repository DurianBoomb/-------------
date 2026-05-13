const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./docs/问卷与后端/coze输出二期/全部问卷_合并.json', 'utf8'));

const surveys = data.questionnaires;

// 输出结构化概要: tag | title | dims数量 | dims列表 | resultTypes列表
surveys.forEach((s, i) => {
  const dimsList = s.dims.join(' | ');
  const resultNames = s.resultTypes.map(r => r.name).join(' | ');
  console.log(`${i+1}\t${s.tag}\t${s.title}\t${s.dims.length}\t${dimsList}\t${resultNames}`);
});
