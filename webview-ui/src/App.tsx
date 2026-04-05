import { useCallback, useEffect, useState } from 'react';

import { EditorToolbar } from './components/EditorToolbar.tsx';
import { BottomToolbar } from './components/BottomToolbar.tsx';
import { SettingsPanel } from './components/SettingsPanel.tsx';
import { GameCanvas } from './components/GameCanvas.tsx';
import { dispatchMessage } from './messageDispatcher.ts';
import { postMessage } from './vscodeApi.ts';

export function App() {
  const [settingsOpen, setSettingsOpen] = useState(false);

  const toggleSettings = useCallback(() => setSettingsOpen(v => !v), []);
  const closeSettings = useCallback(() => setSettingsOpen(false), []);

  // Tell the extension we're ready
  useEffect(() => {
    postMessage({ type: 'webviewReady' });
  }, []);

  // Listen for messages from the extension and dispatch into catStore
  useEffect(() => {
    function onMessage(event: MessageEvent<{ type: string } & Record<string, unknown>>) {
      dispatchMessage(event.data);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <GameCanvas />
      <EditorToolbar />
      <BottomToolbar settingsOpen={settingsOpen} onToggleSettings={toggleSettings} />
      {settingsOpen && <SettingsPanel onClose={closeSettings} />}
    </div>
  );
}
