# AI Work Pet · AI 桌宠

DeepSeek 大肥鱼的分层互动桌宠，后续可以加入其他 AI 角色。

[打开互动网页](https://ai-comic-hhxk233.pages.dev/pet/) · [完整工程下载](https://ai-comic-hhxk233.pages.dev/pet/downloads/deepseek-live2d-source.zip) · [2 分 20 秒展示](https://ai-comic-hhxk233.pages.dev/pet/media/showcase.mp4)

![本版造型](previews/rig-preview.jpg)

## 本版重制

v04 参考原设定重做了短身体、大头、小拳头和柔和的蓝色长发。用户已确认这版美术方向。每个显示帧实时计算同一套分层模型的姿势，无神经补帧。

包含呼吸眨眼、小步走动、挥手、思考、跳跃、伸懒腰、撒娇、抱小鲸鱼、搬出电脑并围绕铰链开盖打字，以及端碗舀白米饭送入口中。饭碗、勺子和握持手使用明确接触锚点，抬手时手腕独立控制。中途换动作会先收好道具。

打开后自动闲逛和随机互动。点击回应、拖动换位置、右键或手机长按指定动作；可暂停、调整大小。漫画网站也有同一只悬浮角色。

展示视频是实际网页模型运行时按 1/60 秒采集的 1280×720、60fps、140 秒渲染视频。浏览器实时帧率取决于设备与浏览器。视频没有 AI 补帧，不是桌面屏幕录制。

## 本地运行

在仓库目录运行 `python -m http.server 8000`，然后打开 `http://localhost:8000/`。通过 HTTP 加载 WebAssembly 与模型，无需安装前端依赖。

| 文件 | 用途 |
| --- | --- |
| `pet.js`、`motion.js`、`props.js` | 互动、连续动作与道具锚点 |
| `widget.js` | 嵌入现有网页的悬浮角色 |
| `model/model.p2lrt` | 本网页实际加载的模型 |
| `model/cubism/` | MOC3、CMO3、配置和纹理 |
| `source/DeepSeek.psd2live` | 完整可编辑绑定工程 |
| `source/layers/`、`rig/parts/` | 分层原画与道具 |
| `downloads/deepseek-live2d-source.zip` | 工程、模型、原画与可运行网页 |
| `media/showcase.mp4` | 本版展示视频 |

MOC3 已在官方 Cubism Native Core 实际加载并渲染测试；CMO3 未在 Cubism Editor 中人工验收。完整编辑源采用 PSD2Live 格式。其他宿主需要自行接入网页层的道具与动作。这是可运行的网页桌宠工程，目前没有独立 Windows 桌宠安装程序。

## 旧版兼容与许可

`assets/spritesheet.png`、`pet.json` 和 `preview.html` 保留旧版 ChatGPT Pets 图集兼容；它们不代表 v04 网页效果。原生 Pets 的图集宿主不能直接运行本网页模型。

角色为 AI 参考用户提供的设定生成的非官方同人创作，与 DeepSeek 官方没有隶属关系。原始私人参考图、工作区资料、工具安装包与账号信息未公开。第三方播放器与运行库保留 MIT 许可，美术作品暂未另行指定使用许可证。

文件校验值见 `SHA256SUMS.txt`。
