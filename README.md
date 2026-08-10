# SONA™ 微信小程序版

将网页版（`web_app/`）移植为**微信小程序**（原生小程序，无需 npm 构建）。

## 目录结构

```
miniprogram/
├── project.config.json      # 小程序项目配置（AppID 需替换）
├── app.json                 # 全局配置（自定义导航、单页面）
├── app.js / app.wxss
├── sitemap.json
├── images/logo.png          # 首页 logo（从 web_app/logo.png 复制）
└── pages/index/
    ├── index.js             # 主逻辑：canvas 绘制 / 音频 / 触屏 / 震动 / 倾斜
    ├── index.wxml           # 页面结构（canvas + 提示 + toast）
    └── index.wxss
```

## 导入微信开发者工具

1. 打开 **微信开发者工具**（[下载](https://developers.weixin.qq.com/miniprogram/dev/devtools/download.html)）
2. 点 **导入项目** → 选择本目录 `miniprogram/`
3. **AppID**：填入你在微信公众平台注册的小程序 AppID（`project.config.json` 中已用游客占位）
   - 没有正式 AppID 也可先用「测试号」体验
4. 编译预览

## 功能

| 功能 | 实现 | 说明 |
|------|------|------|
| 🎵 音乐播放 | WebAudioContext oscillator | 实验性 API，基础库 2.19.0+；**真机测试** |
| 🌊 波形+粒子动画 | canvas 2D 点阵 | 与网页版一致 |
| 📱 倾斜控制 BPM | `wx.onDeviceMotionChange` | 真机生效（开发者工具可模拟） |
| 📳 震动跟随律动 | `wx.vibrateShort`（Light/Medium/Heavy） | 真机生效 |
| 🖱 触屏交互 | touchstart/touchend | 单击进入/播放、长按返回、双击震动开关、滑动切歌 |

## ⚠️ 注意事项

1. **音频**：`wx.createWebAudioContext()` 是实验性 API，个别机型/基础库可能不支持。若真机无声：
   - 升级基础库（编译预览时选最新版）
   - 或改用 `wx.createInnerAudioContext()` + 预生成的旋律音频文件（可脚本离线渲染，需要时告诉我）
2. **震动**：`wx.vibrateShort` 需真机，开发者工具模拟器无震动
3. **倾斜**：真机首次调用会弹授权，允许后生效；开发者工具「传感器」面板可模拟
4. **AppID**：游客模式部分能力受限，建议替换为你注册的 AppID
5. 页面为 135×240 竖屏（与 M5StickS3 同比例），canvas 内部 2× 高清渲染

## 交互

| 手势 | 效果 |
|------|------|
| 单击（首页） | 进入播放器 |
| 单击（播放器） | 播放 / 暂停 |
| 长按（播放器） | 返回首页 |
| 双击（播放器） | 震动开/关 |
| 左右滑动 | 切换曲目 |
| 前倾/后仰手机 | 加速 / 减速（BPM） |

## 分享与运营（个人主体）

**分享能力（已内置）**
- 右上角 `···` → 转发，分享卡片标题会自动根据当前页面变化（首页/播放页）
- 分享路径 `/pages/index/index`，图片用 logo

**获取小程序码**
- 在**微信公众平台后台** → 工具 → 生成小程序码（个人主体可直接下载），用于线下贴纸/海报/朋友圈

**个人主体运营策略（不能做站内社区）**
```
小程序 = 创作/体验入口  →  用户一键分享到微信群/朋友圈  →  微信群 = 讨论社区
```
- 建"SONA 玩家群"，群内晒作品/讨论玩法
- 用短视频（抖音/小红书/B站 拍"手机跟随旋律震动"）引流
- 公众号菜单挂小程序 + 文章内嵌卡片联动
