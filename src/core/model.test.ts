import { describe, expect, it } from 'vitest';
import {
  applyMutation,
  effectiveMarket,
  emptyBook,
  formatPrice,
  ingest,
  initialStream,
  parsePrice,
} from './model';
import type { Mutation, StreamState } from './model';
import { createFixtures, makeSnapshot, makeTick } from './fixtures';
import { decodeBook, DeskStore, STORAGE_KEY } from './store';

const connected = (): StreamState => ingest(initialStream(), makeSnapshot(0), 1000);
const action = (patch: Partial<Mutation> = {}): Mutation => ({
  kind: 'price',
  fixtureId: 'evt-001',
  marketId: 'evt-001:result',
  generation: 'generation-a',
  expectedRevision: 0,
  reason: 'Reviewed the replay',
  prices: { 'result-0': 250, 'result-1': 340, 'result-2': 415 },
  ...patch,
});
const change = (
  book = emptyBook('generation-a'),
  a = action(),
  stream = connected(),
  id = 'change-a',
) => applyMutation(book, stream, a, id, new Date(stream.lastReceivedAt).toISOString());

describe('decimal price boundaries', () => {
  it.each([
    ['1.01', 101],
    ['2.7', 270],
    ['2', 200],
    [' 2.05 ', 205],
    ['1000.00', 100000],
  ])('parses %s as exact hundredths', (text, result) => expect(parsePrice(text)).toBe(result));
  it.each(['1.00', '0', '-3', '1e2', '1.234', '1000.01', 'Infinity', '', '2,5', '.9'])(
    'rejects ambiguous or out-of-range input %s',
    (value) => expect(parsePrice(value)).toBeNull(),
  );
  it('formats without exposing binary rounding artifacts', () =>
    expect(formatPrice(271)).toBe('2.71'));
});

describe('feed protocol', () => {
  it('generates stable fictional fixtures with unique scoped markets', () => {
    const fixtures = createFixtures();
    expect(fixtures).toEqual(createFixtures());
    expect(fixtures).toHaveLength(240);
    expect(new Set(fixtures.map((f) => f.id)).size).toBe(240);
    expect(fixtures.filter((f) => f.phase === 'live')).toHaveLength(12);
    expect(new Set(fixtures.flatMap((f) => f.markets.map((m) => m.id))).size).toBe(720);
  });
  it('applies a contiguous update and preserves untouched fixture references', () => {
    const first = connected();
    const next = ingest(first, makeTick(1), 2000);
    expect(next.sequence).toBe(1);
    expect(next.fixtures[0]).not.toBe(first.fixtures[0]);
    expect(next.fixtures[20]).toBe(first.fixtures[20]);
    expect(next.lastReceivedAt).toBe(2000);
  });
  it('discards duplicate and late frames without rolling prices back', () => {
    let state = connected();
    for (let i = 1; i <= 3; i++) state = ingest(state, makeTick(i), i * 1000);
    const next = ingest(ingest(state, makeTick(3), 5000), makeTick(1), 6000);
    expect(next.sequence).toBe(3);
    expect(next.fixtures).toBe(state.fixtures);
    expect(next.dropped).toBe(2);
    expect(next.lastReceivedAt).toBe(3000);
  });
  it('freezes on a gap, ignores incremental frames, then recovers with a snapshot', () => {
    const gap = ingest(connected(), makeTick(3), 2000);
    expect(gap.connection).toBe('resyncing');
    expect(gap.sequence).toBe(0);
    expect(gap.gaps).toBe(1);
    expect(ingest(gap, makeTick(4), 3000)).toBe(gap);
    const recovered = ingest(gap, makeSnapshot(4), 4000);
    expect(recovered.connection).toBe('connected');
    expect(recovered.sequence).toBe(4);
  });
  it('does not let an old epoch overwrite a connected session', () => {
    const state = connected();
    const next = ingest(state, makeTick(1, 'previous-run'), 2000);
    expect(next.fixtures).toBe(state.fixtures);
    expect(next.dropped).toBe(1);
  });
  it('rejects malformed prices, duplicate fixtures and unknown patch references', () => {
    const tick = makeTick(1);
    tick.fixtures[0]!.markets[0]!.outcomes[0]!.price = -1;
    expect(ingest(connected(), tick, 2000).invalid).toBe(1);
    const duplicate = makeSnapshot(0);
    duplicate.fixtures.push(duplicate.fixtures[0]!);
    expect(ingest(initialStream(), duplicate, 0).invalid).toBe(1);
    const unknown = makeTick(1);
    unknown.fixtures[0]!.id = 'unknown';
    unknown.fixtures[0]!.markets = unknown.fixtures[0]!.markets.map((m) => ({
      ...m,
      id: m.id.replace('evt-001', 'unknown'),
    }));
    expect(ingest(connected(), unknown, 2000).connection).toBe('resyncing');
  });
  it('rejects snapshot rollback while connected but accepts a deliberate new session', () => {
    const current = ingest(connected(), makeTick(1), 2000);
    expect(ingest(current, makeSnapshot(0), 3000).sequence).toBe(1);
    expect(
      ingest({ ...current, connection: 'connecting' }, makeSnapshot(0, 'fresh-session'), 4000)
        .epoch,
    ).toBe('fresh-session');
  });
});

