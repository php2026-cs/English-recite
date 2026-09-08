# 轻词 · 个人背单词项目说明书

> 本文面向下一任开发/维护者，说明当前项目已经完成什么、如何运行、架构是什么、还存在哪些已知问题，以及下一阶段应该如何继续。

> 最新本地验收：2026-09-08，27 个测试文件、137 项测试通过；例句目标词高亮与个人可接受答案已完成，见第 25 节。三个主要复习模式的错义项再练和本机续学见第 24 节。早期部署记录仅代表当时状态，不能作为当前线上状态证明。

## 1. 项目定位

这是一个本地优先、可安装为 PWA 的个人背单词 App。

核心原则：

- 本地 IndexedDB 优先，离线可用
- Word / Meaning 是用户学习数据
- CET6 Lexicon 是静态词典数据，不是用户数据
- Meaning 是 FSRS 间隔重复的最小记忆单位
- 云同步只同步用户实际加入的 Word / Meaning
- Web Push 只是提醒，不修改 FSRS 状态

## 2. 当前完成状态

已真实完成并验证：

- 本地词库与一词多义录入
- CET6 本地词典包
- 中译英 / 英译中 Word 级复习题型
- FSRS 按 Meaning 调度
- 每日复习队列
- 设置页
- Supabase Auth、Profile
- Supabase 云同步
- ReviewState / ReviewRecord 同步
- 重复同步幂等
- Offline → Online 自动同步
- RLS 匿名隔离
- Web Push 前端与 Edge Function 骨架，部分真实部署

尚未完成或未完全验证：

- Web Push 真实端到端
- Cron 每日复习提醒
- 失效 subscription 清理
- iPhone / Android 真机 Push
- 跨用户 RLS 隔离
- IELTS 词典包

## 3. 技术栈

```text
React 18
TypeScript
Vite
Tailwind CSS
Dexie.js + dexie-react-hooks
React Router
ts-fsrs
@supabase/supabase-js
vite-plugin-pwa
Vitest
web-push（Edge Function / VAPID）
```

## 4. 目录结构

```text
src/
  auth/                  AuthContext
  components/            通用 UI 组件
  core/                  review 核心逻辑、wordReview、importExport
  data/lexicon/          CET6 静态词典 JSON 与类型
  db/                    Dexie 数据库定义
  lib/                   通用工具
  pages/                 页面
  repositories/          IndexedDB 数据访问层
  services/
    dictionary/          词典 Provider / Enhancer / 缓存
    lexicon/             本地 Lexicon 查询
    push/                Web Push 前端能力
    srs/                 FSRS、队列、复习提交
    supabase/            Supabase client
    sync/                云同步引擎、mapper、冲突策略
  sync/                  SyncContext
  sw.ts                  自定义 Service Worker
scripts/
  build-cet6-lexicon.mjs
  validate-lexicon.mjs
  cet6-manual-overrides.json
supabase/
  migrations/            SQL migrations
  functions/             Edge Functions
  cron.sql
reports/                 Lexicon 构建报告
```

## 5. 核心数据模型

### 5.1 本地 Word

```ts
interface Word {
  id: string
  word: string
  phonetic?: string
  createdAt: number
  updatedAt: number
}
```

### 5.2 本地 Meaning

```ts
interface Meaning {
  id: string
  wordId: string
  partOfSpeech: string
  chineseMeaning: string
  selectedForStudy: boolean
  correctCount: number
  incorrectCount: number
  lastReviewedAt?: number
  createdAt: number
  updatedAt: number
}
```

Meaning 是最小记忆单元。同一个 Word 的多个义项必须独立保存。

### 5.3 MeaningReviewState

```ts
interface MeaningReviewState {
  meaningId: string
  state: 'new' | 'learning' | 'review' | 'relearning'
  dueAt: number
  lastReviewAt?: number
  stability?: number
  difficulty?: number
  reps: number
  lapses: number
  elapsedDays?: number
  scheduledDays?: number
  fsrsData?: Record<string, unknown>
  createdAt: number
  updatedAt: number
}
```

这是当前状态，与历史 ReviewRecord 分离。

### 5.4 ReviewRecord

```ts
interface ReviewRecord {
  id: string
  wordId: string
  meaningId?: string
  mode: 'zh-to-en' | 'en-to-zh'
  correct: boolean
  result?: 'again' | 'hard' | 'good' | 'easy'
  previousDueAt?: number
  nextDueAt?: number
  responseTimeMs?: number
  reviewedAt: number
}
```

