import { useEffect } from 'react';

import { GameCanvas } from './components/GameCanvas.tsx';
import { postMessage } from './vscodeApi.ts';

export function App() {
  // Tell the extension we're ready
  useEffect(() => {
    postMessage({ type: 'webviewReady' });
  }, []);

  // Listen for messages from the extension
  useEffect(() => {
    function onMessage(event: MessageEvent<{ type: string } & Record<string, unknown>>) {
      const { type, ...payload } = event.data;
      console.log('[Pixel Mav] received:', type, payload);
      // Phase 3+: dispatch into ECS / store
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  return <GameCanvas />;
}
