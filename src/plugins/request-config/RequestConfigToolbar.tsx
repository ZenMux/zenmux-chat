import { useState } from 'react';
import { createPortal } from 'react-dom';
import { RequestConfigPanel } from './RequestConfigPanel';

export function RequestConfigToolbar({ windowId }: { windowId?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="zenmux-config-toolbar__btn"
      >
        <SettingsIcon />
        参数配置
      </button>
      {open && createPortal(
        <div
          className="zenmux-config-modal__overlay"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="zenmux-config-modal__dialog">
            {/* Header */}
            <div className="zenmux-config-modal__header">
              <span className="zenmux-config-modal__title">参数配置</span>
              <button
                onClick={() => setOpen(false)}
                className="zenmux-config-modal__close-btn"
              >&times;</button>
            </div>
            {/* Body */}
            <div className="zenmux-config-modal__body">
              <RequestConfigPanel windowId={windowId} />
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008.7 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8.7a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9c.26.604.852.997 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}
