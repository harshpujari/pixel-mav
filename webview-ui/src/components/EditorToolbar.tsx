import { useSyncExternalStore } from 'react';

import { CATALOG } from '../environment/furnitureCatalog.ts';
import {
  editor,
  undoStack,
  redoStack,
  subscribe,
  getVersion,
} from '../editor/editorState.ts';
import {
  toggleEditor,
  setTool,
  setFurnitureType,
  rotateGhost,
  undo,
  redo,
} from '../editor/editorActions.ts';
import { serializeLayout } from '../editor/layoutSerializer.ts';
import { postMessage } from '../vscodeApi.ts';
import type { EditorTool } from '../editor/editorState.ts';

// ── Tool definitions ────────────────────────────────────────

const TOOLS: Array<{ id: EditorTool; label: string }> = [
  { id: 'select',     label: 'Select' },
  { id: 'floor',      label: 'Floor' },
  { id: 'wall',       label: 'Wall' },
  { id: 'sunny',      label: 'Sunny' },
  { id: 'erase',      label: 'Erase' },
  { id: 'furniture',  label: 'Furniture' },
  { id: 'eyedropper', label: 'Pick' },
];

// ── Component ───────────────────────────────────────────────

export function EditorToolbar() {
  useSyncExternalStore(subscribe, getVersion);

  const saveLayout = () => {
    const json = serializeLayout();
    postMessage({ type: 'saveLayout', json });
  };

  if (!editor.active) {
    return (
      <div style={toggleContainerStyle}>
        <button onClick={toggleEditor} style={toggleBtnStyle} title="Toggle editor (E)">
          Edit
        </button>
      </div>
    );
  }

  return (
    <div style={toolbarStyle}>
      <button onClick={toggleEditor} style={closeBtnStyle} title="Close editor (Esc)">
        X
      </button>
      <span style={sepStyle} />

      {TOOLS.map(t => (
        <button
          key={t.id}
          onClick={() => setTool(t.id)}
          style={editor.tool === t.id ? btnActiveStyle : btnStyle}
          title={t.label}
        >
          {t.label}
        </button>
      ))}

      <span style={sepStyle} />
      <button
        onClick={undo}
        disabled={undoStack.length === 0}
        style={undoStack.length === 0 ? btnDisabledStyle : btnStyle}
        title="Undo (Ctrl+Z)"
      >
        Undo
      </button>
      <button
        onClick={redo}
        disabled={redoStack.length === 0}
        style={redoStack.length === 0 ? btnDisabledStyle : btnStyle}
        title="Redo (Ctrl+Y)"
      >
        Redo
      </button>

      <span style={sepStyle} />
      <button onClick={saveLayout} style={saveBtnStyle} title="Save layout">
        Save
      </button>

      {editor.tool === 'furniture' && (
        <>
          <span style={sepStyle} />
          {[...CATALOG.keys()].map(type => (
            <button
              key={type}
              onClick={() => setFurnitureType(type)}
              style={editor.furnitureType === type ? btnActiveStyle : btnStyle}
            >
              {type.replace('_', ' ')}
            </button>
          ))}
          <button onClick={rotateGhost} style={btnStyle} title="Rotate (R)">
            Rot
          </button>
        </>
      )}
    </div>
  );
}

// ── Styles ──────────────────────────────────────────────────

const toggleContainerStyle: React.CSSProperties = {
  position: 'absolute',
  top: 4,
  right: 4,
  zIndex: 10,
};

const toggleBtnStyle: React.CSSProperties = {
  background: 'rgba(60, 60, 60, 0.8)',
  color: '#ccc',
  border: '1px solid #555',
  borderRadius: 3,
  padding: '2px 8px',
  cursor: 'pointer',
  fontSize: 11,
};

const toolbarStyle: React.CSSProperties = {
  position: 'absolute',
  top: 0,
  left: 0,
  right: 0,
  display: 'flex',
  alignItems: 'center',
  gap: 3,
  padding: '3px 6px',
  background: 'rgba(30, 30, 30, 0.92)',
  borderBottom: '1px solid #444',
  zIndex: 10,
  flexWrap: 'wrap',
};

const btnBase: React.CSSProperties = {
  background: 'rgba(60, 60, 60, 0.9)',
  color: '#ccc',
  border: '1px solid #555',
  borderRadius: 3,
  padding: '2px 6px',
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

const btnDisabledStyle: React.CSSProperties = {
  ...btnBase,
  color: '#666',
  cursor: 'default',
};

const closeBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: '#5a2020',
  borderColor: '#cc4444',
  color: '#faa',
};

const saveBtnStyle: React.CSSProperties = {
  ...btnBase,
  background: '#1a4a1a',
  borderColor: '#44aa44',
  color: '#afa',
};

const sepStyle: React.CSSProperties = {
  width: 1,
  height: 16,
  background: '#444',
  margin: '0 2px',
};
