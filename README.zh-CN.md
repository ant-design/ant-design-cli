# @ant-design/cli

<div align="center">

[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**用于查询 antd 组件知识、分析项目中 antd 用法的命令行工具。**

专为 Code Agent（Claude Code、Cursor、Copilot 等）设计，通过 Shell 调用并解析结构化输出。

[English](./README.md) · [中文](./README.zh-CN.md)

</div>

---

## ✨ 功能特性

| 功能 | 说明 |
|---|---|
| 🤖 **Agent 就绪** | 每条命令均支持 `--format json`，输出结构化数据与标准错误码，为 Claude Code、Cursor、Copilot 等工具调用而生 |
| 📦 **完全离线** | v4/v5/v6 的 Props、Token、Demo、Changelog 全部随包安装，无需网络，零延迟 |
| 🔀 **多版本支持** | 查询任意 antd 版本；对比两个版本间的 API 变更；浏览按类型分类的 Changelog（新功能 / 修复 / 破坏性变更 / 废弃） |
| 🧠 **深度组件数据** | Props 类型与默认值；Design Token；可运行的 Demo 源码；`classNames` / `styles` 语义结构——均可从终端直接查询 |
| 🔍 **项目分析** | 扫描组件用量统计；检查废弃 Props、无障碍缺陷和性能问题；`doctor` 诊断 React 兼容性、重复安装及配置错误 |
| 🚚 **迁移指南** | 详细的 v4→v5 和 v5→v6 迁移清单，区分可自动修复与手动处理；`--apply` 生成供 Agent 执行的结构化迁移提示 |

## 📦 安装

```bash
# npm
npm install -g @ant-design/cli

# pnpm
pnpm add -g @ant-design/cli

# bun
bun add -g @ant-design/cli

# utoo
utoo install @ant-design/cli
```

## 🚀 快速开始

```bash
# 查询组件 API
antd info Button

# 列出所有组件
antd list

# 扫描项目中的 antd 用法
antd usage ./src

# 从 v4 迁移到 v5
antd migrate 4 5
```

## 📖 命令

### 知识查询

#### `antd list`

列出所有组件及其简介与分类。

```bash
antd list
antd list --format json
antd list --version 5.0.0
```

<details>
<summary>示例输出</summary>

```
Component  Category      Description
---------  ------------  -----------------------------------------------------------
Button     General       To trigger an operation.
Table      Data Display  A table displays rows of data.
Select     Data Entry    Select component to select value from options.
Input      Data Entry    A basic widget for getting the user input as a text field.
Form       Data Entry    High performance Form component with data scope management.
Modal      Feedback      Modal dialogs.
Space      Layout        Set components spacing.
Flex       Layout        Flex layout container.
Grid       Layout        24 Grids System.
```

</details>

---

#### `antd info <Component>`

查询组件 API：Props、类型定义、默认值。

```bash
antd info Button
antd info Button --detail
antd info Button --version 4.24.0
antd info Button --format json
```

<details>
<summary>示例输出</summary>

```
Button — To trigger an operation.

Property      Type                                              Default
------------  ------------------------------------------------  -------
block         boolean                                           false
classNames    Record<SemanticDOM, string>                       -
color         default | primary | danger                        default
danger        boolean                                           false
disabled      boolean                                           false
ghost         boolean                                           false
href          string                                            -
htmlType      submit | reset | button                           button
icon          ReactNode                                         -
iconPosition  start | end                                       start
loading       boolean | { delay: number }                       false
shape         default | circle | round                          default
size          large | middle | small                            middle
styles        Record<SemanticDOM, CSSProperties>                -
target        string                                            -
type          primary | default | dashed | text | link          default
variant       outlined | dashed | solid | filled | text | link  -
onClick       (event: React.MouseEvent) => void                 -
```

</details>

---

#### `antd demo <Component> [name]`

获取 Demo 源码。

```bash
antd demo Button                    # 列出 Button 的所有 Demo
antd demo Button basic              # 获取指定 Demo 代码
antd demo Button basic --format json
```

---

#### `antd token [component]`

查询 Design Token。

```bash
antd token                          # 列出所有全局 Token
antd token Button                   # 组件级 Token
antd token --version 4.24.0
```

<details>
<summary>示例输出</summary>

```
Button Component Tokens:

Token                Type    Default
-------------------  ------  ----------------
borderColorDisabled  string  #d9d9d9
colorPrimaryHover    string  #4096ff
contentFontSize      number  14
defaultBg            string  #ffffff
defaultBorderColor   string  #d9d9d9
defaultColor         string  rgba(0,0,0,0.88)
paddingBlock         number  4
paddingInline        number  15
```

</details>

---

#### `antd semantic <Component>`

查询语义化定制结构（`classNames` 和 `styles` 的键名）。

```bash
antd semantic Table
antd semantic Table --format json
```

<details>
<summary>示例输出</summary>

```
Table Semantic Structure:
├── header    # 表头区域
├── body      # 表体区域
├── footer    # 表尾区域
├── cell      # 单元格
├── row       # 行
└── wrapper   # 外层容器

Usage:
  <Table classNames={{ header: 'my-header' }} />
  <Table styles={{ header: { background: '#fff' } }} />
```

</details>

---

#### `antd changelog [version]`

查询 Changelog 条目，对比版本间 API 差异。

```bash
antd changelog 5.22.0              # 精确版本
antd changelog 5.21.0..5.24.0     # 版本范围（两端均包含）
antd changelog --format json
```

---

### 项目分析

#### `antd doctor`

诊断项目级配置问题。

```bash
antd doctor
antd doctor --format json
```

---

#### `antd usage [dir]`

扫描项目中 antd 组件/API 的使用情况统计。

```bash
antd usage                          # 扫描当前目录
antd usage ./src                    # 扫描指定目录
antd usage --format json
```

---

#### `antd lint [file/dir]`

按最佳实践检查 antd 用法。

```bash
antd lint ./src
antd lint ./src/pages/home.tsx
antd lint --only deprecated         # 只检查废弃 API
antd lint --only a11y               # 只检查无障碍
antd lint --only performance        # 只检查性能
antd lint --only best-practice      # 只检查最佳实践
antd lint --format json
```

---

#### `antd migrate <from> <to>`

版本迁移指南，支持自动修复输出。

```bash
antd migrate 4 5                          # 完整迁移清单
antd migrate 4 5 --component Select       # 指定组件迁移
antd migrate 4 5 --apply ./src            # 为 ./src 输出 Agent 迁移提示
antd migrate 4 5 --format json            # 结构化输出，适合 Agent 解析
```

<details>
<summary>示例输出</summary>

```
Migration Guide: v4 → v5

  Select:
    🔧 [BREAKING] Prop `dropdownClassName` renamed to `popupClassName`
    🔧 [BREAKING] Prop `dropdownMatchSelectWidth` renamed to `popupMatchSelectWidth`

Total: 2 steps (2 auto-fixable, 0 manual)
```

</details>

---

## ⚙️ 全局参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--format json\|text\|markdown` | 输出格式 | `text` |
| `--version <v>` | 目标 antd 版本 | 自动检测 |
| `--lang en\|zh` | 输出语言 | `en` |
| `--detail` | 完整信息输出 | `false` |
| `-V, --cli-version` | 打印 CLI 版本号 | — |

## 🤖 与 AI Agent 配合使用

将以下内容添加到 `CLAUDE.md`（或其他 Agent 配置文件），让 Code Agent 自动调用 CLI 查询 antd 相关信息：

````markdown
## Ant Design

使用 `@ant-design/cli` 查询 antd 组件知识：

- `antd info <Component>` — 获取 Props、类型和默认值
- `antd demo <Component> [name]` — 获取 Demo 源码
- `antd token <Component>` — 获取 Design Token
- `antd migrate 4 5 --apply ./src` — 生成迁移指令
- `antd lint ./src` — 检查最佳实践违规

程序化解析时优先使用 `--format json`。
````

## 📄 开源协议

[MIT](./LICENSE) © Ant Design
