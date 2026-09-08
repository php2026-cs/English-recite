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

网页发布使用 Sites，配置位于 `.openai/hosting.json`，Supabase 继续提供登录和云同步。构建时从本机 `.env.local` 读取公开的前端配置；环境文件不上传源码仓库。Vercel 配置仅作为历史文件保留。

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
