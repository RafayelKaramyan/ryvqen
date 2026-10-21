/// <reference lib="webworker" />
import { makeSnapshot, makeTick } from './fixtures';
import type { FeedCommand } from './model';
let sequence = 0;
let timer: ReturnType<typeof setInterval> | undefined;
function start() {
  clearInterval(timer);
  timer = setInterval(() => {
    sequence += 1;
    self.postMessage(makeTick(sequence));
  }, 1800);
}
self.onmessage = (event: MessageEvent<FeedCommand>) => {
  switch (event.data.type) {
    case 'pause':
      clearInterval(timer);
      break;
    case 'resume':
      self.postMessage(makeSnapshot(sequence));
      start();
      break;
    case 'snapshot':
      self.postMessage(makeSnapshot(sequence));
      break;
    case 'duplicate':
      if (sequence === 0) {
        sequence++;
        self.postMessage(makeTick(sequence));
      }
      self.postMessage(makeTick(sequence));
      break;
    case 'late':
      self.postMessage(makeTick(Math.max(1, sequence - 1)));
      break;
    case 'gap':
      sequence += 3;
      self.postMessage(makeTick(sequence));
      break;
  }
};
self.postMessage(makeSnapshot(sequence));
start();
