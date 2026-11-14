# 可编辑分层工程

`DeepSeek.psd2live` 是本版完整的可编辑工程，可用 PSD2Live v3.8.0 打开。`layers/` 是生成画面的分层透明 PNG；肘部使用原画像素做圆形交叠，没有用视频补帧重画身体。

`rig-parameters.json` 列出 14 个驱动参数。头、身体、头发、尾巴、双腿、上臂和前臂分别绑定；眼睛与嘴巴独立变化。

真正的 Cubism 运行模型在 `../model/cubism/`。道具和完整互动时序由网页 `motion.js` / `pet.js` 驱动，不在 `.moc3` 内。当前工具导出的 `.cmo3` 存在编辑源重建缺失，因此本包不把它作为完整 Cubism Editor 工程提供；请使用这里的 PSD2Live 工程继续编辑。