ReviewRecord 是 append-only 历史，不应频繁 update。

### 5.5 ReviewSession

用于英译中一次 Word 级回忆会话。

### 5.6 UserSettings

```ts
interface UserSettings {
  id: 'app'
  dailyNewMeaningLimit: number
  desiredRetention: number
  dailyReminderEnabled: boolean
  reminderTime: string
  reminderOnlyWhenDue: boolean
  showDueCount: boolean
  timezone: string
}
```

### 5.7 LexiconEntry / LexiconSense

```ts
interface LexiconEntry {
  id: string
  word: string
  phonetic?: string
  packs: string[]
  frequency?: number
  senses: LexiconSense[]
}

interface LexiconSense {
  id: string
  partOfSpeech: string
  chineseMeaning: string
  aliases?: string[]
  englishDefinition?: string
  order: number
  reviewStatus?: 'auto' | 'reviewed'
}
```

词典数据与用户 Word / Meaning 严格分离。用户选择 sense 后才会复制成 Meaning。

## 6. Dexie 数据库版本

```ts
version(1): words, meanings, reviewRecords, reviewSessions
version(2): dictionaryCache
version(3): meaningReviewStates, settings
version(4): syncMeta
version(5): performanceProfiles, meaningDifficulties, confusionPairs
version(6): 用户数据表增加 localOwnerUserId 索引
version(7): activeReviewRuns（本机复习队列及进度）
version(8): personalMeaningAliases（本机个人可接受答案）
```

新增表必须新增 version，不要修改已有 version 的 schema。

## 7. CET6 Lexicon

静态词典文件：

```text
src/data/lexicon/cet6.json
```

数据规模：

```text
目标词：7838
匹配词：7813
LexiconEntry：7813
LexiconSense：40650
```

构建命令：

```bash
npm run lexicon:build -- --source <endict目录>
```

验证命令：

```bash
npm run lexicon:validate
```

构建脚本读取 `ismartcoding/endict` 的 CET4 + CET6 词表，生成最终静态 JSON。不要运行 App 时做 NLP 拆分。

## 8. 词典服务层

```text
DictionaryProvider
  ↓
DictionaryApiProvider
  ↓
MeaningEnhancer
  ↓
MyMemoryMeaningEnhancer
  ↓
MeaningNormalizer
  ↓
DictionaryServiceCore
  ↓
DictionaryCache
```

当前在线词典只是 fallback。CET6 本地 Lexicon 优先。

## 9. FSRS 调度

使用 `ts-fsrs`。

关键文件：

- `src/services/srs/fsrsScheduler.ts`
- `src/services/srs/reviewState.ts`
- `src/services/srs/reviewQueue.ts`

复习队列：

- `buildReviewWordQueue()` 按 Word 分组
- 只包含 due / new Meaning
- 同一 Word 在一次生成的队列中只出现一次；重新进入页面会重新按到期状态生成队列，不保证全天只出现一次
- 中译英 / 英译中都是 Word 级出题
- 评分后按 Meaning 分别更新 FSRS

## 10. 复习提交

`src/services/srs/srsReviewService.ts`

提交只写本地 IndexedDB：

```text
MeaningReviewState
ReviewRecord
syncMeta dirty
```

不等待 Supabase，不等待云同步。

## 11. Supabase 云同步

关键文件：

- `src/services/supabase/supabaseClient.ts`
- `src/services/sync/syncEngine.ts`
- `src/services/sync/supabaseMappers.ts`
- `src/services/sync/conflictResolver.ts`
- `src/services/sync/syncMetaRepository.ts`
- `src/sync/SyncContext.tsx`

流程：

```text
UI
↓
Repository
↓
IndexedDB
↓
Sync Engine
↓
Supabase
```

冲突策略：

- Word / Meaning：`updatedAt` Last Write Wins
- MeaningReviewState：`lastReviewAt` 优先，其次 `updatedAt`
- ReviewRecord：UUID append-only merge

同步触发：

- 登录成功
- App 启动且已登录
- online 事件
- 设置页手动“立即同步”

## 12. Supabase 表

```text
profiles
user_words
user_meanings
meaning_review_states
review_records
push_subscriptions
notification_logs
```

Migrations 在：

