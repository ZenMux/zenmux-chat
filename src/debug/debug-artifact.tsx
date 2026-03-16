/**
 * 独立调试页面：仅测试 Markdown + rehype artifact 渲染。
 * 不依赖 kernel/plugin 系统。
 * 访问: http://localhost:5173/debug-artifact.html
 */
import { createRoot } from 'react-dom/client';
import { useState, useCallback } from 'react';
import { Markdown } from '@lobehub/ui';
import { preprocessArtifacts, getArtifactData } from '../plugins/artifact/utils';
import rehypeArtifact from '../plugins/artifact/rehypePlugin';
import '../app.css';

// ─── 简化的 ArtifactCard（不依赖 KernelProvider） ────────────────

function ArtifactCard(props: Record<string, any>) {
  // Debug: 打印所有收到的 props
  console.log('[ArtifactCard] ALL props:', props);
  console.log('[ArtifactCard] prop keys:', Object.keys(props));

  // 尝试多种可能的 prop 名
  const id = props.dataArtifactId ?? props['data-artifact-id'] ?? props.identifier;
  const artifact = id ? getArtifactData(id) : undefined;

  if (!artifact) {
    return (
      <div style={{ padding: 12, border: '2px dashed red', borderRadius: 8, margin: '8px 0' }}>
        Artifact not found. id={String(id)}, props={JSON.stringify(Object.keys(props))}
      </div>
    );
  }

  return (
    <div
      style={{
        margin: '8px 0',
        padding: '12px 16px',
        border: '1px solid #e5e5e5',
        borderRadius: 8,
        background: '#fafafa',
        cursor: 'pointer',
      }}
      onClick={() => alert(`Artifact: ${artifact.title}\nType: ${artifact.type}\nContent length: ${artifact.content.length}`)}
    >
      <strong>{artifact.title || 'Artifact'}</strong>
      <span style={{ marginLeft: 8, fontSize: 12, color: '#888' }}>{artifact.type}</span>
      <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
        Content: {artifact.content.slice(0, 100)}...
      </div>
    </div>
  );
}

// ─── Rehype 插件配置 ─────────────────────────────────────────────

const REHYPE_PLUGINS = [rehypeArtifact];
const COMPONENTS: Record<string, React.FC<any>> = {
  antArtifact: ArtifactCard,
};

// ─── 测试用例 ────────────────────────────────────────────────────

const TEST_MARKDOWN = `**好的，我为你创建一个完整可玩的俄罗斯方块游戏。**

<antArtifact identifier="tetris-game" type="text/html" title="俄罗斯方块">
<!DOCTYPE html>
<html lang="zh">
<head><title>Tetris</title></head>
<body>
<h1>Hello Tetris</h1>
<script>console.log("game");</script>
</body>
</html>
</antArtifact>

**这个俄罗斯方块游戏可以直接玩！** 使用方向键控制。`;

// ─── Debug App ───────────────────────────────────────────────────

function DebugApp() {
  const [input, setInput] = useState(TEST_MARKDOWN);
  const [showAst, setShowAst] = useState(false);

  const processed = preprocessArtifacts(input);

  // Debug: 打印各阶段结果到 console
  const logDebug = useCallback(() => {
    console.group('=== Artifact Debug ===');
    console.log('1. Raw input:', input);
    console.log('2. After preprocessArtifacts:', processed);
    console.log('3. Contains <antArtifact:', processed.includes('<antArtifact'));
    console.log('4. Contains </antArtifact>:', processed.includes('</antArtifact>'));
    console.log('5. getArtifactData("tetris-game"):', getArtifactData('tetris-game'));
    console.groupEnd();
  }, [input, processed]);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'sans-serif' }}>
      {/* 左侧：输入 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #ddd' }}>
        <div style={{ padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #ddd', display: 'flex', gap: 8 }}>
          <strong>Raw Markdown Input</strong>
          <button onClick={logDebug} style={{ marginLeft: 'auto', padding: '2px 8px', cursor: 'pointer' }}>
            Log Debug to Console
          </button>
        </div>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          style={{ flex: 1, padding: 12, fontFamily: 'monospace', fontSize: 13, border: 'none', resize: 'none' }}
        />
      </div>

      {/* 中间：预处理结果 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', borderRight: '1px solid #ddd' }}>
        <div style={{ padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #ddd', display: 'flex', gap: 8 }}>
          <strong>After preprocessArtifacts()</strong>
          <button onClick={() => setShowAst(!showAst)} style={{ marginLeft: 'auto', padding: '2px 8px', cursor: 'pointer' }}>
            {showAst ? 'Show Processed' : 'Show Escaped'}
          </button>
        </div>
        <pre style={{ flex: 1, padding: 12, fontSize: 12, overflow: 'auto', margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
          {showAst ? JSON.stringify(processed, null, 2) : processed}
        </pre>
      </div>

      {/* 右侧：渲染结果 */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '8px 12px', background: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
          <strong>Markdown Render Output</strong>
        </div>
        <div style={{ flex: 1, padding: 12, overflow: 'auto' }}>
          <Markdown
            variant="chat"
            components={COMPONENTS}
            rehypePlugins={REHYPE_PLUGINS}
          >
            {processed}
          </Markdown>
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<DebugApp />);
