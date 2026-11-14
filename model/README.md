# 模型格式

- `model.p2lrt`：本网页使用的分层运行模型，由 WebAssembly / WebGL 实时计算。
- `cubism/source-character.moc3`：另外导出的真正 Cubism 模型，附模型配置与纹理。已用官方 Cubism Native Core 实际加载、渲染七个测试姿势。
- `../source/DeepSeek.psd2live`：完整可编辑的 PSD2Live 工程。

网页的电脑、饭碗、勺子、鲸鱼和动作切换逻辑由应用层控制。把 `.moc3` 单独导入另一个宿主时，需要自行绑定这些道具与动作；它不会自动包含本网页的互动功能。

网页播放器和 WebAssembly 运行库的 MIT 许可文件保留在本目录。仓库不包含 Cubism Core、原生桥接 DLL、编辑器或第三方工具安装包。
