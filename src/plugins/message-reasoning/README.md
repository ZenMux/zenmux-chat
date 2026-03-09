# message-reasoning

显示模型的思考/推理过程（thinking）。

## Slot

- `message:reasoning` — 在每条消息内容上方，以可折叠的 `<details>` 块展示 reasoning 文本

## 机制

从 orchestrator state 按 `messageId` 查找消息的 `reasoning` 字段，仅在有 reasoning 内容时渲染。支持 Gemini 等模型返回的 `thought: true` 推理片段。
