import { useSyncExternalStore } from 'react';

import {
  editor,
  subscribe,
  getVersion,
} from '../editor/editorState.ts';
import { toggleEditor } from '../editor/editorActions.ts';
import { serializeLayout } from '../editor/layoutSerializer.ts';
import { postMessage } from '../vscodeApi.ts';

interface BottomToolbarProps {
  settingsOpen: boolean;
  onToggleSettings: () => void;
}

export function BottomToolbar({ settingsOpen, onToggleSettings }: BottomToolbarProps) {
  useSyncExternalStore(subscribe, getVersion);

  const handleExportLayout = () => {
    const json = serializeLayout();
    postMessage({ type: 'saveLayout', json });
  };

  return (
    <div style={barStyle}>
      {/* Left group */}
      <div style={groupStyle}>
        <button
          onClick={toggleEditor}
          style={editor.active ? btnActiveStyle : btnStyle}
          title="Toggle layout editor (E)"
        >
          <LayoutIcon />
          <span>Layout</span>
        </button>
        {editor.active && (
          <button onClick={handleExportLayout} style={exportBtnStyle} title="Export layout to file">
            <ExportIcon />
          </button>
        )}
      </div>

      {/* Right group */}
      <div style={groupStyle}>
        <button
          onClick={onToggleSettings}
          style={settingsOpen ? btnActiveStyle : btnStyle}
          title="Settings"
        >
          <SettingsIcon />
          <span>Settings</span>
        </button>
      </div>
    </div>
  );
}

// ── Inline SVG icons (pixel-art styled, 14×14) ─────────────

function LayoutIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={iconStyle}>
      <rect x="1" y="1" width="12" height="12" rx="1" stroke="currentColor" strokeWidth="1.2" />
      <line x1="1" y1="5" x2="13" y2="5" stroke="currentColor" strokeWidth="1.2" />
      <line x1="5" y1="5" x2="5" y2="13" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={iconStyle}>
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.2" />
      <path
        d="M7 1v1.5M7 11.5V13M1 7h1.5M11.5 7H13M2.8 2.8l1.1 1.1M10.1 10.1l1.1 1.1M11.2 2.8l-1.1 1.1M3.9 10.1l-1.1 1.1"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExportIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={iconStyle}>
      <path d="M7 2v7M4 6l3 3 3-3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M2 10v2h10v-2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Styles ──────────────────────────────────────────────────

const iconStyle: React.CSSProperties = {
  display: 'block',
  flexShrink: 0,
};

const barStyle: React.CSSProperties = {
  position: 'absolute',
  bottom: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '3px 6px',
  background: 'rgba(30, 30, 30, 0.92)',
  borderTop: '1px solid #444',
  zIndex: 10,
};

const groupStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const btnBase: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  background: 'rgba(60, 60, 60, 0.9)',
  color: '#ccc',
  border: '1px solid #555',
  borderRadius: 3,
  padding: '3px 8px',
  cursor: 'pointer',
  fontSize: 11,
  lineHeight: '16px',
};

const btnStyle: React.CSSProperties = { ...btnBase };

const btnActiveStyle: React.CSSProperties = {
  ...btnBase,
  background: '#264f78',
  borderColor: '#007acc',
  color: '#fff',
};

const exportBtnStyle: React.CSSProperties = {
  ...btnBase,
  padding: '3px 5px',
};
