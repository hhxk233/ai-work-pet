# AI Work Pet · AI 桌宠

DeepSeek 大肥鱼的分层互动桌宠。后续可以继续加入其他 AI 角色。

[打开互动网页](https://ai-comic-hhxk233.pages.dev/pet/) · [完整分层工程下载](https://ai-comic-hhxk233.pages.dev/pet/downloads/deepseek-live2d-source.zip) · [2 分 20 秒展示视频](https://ai-comic-hhxk233.pages.dev/pet/media/showcase.mp4)

![分层模型预览](previews/rig-preview.jpg)

## 这一版做了什么

v03 使用同一套分层脸、身体、四肢和道具实时驱动，替换了旧版神经补帧动画。包含呼吸眨眼、平滑起步与收步、挥手、思考、跳跃、伸懒腰、电脑开合与打字、端碗吃白米饭、抱小鲸鱼和委屈互动。吃饭时勺子会在嘴边变空，再回碗里舀饭。

打开网页后会自行走动，过一会儿随机做动作。点击回应，拖动换位置，右键或手机长按选择动作。漫画网站首页也有同一只悬浮桌宠，可以收起并记住状态。

浏览器每个显示帧都会计算姿势；实际帧率取决于设备和浏览器。展示视频是从真实网页模型运行时按 1/60 秒逐帧采集的 1280×720、60fps、140 秒视频，没有 AI 补帧，也不是桌面屏幕录制。

## 本地运行

下载仓库，在仓库目录运行 `python -m http.server 8000`，再打开 `http://localhost:8000/`。网页需要通过 HTTP 加载模型和 WebAssembly，不能直接双击 HTML。无需安装前端依赖。

## 文件

| 文件 | 用途 |
| --- | --- |
| `index.html`、`pet.js`、`motion.js`、`pet.css` | 网页互动和连续动作控制 |
| `widget.js` | 在其他网页嵌入悬浮桌宠 |
| `model/model.p2lrt` | 网页分层模型 |
| `model/cubism/` | 真正的 `.moc3`、模型配置和纹理 |
| `source/DeepSeek.psd2live` | 完整可编辑的分层绑定工程 |
| `source/layers/`、`rig/parts/` | 分层原画及相同身份的道具 |
| `downloads/deepseek-live2d-source.zip` | 模型、工程和可运行网页代码打包 |
| `media/showcase.mp4` | 本版 2 分 20 秒展示 |

两种运行格式共用这套角色设计。网页使用 PSD2Live 的开放运行格式；另外提供的 `.moc3` 已在官方 Cubism Native Core 加载并渲染测试。完整可编辑源文件采用 PSD2Live 格式；当前 `.cmo3` 导出存在源重建缺失，因此不把它冒充完整 Cubism Editor 工程。

电脑、饭碗和勺子由网页应用层驱动。单独在其他 Live2D 宿主打开 `.moc3`，需要额外绑定道具和动作。这个仓库尚未提供独立运行的 Windows 桌宠程序。

## 旧版 Pets 图集

`assets/spritesheet.png`、`pet.json` 与 `preview.html` 保留旧版 ChatGPT Pets 快照兼容。其动作已被本版分层动画取代，不代表本版网页效果；Pets 宿主的图集播放方式也不能直接运行此网页模型。

## 来源与许可

角色由 AI 参考用户提供的设计生成，是非官方同人创作，与 DeepSeek 官方没有隶属关系。未公开用户原始参考图、私人工作区、账号资料或临时上传地址。

第三方网页播放器与 WebAssembly 运行库遵循各自 MIT 许可，原始许可保留在 `model/`。未打包第三方编辑器、Cubism Core 或原生桥接程序。美术作品暂未另行指定使用许可证。

文件校验值见 `SHA256SUMS.txt`。
