# Dela Rewind 文件与目录说明

> 最后核对：2026-11-09  
> 目的：让后续开发者或 AI 协作者能快速判断“哪个是源码、哪个是产物、哪个能改、哪个不能动”。
> 路径以本机 Windows 环境为准；换机器时替换盘符，不要照搬用户目录。

## 1. 先看结论：哪个才是源码

| 角色                                     | 路径                                                    | 说明                                                                             |
| ---------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------------------------------- |
| **当前产品源码（唯一应继续开发的地方）** | `F:\Project\Fix_Another_Agent_byDS\Dela-Rewind`         | Dela Rewind 的 2.4.0 源码仓库，含自定义功能                                      |
| 旧版本源码（历史参考）                   | `F:\Project\Fix_Another_Agent_byDS\Dela\Dela-src`       | 2.2.1 上完成旧版课堂视频/学期选择的版本；**不要再基于它开发**                    |
| 上游 2.2.1 基线                          | `F:\Project\Fix_Another_Agent_byDS\Dela-upstream-2.2.1` | 用于三方合并的官方 2.2.1 快照，不是产品                                          |
| 工作区根                                 | `F:\Project\Fix_Another_Agent_byDS\Dela`                | 旧源码、research、调试脚本所在目录；`Dela-Rewind` 是它的**同级目录**，不在它里面 |

注意：`Dela-Rewind` 不在 `Dela` 目录内部。经常有人误以为它在 `Dela\Dela-Rewind`。

## 2. 本机目录布局

```text
F:\Project\Fix_Another_Agent_byDS\
├─ Dela\                        工作区：旧源码 + 调研资料 + 调试脚本
│  ├─ Dela-src\                 2.2.1 旧源码（历史，不再开发）
│  ├─ research\                 调研文档、截图、探针数据、测试输出
│  ├─ cdp-*.js                  CDP/调试脚本
│  ├─ repack-asar.js            asar 重打包辅助脚本
│  └─ ...
├─ Dela-Rewind\                 当前产品源码（git 仓库）
│  ├─ src\                      main / preload / renderer / shared
│  ├─ assets\                   品牌图、图标
│  ├─ docs\                     开发文档
│  ├─ scripts\                  构建、冒烟、打包脚本
│  ├─ out\                      Vite 构建产物（gitignore）
│  ├─ dist\                     electron-builder 产物（gitignore）
│  └─ node_modules\             依赖（gitignore）
└─ Dela-upstream-2.2.1\         官方 2.2.1 快照（合并基线）
```

`Dela` 根目录下的 `$tmp`、`asar-extracted` 等是历史临时目录，可清理；不要把它们当源码。

## 3. 源码内部结构（Dela-Rewind）

```text
src\
├─ main\             Electron 主进程：vsjtu、canvas、update、workspace...
├─ preload\          contextBridge / 有限 IPC API
├─ renderer\         React 界面
│  ├─ components\    通用组件（含 level-shell.tsx）
│  ├─ features\
│  │  ├─ classroom\       新版课堂视频 + ClassroomHub
│  │  ├─ old-classroom\   旧版课堂视频
│  │  └─ archive\         课堂视频归档 / 统计 / 传输占位
│  ├─ navigation\    导航入口与路由
│  └─ workspace\     Canvas 课程缓存等
└─ shared\           IPC 契约与共享类型
```

### 本项目新增的关键文件

| 文件/目录                                              | 作用                                         |
| ------------------------------------------------------ | -------------------------------------------- |
| `src/renderer/components/level-shell.tsx`              | 递归层级壳：顶部栏 + 可收起/可拖宽左栏       |
| `src/renderer/features/classroom/ClassroomHub.tsx`     | 课堂视频父层级                               |
| `src/renderer/features/old-classroom/`                 | 旧版课堂视频                                 |
| `src/renderer/features/archive/ArchiveHub.tsx`         | 课堂视频归档层级                             |
| `src/renderer/features/archive/ArchiveStatsView.tsx`   | 统计页面                                     |
| `src/renderer/features/archive/stats-store.ts`         | 统计任务状态（页面外保存；应用重启后仍会丢） |
| `src/main/vsjtu/old.ts`                                | 旧版 Canvas 云录播 LTI 接入                  |
| `src/renderer/features/settings/UpstreamUpdateRow.tsx` | 上游 Dela 只读更新提示                       |