```text
supabase/migrations/
```

RLS 策略在 `003_rls.sql`。

## 13. Auth

支持 Email + Password。

`AuthProvider` 统一管理 user / session / loading。

未登录用户仍可完整使用本地功能。

## 14. Web Push

前端：

- `src/services/push/pushService.ts`
- `src/services/push/notificationPolicy.ts`
- `src/pages/SettingsPage.tsx`

Service Worker：

- `src/sw.ts`

Edge Functions：

- `supabase/functions/test-push/index.ts`
- `supabase/functions/send-review-reminders/index.ts`

VAPID：

- public key 在 `.env.local` 的 `VITE_VAPID_PUBLIC_KEY`
- private key 只存在 Supabase Edge Function secrets

当前 Web Push 状态：

- VAPID 已生成
- Supabase secrets 已设置
- test-push Edge Function 已部署
- 前端订阅、测试通知、关闭通知逻辑已实现
- 真实设备通知和 Cron 提醒尚未完整验证

## 15. 环境变量

`.env.local` 不应提交 Git。

```text
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_VAPID_PUBLIC_KEY=
```

禁止在前端使用：

```text
SUPABASE_SERVICE_ROLE_KEY
VAPID_PRIVATE_KEY
```

## 16. 常用命令

```bash
npm install
npm run dev
npm test
npm run build
npm run preview
npm run lexicon:build -- --source <endict目录>
npm run lexicon:validate
```

## 17. 当前测试状态（2026-09-08）

```text
Test Files  27
Tests       137
```

测试覆盖：

- 核心一词多义复习
- Word 级队列
- 英译中乱序匹配
- alias
- FSRS 评分
- 词典 mapper
- Supabase schema / RLS 文本检查
- 通知策略

## 18. 已知问题 / 待办

1. Web Push 真实设备端到端未完成。
2. Cron 每日复习提醒未完成。
3. 失效 push subscription 清理未真实验证。
4. 跨用户 RLS 隔离未真实验证。
5. 前端主 bundle 约 5.3MB，主要来自 CET6 JSON，未来建议分片懒加载。
6. CET6 词库大部分为 auto 状态，只有 15 个高频多义词为 reviewed。
7. 在线词典中文义项质量依赖 MyMemory，长句释义需要用户精简。

## 19. 下一阶段建议顺序

1. 完成 Web Push 真实设备验证。
2. 完成 test-push 的 Supabase 订阅写入链路。
3. 部署并验证 send-review-reminders。
4. 配置并验证 Cron。
5. 验证 iPhone PWA 和 Android Chrome。
6. 优化 CET6 词库分片。
7. 再扩展 IELTS Lexicon。

## 20. Vercel 公网部署交接

### 当前状态

- 本地开发、测试、构建均已完成
- 已新增 `vercel.json`
- 已新增开发验收页面 `/debug/personalization`
- 尚未成功登录 Vercel
- 尚未产生公网 Production URL

### 已验证

```text
npm test        108 passed
npm run build   passed
```

### Vercel 登录阻塞

本轮执行：

```text
npx vercel login
```

时，CLI 曾生成设备授权链接，但登录未完成。下一任应重新执行：

```text
npx vercel login
```

然后按 CLI 输出的链接在浏览器中授权。

### 部署配置

`vercel.json`：

```json
{
  "rewrites": [
    {
      "source": "/(.*)",
      "destination": "/index.html"
    }
  ]
}
```

推荐 Vercel 项目配置：

```text
Framework Preset: Vite
Build Command: npm run build
Output Directory: dist
Install Command: npm install
```

### 部署命令

登录成功后执行：

```text
npx vercel --prod
```

交互问题建议：

```text
Set up and deploy? Yes
Link to existing project? 如果没有现有关联则 No
Override settings? No
```

### 部署后必须验收的路由

```text
/
/review
/review/adaptive
/debug/personalization
```

### 部署后检查项

- 页面是否正常加载
- React Router SPA fallback 是否正常
- IndexedDB 是否正常
- 智能复习题型是否正常
- ConfidencePicker 是否正常
- Response Timer 是否正常
- Spelling 是否正常
- Context fallback 是否正常
- Console 是否存在未处理异常

### 禁止事项

- 不要为了部署成功修改业务代码
- 不要删除 `dist/`、`vercel.json` 或项目文件
- 不要重置 Git
- 不要在 Vercel 部署阶段迁移 Dexie 数据到 Supabase

