---
name: loop-budget
description: 在每次循环运行前后检查 Token 预算和运行日志花费。超预算或无待办工作时强制提前退出。
---

# Loop Budget Guard（循环预算守卫）

在**每次**循环迭代的**开始**和**结束**时运行。

## 运行开始

1. 读取 `loop-budget.md` 获取每日上限和 kill-switch 标志。
2. 读取 `loop-run-log.md` 最近 24 小时的条目。
3. 汇总当日该模式的 `tokens_estimate`。
4. 如果花费 ≥ 模式每日上限的 80% → **仅报告模式**（禁止子代理、禁止自动修复）。
5. 如果花费 ≥ 100% 或 `loop-pause-all` 已设置 → **立即退出**，在 STATE.md 中写一行说明。
6. 如果观察列表/状态中无可操作项 → **在 <5k token 内退出**（不创建子代理）。

## 运行结束

向 `loop-run-log.md` 追加一条 JSON 对象：

```json
{
  "run_id": "<ISO8601>",
  "pattern": "<pattern-id>",
  "duration_s": <number>,
  "items_found": <number>,
  "actions_taken": <number>,
  "escalations": <number>,
  "tokens_estimate": <number>,
  "outcome": "no-op | report-only | fix-proposed | escalated"
}
```

## 规则

- 绝不超出 `loop-budget.md` 中 `max sub-agent spawns/run` 的限制。
- 高频模式（CI Sweeper、PR Babysitter）**必须**在无待办时提前退出。
- 自我节流时，在 `loop-budget.md` 的 **Alerts This Period** 下追加一行。
