import { useEffect } from 'react';

import { GameCanvas } from './components/GameCanvas.tsx';
import { dispatchMessage } from './messageDispatcher.ts';
import { postMessage } from './vscodeApi.ts';

export function App() {
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

  return <GameCanvas />;
}