## 4. 构建产物与安装目录

### 源码构建

| 路径                                                 | 说明                                 | 是否可删          |
| ---------------------------------------------------- | ------------------------------------ | ----------------- |
| `Dela-Rewind\out\`                                   | Vite 生成的 main/preload/renderer 包 | 可重新生成        |
| `Dela-Rewind\dist\win-unpacked\`                     | 免安装程序目录                       | 可重新生成        |
| `Dela-Rewind\dist\Dela-Rewind-<version>-win-x64.exe` | NSIS 安装包                          | 对应 Release 资产 |
| `Dela-Rewind\dist\...blockmap`                       | 差分更新 blockmap                    | 发布资产          |
| `Dela-Rewind\dist\latest.yml`                        | electron-updater 更新元数据          | 发布资产          |
| `Dela-Rewind\dist\...sha256.txt`                     | 安装包校验文件                       | 发布资产          |

### 当前本机安装/测试

| 路径                                | 版本/状态           | 说明                                               |
| ----------------------------------- | ------------------- | -------------------------------------------------- |
| `F:\Tool\Download\Dela Rewind`      | 2.2.2，NSIS 安装    | 早先的正式安装版，**不包含**最新层级/教师改动      |
| `F:\Tool\Download\Dela-Rewind-Test` | 2.4.0，win-unpacked | 最新测试版，直接运行 `Dela Rewind.exe`             |
| `F:\Tool\Download\Dela`             | **当前不存在**      | 原官方 Dela 目录；安装 Dela Rewind 后已被覆盖/替换 |

测试版规则：`Dela-Rewind-Test` 永远只保留**最新一次构建**；升级版本时直接覆盖，不创建 `Dela-Rewind-2.4.0-Test` 之类的版本目录，避免测到旧包。

命名注意：安装目录是 `Dela Rewind`（空格），测试目录是 `Dela-Rewind-Test`（连字符）；不要混用。

边界：`F:\Tool\Download` 根目录只放“安装目录/测试目录”，不要在这里放源码、构建产物或安装包副本。安装包只留在 `Dela-Rewind\dist`，需要测试时从 `dist` 安装，或复制整个 `win-unpacked` 到测试目录。

### 构建命令

在 `Dela-Rewind` 下：

```powershell
pnpm install
pnpm typecheck
pnpm build
pnpm package:dir    # win-unpacked
pnpm package:dist   # NSIS 安装包
pnpm smoke
```

`electron-builder` 需要联网下载/校验 `winCodeSign`、NSIS 等构建工具；代理关闭时可能打包失败。缓存通常在 `%LOCALAPPDATA%\electron-builder\Cache`。

### Electron 运行时缓存与镜像

- Electron 运行时按版本存放，不能把 2.2.2 的 `node_modules/electron/dist` 直接给 2.4.0 用；
- 同一版本可以复用缓存，不同版本必须下载对应的 zip；
- 下载缓存：`%LOCALAPPDATA%\electron\Cache`；
- 国内加速：

```powershell
$env:ELECTRON_MIRROR='https://npmmirror.com/mirrors/electron/'
pnpm exec install-electron
```

- `install-electron` 默认没有进度输出，看起来像卡住；zip 约 150MB，下载完成后才会返回；
- `pnpm` 依赖包缓存与 Electron 运行时缓存分开，二者都可能被不同项目复用。

### 测试环境的 Git Bash

`src/main/terminal/index.ts` 查找 Bash 的顺序是：

1. `%ProgramFiles%\Git\bin\bash.exe`
2. `%ProgramFiles(x86)%\Git\bin\bash.exe`
3. `%LOCALAPPDATA%\Programs\Git\bin\bash.exe`
4. 随包 MinGit
5. 应用内安装的 MinGit

它**不会扫描 PATH**。所以即使电脑里安装了 Git Bash，只要不在上述位置，测试仍会报“未找到 Git Bash”。本机 Git 在 `F:\Base\Git`，不在默认位置，因此全量测试里依赖 Bash 的用例会失败；应用正式运行时应使用随包 MinGit，或在终端页一键安装 Dela 运行时。若要跑这些测试，应把 Git for Windows 安装到默认 `Program Files`，或使用应用内 MinGit；不要依赖修改 PATH。

## 5. GitHub / 网上位置

| 项目           | 地址                                                         |
| -------------- | ------------------------------------------------------------ |
| 当前 fork      | https://github.com/ZOFFYycch/Dela-Rewind                     |
| 上游官方       | https://github.com/Chang-Yo/Dela                             |
| Release v2.4.0 | https://github.com/ZOFFYycch/Dela-Rewind/releases/tag/v2.4.0 |

当前 git 状态（本地）：

```text
main              6f4c808  上游 2.2.2 镜像
custom            v2.4.0   已 push 的稳定/发布基线
upgrade/2.4.0     2.4.0    2.4.0 升级分支（本地/已并回 custom）
feat/video-archive ee91e6f 2.2.2 自定义功能历史分支
port-2.2.2        6654237  首次拆分课堂视频/更新逻辑的分支
```

Remote 里还有大量从上游继承的分支；不要以为它们都是本项目维护的功能分支。

Release 资产：

- `Dela-Rewind-2.4.0-win-x64.exe`
- `Dela-Rewind-2.4.0-win-x64.exe.blockmap`
- `latest.yml`
- `Dela-Rewind-2.4.0-win-x64.exe.sha256.txt`

Release 标签 `v2.4.0` 指向 `custom` 分支的 2.4.0 合并提交。

## 6. 用户数据与凭据（不要提交、不要外发）

| 路径                            | 内容                              |
| ------------------------------- | --------------------------------- |
| `%APPDATA%\dela\`               | Dela/Dela Rewind 共用用户数据目录 |
| `...\canvas-token.bin`          | Canvas 令牌（加密）               |
| `...\campus-session.bin`        | 校园会话（加密）                  |
| `...\dela.db`                   | 应用数据库                        |
| `...\Local Storage\`            | 渲染层 localStorage               |
| `%USERPROFILE%\Documents\Dela\` | 工作区/资料文件（如使用）         |

- Dela Rewind 与官方 Dela 使用相同 `appId` 和用户数据目录；
- 运行安装程序会被视为对原版的更新，可能覆盖安装；
- 二者不能同时存在/混用安装；不要同时运行两个版本；
- AI 协作者不得读取、打印、复制或提交其中的 token、Cookie、个人数据。

## 7. 测试/正式/调研文件边界

### 应提交到 git

- `src/`、`docs/`、`scripts/`、`assets/`、`package.json`、锁文件、配置文件；
- `CHANGELOG-Rewind.md`、README。

### 不应提交

- `node_modules/`、`out/`、`dist/`、`*.asar`、安装包；
- `%APPDATA%\dela\` 下任何文件；
- `research/` 中的真实课程数据、截图、导出的 CSV、调试输出；
- 根目录的 `deploy-key.json`、SSH 日志、CDP 临时脚本（不是产品）。

## 8. 调研与临时脚本

`Dela\research\` 保存：

- 旧版课堂 LTI 探测记录；
- API 字段和截图；
- 统计 CSV/测试输出；
- 浏览器/CDP 调试脚本。

这些是**证据/工具**，不是产品源码；不要从 `research` 直接向 `src` 复制实现。

`Dela` 根目录的 `cdp-*.js`、`debug-*.js`、`repack-*.js` 是调试脚本，可删除/重建，不属于发布物。

## 9. 当前功能状态（重要）

- 最新源码：`custom` / `upgrade/2.4.0`，2.4.0；
- 最新测试版：`F:\Tool\Download\Dela-Rewind-Test`，2.4.0；
- Release v2.4.0 对应 2.4.0 安装包。

## 10. 给后续 AI 的开工检查清单

1. 先读本文件、`AGENTS.md`、`CONTRIBUTING.md`、`README.md`；
2. 确认当前目录是 `Dela-Rewind`，不是 `Dela-src`；
3. `git status` 必须是干净的；不要覆盖未参与的文件；
4. 不要编辑 `AGENTS.md`（只能由人类维护）；
5. 不要提交/读取凭据、用户数据、安装产物；
6. 修改后至少跑 `pnpm typecheck`、相关测试、`pnpm build`；
7. 打包前确认代理开启，否则 `electron-builder` 可能卡在下载；
8. 测试版先复制到 `Dela-Rewind-Test`，不要直接覆盖正在使用的安装版；
9. push、创建 Release、修改 `appId`、迁移用户数据必须得到人类明确确认；
10. 路径/分支/Release 状态变化后，更新本文件。
