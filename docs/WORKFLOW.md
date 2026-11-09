# Dela Rewind 工作流程

> 最后核对：2026-11-09  
> 配套文件：`docs/FILE-ORGANIZATION.md`（路径与目录说明）

## 1. 我们基于什么修改

Dela Rewind 是官方 Dela 的**非官方 fork**。

- 上游：`Chang-Yo/Dela`
- 当前功能基线：官方 2.2.2 源码
- 版本号策略：**与上游使用相同版本号**，不写死具体版本
- 当前源码目录：`F:\Project\Fix_Another_Agent_byDS\Dela-Rewind`
- 历史 2.2.1 源码只作参考，不再作为开发基线

修改原则：

1. 以官方 2.2.2 的现有能力为底座，只叠加自定义功能；
2. 保留上游已有能力，例如 Canvas 令牌登录、播放进度记忆、语音文稿；
3. 不修改 `appId`、包名、用户数据目录；
4. 外显名称可以改，底层 ID 保持与 Dela 一致；
5. 优先复用现有组件和视觉 token，不另写一套近似实现；
6. 不直接改安装版里的 `app.asar` 作为长期方案。

## 2. 当前功能范围

### 已实现

- 资料页「显示全部学期」开关；
- 新版课堂视频：学期选择、记住上次/当前学期、只加载一个学期；
- 旧版课堂视频：独立页面、按 Canvas 学期/课程浏览、无语音页签；
- 课堂视频父层级：新版 / 旧版 / 课堂视频归档；
- 归档层级：统计 / 传输（传输为占位）；
- 归档统计：
  - 新版 + 旧版；
  - 两路画面分别统计；
  - 新旧重叠分别统计；
  - 教师列：新版留空，旧版读取 `userName`；
  - 总大小、画面数、视频数、失败数；
  - 导出 CSV；
- 双更新检查：上游只读提示 + Dela Rewind 自身更新；
- 外显名称 Dela Rewind，底层 ID 保持 Dela。

### 待实现

- 传输页；
- 下载 → 百度网盘上传 → 云端校验 → 删除本地；
- 批次队列、断点恢复、主进程后台任务；
- 统计/传输结果跨应用重启持久化；
- 传输失败重试和云端空间检查。

## 3. 分支与提交规则

```text
main               官方 2.2.2 镜像，只同步上游
custom             已 push 的稳定/文档基线
feat/video-archive 当前功能开发分支
port-2.2.2         首次拆分课堂视频/更新逻辑的分支
```

流程：

1. 从最新基线创建 `feat/<主题>` 分支；
2. 一个提交只做一个主题；
3. 提交前格式化、类型检查、相关测试；
4. 不把 `node_modules`、`out`、`dist`、凭据、用户数据提交进 git；
5. push、改 tag、发 Release 前必须由人类确认。

## 4. 修改流程

### 第一步：确认需求

- 先读 `AGENTS.md`、`CONTRIBUTING.md`、`README.md`、`docs/FILE-ORGANIZATION.md`；
- 明确目标、边界、验收标准；
- 不确定时先讨论，不擅自扩大范围；
- 不修改 `AGENTS.md`（只能由人类维护）。

### 第二步：确认工作区

```powershell
cd F:\Project\Fix_Another_Agent_byDS\Dela-Rewind
git status
git branch --show-current
```

- 工作区必须干净；有他人改动时不要覆盖；
- 确认改的是 `Dela-Rewind`，不是 `Dela\Dela-src`；
- 确认当前分支是功能分支。

### 第三步：读代码再改

- 先定位 main / preload / renderer / shared 的边界；
- renderer 不直接读凭据、数据库、文件系统；
- 所有校园能力走 IPC；
- 复用现有 `Button`、`PanelToggleButton`、`Resizer`、设计 token；
- 不把调试脚本或 research 代码复制进产品。

### 第四步：实现

- 只改必要文件；
- 保持现有 UI 视觉和交互一致；
- 用户数据、token、session 不写日志、不进 git；
- 新增交互要考虑页面卸载、重复进入、后台任务；
- 涉及更新/下载/传输时，任务状态应放在页面之外。

