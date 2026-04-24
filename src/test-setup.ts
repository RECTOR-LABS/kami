import '@testing-library/jest-dom/vitest';
import { Readable } from 'node:stream';

// Vite's nodePolyfills replaces `node:stream` with the `readable-stream` package
// in the bundled test runtime. `readable-stream` does not expose
// `Readable.fromWeb` (a Node 17+ native). Provide a minimal shim so handlers
// that pipe a Web ReadableStream into res (api/chat.ts) can be exercised.
type ReadableCtor = typeof Readable & {
  fromWeb?: (stream: ReadableStream<Uint8Array>) => Readable;
};
const R = Readable as ReadableCtor;
if (!R.fromWeb) {
  R.fromWeb = function fromWeb(webStream: ReadableStream<Uint8Array>) {
    const reader = webStream.getReader();
    return new Readable({
      async read() {
        try {
          const { value, done } = await reader.read();
          if (done) this.push(null);
          else this.push(Buffer.from(value));
        } catch (err) {
          this.destroy(err instanceof Error ? err : new Error(String(err)));
        }
      },
    });
  };
}
