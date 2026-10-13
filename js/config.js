/* 集中维护公开展示信息，避免首页、剧目目录和说明文档出现版本漂移。 */
window.ProjectConfig = Object.freeze({
  version: '2026.10.09',
  title: '指尖灯影',
  dramas: Object.freeze(['三打白骨精', '大闹天宫', '哪吒闹海']),
  modules: Object.freeze(['经典剧目', '自由操影', '皮影工坊', '关节工坊', '非遗课堂']),
  demo: Object.freeze({ enabledByDefault: true, timeScale: 0.4 }),
  licenses: Object.freeze({
    handTracking: 'MediaPipe Tasks Vision / Apache-2.0',
    font: 'LXGW WenKai / SIL Open Font License 1.1',
  }),
});
