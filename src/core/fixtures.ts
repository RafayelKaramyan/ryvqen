import type { FeedMessage, Fixture, Market } from './model';

const football = [
  ['Northbridge', 'NBR', '#d7fa70'],
  ['AC Valora', 'VAL', '#a6b9ef'],
  ['Harbour Athletic', 'HBR', '#f4b17c'],
  ['Eastford City', 'EFC', '#7bd9da'],
  ['Riverton', 'RIV', '#c3abea'],
  ['Union Sol', 'USL', '#eab283'],
  ['Westport', 'WPT', '#b3d6b3'],
  ['Alpine Rovers', 'ALP', '#e5c591'],
] as const;
const basketball = [
  ['Montara', 'MNT', '#efb582'],
  ['Northstar', 'NST', '#c4b5ee'],
  ['Bay District', 'BAY', '#7dd7d3'],
  ['Redwood', 'RDW', '#eaa19f'],
] as const;

function price(base: number, sequence: number, offset: number): number {
  return Math.max(
    105,
    base + Math.round(Math.sin((sequence + offset) * 0.51) * 12) + (sequence % 4) * 2,
  );
}
function markets(id: string, sport: Fixture['sport'], offset: number, sequence: number): Market[] {
  const make = (key: string, name: string, labels: string[], bases: number[]): Market => ({
    id: `${id}:${key}`,
    name,
    status: 'open',
    outcomes: labels.map((label, i) => ({
      id: `${key}-${i}`,
      label,
      price: price(bases[i] ?? 190, sequence, offset + i * 3),
      history: Array.from({ length: 18 }, (_, h) =>
        price(bases[i] ?? 190, sequence - 17 + h, offset + i * 3),
      ),
    })),
  });
  return sport === 'football'
    ? [
        make(
          'result',
          'Match result',
          ['Home', 'Draw', 'Away'],
          [188 + (offset % 25), 325, 405 - (offset % 35)],
        ),
        make('goals', 'Total goals · 2.5', ['Over', 'Under'], [195, 187]),
        make('both', 'Both teams to score', ['Yes', 'No'], [178, 205]),
      ]
    : [
        make('result', 'Match winner', ['Home', 'Away'], [172, 217]),
        make('total', 'Total points · 164.5', ['Over', 'Under'], [193, 190]),
        make('spread', 'Spread · −3.5', ['Home', 'Away'], [188, 196]),
      ];
}
export function createFixtures(sequence = 0): Fixture[] {
  return Array.from({ length: 240 }, (_, i) => {
    const sport = i % 4 === 2 ? 'basketball' : 'football';
    const teams = sport === 'football' ? football : basketball;
    const home = teams[i % teams.length] ?? teams[0];
    const away =
      teams[(i + 1 + (Math.floor(i / teams.length) % (teams.length - 1))) % teams.length] ??
      teams[1];
    const id = `evt-${String(i + 1).padStart(3, '0')}`;
    const phase = i < 12 ? 'live' : i < 216 ? 'upcoming' : 'finished';
    const liveStep = phase === 'live' ? sequence : 0;
    return {
      id,
      sport,
      league:
        sport === 'football'
          ? i % 3
            ? 'Continental Cup'
            : 'Northern Premier'
          : 'Atlantic Basketball',
      home: home[0],
      away: away[0],
      homeCode: home[1],
      awayCode: away[1],
      homeColor: home[2],
      awayColor: away[2],
      phase,
      minute:
        phase === 'finished'
          ? sport === 'football'
            ? 90
            : 40
          : phase === 'upcoming'
            ? 0
            : (sport === 'football' ? 64 : 26) + (i % 10),
      homeScore: phase === 'upcoming' ? 0 : sport === 'football' ? i % 3 : 68 + (i % 35),
      awayScore: phase === 'upcoming' ? 0 : sport === 'football' ? (i + 1) % 2 : 62 + (i % 37),
      startsAt: new Date(
        Date.UTC(2026, 9, 20, 18 + Math.floor(i / 24), (i % 4) * 15),
      ).toISOString(),
      possession: 49 + Math.round(Math.sin(liveStep / 4 + i) * 12),
      markets: markets(id, sport, i, liveStep),
    };
  });
}
export const makeSnapshot = (sequence: number, epoch = 'ryvqen-replay-v1'): FeedMessage => ({
  type: 'snapshot',
  epoch,
  sequence,
  fixtures: createFixtures(sequence),
});
export const makeTick = (sequence: number, epoch = 'ryvqen-replay-v1'): FeedMessage => ({
  type: 'tick',
  epoch,
  sequence,
  fixtures: createFixtures(sequence).slice(0, 12),
});
