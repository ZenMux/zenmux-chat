# pk

多模型 PK（对比）模式：同一提示词同时发送给多个模型，并排展示结果。

## Slot

- `toolbar:right` — PK 开关按钮（开启后显示 `PK +` 追加窗口，`×` 移除当前窗口）

## State Slice

- `pk` — `{ enabled: boolean; windowIds: string[] }`
- `pk:input` — `{ text: string }`（PK 模式下的共享输入文本）

## Service

- `inputSync: InputSyncService` — 多窗口输入同步服务，供 input-composer 插件感知 PK 模式并统一管理输入、发送、中断

## 行为

- 开启 PK：当前窗口保留（带窗口级 modelId + protocolId），新建窗口自动选择不同模型并使用其 defaultProtocol，继承全局 requestConfig / billing / 附件
- 追加窗口：`PK +` 按钮新建窗口，自动选择未使用的模型，协议设为该模型的 defaultProtocol
- 移除窗口：剩余 ≤1 个窗口时自动退出 PK 模式，模型和协议同步回全局状态
- 发送消息：通过 orchestrator.broadcast 广播到所有 PK 窗口
