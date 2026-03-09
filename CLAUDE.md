# Chat Kernel + Plugin Architecture

## Project Overview

A plugin-based chat UI kernel built with React 19 + Vercel AI SDK. The microkernel architecture separates a stable core ("kernel") from extensible business logic ("plugins").

## Tech Stack

- **Runtime**: React 19, Vercel AI SDK (`ai` + `@ai-sdk/openai`)
- **Build**: Vite 7, TypeScript 5 (strict mode)
- **Package Manager**: tnpm (not npm)

## Project Structure

```
src/
  app/App.tsx                          # Entry: kernel init, plugin registration
  main.tsx                             # React mount
  kernel/
    core/
      types.ts                         # All core interfaces & types
      ChatKernel.ts                    # Kernel factory (assembles subsystems)
      PluginManager.ts                 # Plugin registration & lifecycle
      ServiceContainer.ts              # Lazy-singleton IoC container
    ui/
      KernelProvider.tsx               # React context, hooks, SlotRenderer
      UISlotRegistry.ts                # Observable slot registry (cached)
      ChatPanel.tsx                    # Chat UI (messages, input, errors)
      Toolbar.tsx                      # Top toolbar shell
      SettingsPanel.tsx                # Right sidebar shell
    request/
      AIRequestPipeline.ts            # streamText pipeline with plugin hooks
      RequestLifecycleRegistry.ts     # Hook registry
    state/
      RuntimeState.ts                 # Slice-based reactive state manager
    orchestrator/
      ChatOrchestrator.ts             # Multi-window chat orchestration
  plugins/
    billing/                           # Billing mode, usage tracking, headers
    request-config/                    # Temperature, topP, maxTokens, system prompt
```

## Architecture

### Plugin System

Plugins implement `ChatPlugin { id, setup(ctx), dispose? }`. The `PluginContext` provides:
- `ctx.ui` — Register React components into named UI slots
- `ctx.requests` — Register request lifecycle hooks
- `ctx.state` — Register and manage state slices
- `ctx.services` — Access shared services

### UI Slots

Named slots: `toolbar:left`, `toolbar:right`, `settings:panel`, `panel:header`, `panel:footer`, `message:above`, `message:below`, `input:actions`

### Request Pipeline

`onBuildRequest → onBeforeSend → streamText (fullStream) → onStreamChunk → onAfterResponse / onRequestError`

### Key Types

- `AICallParams` — Derived from `Partial<Omit<Parameters<typeof streamText>[0], 'messages' | 'abortSignal'>>`, not hand-written
- `ChatError` — Structured error with `message`, `statusCode`, `errorType`, `requestId`, `responseBody`, `timestamp`
- `ParamEntry<T>` — `{ enabled: boolean, value: T }` pattern for optional parameter injection

## Conventions

- **Factory functions over classes** — All subsystems use factory functions returning interfaces
- **tnpm** for package management, not npm
- **Path aliases**: `@kernel/*` → `src/kernel/*`, `@plugins/*` → `src/plugins/*`
- **Error handling**: Pipeline uses `fullStream` (not `textStream`) to capture error events from AI SDK; orchestrator extracts structured error info via cause-chain walking
- **UI slot caching**: UISlotRegistry caches `getItems()` results to prevent `useSyncExternalStore` infinite re-render loops
- **State management**: Custom slice-based system in RuntimeState.ts (zustand is a dependency but unused)
- Comments and variable names may be in Chinese (中文)

## Commands

```bash
tnpm run dev      # Start dev server
tnpm run build    # Type-check + production build
tnpm run preview  # Preview production build
```
