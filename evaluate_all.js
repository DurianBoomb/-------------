const fs = require('fs');
const data = JSON.parse(fs.readFileSync('./docs/问卷与后端/coze输出二期/全部问卷_合并.json', 'utf8'));
const surveys = data.questionnaires;

// 将所有console.log重定向到缓冲区并写入文件
const oldLog = console.log;
const outputBuffer = [];
console.log = function(...args) {
  const line = args.join(' ');
  outputBuffer.push(line);
  oldLog.apply(console, args);
};

// ========== 评分函数 ==========

// 常见的低意外模式
const LOW_SURPRISE_PATTERNS = [
  /^你是哪种/, /^测测/, /^测试/, /^你的/, /^你属于/, /^前世/, /^下辈子/, /^拖延/, /^社恐/,
  /^讨好/, /^摆烂/, /^发疯/, /^戏精/, /^当代/, /^精神图腾/, /^小丑/, /^怨气/, /^今天吃/,
  /^恋爱/, /^暧昧/, /^相亲/, /^催婚/, /^孤寡/, /^注孤生/, /^桃花/, /^分手/, /^前任/,
  /^猫奴/, /^狗语/, /^抽卡/, /^追星/, /^吃辣/, /^奶茶/, /^火锅/, /^单身/,
  /^加班/, /^工资/, /^拖延症/, /^emo/, /^熬夜/, /^通勤/,
  /^你的情绪/, /^你的大脑/, /^你的社交/, /^你的存在感/,
  /^确诊为/, /^你是哪个/, /^从\w+看/,
];

// 实体隐喻型检测 - D维度加分
const ENTITY_PATTERNS = [
  /^确诊为/, /^你是哪种/, /^你的.*是什么/, /^前世.*外卖/, /^前世.*小吃/,
  /^用\w+方式/, /^上辈子/, /^下辈子/, /^前世是什么/, /^前世.*未了/,
  /^你的.*像什么/, /^友谊的小船/, /^你的大脑.*/, /^你的身体.*/,
  /^你的幽默感/, /^你是.*信号/, /^你是.*会议室/, /^你是.*充电宝/,
  /^用手机电量/, /^你的家庭地位/, /^确诊为/, /^办公室植物/,
  /^你的爱情像/, /^你的暗恋像/, /^用追剧/, /^用睡觉/,
  /^通过\w+反推/, /^恋爱像在/, /^你的财运/, /^你的笑声/,
  /^如果家具/, /^你的专属/, /^你的工位风/,
  /^灵气复苏/, /^跟历史人物/, /^你的QQ宠物/,
  /^投胎成/, /^下辈子当/, /^下辈子做/, /^你的手机/,
  /^工位零食/, /^你的表情包/, /^通过奶茶/,
  /^给你.*分配/, /^你的工位风/, /^用赖床/,
  /^暗恋像在/, /^给Wi-Fi分配/,
  /^你是哪个/, /^你眼中的/,
];

// 传播势能关键词 - 高分结果名特征
const HIGH_VIRAL_RESULT_KEYWORDS = [
  /冻得梆硬/, /鲭鱼/, /淀粉肠/, /西西弗斯/, /鸭子.*嘴/, /反向预言家/,
  /核弹级/, /公开处刑/, /终身烙印/, /孟婆汤/, /边界溶解体/,
  /电量欺诈师/, /影武者/, /里人格/, /抽象传染源/,
  /闭环逻辑/, /能量守恒/, /薛定谔/, /绝境觉醒/,
  /待机模式/, /永动机/, /请假理由/, /工位结界/,
  /功德刺客/, /地狱VIP/, /自我隐形/, /抱歉永动机/,
  /洗脑循环/, /牛头不对马嘴/, /语言按摩师/, /学完就忘/,
  /冷战冠军/, /核弹级/, /绝交书/, /未读消息/,
  /代餐/, /韭菜/, /锦鲤/, /欧皇/, /非酋/,
];