describe('market decisions', () => {
  it('rejects a stale but still-open transport at the moment of commit', () => {
    const stream = connected();
    expect(() =>
      applyMutation(
        emptyBook('generation-a'),
        stream,
        action(),
        'stale',
        new Date(stream.lastReceivedAt + 7501).toISOString(),
      ),
    ).toThrow('stale');
  });
  it('gives a provider suspension precedence over a local resume or manual price', () => {
    const stream = connected();
    const market = stream.fixtures[0]!.markets[0]!;
    market.status = 'suspended';
    expect(() => change(undefined, action(), stream)).toThrow('feed has suspended');
    expect(
      effectiveMarket(market, {
        revision: 1,
        suspended: false,
        prices: null,
        reason: 'Local resume',
      }).status,
    ).toBe('suspended');
  });
  it('keeps manual prices through new feed frames and releases to the latest feed', () => {
    const book = change();
    const stream = ingest(connected(), makeTick(1), 2000);
    const market = stream.fixtures[0]!.markets[0]!;
    expect(effectiveMarket(market, book.overrides[market.id]).outcomes[0]!.price).toBe(250);
    const released = change(
      book,
      action({ kind: 'release', expectedRevision: 1 }),
      stream,
      'release-a',
    );
    expect(effectiveMarket(market, released.overrides[market.id]).outcomes[0]!.price).toBe(
      market.outcomes[0]!.price,
    );
    expect(released.journal).toHaveLength(2);
    expect(released.journal[0]!.before).toContain('2.50');
    expect(released.journal[0]!.after).toContain(formatPrice(market.outcomes[0]!.price));
  });
  it('suspends, rejects price writes while paused, and resumes without losing manual prices', () => {
    const book = change();
    const paused = change(
      book,
      action({ kind: 'suspend', expectedRevision: 1 }),
      connected(),
      'pause-a',
    );
    expect(paused.overrides['evt-001:result']!.suspended).toBe(true);
    expect(() => change(paused, action({ expectedRevision: 2 }))).toThrow('Resume');
    const resumed = change(
      paused,
      action({ kind: 'resume', expectedRevision: 2 }),
      connected(),
      'resume-a',
    );
    expect(resumed.overrides['evt-001:result']!.suspended).toBe(false);
    expect(resumed.overrides['evt-001:result']!.prices!['result-0']).toBe(250);
  });
  it('does not release a local suspension when returning to feed prices', () => {
    const book = change();
    const paused = change(
      book,
      action({ kind: 'suspend', expectedRevision: 1 }),
      connected(),
      'pause-a',
    );
    const released = change(
      paused,
      action({ kind: 'release', expectedRevision: 2 }),
      connected(),
      'release-a',
    );
    expect(released.overrides['evt-001:result']!.suspended).toBe(true);
    expect(released.overrides['evt-001:result']!.prices).toBeNull();
  });
  it('rejects stale forms and forms from a reset workspace', () => {
    expect(() => change(change(), action())).toThrow('another tab');
    expect(() => change(emptyBook('different-generation'))).toThrow('workspace changed');
  });
  it('requires a connected feed, live event, complete prices and meaningful reason', () => {
    expect(() => change(undefined, undefined, { ...connected(), connection: 'paused' })).toThrow(
      'Reconnect',
    );
    expect(() =>
      change(undefined, action({ fixtureId: 'evt-025', marketId: 'evt-025:result' })),
    ).toThrow('current live');
    expect(() => change(undefined, action({ reason: '  x ' }))).toThrow('reason');
    expect(() => change(undefined, action({ prices: { 'result-0': 250 } }))).toThrow(
      'every outcome',
    );
    expect(() =>
      change(undefined, action({ prices: { 'result-0': 0, 'result-1': 340, 'result-2': 415 } })),
    ).toThrow('every outcome');
  });
  it('records the observed feed sequence and retains only the latest 200 decisions', () => {
    let book = emptyBook('generation-a');
    for (let i = 0; i < 205; i++)
      book = change(book, action({ expectedRevision: i }), connected(), `id-${i}`);
    expect(book.journal).toHaveLength(200);
    expect(book.journal[0]!.id).toBe('id-204');
    expect(book.journal.at(-1)!.id).toBe('id-5');
    expect(book.revision).toBe(205);
  });
});