## 5. 改完怎么测试

在 `Dela-Rewind` 下按顺序执行：

### 5.1 静态检查

```powershell
pnpm typecheck
pnpm format:check
pnpm lint
```

### 5.2 相关测试

```powershell
pnpm exec vitest run <相关测试文件>
```

例如课堂视频：

```powershell
pnpm exec vitest run src/renderer/features/classroom/store.test.ts
pnpm exec vitest run src/main/vsjtu/test/api.test.ts src/main/vsjtu/test/playback.test.ts
```

### 5.3 全量测试

```powershell
pnpm test
```

已知环境问题：

- `src/main/agent/test/commands.test.ts` 可能因为测试环境找不到 Git Bash 失败，与本功能无关；
- 若失败，先确认是否是同一环境原因，不要直接宣称功能失败或通过。

### 5.4 构建与冒烟

```powershell
pnpm build
pnpm package:dir
```

然后运行：

```powershell
.\dist\win-unpacked\'Dela Rewind.exe' --smoke-test
```

打包注意：

- 保持代理开启，否则 `electron-builder` 可能卡在下载 `winCodeSign`/NSIS；
- 缓存位置：`%LOCALAPPDATA%\electron-builder\Cache`；
- 打包失败先看是网络还是代码错误，不要反复盲重试。

### 5.5 测试版验收

把新的 `win-unpacked` 复制到：

```text
F:\Tool\Download\Dela-Rewind-Test
```

由人类实际打开检查：

- UI 布局、层级、动画、宽度拖拽；
- 新版/旧版课堂视频能否加载和播放；
- 统计是否正常、CSV 是否正确；
- 更新检查两行行为是否正常。

测试前先关闭官方/已安装版本，并备份 `%APPDATA%\dela`。

## 6. 测试完做什么

### 人类验收

- 人类检查 `win-unpacked` 后确认；
- 未确认前不生成正式安装包、不 push、不发 Release。

### 安装包

确认后：

```powershell
pnpm package:dist
```

产物在 `dist\`：

- `Dela-Rewind-<version>-win-x64.exe`
- `.blockmap`
- `latest.yml`
- `.sha256.txt`

### 安装验证

- 安装到独立目录；
- 备份用户数据；
- 注意安装器可能被视为对官方 Dela 的更新而覆盖安装；
- 验证安装后启动、课堂视频、统计、更新检查。

### 发布

只有人类明确确认后才：

1. 合并/推送 `custom`；
2. 创建标签（当前策略：与上游同版本号）；
3. 上传安装包、blockmap、`latest.yml`、校验文件；
4. 确认 `releases/latest` 和 `latest.yml` 指向正确；
5. 不把测试版、用户数据、调试脚本放进 Release。

## 7. 文档维护

每次以下变化都要更新文档：

- 源码/安装/测试目录变化；
- 分支、Release、版本状态变化；
- 构建或测试流程变化；
- 新增功能或移除功能。

- 文件位置：`docs/FILE-ORGANIZATION.md`
- 工作流程：`docs/WORKFLOW.md`（本文件）
- 功能变更记录：`CHANGELOG-Rewind.md`

## 8. AI 协作检查清单

开工前：

- [ ] 读 `AGENTS.md`（不编辑）
- [ ] 读 `CONTRIBUTING.md`
- [ ] 读 `docs/FILE-ORGANIZATION.md`
- [ ] 确认分支和工作区
- [ ] 确认没有未参与的改动

提交前：

- [ ] 类型检查
- [ ] 格式检查
- [ ] lint
- [ ] 相关测试
- [ ] 构建
- [ ] 冒烟
- [ ] 更新 CHANGELOG（如需要）
- [ ] 更新文件/流程文档（如需要）

禁止：

- 提交 token、Cookie、数据库、用户数据；
- 直接改安装版 asar 作为正式方案；
- 未经确认 push、打 tag、发 Release；
- 修改 `AGENTS.md`；
- 把 research/调试脚本复制进产品。