// 传播势能普通关键词
const MEDIUM_VIRAL_KEYWORDS = [
  /社恐/, /摸鱼/, /摆烂/, /发疯/, /内卷/, /PUA/, /EMO/,
  /MBTI/, /WiFi/, /信号/, /电量/, /充电/, /待机/, /关机/,
  /NPC/, /副本/, /技能/, /天赋/, /隐藏/, /觉醒/,
  /考古/, /化石/, /宝藏/, /黑历史/,
  /图鉴/, /鉴定/, /认证/, /段位/, /等级/, /指数/, /浓度/,
  /宇宙/, /平行/, /重生/, /转世/, /投胎/, /上辈子/,
  /暴富/, /财运/, /桃花/, /偏财/, /横财/,
  /人生/, /命运/, /命格/, /运势/,
];

// 共鸣强领域
const HIGH_RESONANCE_TOPICS = [
  /摸鱼/, /摆烂/, /拖延/, /加班/, /下班/, /工位/, /职场/, /会议/,
  /通勤/, /请假/, /KPI/, /PPT/, /同事/, /老板/, /领导/, /汇报/,
  /外卖/, /奶茶/, /火锅/, /熬夜/, /失眠/, /emo/, /焦虑/, /内耗/,
  /社恐/, /社死/, /尴尬/, /讨好/, /道歉/, /边界/,
  /恋爱/, /暗恋/, /催婚/, /分手/, /前任/, /单身/,
  /社交/, /充电/, /耗电/, /能量/, /关机/, /待机/,
  /废话/, /表情包/, /截图/, /收藏夹/, /备忘录/,
  /省钱/, /凑单/, /工资/, /月光/, /吃土/, /穷/,
  /精神状态/, /发疯/, /怨气/, /小丑/, /抽象/,
];

function scoreDimensionA(tag, dims, resultTypes) {
  // 检查是否命中低意外模式
  for (const p of LOW_SURPRISE_PATTERNS) {
    if (p.test(tag)) return 2;
  }
  
  // 超长/太泛的标题
  if (tag.length > 10 && /(什么|多少|哪|吗)/.test(tag)) return 2;
  
  // 有特殊创意的
  const HIGH_A_KEYWORDS = [/板砖/, /鲭鱼/, /过期食品/, /BUG/, /待办事项/, /阅读理解/, /APP/,
    /NPC/, /平行世界/, /版本/, /搜索引擎/, /弹幕/, /工期/, /路由器/, /CPU/, /GPU/,
    /WiFi/, /信号/, /带宽/, /协议/, /数据包/, /压缩包/, /垃圾处理器/, /存储设备/,
    /浏览器/, /后台程序/, /存档/, /补丁/, /系统更新/, /版本号/,
    /功德/, /阳寿/, /灵石/, /灵根/, /灵气/, /渡劫/, /飞升/,
    /濒危动物/, /保护色/, /伪装/, /拟态/,
    /小丑竟是我/, /怨气/, /发疯指数/, /抽象大师/, /精神图腾/,
  ];
  
  for (const k of HIGH_A_KEYWORDS) {
    if (k.test(tag)) return 4;
  }
  
  // 对"领带薪拉屎冠军"这种颠覆性组合
  const VERY_HIGH = [/拉屎/, /板砖/, /鲭鱼/, /冻得/];
  for (const k of VERY_HIGH) {
    if (k.test(tag)) return 4;
  }
  
  return 3;
}

