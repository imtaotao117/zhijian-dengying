/* 非遗课堂的共享内容：浏览器展示、本地搜索和服务端问答使用同一份资料。 */
const ClassroomData = {
  eras: [
    { when: '汉代 · 传统叙述', name: '萌芽 —— 灯烛幻影', keywords: '起源 皮影起源', text: '后世常以汉武帝思念李夫人的灯影传说追溯影戏源头；这一说法具有文化象征意义，但并非皮影戏成形年代的唯一学术结论。' },
    { when: '唐代 · 618—907', name: '孕育 —— 说唱与影画', text: '有研究将寺院俗讲、说唱与影画传统视为影戏发展的文化土壤。现有材料更适合说明孕育过程，不宜断言此时已形成今天所见的完整皮影戏。' },
    { when: '宋代 · 960—1279', name: '兴盛 —— 瓦舍勾栏', text: '宋代城市娱乐繁荣，文献中已出现关于影戏和影戏艺人的较明确记录，通常被视为皮影戏成熟发展的重要阶段。' },
    { when: '元明时期', name: '传播 —— 跨地域交流', text: '随着商贸、人口迁徙与中外文化交流，影戏在更广地域流传。其海外传播路径和具体年代存在多种研究观点。' },
    { when: '明代 · 1368—1644', name: '流派渐成', text: '各地影班与地方声腔结合，人物造型、雕刻工艺和表演程式逐步形成鲜明地域差异。' },
    { when: '清代 · 1636—1912', name: '鼎盛 —— 百花齐放', text: '皮影戏在宫廷与民间均有演出，不同地区形成各具唱腔、造型与操演方式的流派；欧洲也出现以“中国影灯”为名的相关表演和讨论。' },
    { when: '近现代 · 20世纪', name: '式微 —— 人亡艺绝之危', text: '战乱频仍、电影兴起，皮影演出市场萎缩。老艺人年事渐高，部分流派面临失传风险。' },
    { when: '当代 · 2006 至今', name: '新生 —— 非遗保护', text: '2006年列入首批国家级非物质文化遗产名录；2011年入选联合国教科文组织“人类非物质文化遗产代表作名录”。数字化活态传承正当其时。' },
  ],
  schools: [
    { key: 'luanzhou', name: '冀东皮影', place: '河北 · 滦州、唐山', x: 717, y: 272, text: '以“驴皮影”闻名，唱腔高亢婉转，雕刻繁丽，“一口叙说千古事，双手舞动百万兵”即源于此。' },
    { key: 'huazhou', name: '华县皮影', place: '陕西 · 华州', x: 589, y: 362, text: '陕西东路皮影代表，刀工精细、造型古朴夸张，2006年随中国皮影戏整体列入首批国家级非遗。' },
    { key: 'huanxian', name: '环县道情皮影', place: '甘肃 · 环县', x: 551, y: 325, text: '陇东道情与皮影结合的“道情皮影”，黄土高原上的悲腔高调，粗犷苍凉，堪称“东方戏剧活化石”。' },
    { key: 'tengchong', name: '腾冲皮影', place: '云南 · 腾冲', x: 416, y: 534, text: '西南边陲的刘家寨皮影，兼收中原技法与滇西风情，是云南“活态皮影”的代表。' },
    { key: 'tongbai', name: '桐柏皮影', place: '河南 · 桐柏', x: 644, y: 400, text: '中原皮影重镇，唱腔为“西路罗圈腔”，艺人身兼“签手、唱、念”数职，乡土气息浓厚。' },
    { key: 'taishan', name: '泰山皮影', place: '山东 · 泰安', x: 701, y: 332, text: '“十不闲”绝技独步天下：一人演一台戏，唱念做打、敲锣打鼓全凭一双手，非遗传承人范正安。' },
    { key: 'beijing', name: '北京皮影', place: '北京', x: 690, y: 265, text: '清代宫廷影班遗风，造型华贵、刻工细腻，曾随清宫大戏走向顶峰。' },
    { key: 'haining', name: '海宁皮影', place: '浙江 · 海宁', x: 765, y: 435, text: '江南皮影代表，唱腔为“皮影腔”，婉约柔美，水乡风情别具一格。' },
  ],
  steps: [
    { ico: '皮', name: '选皮', text: '选用适合雕刻、透光和长期保存的牛皮或驴皮，材料会影响成品的韧性与光影效果。' },
    { ico: '制', name: '制皮', text: '经刮毛、去脂、浸泡、绷晾等步骤，将原皮处理为半透明而柔韧的皮板。' },
    { ico: '稿', name: '画稿', text: '依图谱勾画人物部件，包括头茬、身段与四肢，不同地区具有不同程式和纹样。' },
    { ico: '描', name: '过稿', text: '将画稿誊描到处理好的皮面，并沿线留下便于下刀的清晰痕迹。' },
    { ico: '刻', name: '镂刻', text: '运用推、拉、转、刻等刀法镂出纹样，是形成皮影造型与透光层次的关键工序。' },
    { ico: '彩', name: '敷彩', text: '依据地域传统和人物身份进行着色，使皮影在灯下呈现鲜明、通透的色彩。' },
    { ico: '熨', name: '发汗熨平', text: '通过适当温度与压力帮助颜色稳定并使皮片平整定型。' },
    { ico: '缀', name: '缀结合成', text: '在关节处缀连部件并安装操纵杆，完成可供登台操演的影人。' },
  ],
};

ClassroomData.entries = [
  ...ClassroomData.eras.map((item, index) => ({ type: 'era', id: String(index), title: item.name, meta: item.when, text: item.text, keywords: item.keywords || '' })),
  ...ClassroomData.schools.map(item => ({ type: 'school', id: item.key, title: item.name, meta: item.place, text: item.text, keywords: '' })),
  ...ClassroomData.steps.map((item, index) => ({ type: 'step', id: String(index), title: item.name, meta: `第 ${index + 1} 道工序`, text: item.text, keywords: '制作 工艺' })),
];

ClassroomData.search = function (query, limit = 6) {
  const q = String(query || '').trim().toLowerCase().replace(/[\s？?。！，,]/g, '');
  if (!q) return [];
  const allGrams = q.length > 1 ? [...new Set(Array.from({ length: q.length - 1 }, (_, i) => q.slice(i, i + 2)))] : [q];
  const specificGrams = allGrams.filter(gram => !['皮影', '影戏', '中国', '怎么', '如何', '什么'].includes(gram));
  const grams = specificGrams.length ? specificGrams : allGrams;
  const scored = ClassroomData.entries.map(entry => {
    const title = entry.title.toLowerCase();
    const body = `${entry.meta} ${entry.text} ${entry.keywords}`.toLowerCase();
    const exact = title.includes(q) || body.includes(q);
    const score = (title.includes(q) ? 20 : 0) + (body.includes(q) ? 10 : 0) +
      grams.reduce((sum, gram) => sum + (title.includes(gram) ? 4 : body.includes(gram) ? 1 : 0), 0);
    return { ...entry, exact, score };
  }).filter(entry => entry.score > 0).sort((a, b) => b.score - a.score);
  const exactHits = scored.filter(entry => entry.exact);
  return (exactHits.length ? exactHits : scored).slice(0, limit);
};

if (typeof window !== 'undefined') window.ClassroomData = ClassroomData;
if (typeof module !== 'undefined') module.exports = ClassroomData;
