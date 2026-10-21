import { applyMutation, bookSchema, emptyBook, ingest, initialStream } from './model';
import type { Book, Connection, FeedCommand, Mutation, StreamState } from './model';
import { createFixtures } from './fixtures';

export const STORAGE_KEY = 'ryvqen:desk:v1';
export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}
export type DeskSnapshot = {
  book: Book;
  stream: StreamState;
  error: string | null;
  corrupt: string | null;
  notice: string;
  pending: boolean;
  rejectNext: boolean;
};
type Options = {
  storage: StoragePort;
  id: () => string;
  now: () => number;
  lock?: <T>(work: () => Promise<T>) => Promise<T>;
};
const known = createFixtures();
const fixtureIds = new Set(known.map((f) => f.id));
const knownMarkets = new Map(known.flatMap((f) => f.markets.map((m) => [m.id, m] as const)));
const message = (e: unknown) => (e instanceof Error ? e.message : 'The change could not be saved.');

export function decodeBook(raw: string): Book {
  const book = bookSchema.parse(JSON.parse(raw));
  if (
    new Set(book.watchlist).size !== book.watchlist.length ||
    book.watchlist.some((id) => !fixtureIds.has(id)) ||
    Object.keys(book.overrides).length > knownMarkets.size
  )
    throw new Error('Invalid saved references.');
  for (const [id, override] of Object.entries(book.overrides)) {
    const market = knownMarkets.get(id);
    if (
      !market ||
      (override.prices &&
        (Object.keys(override.prices).length !== market.outcomes.length ||
          market.outcomes.some((o) => override.prices?.[o.id] === undefined)))
    )
      throw new Error('Invalid saved market.');
  }
  if (
    new Set(book.journal.map((e) => e.id)).size !== book.journal.length ||
    book.journal.some(
      (e) =>
        !fixtureIds.has(e.fixtureId) ||
        !e.marketId.startsWith(e.fixtureId + ':') ||
        !knownMarkets.has(e.marketId) ||
        Number.isNaN(Date.parse(e.at)),
    )
  )
    throw new Error('Invalid saved journal.');
  return book;
}

export class DeskStore {
  private listeners = new Set<() => void>();
  private snapshot: DeskSnapshot;
  private options: Options;
  send: ((command: FeedCommand) => void) | undefined;
  constructor(options: Options) {
    this.options = options;
    const book = emptyBook(options.id());
    this.snapshot = {
      book,
      stream: initialStream(),
      error: null,
      corrupt: null,
      notice: '',
      pending: false,
      rejectNext: false,
    };
    this.refresh();
  }
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  getSnapshot = () => this.snapshot;
  private update(patch: Partial<DeskSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    this.listeners.forEach((fn) => fn());
  }
  refresh = () => {
    try {
      const raw = this.options.storage.getItem(STORAGE_KEY);
      if (raw === null) {
        this.update({
          book: this.snapshot.book.revision ? emptyBook(this.options.id()) : this.snapshot.book,
          error: null,
          corrupt: null,
        });
        return;
      }
      try {
        this.update({ book: decodeBook(raw), error: null, corrupt: null });
      } catch {
        this.update({
          corrupt: raw,
          error: 'Saved workspace data could not be read. Download a backup before resetting it.',
        });
      }
    } catch {
      this.update({ error: 'Browser storage is unavailable. Changes cannot be saved yet.' });
    }
  };
  receive = (input: unknown) => {
    const previous = this.snapshot.stream;
    if (previous.connection === 'paused') return;
    const next = ingest(previous, input, this.options.now());
    this.update({ stream: next });
    if (next.connection === 'resyncing' && previous.connection !== 'resyncing')
      this.send?.({ type: 'snapshot' });
  };
  connection = (connection: Connection) => {
    this.update({ stream: { ...this.snapshot.stream, connection } });
  };
  control = (type: FeedCommand['type']) => {
    if (type === 'pause') this.connection('paused');
    if (type === 'resume' || type === 'snapshot') this.connection('connecting');
    this.send?.({ type });
  };
  clearNotice = () => this.update({ notice: '' });
  rejectNextChange = () =>
    this.update({
      rejectNext: !this.snapshot.rejectNext,
      notice: this.snapshot.rejectNext
        ? 'Request failure scenario cancelled.'
        : 'The next market request will be rejected without changing saved data.',
    });
  private async transaction(change: (current: Book) => Book, notice: string) {
    const work = async () => {
      const raw = this.options.storage.getItem(STORAGE_KEY);
      const current = raw === null ? this.snapshot.book : decodeBook(raw);
      if (this.snapshot.corrupt !== null)
        throw new Error('Download the unreadable data and reset the workspace first.');
      const next = change(current);
      try {
        this.options.storage.setItem(STORAGE_KEY, JSON.stringify(next));
      } catch {
        throw new Error(
          'Browser storage rejected the save. Your change was not applied. Free some space and try again.',
        );
      }
      this.update({ book: next, error: null, notice });
    };
    try {
      await (this.options.lock ? this.options.lock(work) : work());
    } catch (e) {
      this.update({ error: message(e) });
      throw e;
    }
  }
  mutate = async (action: Mutation, reject = false) => {
    if (this.snapshot.pending) throw new Error('A market change is already being processed.');
    const shouldReject = reject || this.snapshot.rejectNext;
    this.update({ pending: true, rejectNext: false });
    try {
      await new Promise((resolve) => setTimeout(resolve, 320));
      if (shouldReject)
        throw new Error('The demo endpoint rejected this request. Nothing was changed.');
      await this.transaction(
        (current) =>
          applyMutation(
            current,
            this.snapshot.stream,
            action,
            this.options.id(),
            new Date(this.options.now()).toISOString(),
          ),
        'Market updated. Change recorded in the journal.',
      );
    } catch (e) {
      this.update({ error: message(e) });
      throw e;
    } finally {
      this.update({ pending: false });
    }
  };
  watch = (id: string) =>
    this.transaction((current) => {
      if (!fixtureIds.has(id)) throw new Error('This fixture is not available.');
      return {
        ...current,
        revision: current.revision + 1,
        watchlist: current.watchlist.includes(id)
          ? current.watchlist.filter((x) => x !== id)
          : [...current.watchlist, id],
      };
    }, 'Watchlist saved on this device.');
  toggleMotion = () =>
    this.transaction(
      (current) => ({
        ...current,
        revision: current.revision + 1,
        motionPaused: !current.motionPaused,
      }),
      'Motion preference saved.',
    );
  resetCorrupt = async (expectedRaw: string) => {
    const work = async () => {
      const raw = this.options.storage.getItem(STORAGE_KEY);
      if (raw !== expectedRaw) throw new Error('Saved data changed. Refresh before resetting.');
      const book = emptyBook(this.options.id());
      this.options.storage.setItem(STORAGE_KEY, JSON.stringify(book));
      this.update({
        book,
        corrupt: null,
        error: null,
        notice: 'Unreadable workspace reset. The replay feed is unchanged.',
      });
    };
    try {
      await (this.options.lock ? this.options.lock(work) : work());
    } catch (e) {
      this.update({ error: message(e) });
      throw e;
    }
  };
}