function scoreDimensionB(tag, title, resultTypes) {
  // 检查结果名是否有梗
  let hasGoodPuns = false;
  let punCount = 0;
  for (const r of resultTypes) {
    if (r.name.length > 3 && /[的之与和]/.test(r.name)) punCount++;
    if (r.name.includes('大师') || r.name.includes('家') || r.name.includes('者') || r.name.includes('型')) punCount++;
    if (r.name.length > 5 && /[（(]/.test(r.name)) punCount++;
  }
  
  // 标题本身是否有梗
  const CLEVER_TITLES = [/坑位/, /信息密度/, /物理防身/, /历史地位/, /可歌可泣/, /还剩多少/,
    /体检报告/, /装的吗/, /准不准/, /多高/, /多深/, /几级/, /几层/, /几格/, /多低/,
    /白上了/, /白打工/, /又给老板/, /下地狱/,
  ];
  
  for (const k of CLEVER_TITLES) {
    if (k.test(title)) { hasGoodPuns = true; break; }
  }
  
  if (punCount >= 4 && hasGoodPuns) return 4;
  if (punCount >= 3) return 3;
  if (punCount >= 2) return 3;
  return 2;
}

function scoreDimensionC(tag, title, dims, resultTypes) {
  // 共鸣强领域直接高分
  for (const p of HIGH_RESONANCE_TOPICS) {
    if (p.test(tag)) return 4;
  }
  
  // 检查维度是否戳痛点
  const PAIN_DIMS = [/内耗/, /焦虑/, /负债/, /破产/, /失败/, /拖延/, /回避/, /逃避/, /补偿/,
    /敏感/, /脆弱/, /孤独/, /emo/, /怨/, /恨/, /气/, /怒/, /崩溃/, /尴尬/, /社死/,
    /内卷/, /妥协/, /牺牲/, /隐形/, /透明/, /消失/, /失踪/,
    /边界/, /底线/, /心软/, /拒绝/, /讨好/, /自责/, /复盘/,
  ];
  let painCount = 0;
  for (const d of dims) {
    for (const p of PAIN_DIMS) {
      if (p.test(d)) { painCount++; break; }
    }
  }
  
  if (painCount >= 2) return 4;
  if (painCount >= 1) return 3;
  if (resultTypes && resultTypes.length <= 3) return 2;
  return 3;
}

function scoreDimensionD(tag, dims, resultTypes) {
  // 维度数量
  const dimCount = dims.length;
  if (dimCount >= 6) {
    // 检查维度是否构成逻辑链
    const hasCoherence = dims.some(d => 
      /度$|率$|性$|力$|值$|指数|能力|模式|倾向|程度|等级|速度/.test(d)
    );
    return hasCoherence ? 4 : 3;
  } else if (dimCount === 5) {
    const hasCoherence = dims.some(d => 
      /度$|率$|性$|力$|值$|指数|能力|模式/.test(d)
    );
    return hasCoherence ? 4 : 3;
  } else if (dimCount <= 3) {
    return 2;
  }
  return 3;
}

function scoreDimensionE(tag, resultTypes) {
  // 检查结果名的高传播关键词
  let highCount = 0;
  for (const r of resultTypes) {
    for (const k of HIGH_VIRAL_RESULT_KEYWORDS) {
      if (k.test(r.name)) { highCount++; break; }
    }
  }
  
  let medCount = 0;
  for (const r of resultTypes) {
    for (const k of MEDIUM_VIRAL_KEYWORDS) {
      if (k.test(r.name)) { medCount++; break; }
    }
  }
  
  // 部分超强传播力的结果名
  if (highCount >= 2) return 5;
  if (highCount >= 1) return 4;
  if (medCount >= 3) return 4;
  if (medCount >= 1) return 3;
  
  // 检查是否有独特有趣的结果名
  const uniqueNames = resultTypes.filter(r => r.name.length > 4);
  if (uniqueNames.length >= 4) return 3;
  return 2;
}

function isEntityMetaphor(tag) {
  for (const p of ENTITY_PATTERNS) {
    if (typeof p === 'function' ? p(tag) : p.test(tag)) return true;
  }
  return false;
}

// ========== 执行评分 ==========

const results = surveys.map((s, idx) => {
  const tag = s.tag;
  const title = s.title;
  const dims = s.dims || [];
  const resultTypes = s.resultTypes || [];
  
  let A = scoreDimensionA(tag, dims, resultTypes);
  let B = scoreDimensionB(tag, title, resultTypes);
  let C = scoreDimensionC(tag, title, dims, resultTypes);
  let D = scoreDimensionD(tag, dims, resultTypes);
  let E = scoreDimensionE(tag, resultTypes);
  
  // 实体隐喻型 D 维度加分
  if (isEntityMetaphor(tag) && D >= 3) {
    D = Math.min(5, D + 0.5);
  }
  
  const total = A + B + C + D + E;
  const scores = [A, B, C, D, E];
  
  // 排序确定档位（先存起来后续二次定档）
  return {
    idx: idx + 1,
    tag,
    title,
    dimCount: dims.length,
    A, B, C, D, E,
    total,
    scores,
    beScore: B + E  // tiebreaker
  };
});

// 按总分排序确定档位
const sorted = [...results].sort((a, b) => b.total - a.total || b.beScore - a.beScore);
const totalSurveys = sorted.length;
const legendCount = Math.max(1, Math.round(totalSurveys * 0.1));
const rareCount = Math.max(1, Math.round(totalSurveys * 0.2));

sorted.forEach((r, i) => {
  if (i < legendCount) {
    r.tier = 'Legendary';
  } else if (i < legendCount + rareCount) {
    r.tier = 'Rare';
  } else {
    r.tier = 'Common';
  }
});

// 按原序输出
results.sort((a, b) => a.idx - b.idx);

// === 输出统计 ===
const legendItems = results.filter(r => r.tier === 'Legendary');
const rareItems = results.filter(r => r.tier === 'Rare');
const commonItems = results.filter(r => r.tier === 'Common');

console.log(`\n======= 标签创意评价总报告 =======`);
console.log(`总共评价: ${totalSurveys} 份`);
console.log(`Legendary: ${legendItems.length} 份 (${(legendItems.length/totalSurveys*100).toFixed(1)}%)`);
console.log(`Rare: ${rareItems.length} 份 (${(rareItems.length/totalSurveys*100).toFixed(1)}%)`);
console.log(`Common: ${commonItems.length} 份 (${(commonItems.length/totalSurveys*100).toFixed(1)}%)`);
console.log(`中位总分: ${sorted[Math.floor(totalSurveys/2)].total}`);
console.log(`平均总分: ${(results.reduce((s,r)=>s+r.total,0)/totalSurveys).toFixed(1)}`);

console.log(`\n\n======= Legendary 传说级标签 (${legendItems.length}) =======`);
legendItems.sort((a,b) => b.total - a.total || b.beScore - a.beScore);
legendItems.forEach((r, i) => {
  console.log(`${i+1}. [${r.total}] ${r.tag} (A${r.A}B${r.B}C${r.C}D${r.D}E${r.E})`);
});

console.log(`\n======= Rare 稀有级标签 (${rareItems.length}) =======`);
rareItems.sort((a,b) => b.total - a.total || b.beScore - a.beScore);
rareItems.forEach((r, i) => {
  console.log(`${i+1}. [${r.total}] ${r.tag} (A${r.A}B${r.B}C${r.C}D${r.D}E${r.E})`);
});

console.log(`\n======= Common 普通级标签 (前30) =======`);
const commonSorted = [...commonItems].sort((a,b) => b.total - a.total || b.beScore - a.beScore);
commonSorted.slice(0, 30).forEach((r, i) => {
  console.log(`${i+1}. [${r.total}] ${r.tag} (A${r.A}B${r.B}C${r.C}D${r.D}E${r.E})`);
});

// === 输出完整CSV ===
console.log(`\n\n======= 完整评价表 (CSV格式) =======`);
console.log('序号,标签名,总分,A意外指数,B解码愉悦度,C共鸣锐度,D延展自洽性,E传播势能,定档,B+E(同分决胜)');
results.forEach(r => {
  console.log(`${r.idx},${r.tag},${r.total},${r.A},${r.B},${r.C},${r.D},${r.E},${r.tier},${r.beScore}`);
});

// === 输出统计分布 ===
console.log('\n\n======= 分数分布 =======');
const dist = {};
results.forEach(r => {
  dist[r.total] = (dist[r.total] || 0) + 1;
});
for (let i = 25; i >= 5; i--) {
  if (dist[i]) {
    const bar = '█'.repeat(Math.min(dist[i], 30));
    console.log(`${String(i).padStart(2)}分: ${bar} ${dist[i]}`);
  }
}

// === 实体型 vs 非实体型统计 ===
const entityCount = results.filter(r => isEntityMetaphor(r.tag)).length;
console.log(`\n实体隐喻型标签: ${entityCount} 份`);
console.log(`非实体型标签: ${totalSurveys - entityCount} 份`);

// 写入文件
fs.writeFileSync('./evaluation_full_output.txt', outputBuffer.join('\n'), 'utf8');
console.log('\n完整输出已保存到 evaluation_full_output.txt');
