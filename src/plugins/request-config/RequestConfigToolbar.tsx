import { useState } from 'react';
import { createPortal } from 'react-dom';
import { RequestConfigPanel } from './RequestConfigPanel';

export function RequestConfigToolbar({ windowId }: { windowId?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 border border-neutral-300 rounded bg-white text-[13px] cursor-pointer flex items-center gap-1"
      >
        <SettingsIcon />
        参数配置
      </button>
      {open && createPortal(
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center z-[1000]"
          onClick={(e) => { if (e.target === e.currentTarget) setOpen(false); }}
        >
          <div className="w-[420px] max-h-[80vh] bg-white rounded-xl shadow-[0_8px_30px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-[18px] py-3.5 border-b border-neutral-300">
              <span className="text-[15px] font-semibold">参数配置</span>
              <button
                onClick={() => setOpen(false)}
                className="border-none bg-transparent text-lg cursor-pointer text-neutral-400 px-0.5 leading-none"
              >&times;</button>
            </div>
            {/* Body */}
            <div className="p-[18px] overflow-y-auto">
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
