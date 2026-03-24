<div align="center">

# @ant-design/cli

[![CI](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/ant-design/ant-design-cli/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![npm downloads](https://img.shields.io/npm/dm/@ant-design/cli)](https://www.npmjs.com/package/@ant-design/cli)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](./LICENSE)

**查询 Ant Design 组件知识、分析项目中 antd 用法的命令行工具。**

为 Code Agent（Claude Code、Cursor、Copilot、Codex、Gemini CLI）而生 — 结构化输出，完全离线，零配置。

[English](./README.md) · [中文](./README.zh-CN.md)

</div>

---

## 功能特性

- **Agent 就绪** — 所有命令支持 `--format json`，输出结构化数据与标准错误码
- **完全离线** — v4 / v5 / v6 的 Props、Token、Demo、Changelog 全部随包安装
- **多版本支持** — 查询任意 antd 版本，支持按小版本快照精确匹配；对比版本间 API 差异
- **深度组件数据** — Props、Design Token、Demo 源码、语义化 `classNames` / `styles` 结构
- **项目分析** — 用量扫描、废弃 API 检查、无障碍检查、`doctor` 诊断
- **迁移指南** — v4→v5 和 v5→v6 迁移清单，区分可自动修复与手动处理

## 安装

```bash
npm install -g @ant-design/cli
```

或安装为 Code Agent 的 [skill](https://github.com/nicepkg/agent-skills)：

```bash
npx skills add ant-design/ant-design-cli
```

## 快速开始

```bash
antd info Button                    # 查询组件 API
antd list                           # 列出所有组件
antd demo Button basic              # 获取 Demo 源码
antd token Button                   # 查询 Design Token
antd changelog 4.24.0 5.0.0 Select  # 对比版本间 API 差异
antd usage ./src                    # 扫描项目 antd 用量
antd doctor                         # 诊断项目配置
antd migrate 4 5                    # v4 → v5 迁移指南
```

## 命令

### 知识查询

#### `antd list`

列出所有组件及其描述与分类。

```bash
antd list
antd list --version 5.0.0
antd list --format json
```

<details>
<summary>示例输出</summary>

```
Component       组件名    Description                                               Since
--------------  -----  -------------------------------------------------------  ------
Button          按钮     To trigger an operation.                                  4.0.0
Table           表格     A table displays rows of data.                            4.0.0
Form            表单     High performance Form component with data scope management. 4.0.0
Select          选择器    Select component to select value from options.            4.0.0
Modal           对话框    Modal dialogs.                                            4.0.0
DatePicker      日期选择框  To select or input a date.                               4.0.0
Input           输入框    A basic widget for getting the user input.                4.0.0
...
```

</details>

---

#### `antd info <Component>`

查询组件 API：Props、类型定义、默认值。使用 `--detail` 获取完整文档，包含描述、版本信息、废弃状态和 FAQ。

```bash
antd info Button
antd info Button --detail
antd info Button --version 4.24.0
antd info Button --format json
```

<details>
<summary>示例输出</summary>

```
Button (按钮) — To trigger an operation.

Property         Type                                                        Default   Since
---------------  ----------------------------------------------------------  --------  ------
autoInsertSpace  boolean                                                     true      5.17.0
block            boolean                                                     false     -
classNames       Record<SemanticDOM, string>                                 -         5.4.0
danger           boolean                                                     false     -
disabled         boolean                                                     false     -
ghost            boolean                                                     false     -
href             string                                                      -         -
htmlType         submit | reset | button                                     button    -
icon             ReactNode                                                   -         -
iconPosition     start | end                                                 start     5.17.0
loading          boolean | { delay: number, icon: ReactNode }                false     -
shape            default | circle | round                                    default   -
size             large | middle | small                                      middle    -
styles           Record<SemanticDOM, CSSProperties>                          -         5.4.0
type             primary | default | dashed | text | link                    default   -
variant          outlined | dashed | solid | filled | text | link            -         5.13.0
onClick          (event: React.MouseEvent) => void                           -         -
```

</details>

---

#### `antd doc <Component>`

输出组件的完整 API 文档（Markdown 格式）。

```bash
antd doc Button                     # 输出完整 Markdown 文档
antd doc Button --format json       # 结构化输出 { name, doc }
antd doc Button --lang zh           # 中文文档
```

---

#### `antd demo <Component> [name]`

获取 Demo 源码。不指定名称时列出所有可用 Demo。

```bash
antd demo Button                    # 列出 Button 的所有 Demo
antd demo Button basic              # 获取指定 Demo 代码
antd demo Button basic --format json
```

---

#### `antd token [component]`

查询 Design Token（仅 v5+）。

```bash
antd token                          # 列出所有全局 Token
antd token Button                   # 组件级 Token
antd token --format json
```

<details>
<summary>示例输出</summary>

```
Button Component Tokens:

Token                     Type    Default
------------------------  ------  -------
contentFontSize           number
contentFontSizeLG         number
contentFontSizeSM         number
dangerColor               string
dangerShadow              string
defaultActiveBg           string
defaultActiveBorderColor  string
defaultActiveColor        string
defaultBg                 string
...
```

</details>

---

#### `antd semantic <Component>`

查询语义化定制结构 — 可用的 `classNames` 和 `styles` 键名。

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

#### `antd changelog [v1] [v2] [component]`

查询 Changelog 条目、版本范围，或对比两个版本间的 API 差异。

```bash
antd changelog 5.22.0               # 单个版本 Changelog
antd changelog 5.21.0..5.24.0       # 版本范围（两端均包含）
antd changelog 4.24.0 5.0.0         # 对比两个版本的所有 API 变更
antd changelog 4.24.0 5.0.0 Select  # 只对比 Select 的 API
antd changelog --format json
```

---

### 项目分析

#### `antd doctor`

诊断项目级配置问题：React 兼容性、重复安装、主题配置、babel 插件、CSS-in-JS 配置。

```bash
antd doctor
antd doctor --format json
```

---

#### `antd usage [dir]`

扫描项目中 antd 组件/API 的使用统计。检测导入、子组件（`Form.Item`）和非组件导出（`message`、`theme`）。

```bash
antd usage                          # 扫描当前目录
antd usage ./src                    # 扫描指定目录
antd usage -f Button                # 过滤特定组件
antd usage --format json
```

---

#### `antd lint [file/dir]`

检查 antd 用法最佳实践。ESLint 的补充，聚焦 antd 特有的知识。

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

版本迁移指南，区分可自动修复与手动处理。

```bash
antd migrate 4 5                    # 完整迁移清单
antd migrate 4 5 --component Select # 指定组件迁移
antd migrate 4 5 --apply ./src      # 输出 Agent 迁移提示
antd migrate 4 5 --format json
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

### 问题反馈

#### `antd bug`

向 `ant-design/ant-design` 报告 Bug，自动收集环境信息。

```bash
antd bug --title "DatePicker 选择日期时崩溃"
antd bug --title "..." --steps "1. 点击按钮" --expected "正常工作" --actual "崩溃"
antd bug --title "..." --reproduction "https://codesandbox.io/s/xxx"
antd bug --title "..." --submit          # 通过 gh CLI 直接提交
```

#### `antd bug-cli`

向 `ant-design/ant-design-cli` 报告 Bug。

```bash
antd bug-cli --title "antd info 在 v4 组件上崩溃"
antd bug-cli --title "..." --submit
```

---

## 全局参数

| 参数 | 说明 | 默认值 |
|---|---|---|
| `--format json\|text\|markdown` | 输出格式 | `text` |
| `--version <v>` | 目标 antd 版本（如 `5.20.0`） | 自动检测 |
| `--lang en\|zh` | 输出语言 | `en` |
| `--detail` | 完整信息输出 | `false` |
| `-V, --cli-version` | 打印 CLI 版本号 | — |

## 与 Code Agent 配合使用

CLI 内置 [skill 文件](./skills/antd/SKILL.md)，让 Code Agent 知道在何时、如何使用每条命令。一条命令安装：

```bash
npx skills add ant-design/ant-design-cli
```

支持 Claude Code、Cursor、Codex、Gemini CLI 等所有兼容 [skills](https://github.com/nicepkg/agent-skills) 协议的 Agent。

## 开源协议

[MIT](./LICENSE) © Ant Design
