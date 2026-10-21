import { WebSocketServer, WebSocket } from 'ws';
import { makeSnapshot, makeTick } from '../src/core/fixtures';
const epoch = `local-${Date.now()}`;
let sequence = 0;
const server = new WebSocketServer({ host: '127.0.0.1', port: 8787, maxPayload: 2048 });
server.on('connection', (client, request) => {
  const origin = request.headers.origin;
  if (origin) {
    try {
      if (!['localhost', '127.0.0.1'].includes(new URL(origin).hostname)) {
        client.close(1008, 'Local development origins only');
        return;
      }
    } catch {
      client.close(1008, 'Invalid origin');
      return;
    }
  }
  client.send(JSON.stringify(makeSnapshot(sequence, epoch)));
  client.on('message', (bytes) => {
    try {
      if ((JSON.parse(bytes.toString()) as { type?: string }).type === 'snapshot')
        client.send(JSON.stringify(makeSnapshot(sequence, epoch)));
    } catch {
      client.close(1007, 'Invalid message');
    }
  });
  client.on('error', () => client.close());
});
const timer = setInterval(() => {
  sequence++;
  const message = JSON.stringify(makeTick(sequence, epoch));
  server.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) client.send(message);
  });
}, 1800);
server.on('listening', () => console.log('RYVQEN local demonstration feed: ws://127.0.0.1:8787'));
function stop() {
  clearInterval(timer);
  server.clients.forEach((c) => c.close());
  server.close();
}
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