## 21. 智能复习闭环审计记录（历史记录，最新状态见第 22 节）

### 审计结论

```text
PASS WITH FIXES
```

### 已修复问题

1. Response Timer 提交后归零

原因：`handleSubmit()` 调用了 `timer.stop()`，随后提交时又调用 `getElapsedMs()`，导致 responseTimeMs 始终为 0。

修复：`AdaptiveReviewPage` 新增 `elapsedMs` 状态，在停止计时器时保存真实用时。

2. 智能复习所有题型被错误记为 `zh-to-en`

原因：`submitZhEnReview()` 固定写入 `mode = zh-to-en` 和 `questionType = zh-to-en`。

修复：`submitZhEnReview()` 增加可选 `questionType` 和 `mode`，`AdaptiveReviewPage` 根据当前题目类型传入真实值。

### 修改文件

- `src/pages/AdaptiveReviewPage.tsx`
- `src/services/srs/srsReviewService.ts`

### 核心链路

```text
Text → Queue → Meaning → Question → Answer
     → Confidence → Response Time → FSRS
     → MeaningReviewState → ReviewRecord → syncMeta
```

上述链路已审计，关键写入关系正确。

### 一词多义

- MeaningReviewState 使用 `meaningId`
- ReviewRecord 保存 `meaningId`
- 每次复习只更新当前 Meaning
- Meaning A 与 Meaning B 独立更新

### 当前测试与构建

```text
npm test        108 passed
npm run build   passed
```

### 已知未解决

1. `AdaptiveReviewPage` 仍使用 Meaning 级 `buildReviewQueue()`，未迁移到 Word 级 `buildReviewWordQueue()`。
2. Confidence 仍是行为信号，不直接修改 FSRS rating。
3. Context 题暂无可靠例句来源，实际会 fallback。
4. 未完成浏览器真实 E2E 验收。

### 下一阶段建议

优先处理：

```text
AdaptiveReviewPage 队列迁移到 buildReviewWordQueue
```

不要同时扩展 Confusion、Dashboard、Push 或 IELTS。

## 22. 智能复习 Word 级迁移与本地验收（2026-09-07）

### 当前行为

- `AdaptiveReviewPage` 使用 `buildReviewWordQueue`，按单词组织本轮到期义项及额度内的新义项。
- 队列在本轮开始时固定；后台同步或本地保存不会重排当前题目。切换账号会重建复习会话。
- 根据组内优先级最高的义项选择题型，整组共用该题型；没有可靠例句时，语境题回退中译英。
- 英译中每格一个中文释义，顺序不限；同一个输入只能匹配一个义项。仅使用本地词典中与当前中文释义和词性一致的别名。
- 中译英与拼写显示本组中文释义，填写一次英文答案；提交后每个义项仍可独立选择忘记、困难、记得、熟练，并填写信心分。
- 正确答案显示与题型一致。支持部分留空和主动揭晓全部空答案。
- `submitAdaptiveWordReview` 在一个 IndexedDB 事务中保存整组义项的状态、记录、表现画像和同步 dirty 标记；失败会回滚整批并保留界面答案供重试。
- 同一题的作答时间记录到各个义项，表示整词作答用时，并不是每个义项分别计时。信心分仍是行为信号，不直接改变 FSRS 评分。
- 修正表现画像中平均用时和信心分误用 0–1 截断的问题，分别保留毫秒和 0–3 量级。

### 验证与复现

```text
npm test        22 files / 119 tests passed
npm run build   passed（仍有 CET6 大包警告）
```

浏览器验收脚本：`scripts/verify-adaptive-review.mjs`。需要 Playwright 和 Chromium，以及运行在 `http://127.0.0.1:4179` 的 Vite 开发服务器。可用 `REVIEW_TEST_URL` 更换地址，用 `PLAYWRIGHT_MODULE` 指向已有的 Playwright ESM 包。脚本使用独立的临时浏览器上下文，不复用用户词库或登录状态。

```text
npm run dev -- --host 127.0.0.1 --port 4179 --strictPort
node scripts/verify-adaptive-review.mjs
```

验收覆盖：混合到期/新义项/未到期/未勾选、乱序及别名、部分答对、独立评分及 FSRS 到期时间、真实事务回滚及重试、重复点击防重、拼写与语境回退、空答案揭晓、刷新持久化和空队列。已检查手机宽度与桌面截图，无未捕获浏览器异常。

