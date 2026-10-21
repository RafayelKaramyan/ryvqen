import { spawn } from 'node:child_process';
import type { ChildProcess } from 'node:child_process';
import { afterAll, beforeAll, expect, it } from 'vitest';
import WebSocket from 'ws';
import { messageSchema } from './model';
let child: ChildProcess;
beforeAll(async () => {
  child = spawn(process.execPath, ['--import', 'tsx', 'server/feed.ts'], {
    cwd: process.cwd(),
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Feed server startup timed out')), 8000);
    child.stdout?.once('data', () => {
      clearTimeout(timeout);
      resolve();
    });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code) reject(new Error(`Feed exited ${code}`));
    });
  });
}, 10000);
afterAll(() => {
  child?.kill('SIGTERM');
});
it('serves the same strict snapshot and contiguous tick over a real local WebSocket', async () => {
  const client = new WebSocket('ws://127.0.0.1:8787', { origin: 'http://localhost:4173' });
  const messages: unknown[] = [];
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      client.close();
      reject(new Error('No contiguous tick'));
    }, 5000);
    client.on('error', reject);
    client.on('message', (bytes) => {
      messages.push(JSON.parse(bytes.toString()));
      if (messages.length === 2) {
        clearTimeout(timeout);
        client.close();
        resolve();
      }
    });
  });
  const first = messageSchema.parse(messages[0]);
  const next = messageSchema.parse(messages[1]);
  expect(first.type).toBe('snapshot');
  expect(next.type).toBe('tick');
  expect(next.sequence).toBe(first.sequence + 1);
  expect(next.epoch).toBe(first.epoch);
});
it('rejects a non-local browser origin', async () => {
  const client = new WebSocket('ws://127.0.0.1:8787', { origin: 'https://unrelated.example' });
  const code = await new Promise<number>((resolve, reject) => {
    client.on('close', resolve);
    client.on('error', reject);
  });
  expect(code).toBe(1008);
});
it('closes malformed client commands with the invalid-data code', async () => {
  const client = new WebSocket('ws://127.0.0.1:8787');
  const code = await new Promise<number>((resolve, reject) => {
    client.on('open', () => client.send('{broken'));
    client.on('close', resolve);
    client.on('error', reject);
  });
  expect(code).toBe(1007);
});
