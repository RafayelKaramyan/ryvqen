import { z } from 'zod';

export const oddsSchema = z.number().int().min(101).max(100000);
export const outcomeSchema = z
  .object({
    id: z.string().max(50),
    label: z.string().max(50),
    price: oddsSchema,
    history: z.array(oddsSchema).max(24),
  })
  .strict();
export const marketSchema = z
  .object({
    id: z.string().max(60),
    name: z.string().max(60),
    status: z.enum(['open', 'suspended']),
    outcomes: z.array(outcomeSchema).min(2).max(3),
  })
  .strict();
export const fixtureSchema = z
  .object({
    id: z.string().max(40),
    sport: z.enum(['football', 'basketball']),
    league: z.string().max(60),
    home: z.string().max(60),
    away: z.string().max(60),
    homeCode: z.string().max(3),
    awayCode: z.string().max(3),
    homeColor: z.string().regex(/^#[a-f0-9]{6}$/i),
    awayColor: z.string().regex(/^#[a-f0-9]{6}$/i),
    phase: z.enum(['live', 'upcoming', 'finished']),
    minute: z.number().int().min(0).max(120),
    homeScore: z.number().int().min(0).max(200),
    awayScore: z.number().int().min(0).max(200),
    startsAt: z.string().datetime(),
    possession: z.number().int().min(20).max(80),
    markets: z.array(marketSchema).min(1).max(4),
  })
  .strict();
export type Fixture = z.infer<typeof fixtureSchema>;
export type Market = z.infer<typeof marketSchema>;
export type Sport = Fixture['sport'];
export const messageSchema = z.discriminatedUnion('type', [
  z
    .object({
      type: z.literal('snapshot'),
      epoch: z.string().max(80),
      sequence: z.number().int().nonnegative(),
      fixtures: z.array(fixtureSchema).min(1).max(500),
    })
    .strict(),
  z
    .object({
      type: z.literal('tick'),
      epoch: z.string().max(80),
      sequence: z.number().int().positive(),
      fixtures: z.array(fixtureSchema).min(1).max(16),
    })
    .strict(),
]);
export type FeedMessage = z.infer<typeof messageSchema>;
export type FeedCommand = { type: 'snapshot' | 'pause' | 'resume' | 'duplicate' | 'late' | 'gap' };
export type Connection = 'connecting' | 'connected' | 'paused' | 'disconnected' | 'resyncing';
export type StreamState = {
  fixtures: Fixture[];
  sequence: number;
  epoch: string;
  received: number;
  dropped: number;
  invalid: number;
  gaps: number;
  lastReceivedAt: number;
  connection: Connection;
};
export const initialStream = (): StreamState => ({
  fixtures: [],
  sequence: 0,
  epoch: '',
  received: 0,
  dropped: 0,
  invalid: 0,
  gaps: 0,
  lastReceivedAt: 0,
  connection: 'connecting',
});

function validFixtureSet(fixtures: Fixture[]): boolean {
  const ids = new Set<string>();
  return fixtures.every((f) => {
    if (ids.has(f.id)) return false;
    ids.add(f.id);
    const markets = new Set<string>();
    return f.markets.every((m) => {
      if (markets.has(m.id) || !m.id.startsWith(f.id + ':')) return false;
      markets.add(m.id);
      return new Set(m.outcomes.map((o) => o.id)).size === m.outcomes.length;
    });
  });
}

export function ingest(state: StreamState, input: unknown, now: number): StreamState {
  const result = messageSchema.safeParse(input);
  if (!result.success || !validFixtureSet(result.data.fixtures))
    return { ...state, invalid: state.invalid + 1 };
  const m = result.data;
  if (m.type === 'snapshot') {
    // A snapshot is requested only for initialization or an explicit recovery.
    if (
      state.connection === 'connected' &&
      (m.epoch !== state.epoch || m.sequence < state.sequence)
    )
      return { ...state, dropped: state.dropped + 1 };
    return {
      ...state,
      fixtures: m.fixtures,
      epoch: m.epoch,
      sequence: m.sequence,
      connection: 'connected',
      received: state.received + 1,
      lastReceivedAt: now,
    };
  }
  if (state.connection !== 'connected') return state;
  if (m.epoch !== state.epoch || m.sequence <= state.sequence)
    return { ...state, dropped: state.dropped + 1 };
  if (m.sequence !== state.sequence + 1)
    return { ...state, connection: 'resyncing', gaps: state.gaps + 1 };
  const known = new Set(state.fixtures.map((f) => f.id));
  if (m.fixtures.some((f) => !known.has(f.id)))
    return { ...state, invalid: state.invalid + 1, connection: 'resyncing' };
  const updated = new Map(m.fixtures.map((f) => [f.id, f]));
  return {
    ...state,
    fixtures: state.fixtures.map((f) => updated.get(f.id) ?? f),
    sequence: m.sequence,
    received: state.received + 1,
    lastReceivedAt: now,
  };
}

export const overrideSchema = z
  .object({
    revision: z.number().int().positive(),
    suspended: z.boolean(),
    prices: z.record(z.string(), oddsSchema).nullable(),
    reason: z.string().min(4).max(240),
  })
  .strict();
export type Override = z.infer<typeof overrideSchema>;
export const actionKinds = ['price', 'suspend', 'resume', 'release'] as const;
export type ActionKind = (typeof actionKinds)[number];
export const auditSchema = z
  .object({
    id: z.string().max(80),
    at: z.string(),
    kind: z.enum(actionKinds),
    fixtureId: z.string().max(40),
    fixture: z.string().max(130),
    marketId: z.string().max(60),
    market: z.string().max(60),
    reason: z.string().min(4).max(240),
    before: z.string().max(240),
    after: z.string().max(240),
    sequence: z.number().int().nonnegative(),
  })
  .strict();
export const bookSchema = z
  .object({
    version: z.literal(1),
    generation: z.string().max(80),
    revision: z.number().int().nonnegative(),
    watchlist: z.array(z.string().max(40)).max(240),
    overrides: z.record(z.string(), overrideSchema),
    journal: z.array(auditSchema).max(200),
    motionPaused: z.boolean(),
  })
  .strict();
export type Book = z.infer<typeof bookSchema>;
export const emptyBook = (generation: string): Book => ({
  version: 1,
  generation,
  revision: 0,
  watchlist: [],
  overrides: {},
  journal: [],
  motionPaused: false,
});
export type Mutation = {
  kind: ActionKind;
  fixtureId: string;
  marketId: string;
  expectedRevision: number;
  generation: string;
  reason: string;
  prices?: Record<string, number>;
};

export function effectiveMarket(market: Market, override?: Override): Market {
  return {
    ...market,
    status: market.status === 'suspended' || override?.suspended ? 'suspended' : 'open',
    outcomes: market.outcomes.map((o) => ({ ...o, price: override?.prices?.[o.id] ?? o.price })),
  };
}
export function parsePrice(value: string): number | null {
  if (!/^\d{1,4}(\.\d{1,2})?$/.test(value.trim())) return null;
  const [whole = '', fraction = ''] = value.trim().split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return oddsSchema.safeParse(cents).success ? cents : null;
}
export const formatPrice = (cents: number): string => (cents / 100).toFixed(2);
export function marketSummary(market: Market): string {
  return `${market.status} / ${market.outcomes.map((o) => `${o.label} ${formatPrice(o.price)}`).join(' · ')}`;
}

export function applyMutation(
  book: Book,
  stream: StreamState,
  action: Mutation,
  id: string,
  at: string,
): Book {
  if (stream.connection !== 'connected')
    throw new Error('Reconnect the feed before changing a market.');
  if (Date.parse(at) - stream.lastReceivedAt > 7500)
    throw new Error('The feed is stale. Reconnect before changing a market.');
  if (action.generation !== book.generation)
    throw new Error('This workspace was reset. Close this form and reopen the market.');
  const fixture = stream.fixtures.find((f) => f.id === action.fixtureId);
  const market = fixture?.markets.find((m) => m.id === action.marketId);
  if (!fixture || !market || fixture.phase !== 'live')
    throw new Error('Only a current live market can be changed.');
  if (market.status !== 'open')
    throw new Error('The feed has suspended this market. Try again after it reopens.');
  const old = book.overrides[market.id];
  if ((old?.revision ?? 0) !== action.expectedRevision)
    throw new Error('This market changed in another tab. Reopen it to review the latest values.');
  const reason = action.reason.trim();
  if (reason.length < 4 || reason.length > 240)
    throw new Error('Add a reason between 4 and 240 characters.');
  if (action.kind === 'suspend' && old?.suspended)
    throw new Error('This market is already suspended.');
  if (action.kind === 'resume' && !old?.suspended) throw new Error('This market is already open.');
  if (action.kind === 'price' && old?.suspended)
    throw new Error('Resume this market before changing its price.');
  if (action.kind === 'release' && !old?.prices)
    throw new Error('This market already follows feed prices.');
  let prices = old?.prices ?? null;
  if (action.kind === 'price') {
    const incoming = action.prices;
    if (
      !incoming ||
      Object.keys(incoming).length !== market.outcomes.length ||
      market.outcomes.some((o) => !oddsSchema.safeParse(incoming[o.id]).success)
    )
      throw new Error('Enter a valid price for every outcome (1.01–1000.00).');
    prices = { ...incoming };
  }
  if (action.kind === 'release') prices = null;
  const next: Override = {
    revision: (old?.revision ?? 0) + 1,
    suspended:
      action.kind === 'suspend'
        ? true
        : action.kind === 'resume'
          ? false
          : (old?.suspended ?? false),
    prices,
    reason,
  };
  const entry = {
    id,
    at,
    kind: action.kind,
    fixtureId: fixture.id,
    fixture: `${fixture.home} / ${fixture.away}`,
    marketId: market.id,
    market: market.name,
    reason,
    before: marketSummary(effectiveMarket(market, old)),
    after: marketSummary(effectiveMarket(market, next)),
    sequence: stream.sequence,
  };
  return {
    ...book,
    revision: book.revision + 1,
    overrides: { ...book.overrides, [market.id]: next },
    journal: [entry, ...book.journal].slice(0, 200),
  };
}