结果与截图在 `reports/adaptive-review/`。这些是本地 Chromium 验收，不代表公网部署、真机推送或 Supabase 跨用户 RLS 验收。

### 后续工作

1. 优化 CET6 整包加载；当前主 JS 仍约 5.34 MB。
2. 核实公网部署、跨账号云端隔离和同步端到端。
3. 完成真实设备 Push 和 Cron 提醒，再考虑扩充 IELTS 与例句来源。

现有 `dailyNewMeaningLimit` 是每次生成队列的新义项上限，尚未扣除当天之前已学的新义项；如要实现严格的全天额度，需要单独补充按日统计逻辑。

## 23. 英译中按词性提示、逐空反馈与首学例句（2026-09-07）

### 用户确认的交互

- 普通英译中 `/review/en-zh` 与智能复习中的英译中共用 `EnZhWordQuestion`。
- 顶部提示名词、动词、形容词等各有多少个待回忆义项；填空按词性分组。同一词性内顺序不限，答案不能跨词性匹配。
- 点击“查看答案”后，每个填空下方立即显示与该输入匹配的参考答案和掌握程度。未匹配的填空依次展示本组剩余答案，每个义项只出现一次。
- 每格可分别选忘记、困难、记得、熟练；信心反馈默认折叠。点击“保存并下一词 / 保存并完成”才持久化，查看答案本身不写复习结果。
- 用户确认：某个义项首次学习时自动展开双语例句，以后复习默认折叠，可随时点开。首次学习通过本地义项统计、lastReviewedAt 和 FSRS 历史判定，不新增数据库版本；未保存就退出仍视为未完成首次学习。
- 英译中会话、独立义项记录、FSRS 状态和同步标记在同一事务保存，重试与重复点击保护延续第 22 节规则。

### 例句来源及范围

- `src/data/lexicon/studyExamples.ts`：16 个单词、80 个义项的原创双语学习例句，含原有 15 个已校对多义词的全部 77 个标准义项；另补 charge 的充电义和 adapt 的两个义项。界面标明 AI 编写。
- `src/services/lexicon/studyExamples.ts`：按单词、词性和中文义项精确读取，可识别该义项的词典别名，不将其他词性的例句套用过来。
- CET6 整体尚无完整例句库；未收录的义项显示“该义项暂无例句”。本次没有接入在线生成服务，也没有更改语境题的回退规则。

### 验收

```text
npm test        24 files / 126 tests passed
npm run build   passed（CET6 整包警告仍存在）
node scripts/verify-adaptive-review.mjs
node scripts/verify-en-zh-groups.mjs
```

浏览器环境设置同第 22 节。新增脚本分别验收普通与智能入口：词性提示、揭晓前隐藏答案与例句、同词性乱序、跨词性拒绝、答案/评分/例句与输入对应、首次展开、保存后再次复习折叠及手动展开、独立评分入库、手机与桌面布局。原有事务回滚和防重等验收同时通过。

新增报告和截图在 `reports/en-zh-groups/`。下一步如扩大例句覆盖，优先补充能按义项对应的例句素材，避免仅按单词匹配。

## 24. 错义项再练与中途继续（2026-09-08）

### 覆盖与交互

- `/review/en-zh`、`/review/zh-en`、`/review/adaptive` 共用 `ReviewRunPage`。旧的 `/review/today` 不在本次改动范围。
- 每次保存后，只把最终掌握程度为“忘记”的义项加入再练任务；尽量间隔 3 个其他单词，剩余任务不足时排到队尾。每个义项本轮最多额外练 2 次，仍未记住则交给后续 FSRS 复习。
- 再练题明确标注次数和义项数量，已记住的义项不会被再次评分。每次再练都是新的真实 FSRS 复习；“已完成单词/义项”只统计首轮，再练次数单独展示。
- 进入未完成的模式自动恢复。页面保留当前任务、已输入答案、答案是否已揭晓、掌握程度、信心分与累计有效作答时间；离开页面的时间不计入作答。
- “暂存退出”回到模式选择并保留本轮，“结束本轮”主动停止当前队列，已保存学习记录保留，不给未提交的答案评分。
- 模式选择页标明哪些模式可以继续。账号和模式分别存储；当前仅在同一浏览器恢复，不进行云端或跨设备同步。清除浏览器数据会删除本机续学进度。

