import { serializeLayout } from '../editor/layoutSerializer.ts';
import { postMessage } from '../vscodeApi.ts';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const handleExport = () => {
    const json = serializeLayout();
    postMessage({ type: 'saveLayout', json });
  };

  const handleImport = () => {
    postMessage({ type: 'importLayout' });
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={panelStyle} onClick={e => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ fontWeight: 600 }}>Settings</span>
          <button onClick={onClose} style={closeBtnStyle} title="Close (Esc)">×</button>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Layout</div>
          <div style={rowStyle}>
            <button onClick={handleExport} style={actionBtnStyle}>Export Layout</button>
            <button onClick={handleImport} style={actionBtnStyle}>Import Layout</button>
          </div>
        </div>

        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Sound</div>
          <div style={rowStyle}>
            <span style={{ color: '#888', fontSize: 11 }}>Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────

const backdropStyle: React.CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0, 0, 0, 0.5)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 20,
};

const panelStyle: React.CSSProperties = {
  background: '#252526',
  border: '1px solid #444',
  borderRadius: 6,
  width: 260,
  padding: 0,
  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 12px',
  borderBottom: '1px solid #444',
  color: '#ddd',
  fontSize: 13,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#888',
  fontSize: 18,
  cursor: 'pointer',
  padding: '0 2px',
  lineHeight: 1,
};

const sectionStyle: React.CSSProperties = {
  padding: '10px 12px',
  borderBottom: '1px solid #333',
};

const sectionTitleStyle: React.CSSProperties = {
  color: '#999',
  fontSize: 10,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  marginBottom: 6,
};

const rowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 6,
  flexWrap: 'wrap',
};

const actionBtnStyle: React.CSSProperties = {
  background: 'rgba(60, 60, 60, 0.9)',
  color: '#ccc',
  border: '1px solid #555',
  borderRadius: 3,
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 11,
};
