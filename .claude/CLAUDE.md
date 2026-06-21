# 方思照个人网站 — Agent 集群 v2

> 审计优化版：拆瓶颈、加验证、分级修复、检查点同步

---

## 一、团队角色（6 角色优化版）

### 🏗️ 架构 Agent
- **Agent**: `architect`
- **职责**: 技术选型、文件结构决策、组件树设计
- **输出**: `ARCHITECTURE.md`（只读决策，不分配任务）
- **触发**: 新功能涉及 3+ 文件改动时

### 🎯 规划 Agent
- **Agent**: `planner` + `pm-partner`
- **职责**: 需求拆解 → 任务拆分 → 优先级排序 → 分配执行者
- **输出**: `TASKS.md`（结构化任务列表，含依赖关系）
- **前置**: 架构 Agent 已完成 `ARCHITECTURE.md`

### 🎨 前端 Agent
- **Agent**: `code-explorer` → `frontend-design` skill → 编码
- **职责**: 页面布局、组件编写、响应式样式
- **验证**: 输出后自动 `Playwright 截图 → vision 分析 → 修正循环`（最多 2 轮）
- **并行**: 可与内容 Agent 同时跑

### ✍️ 内容 Agent
- **Agent**: `video-script-generation` / `docx` / `thumbnail-cover-design`
- **职责**: 文案撰写、图片/视频素材生成、格式适配
- **子任务并行**: 文案、图片、视频无依赖时同时生成
- **并行**: 可与前端 Agent 同时跑

### 🔍 审查 Agent
- **Agent**: `code-reviewer` + `security-reviewer`
- **分级修复**:
  | 级别 | 动作 |
  |------|------|
  | LOW / MEDIUM | `code-simplifier` 直接修复 |
  | HIGH | 退回前端 Agent 重做 |
  | CRITICAL | 阻塞部署，通知 PM Agent |
- **并行**: 可与内容审查同时跑

### 🚀 部署 Agent
- **Agent**: `verification-before-completion` skill
- **职责**: Vercel 部署 + 域名管理 + 访问统计 + 线上验证
- **流程**: 本地校验(`node --check`) → 预发布预览 → Playwright 确认 → 生产上线
- **前置**: 审查 Agent 通过（无 CRITICAL/HIGH 遗留）

### 📊 PM Agent
- **Agent**: `pm-partner` + `sprint-master` + `/orient` + `/reconcile-summary`
- **职责**: 进度追踪（从任务板自动读取）、风险预警（规则触发）、团队协调
- **自动化**: Agent 完成任务时调 `finish-task` → PM Agent 自动更新状态
- **预警规则**: 连续 3 次审查不通过 → 告警；任务超预估 150% → 升级

---

## 二、检查点协议（替代实时通信）

所有 Agent 通过以下文件同步状态，不需要实时通道：

```
项目根目录/
├── ARCHITECTURE.md    ← 架构 Agent 写入，其他 Agent 读取
├── TASKS.md           ← 规划 Agent 写入，PM Agent 维护
├── CHANGELOG.md       ← 每次部署自动追加
└── .claude/
    └── decisions/     ← 历史决策记录，避免重复推导
```

**检查点规则**：每个 Agent 在关键节点写入状态文件，下一个 Agent 启动时先读取再执行。

---

## 三、并行执行矩阵

```
架构决策（必须先跑）
    │
    ├──▶ 前端 Agent ──▶ 审查 Agent（代码）
    │         │               │
    │         └── UI验证 ─────┘
    │
    └──▶ 内容 Agent ──▶ 审查 Agent（内容）
              │
              └── 子任务并行（文案∥图片∥视频）

    前端 + 内容 ──▶ 审查通过 ──▶ 部署 Agent ──▶ 上线
                                       │
                                    PM Agent（全程追踪）
```

**并发上限**: 3 组同时（前端 + 内容 + PM 监控）

---

## 四、使用方式

### 日常开发
```
"优化 Hero 动画"            → 架构→前端→审查→部署，自动路由
"写一段关于我的新文案"       → 内容 Agent 直出
"审查最近改动"              → 审查 Agent，分级修复
```

### 批量并行
```
/orient                     # PM Agent 扫项目，列出待办
/dispatch                   # 并行为前端+内容分配任务
/reconcile-summary <id>     # 汇总结果
```

### 全自动
```
/auto-run --through <id>    # PM Agent 自主执行全部任务
```

---

## 五、部署检查清单

- [ ] `node --check assets/js/*.js` 通过
- [ ] Playwright 截图 → vision 分析无布局问题
- [ ] 审查 Agent 无 CRITICAL/HIGH 遗留
- [ ] Vercel 预发布预览正常
- [ ] 生产部署 → `https://fz-deploy.vercel.app` 验证

---

## 六、知识沉淀

每次重要决策写入 `.claude/decisions/`，格式：
```
决策日期: YYYY-MM-DD
问题: 为什么选 X 而不是 Y
结论: 选 X，因为 Z
代价: 未来如果要换 Y，需要改 A/B/C
```
