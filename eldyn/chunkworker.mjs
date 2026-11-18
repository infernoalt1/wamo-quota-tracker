// Builds ground chunks off the main thread.
import { chunkPixels } from './terrain.mjs';

self.onmessage = (e) => {
  const { cx, cy, size, res } = e.data;
  const px = chunkPixels(cx, cy, size, res);
  self.postMessage({ cx, cy, px }, [px.buffer]);
};
