# chat-memory

聊天记忆管理：控制每次请求携带的历史消息数量，支持 New Session 分隔会话。

## Slot

- `input:actions` — Chat memory 滑块按钮（控制携带消息条数）
- `input:actions` — New Session 按钮（插入会话分隔线）

## State Slice

`chatMemory` — `{ maxMessages: number }`

- `maxMessages` 为 100 时表示携带全部消息

## 消息渲染器

- `new-session-divider` — 将 `__NEW_SESSION__` 标记消息渲染为 `—— New Session ——` 分隔线

## 请求钩子

- `onBuildRequest` — 先按最后一条 New Session 分隔符截断（分隔符之前的消息不发送），再按 `maxMessages` 截取最近 N 条
