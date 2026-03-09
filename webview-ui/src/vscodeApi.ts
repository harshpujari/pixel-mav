interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const api: VsCodeApi =
  typeof acquireVsCodeApi !== 'undefined'
    ? acquireVsCodeApi()
    : { postMessage: (msg) => console.log('[pixel-mav stub]', msg) };

export function postMessage(message: { type: string } & Record<string, unknown>): void {
  api.postMessage(message);
}
