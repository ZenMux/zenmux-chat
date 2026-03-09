# billing

计费模式管理与用量追踪。

## Slot

- `toolbar:right` — 显示计费模式切换按钮（subscription / pay-as-you-go）

## State Slice

`billing` — `{ mode: BillingMode; plan: string; usageCount: number }`

## 请求钩子

- `onBeforeSend` — 向请求注入 `x-billing-mode` 和 `x-plan` header
- `onAfterResponse` — 每次请求完成后 `usageCount + 1`