### 持久化与一致性

- Dexie 新增 version 7 的 `activeReviewRuns` 表，保留此前数据库版本定义。每个账号与模式维护一份最近会话，`sessionId` 区分新旧轮次，`taskId` 区分同一单词的各次再练。
- `submitAdaptiveWordReview` 在同一个 IndexedDB 事务里写入 FSRS 状态、复习记录、表现画像、英译中会话、同步标记以及下一题位置。任一步失败全部回滚。
- 对已完成的 `taskId` 重复提交直接返回当前进度，不重复记录或评分；覆盖双击、保存重试和两个标签页同时提交。
- 输入草稿使用本机 localStorage，以 sessionId + taskId 隔离；输入、评分及页面退出时保存，提交成功后清理。草稿存储失败时界面提示先保存本题。
- 恢复时重新核对当前词库，剔除已删除或取消背诵的义项；单词、词性或义项内容变化时，生成新 taskId 并放弃旧题草稿，避免错用答案。
- 本机续学不纳入现有 JSON 词库备份或云同步范围，匿名学习转为登录账号时按新账号重新生成队列。

### 关键文件与验收

```text
src/core/reviewRun.ts
src/services/srs/reviewRunRepository.ts
src/services/srs/reviewDraft.ts
src/components/ReviewRunPage.tsx
src/components/AdaptiveWordQuestion.tsx
src/components/EnZhWordQuestion.tsx

npm test        25 files / 130 tests passed
npm run build   passed（原有 CET6 整包警告仍存在）
node scripts/verify-review-resume.mjs
node scripts/verify-adaptive-review.mjs
node scripts/verify-en-zh-groups.mjs
```

浏览器环境同第 22 节。新增验收覆盖三个模式的填写中刷新、揭晓后评分恢复、暂存退出与继续、间隔 3 词、仅错义项再练、再练上限、跨标签页防重、结束本轮不新增记录、取消背诵后的队列清理、账号隔离，以及真实 IndexedDB v6 → v7 升级后旧词库与复习记录保留。

原有事务回滚/重试和逐空反馈/例句验收同时通过。报告及手机截图位于 `reports/review-resume/`，其余回归报告位置见第 22、23 节。

## 25. 例句目标词高亮与个人可接受答案（2026-09-08）

- 用户确认：只突出当前正在背的单词。英文例句用浅黄色标出目标词及常见屈折变形（如 charge / charges / charged、run / ran / running）；不标出其他生词。按完整词匹配，保留原句的大小写、空格和标点。现有 80 个例句均已验证能匹配目标词。
- 普通英译中及智能复习中的英译中，在未匹配的非空答案下提供“这个答案也算对”，明确展示将输入记作哪个义项的可接受表达。接受后重新匹配并默认选“记得”，仍可手动调整掌握程度；只有保存本题才写入复习记录。
- 个人表达在后续复习自动生效，已应用的表达可用“撤销这个表达”移除。撤销后重新匹配当前答案，不改写历史学习记录。匹配先处理所有标准答案，再处理别名，避免别名抢占其他义项的标准答案。
- Dexie version 8 新增 `personalMeaningAliases`，按账号、单词、义项、词性和标准释义隔离；义项修改后不沿用旧表达。当前仅本机保存，不纳入云同步或 JSON 备份。

关键文件：`src/core/exampleHighlight.ts`、`src/core/personalVocabulary.ts`、`src/repositories/personalVocabularyRepository.ts`、`src/core/wordReview.ts`、`src/components/EnZhWordQuestion.tsx`。

```text
npm test        27 files / 137 tests passed
npm run build   passed（原有 CET6 整包警告仍存在）
node scripts/verify-personal-answers.mjs
node scripts/verify-review-resume.mjs
node scripts/verify-en-zh-groups.mjs
node scripts/verify-adaptive-review.mjs
```

浏览器环境同第 22 节。新增验收覆盖目标词及变形高亮、原句不变、接受后重新匹配及默认评分、刷新保留、后续复习复用、跨词性和账号隔离、撤销持久化及历史记录不变；检查手机布局且无未捕获浏览器异常。报告和截图位于 `reports/personal-answers/`。续学验收同时验证真实 IndexedDB v6 → v8 升级保留旧词库与复习记录；原有逐空反馈、首学例句、事务回滚和防重回归均通过。
