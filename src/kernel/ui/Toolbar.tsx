import { SlotRenderer } from './KernelProvider';

export function Toolbar({ windowId }: { windowId?: string }) {
  return (
    <div className="kernel-toolbar" style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '8px 16px',
      borderBottom: '1px solid #e0e0e0',
    }}>
      <div className="kernel-toolbar__left" style={{ display: 'flex', gap: 8 }}>
        <SlotRenderer slot="toolbar:left" windowId={windowId} />
      </div>
      <div className="kernel-toolbar__right" style={{ display: 'flex', gap: 8 }}>
        <SlotRenderer slot="toolbar:right" windowId={windowId} />
      </div>
    </div>
  );
}
