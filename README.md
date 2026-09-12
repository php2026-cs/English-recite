# 轻词 · 个人背单词

一个本地优先、可安装为 PWA 的极简背单词工具。重点解决“一词多义”的独立录入与背诵。

## 技术栈

- React + TypeScript + Vite
- Tailwind CSS
- Dexie.js（IndexedDB）
- React Router
- vite-plugin-pwa
- Vitest

## 词典候选来源

“获取释义”通过可替换的 `DictionaryProvider` 抽象调用：

- 英文释义：`dictionaryapi.dev`
- 英文释义翻译为中文：`MyMemory Translation API`

当前数据源免费、无需 API Key。网络不可用时仍然可以手动添加释义，已保存的本地词库不受影响。

词典查询会按 `trim().toLowerCase()` 后的单词缓存到本地 IndexedDB，重复查询直接使用缓存；“重新获取”会跳过缓存并覆盖旧结果。英文 definition 翻译时会先去重并按 4 个并发限制请求。

## 运行

```bash
npm install
npm run dev
```

生产构建：

```bash
npm run build
npm run preview
```

测试：

```bash
npm test
```

## 数据模型

- `Word`：单词、音标、创建/更新时间。
- `Meaning`：词性、中文释义、是否加入背诵、复习统计；是独立记忆点。
- `ReviewRecord`：每次中译英/英译中结果的记录。
- `ReviewSession`：英译中一次回忆多个义项的会话记录。

所有数据存储在浏览器 IndexedDB，页面刷新不会丢失。

## 主要页面

- `/` 首页
- `/words` 词库
- `/words/new` 添加单词
- `/words/:id` 查看/编辑单词及释义
- `/review` 选择背诵模式
- `/review/zh-en` 中译英
- `/review/en-zh` 英译中
- `/review/adaptive` 智能复习（单词分组出题、义项独立评分）
- `/stats` 统计与数据备份

智能复习会集中展示同一单词本轮到期或新学的义项。普通英译中和智能复习的英译中都按词性分组，同词性内支持乱序及本地词典别名匹配。查看答案后，每个填空下方显示对应答案、掌握程度和学习例句；首次学习自动展开例句，后续折叠。按每个义项独立评分并保存，保存失败会保留答案供重试。

本地例句目前覆盖 16 个单词的 80 个义项（含全部 15 个已校对多义词），未收录的义项显示暂无例句。浏览器验收脚本与当前验收结果见 `PROJECT_MANUAL.md` 第 22、23 节。

例句仅高亮当前学习的单词及常见变形。英译中查看答案后，可用“这个答案也算对”记住某个义项的个人表达，后续复习自动接受，也可撤销。个人表达按账号和义项隔离，仅保存在当前浏览器，暂不纳入云同步或 JSON 备份。实现与验收见 `PROJECT_MANUAL.md` 第 25 节。

英译中、中译英和智能复习均支持本轮错义项再练及中途继续：选“忘记”的义项尽量隔 3 个其他单词再练，每个义项最多额外练 2 次。当前位置、已输入答案、揭晓状态和掌握程度自动保留；“暂存退出”后可从模式选择继续，也可“结束本轮”。续学进度保存在当前浏览器，按账号与模式分开，暂不跨设备同步。实现与验收见 `PROJECT_MANUAL.md` 第 24 节。

## 项目结构

界面采用受终末地启发的 `endfield + moderate` 设计：炭黑导航、浅色工程网格、信号黄操作、克制切角与大号释义。设计工作流参考 [ark-ui-skill](https://github.com/Brandon030722/ark-ui-skill)，网站样式和图标为本项目自行实现，未引入官方游戏素材或字体。验收脚本：`scripts/verify-endfield-design.mjs`（桌面/手机布局、导航、键盘焦点）和 `scripts/verify-two-rounds.mjs`（复习交互）。

新建的英译中、中译英和智能复习采用两轮：整批先选择辨认，再对同一批单词输入回忆。英译中显示选项总数和应选数量，用拼写接近的英语词对应释义作干扰；中译英为英文单选。选择轮只保留进度，第二轮输入后才按义项评分及安排 FSRS，再练仍使用输入题。旧的未完成会话保留原流程。题目释义使用响应式大号粗体，切题渐入，尊重系统减少动态效果设置。浏览器验证脚本为 `scripts/verify-two-rounds.mjs`。

性能优化：完整 CET6 词典和词典页面按需加载，复习所需的别名使用独立小索引。首页主脚本约 654 KB（gzip 194 KB），此前约 5.36 MB（gzip 876 KB）。Service Worker 在后台保留完整词典离线缓存，因此这是首屏解析与关键资源的优化，并非删除离线词库。六级列表每次显示 80 个词，搜索仍覆盖全部 7,813 词。词典更新后通过 `npm run lexicon:build` 同时重建别名索引；单元测试检查索引与完整词典一致。

网页发布使用 GitHub Pages，仓库为 `php2026-cs/English-recite`。推送 `main` 后，`.github/workflows/pages.yml` 自动测试、构建和发布；Supabase 继续提供登录和云同步。GitHub 仓库的 Actions variables 配置 `VITE_SUPABASE_URL`、`VITE_SUPABASE_ANON_KEY`、`VITE_VAPID_PUBLIC_KEY`，仅允许公开的客户端配置，禁止 service-role 密钥。

Pages 构建使用 `/English-recite/` 资源路径和 hash 路由，复习地址形如 `/English-recite/#/review/adaptive`，刷新不会请求不存在的服务器路由。PWA 图标、启动路径、缓存和通知链接跟随部署路径。本地与已有 Sites 默认保持根路径和普通路由；`.openai/hosting.json` 保留已有 Sites 项目关联。环境文件不上传源码仓库，Vercel 配置仅作为历史文件保留。

```text
src/
  core/            纯业务逻辑与测试
  db/              Dexie 数据库定义
  repositories/   数据访问层
  services/       跨仓储的复习记录逻辑
  components/     通用 UI 组件
  pages/          页面
  lib/            通用工具
```