class MemoryStorage {
  raw: string | null = null;
  fail = false;
  getItem() {
    return this.raw;
  }
  setItem(_key: string, value: string) {
    if (this.fail) throw new Error('Quota');
    this.raw = value;
  }
}
const makeStore = (storage = new MemoryStorage(), idPrefix = 'generation') => {
  let id = 0;
  const store = new DeskStore({
    storage,
    id: () => `${idPrefix}-${++id}`,
    now: () => Date.UTC(2026, 9, 20),
  });
  store.receive(makeSnapshot(0));
  return { store, storage };
};
const storeAction = (store: DeskStore) =>
  action({ generation: store.getSnapshot().book.generation });
describe('durable local workspace', () => {
  it('commits only after storage succeeds and restores exact prices and reasons', async () => {
    const { store, storage } = makeStore();
    await store.mutate(storeAction(store));
    const restored = makeStore(storage).store;
    expect(restored.getSnapshot().book.overrides['evt-001:result']!.prices!['result-0']).toBe(250);
    expect(restored.getSnapshot().book.journal[0]!.reason).toBe('Reviewed the replay');
  });
  it('does not acknowledge failed saves or append an invented journal entry', async () => {
    const { store, storage } = makeStore();
    storage.fail = true;
    await expect(store.mutate(storeAction(store))).rejects.toThrow('not applied');
    expect(store.getSnapshot().book.revision).toBe(0);
    expect(store.getSnapshot().book.journal).toHaveLength(0);
    expect(store.getSnapshot().pending).toBe(false);
    expect(storage.raw).toBeNull();
  });
  it('recovers after a rejected endpoint response without mutating saved state', async () => {
    const { store } = makeStore();
    store.rejectNextChange();
    await expect(store.mutate(storeAction(store))).rejects.toThrow('rejected');
    expect(store.getSnapshot().book.journal).toHaveLength(0);
    await store.mutate(storeAction(store));
    expect(store.getSnapshot().book.journal).toHaveLength(1);
  });
  it('prevents a duplicate submission while a request is pending', async () => {
    const { store } = makeStore();
    const a = storeAction(store);
    const pending = store.mutate(a);
    await expect(store.mutate(a)).rejects.toThrow('already');
    await pending;
    expect(store.getSnapshot().book.journal).toHaveLength(1);
  });
  it('rereads storage before committing a form from another tab', async () => {
    const shared = new MemoryStorage();
    const a = makeStore(shared).store;
    const b = makeStore(shared, 'other-tab').store;
    const stale = storeAction(b);
    await a.mutate(storeAction(a));
    await expect(b.mutate(stale)).rejects.toThrow('another tab');
    expect(decodeBook(shared.raw!).journal).toHaveLength(1);
  });
  it('does not apply queued frames while intentionally paused', () => {
    const { store } = makeStore();
    store.connection('paused');
    store.receive(makeSnapshot(8));
    expect(store.getSnapshot().stream.connection).toBe('paused');
    expect(store.getSnapshot().stream.sequence).toBe(0);
  });
  it('preserves corrupt bytes and refuses to overwrite changed recovery data', async () => {
    const shared = new MemoryStorage();
    shared.raw = '{unfinished';
    const { store } = makeStore(shared);
    expect(store.getSnapshot().corrupt).toBe('{unfinished');
    await expect(store.watch('evt-001')).rejects.toThrow();
    expect(shared.raw).toBe('{unfinished');
    shared.raw = '{changed';
    await expect(store.resetCorrupt('{unfinished')).rejects.toThrow('changed');
    expect(shared.raw).toBe('{changed');
  });
  it('resets unreadable data only against the reviewed bytes', async () => {
    const shared = new MemoryStorage();
    shared.raw = 'broken';
    const { store } = makeStore(shared);
    await store.resetCorrupt('broken');
    expect(store.getSnapshot().corrupt).toBeNull();
    expect(decodeBook(shared.raw!).watchlist).toEqual([]);
  });
  it('persists watchlists and motion preferences, then invalidates external deletion', async () => {
    const { store, storage } = makeStore();
    await store.watch('evt-001');
    await store.toggleMotion();
    expect(decodeBook(storage.raw!).motionPaused).toBe(true);
    const generation = store.getSnapshot().book.generation;
    storage.raw = null;
    store.refresh();
    expect(store.getSnapshot().book.watchlist).toEqual([]);
    expect(store.getSnapshot().book.generation).not.toBe(generation);
  });
  it('rejects well-formed JSON with foreign market references', () => {
    const book = emptyBook('test');
    book.watchlist = ['foreign-event'];
    expect(() => decodeBook(JSON.stringify(book))).toThrow();
  });
  it('notifies subscribers and can unsubscribe without leaking callbacks', async () => {
    const { store } = makeStore();
    let calls = 0;
    const off = store.subscribe(() => {
      calls++;
    });
    await store.watch('evt-001');
    expect(calls).toBe(1);
    off();
    await store.watch('evt-001');
    expect(calls).toBe(1);
  });
  it('uses the expected isolated storage key', () => expect(STORAGE_KEY).toBe('ryvqen:desk:v1'));
});
