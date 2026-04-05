import { useEffect, useSyncExternalStore } from 'react';

import { serializeLayout } from '../editor/layoutSerializer.ts';
import { postMessage } from '../vscodeApi.ts';
import {
  settings,
  subscribeSettings,
  getSettingsVersion,
  setSoundEnabled,
  setVolume,
} from '../settingsStore.ts';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  useSyncExternalStore(subscribeSettings, getSettingsVersion);

  // Esc to close
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [onClose]);

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
        {/* Header */}
        <div style={headerStyle}>
          <span style={{ fontWeight: 600 }}>Settings</span>
          <button onClick={onClose} style={closeBtnStyle} title="Close (Esc)">×</button>
        </div>

        {/* Layout section */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Layout</div>
          <div style={rowStyle}>
            <button onClick={handleExport} style={actionBtnStyle}>Export</button>
            <button onClick={handleImport} style={actionBtnStyle}>Import</button>
          </div>
        </div>

        {/* Sound section */}
        <div style={sectionStyle}>
          <div style={sectionTitleStyle}>Sound</div>
          <div style={rowStyle}>
            <label style={toggleLabelStyle}>
              <span>Enabled</span>
              <button
                onClick={() => setSoundEnabled(!settings.soundEnabled)}
                style={settings.soundEnabled ? toggleOnStyle : toggleOffStyle}
                title={settings.soundEnabled ? 'Mute sounds' : 'Enable sounds'}
              >
                <span style={{
                  ...toggleKnobStyle,
                  transform: settings.soundEnabled ? 'translateX(14px)' : 'translateX(0)',
                }} />
              </button>
            </label>
          </div>
          <div style={{ ...rowStyle, marginTop: 8, alignItems: 'center' }}>
            <span style={sliderLabelStyle}>Volume</span>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(settings.volume * 100)}
              onChange={e => setVolume(Number(e.target.value) / 100)}
              disabled={!settings.soundEnabled}
              style={sliderStyle}
            />
            <span style={sliderValueStyle}>
              {Math.round(settings.volume * 100)}%
            </span>
          </div>
        </div>

        {/* Footer hint */}
        <div style={footerStyle}>
          Press <kbd style={kbdStyle}>Esc</kbd> to close
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
  width: 280,
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
  flex: 1,
  textAlign: 'center',
};

const toggleLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  width: '100%',
  color: '#ccc',
  fontSize: 12,
};

const toggleBase: React.CSSProperties = {
  position: 'relative',
  width: 32,
  height: 18,
  borderRadius: 9,
  border: 'none',
  cursor: 'pointer',
  padding: 0,
  transition: 'background 0.15s',
};

const toggleOnStyle: React.CSSProperties = {
  ...toggleBase,
  background: '#007acc',
};

const toggleOffStyle: React.CSSProperties = {
  ...toggleBase,
  background: '#555',
};

const toggleKnobStyle: React.CSSProperties = {
  display: 'block',
  width: 14,
  height: 14,
  borderRadius: '50%',
  background: '#fff',
  position: 'absolute',
  top: 2,
  left: 2,
  transition: 'transform 0.15s',
};

const sliderLabelStyle: React.CSSProperties = {
  color: '#ccc',
  fontSize: 12,
  flexShrink: 0,
  width: 48,
};

const sliderStyle: React.CSSProperties = {
  flex: 1,
  height: 4,
  accentColor: '#007acc',
  cursor: 'pointer',
};

const sliderValueStyle: React.CSSProperties = {
  color: '#888',
  fontSize: 11,
  width: 32,
  textAlign: 'right',
  flexShrink: 0,
};

const footerStyle: React.CSSProperties = {
  padding: '6px 12px',
  color: '#666',
  fontSize: 10,
  textAlign: 'center',
};

const kbdStyle: React.CSSProperties = {
  background: '#333',
  border: '1px solid #555',
  borderRadius: 2,
  padding: '0 3px',
  fontSize: 10,
  color: '#aaa',
};
