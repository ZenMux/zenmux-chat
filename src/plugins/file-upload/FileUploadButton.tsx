import { useRef, useMemo } from 'react';
import { Dropdown } from 'antd';
import { PlusOutlined, FileImageOutlined, FileOutlined } from '@ant-design/icons';
import type { MenuProps } from 'antd';
import type { MessageAttachment } from '../../kernel/core/types';
import type { ModelInfoService } from '../model-selector';
import type { InputSyncService } from '../input-composer/InputComposerPlugin';
import { useKernel, useOrchestratorState, usePluginState } from '../../kernel/ui/KernelProvider';

/** 获取当前模型能力（modelInfo service 不存在时默认全部允许） */
function getModelCapabilities(services: { has(name: string): boolean; get<T>(name: string): T }) {
  if (!services.has('modelInfo')) {
    return { supportsImages: true, supportsFiles: true };
  }
  return services.get<ModelInfoService>('modelInfo').getCapabilities();
}

export function FileUploadButton({ windowId }: { windowId?: string }) {
  const kernel = useKernel();
  const orchState = useOrchestratorState();
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 优先使用传入的 windowId（PK 模式下每个面板独立），否则使用全局 activeWindowId
  const targetWindowId = windowId ?? orchState.activeWindowId;
  const targetWindow = targetWindowId ? orchState.windows[targetWindowId] : undefined;
  const isStreaming = targetWindow?.status === 'streaming';

  // 订阅 modelSelector slice 以响应模型切换（slice 不存在时忽略）
  let capabilities = { supportsImages: true, supportsFiles: true };
  try {
    usePluginState('modelSelector');
    capabilities = getModelCapabilities(kernel.services);
  } catch {
    // modelSelector slice 未注册，使用默认值
  }

  // PK 模式下获取所有窗口 ID，用于同步附件
  const syncService = kernel.services.has('inputSync')
    ? kernel.services.get<InputSyncService>('inputSync')
    : null;
  const isPKSync = syncService?.isActive() ?? false;

  const addFiles = (files: FileList) => {
    if (!targetWindowId) return;
    // PK 模式下附件同步到所有窗口，否则只添加到当前窗口
    const targetIds = isPKSync ? syncService!.getWindowIds() : [targetWindowId];
    Array.from(files).forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = (reader.result as string).split(',')[1];
        for (const wid of targetIds) {
          const attachment: MessageAttachment = {
            id: crypto.randomUUID(),
            name: file.name,
            mediaType: file.type || 'application/octet-stream',
            data: base64,
          };
          kernel.orchestrator.addPendingAttachment(wid, attachment);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(e.target.files);
    e.target.value = '';
  };

  const menuItems: MenuProps['items'] = useMemo(() => [
    {
      key: 'image',
      icon: <FileImageOutlined />,
      label: '上传图片',
      disabled: !capabilities.supportsImages,
      title: capabilities.supportsImages ? undefined : '当前模型不支持图片',
      onClick: () => imageInputRef.current?.click(),
    },
    {
      key: 'file',
      icon: <FileOutlined />,
      label: '上传文件',
      disabled: !capabilities.supportsFiles,
      title: capabilities.supportsFiles ? undefined : '当前模型不支持文件',
      onClick: () => fileInputRef.current?.click(),
    },
  ], [capabilities.supportsImages, capabilities.supportsFiles]);

  return (
    <>
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.txt,.md,.csv,.json,.xml"
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      <Dropdown
        menu={{ items: menuItems }}
        trigger={['click']}
        disabled={isStreaming}
        placement="topLeft"
      >
        <button
          disabled={isStreaming}
          title="上传文件"
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            border: 'none',
            backgroundColor: 'transparent',
            color: isStreaming ? '#ccc' : '#666',
            cursor: isStreaming ? 'default' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
            transition: 'color 0.15s',
          }}
        >
          <PlusOutlined style={{ fontSize: 16 }} />
        </button>
      </Dropdown>
    </>
  );
}
