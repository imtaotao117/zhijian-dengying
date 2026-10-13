# 第三方软件与字体说明

本文件用于参赛材料与发布包的知识产权核对。实际提交前，团队应再次核对所使用文件的来源、版本和完整许可证文本。

## MediaPipe Tasks Vision

- 用途：浏览器端手部21关键点检测与双手跟踪。
- 项目：Google MediaPipe。
- 运行时版本线索：代码中的网络回退地址为 `@mediapipe/tasks-vision@0.10.21`；团队应以最终打包文件的真实版本为准。
- 许可证：Apache License 2.0。
- 项目地址：https://github.com/google-ai-edge/mediapipe
- 许可证地址：https://www.apache.org/licenses/LICENSE-2.0

项目中的 `assets/wasm/` 与 `assets/models/hand_landmarker.task` 属于上述第三方运行时/模型，不应被描述为团队原创或CC素材。

## 霞鹜文楷（LXGW WenKai）

- 用途：本地中文标题与正文显示。
- 许可证：SIL Open Font License 1.1。
- 项目地址：https://github.com/lxgw/LxgwWenKai
- 许可证地址：https://openfontlicense.org/

## 团队原创内容

角色轮廓、部件路径、舞台视觉、剧情编排、交互逻辑和音频合成代码是否由团队独立创作，应由项目成员以源文件、提交记录、草图和过程记录证明。本文件不替代原创性声明。

## 未使用的在线依赖

正式版已移除Google Fonts在线请求，运行时不再依赖外部字体CDN。页面中的官方资料链接仅用于内容溯源，不影响离线运行。
