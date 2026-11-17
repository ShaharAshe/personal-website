// The doodles (Task F.4): the data, which doodle a build on a given date shows, the DOODLE override and its guard,
// the animation keyframes and the interaction rules. The built pages are in tests/doodles-dist.test.ts; the browser
// behavior in tests/e2e/doodle.spec.ts.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import {
  DOODLES,
  DOODLE_IDS,
  boxSize,
  dotCenter,
  dotsOf,
  doodleById,
  gridOf,
  shapeSize,
  type DoodleId,
} from '../src/lib/doodles/doodles.ts';
import {
  doodleForDate,
  hanukkahStart,
  occurrence,
  parseLaunchDate,
  programmersDay,
  utcDay,
} from '../src/lib/doodles/dates.ts';
import { selectDoodle } from '../src/lib/doodles/select.ts';
import { MOTION_MS, motionPlan, type Frame } from '../src/lib/doodles/motion.ts';
import { INITIAL_STATE, reduce, type DoodleEvent, type DoodleState } from '../src/lib/doodles/interaction.ts';
import { DOODLE_OUT_DIR, doodleGuardProblem } from '../scripts/doodles/doodle-guard.mts';
import { DOODLE_DIR } from '../scripts/doodles/doodle-server.ts';
import { LAUNCH_DATE } from '../src/lib/site.ts';

/** The doodle id for a build at noon UTC on this date ('YYYY-MM-DD'), or null. */
const on = (date: string, launchDate = '') => doodleForDate(new Date(`${date}T12:00:00Z`), launchDate)?.id ?? null;
const iso = (day: number) => new Date(day * 86_400_000).toISOString().slice(0, 10);

// --- The data ---

test('the doodles, in priority order: launch, the one-day doodles, then Hanukkah', () => {
  assert.deepEqual(
    DOODLES.map((d) => d.id),
    [...DOODLE_IDS],
  );
  assert.deepEqual(
    [...DOODLE_IDS],
    ['launch', 'new-year', 'pi-day', 'turing', 'programmers-day', 'halloween', 'hanukkah'],
  );
});

test('every doodle links to an English Wikipedia article, named "<day>, read about it on Wikipedia"', () => {
  for (const doodle of DOODLES) {
    assert.match(doodle.wikipedia, /^https:\/\/en\.wikipedia\.org\/wiki\/[^\s/?#]+$/, doodle.id);
    assert.doesNotThrow(() => new URL(doodle.wikipedia));
    assert.match(doodle.label, /^\S.*, read about it on Wikipedia$/, doodle.id);
    assert.ok(doodle.bubble.length > 20 && doodle.bubble.length <= 100, `${doodle.id} bubble length`);
  }
  assert.equal(new Set(DOODLES.map((d) => d.label)).size, DOODLES.length);
});

test("no doodle for the owner's birthday or a national day (design-doc §10.3)", () => {
  const text = DOODLES.map((d) => `${d.id} ${d.label} ${d.bubble}`)
    .join(' ')
    .toLowerCase();
  for (const word of ['independence', 'birthday of shahar', 'national', 'memorial']) {
    assert.ok(!text.includes(word), word);
  }
});

test('every shape is a rectangle of dots that fits the doodle box (at most 17 × 11)', () => {
  for (const doodle of DOODLES) {
    const { cols, rows } = shapeSize(doodle.shape);
    assert.ok(cols > 0 && cols <= 17 && rows > 0 && rows <= 11, doodle.id);
    for (const line of doodle.shape) {
      assert.equal(line.length, cols, `${doodle.id}: "${line}"`);
      assert.match(line, /^[#o.]+$/, doodle.id);
    }
    // No empty first or last row or column: the box is the shape's own size.
    const dots = dotsOf(doodle.shape);
    assert.equal(Math.min(...dots.map((d) => d.row)), 0, `${doodle.id} top`);
    assert.equal(Math.max(...dots.map((d) => d.row)), rows - 1, `${doodle.id} bottom`);
    assert.equal(Math.min(...dots.map((d) => d.col)), 0, `${doodle.id} left`);
    assert.equal(Math.max(...dots.map((d) => d.col)), cols - 1, `${doodle.id} right`);
    // A touch target of at least 44×44.
    const { width, height } = boxSize(doodle.shape);
    assert.ok(width >= 44 && height >= 44, doodle.id);
  }
});

test('the dots that move on their own are where the motion needs them', () => {
  for (const doodle of DOODLES) {
    const accents = dotsOf(doodle.shape).filter((d) => d.accent).length;
    if (doodle.motion === 'tape' || doodle.motion === 'flicker') assert.ok(accents > 0, doodle.id);
  }
  // Hanukkah: eight candles and the shamash, each with a flame.
  assert.equal(dotsOf(doodleById('hanukkah')!.shape).filter((d) => d.accent).length, 9);
});

test('gridOf() reads back the grid place of every drawn dot', () => {
  for (const doodle of DOODLES) {
    for (const dot of dotsOf(doodle.shape)) {
      const { x, y } = dotCenter(dot);
      assert.deepEqual(gridOf(x, y), { col: dot.col, row: dot.row });
    }
  }
});

// --- The dates ---

test('each one-day doodle shows from the day before to the day after, and not beyond', () => {
  const cases: [DoodleId, string, string, string, string, string][] = [
    ['new-year', '2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02', '2027-01-03'],
    ['pi-day', '2027-03-12', '2027-03-13', '2027-03-14', '2027-03-15', '2027-03-16'],
    ['turing', '2027-06-21', '2027-06-22', '2027-06-23', '2027-06-24', '2027-06-25'],
    ['programmers-day', '2027-09-11', '2027-09-12', '2027-09-13', '2027-09-14', '2027-09-15'],
    ['halloween', '2027-10-29', '2027-10-30', '2027-10-31', '2027-11-01', '2027-11-02'],
  ];
  for (const [id, before, ...rest] of cases) {
    const after = rest.pop()!;
    assert.equal(on(before), null, `${id}: ${before}`);
    for (const date of rest) assert.equal(on(date), id, `${id}: ${date}`);
    assert.equal(on(after), null, `${id}: ${after}`);
  }
});

test('the window follows the UTC date: just after midnight and just before the next one', () => {
  assert.equal(doodleForDate(new Date('2027-03-13T00:00:00Z'), '')?.id, 'pi-day');
  assert.equal(doodleForDate(new Date('2027-03-15T23:59:59Z'), '')?.id, 'pi-day');
  assert.equal(doodleForDate(new Date('2027-03-12T23:59:59Z'), ''), null);
  assert.equal(doodleForDate(new Date('2027-03-16T00:00:00Z'), ''), null);
  assert.equal(utcDay(new Date('1970-01-02T00:00:00Z')), 1);
});

test('Day of the Programmer is the 256th day: Sep 13, or Sep 12 in a leap year', () => {
  assert.equal(iso(programmersDay(2024)), '2024-09-12');
  assert.equal(iso(programmersDay(2028)), '2028-09-12');
  assert.equal(iso(programmersDay(2025)), '2025-09-13');
  assert.equal(iso(programmersDay(2026)), '2026-09-13');
  assert.equal(iso(programmersDay(2100)), '2100-09-13', '2100 is not a leap year');
  assert.equal(on('2024-09-11'), 'programmers-day');
  assert.equal(on('2024-09-13'), 'programmers-day');
  assert.equal(on('2024-09-14'), null);
  assert.equal(on('2024-09-10'), null);
});

// First day (25 Kislev) of Hanukkah; the first candle is lit the evening before.
const HANUKKAH: [number, string][] = [
  [2021, '2021-11-29'],
  [2022, '2022-12-19'],
  [2023, '2023-12-08'],
  [2024, '2024-12-26'],
  [2025, '2025-12-15'],
  [2026, '2026-12-05'],
  [2027, '2027-12-25'],
];

test("Hanukkah starts on 25 Kislev, from Intl's Hebrew calendar, for several known years", () => {
  for (const [year, first] of HANUKKAH) assert.equal(iso(hanukkahStart(year)), first, String(year));
});

test('Hanukkah shows for its 8 days, plus the day before and the day after', () => {
  const first = hanukkahStart(2026);
  assert.equal(on(iso(first - 2)), null);
  for (let day = first - 1; day <= first + 8; day++) assert.equal(on(iso(day)), 'hanukkah', iso(day));
  assert.equal(on(iso(first + 9)), null);
  assert.deepEqual(occurrence('hanukkah', 2026, ''), { first, last: first + 7 });
  // 2026: Dec 4 to Dec 13.
  assert.equal(iso(first - 1), '2026-12-04');
  assert.equal(iso(first + 8), '2026-12-13');
});

test('overlaps go by priority: New Year wins over a Hanukkah that runs into January', () => {
  // Hanukkah 2024: Dec 26 – Jan 2; shown Dec 25 – Jan 3. New Year 2025: shown Dec 31 – Jan 2.
  assert.equal(on('2024-12-30'), 'hanukkah');
  assert.equal(on('2024-12-31'), 'new-year');
  assert.equal(on('2025-01-01'), 'new-year');
  assert.equal(on('2025-01-02'), 'new-year');
  assert.equal(on('2025-01-03'), 'hanukkah', 'the day after Hanukkah, across the year boundary');
  assert.equal(on('2025-01-04'), null);
  // The launch day wins over everything.
  assert.equal(on('2027-03-14', '2026-03-14'), 'launch');
});

test('a normal day has no doodle, and 2026 has 25 doodle days', () => {
  assert.equal(on('2026-11-17'), null);
  assert.equal(on('2026-05-05'), null);
  let days = 0;
  for (let day = utcDay(new Date('2026-01-01T00:00:00Z')); iso(day) < '2027-01-01'; day++) {
    if (on(iso(day))) days++;
  }
  // Pi Day, Turing, Programmers' Day and Halloween: 3 days each. New Year: Jan 1–2 (2026's) and Dec 31 (2027's day
  // before). Hanukkah: its 8 days plus 2. No overlaps in 2026.
  assert.equal(days, 4 * 3 + 3 + 10);
});

test('the launch date: empty is off; a date shows that day every year; anything else throws', () => {
  assert.equal(LAUNCH_DATE, '', 'set at Task 4.2, empty until then');
  assert.equal(parseLaunchDate(''), null);
  assert.equal(occurrence('launch', 2027, ''), null);
  for (const date of ['2027-02-09', '2027-02-10', '2027-02-11', '2028-02-10']) {
    assert.equal(on(date, '2027-02-10'), 'launch', date);
  }
  assert.equal(on('2027-02-12', '2027-02-10'), null);
  assert.equal(on('2027-02-10', ''), null);
  for (const bad of ['2027-02-30', '27-02-10', '2027-2-10', 'soon', '2027-13-01']) {
    assert.throws(() => parseLaunchDate(bad), /LAUNCH_DATE/, bad);
    assert.throws(() => doodleForDate(new Date('2027-05-05T12:00:00Z'), bad), /LAUNCH_DATE/, bad);
  }
});

// --- The DOODLE override and its guard ---

test('DOODLE forces a doodle on any day, DOODLE=none forces none, and an unknown id fails the build', () => {
  const now = new Date('2026-11-17T12:00:00Z');
  const piDay = new Date('2027-03-14T12:00:00Z');
  assert.equal(selectDoodle({ now, env: undefined, launchDate: '' }), null);
  assert.equal(selectDoodle({ now, env: '', launchDate: '' }), null);
  assert.equal(selectDoodle({ now: piDay, env: undefined, launchDate: '' })?.id, 'pi-day');
  for (const id of DOODLE_IDS) assert.equal(selectDoodle({ now, env: id, launchDate: '' })?.id, id);
  assert.equal(selectDoodle({ now: piDay, env: 'none', launchDate: '' }), null);
  assert.throws(() => selectDoodle({ now, env: 'pi', launchDate: '' }), /not a doodle.*pi-day/);
});

test('the guard fails a forced doodle build into dist/, and allows dist-doodle/ or no DOODLE', () => {
  const root = path.join(path.sep, 'repo');
  const dist = path.join(root, 'dist');
  assert.match(doodleGuardProblem(dist, root, 'pi-day') ?? '', /dist\/, which deploys/);
  assert.match(doodleGuardProblem(dist + path.sep, root, 'none') ?? '', /DOODLE is set/);
  assert.equal(doodleGuardProblem(dist, root, undefined), null);
  assert.equal(doodleGuardProblem(dist, root, ''), null);
  assert.equal(doodleGuardProblem(path.join(root, DOODLE_OUT_DIR), root, 'pi-day'), null);
  assert.equal(DOODLE_OUT_DIR, DOODLE_DIR, 'the guard and the server name the same folder');
});

// --- The animations ---

const IDENTITY = /^(translate\(0px, 0px\)|rotate\((-?\d+)deg\) scale\(1\)|scale\(1\))$/;
const isIdentity = (transform: string) => {
  const match = transform.match(IDENTITY);
  return !!match && (match[2] === undefined || Number(match[2]) % 360 === 0);
};
const ALLOWED_TRANSFORM = /^((translate\(-?[\d.]+px, -?[\d.]+px\)|rotate\(-?[\d.]+deg\)|scale\([\d.]+\))\s?)+$/;

for (const doodle of DOODLES) {
  test(`${doodle.id}: the ${doodle.motion} animation uses only transform and opacity, plays once and ends in place`, () => {
    assert.ok(MOTION_MS >= 2000 && MOTION_MS <= 3000);
    const { cols, rows } = shapeSize(doodle.shape);
    const dots = dotsOf(doodle.shape);
    const plan = motionPlan(doodle.motion, dots, cols, rows);
    assert.equal(plan.dots.length, dots.length);
    const lists = [plan.shape, ...plan.dots].filter((frames): frames is Frame[] => frames !== null);
    assert.ok(lists.length > 0, 'something moves');
    for (const frames of lists) {
      assert.ok(frames.length >= 2);
      assert.equal(frames[0]!.offset, 0);
      assert.equal(frames.at(-1)!.offset, 1);
      for (const [i, frame] of frames.entries()) {
        for (const key of Object.keys(frame))
          assert.ok(['offset', 'transform', 'opacity', 'easing'].includes(key), key);
        assert.match(frame.transform, ALLOWED_TRANSFORM);
        assert.ok(frame.opacity >= 0 && frame.opacity <= 1);
        if (i > 0) assert.ok(frame.offset > frames[i - 1]!.offset, 'offsets go up');
      }
      for (const end of [frames[0]!, frames.at(-1)!]) {
        assert.ok(isIdentity(end.transform), `starts and ends in place: ${end.transform}`);
        assert.equal(end.opacity, 1);
      }
      // Opacity dips (a drop of 0.3 or more) at most twice per second: no flashing (WCAG 2.3.1).
      const dips = frames.filter((f, i) => i > 0 && frames[i - 1]!.opacity - f.opacity >= 0.3).length;
      assert.ok(dips <= (2 * MOTION_MS) / 1000, `${dips} dips`);
    }
  });
}

test("Turing's tape: the marks step one cell left, twice, and a mark that leaves the tape fades", () => {
  const doodle = doodleById('turing')!;
  const { cols, rows } = shapeSize(doodle.shape);
  const dots = dotsOf(doodle.shape);
  const plan = motionPlan('tape', dots, cols, rows);
  dots.forEach((dot, i) => {
    const frames = plan.dots[i];
    if (!dot.accent) return assert.equal(frames, null, 'the tape and the head stay still');
    assert.ok(frames);
    assert.ok(frames.some((f) => f.transform === 'translate(-24px, 0px)'));
    assert.ok(frames.some((f) => f.transform === 'translate(-48px, 0px)'));
    const leftmost = dot.col < 5;
    assert.equal(frames.find((f) => f.transform === 'translate(-24px, 0px)')!.opacity, leftmost ? 0 : 1);
  });
});

// --- Hover, focus, touch and Esc ---

/** Runs the events from the start, returning every reaction. */
function run(...events: DoodleEvent[]) {
  let state: DoodleState = INITIAL_STATE;
  return events.map((event) => {
    const reaction = reduce(state, event);
    state = reaction.state;
    return reaction;
  });
}

const mouse = (type: 'enter' | 'leave'): DoodleEvent => ({ type, pointerType: 'mouse' });

test('hover opens the bubble and animates once; leaving closes it; the next hover animates again', () => {
  const [enter, leave, again] = run(mouse('enter'), mouse('leave'), mouse('enter'));
  assert.deepEqual([enter!.state.open, enter!.animate, enter!.preventNavigation], [true, true, false]);
  assert.deepEqual([leave!.state.open, leave!.animate], [false, false]);
  assert.deepEqual([again!.state.open, again!.animate], [true, true]);
});

test('no replay while the bubble is open: focus during a hover, or a hover during focus', () => {
  const reactions = run(mouse('enter'), { type: 'focus' }, mouse('leave'), mouse('enter'));
  assert.deepEqual(
    reactions.map((r) => r.animate),
    [true, false, false, false],
  );
  assert.ok(
    reactions.every((r) => r.state.open),
    'focus keeps it open after the pointer leaves',
  );
});

test('focus opens and animates; blur closes unless hovered', () => {
  const [focus, blur] = run({ type: 'focus' }, { type: 'blur' });
  assert.deepEqual([focus!.state.open, focus!.animate], [true, true]);
  assert.equal(blur!.state.open, false);
  const hovered = run(mouse('enter'), { type: 'focus' }, { type: 'blur' }).at(-1)!;
  assert.equal(hovered.state.open, true);
});

test('Esc closes the bubble and keeps hover and focus; it reopens only on a new hover or focus', () => {
  const reactions = run(mouse('enter'), { type: 'escape' }, { type: 'escape' }, mouse('leave'), mouse('enter'));
  assert.deepEqual(
    reactions.map((r) => r.state.open),
    [true, false, false, false, true],
  );
  assert.equal(reactions[1]!.state.hovered, true);
  assert.equal(reactions.at(-1)!.animate, true);
});

test('mouse clicks and Enter follow the link', () => {
  for (const via of ['pointer', 'keyboard'] as const) {
    assert.equal(run({ type: 'click', via })[0]!.preventNavigation, false);
    assert.equal(run(mouse('enter'), { type: 'click', via })[1]!.preventNavigation, false);
  }
});

test('touch: the first tap opens with the hint and animates, cancelling the navigation; the second follows the link', () => {
  const touch: DoodleEvent = { type: 'click', via: 'touch' };
  const [enter, first, second] = run({ type: 'enter', pointerType: 'touch' }, touch, touch);
  assert.deepEqual(enter!.state, INITIAL_STATE, 'a touch "enter" changes nothing');
  assert.deepEqual(
    [first!.state.open, first!.state.armed, first!.animate, first!.preventNavigation],
    [true, true, true, true],
  );
  assert.deepEqual([second!.state.open, second!.preventNavigation], [true, false]);
});

test('touch: a tap that focused the link first still needs a second tap, and animates only once', () => {
  const touch: DoodleEvent = { type: 'click', via: 'touch' };
  const [focus, first, second] = run({ type: 'focus' }, touch, touch);
  assert.equal(focus!.animate, true);
  assert.deepEqual([first!.animate, first!.preventNavigation, first!.state.armed], [false, true, true]);
  assert.equal(second!.preventNavigation, false);
});

test('touch: a tap elsewhere closes and disarms; a tap on the bubble (blur) keeps it; touch leave is ignored', () => {
  const touch: DoodleEvent = { type: 'click', via: 'touch' };
  const reactions = run(
    { type: 'focus' },
    touch,
    { type: 'leave', pointerType: 'touch' },
    { type: 'blur' },
    { type: 'outside' },
    touch,
  );
  assert.deepEqual(
    reactions.map((r) => r.state.open),
    [true, true, true, true, false, true],
  );
  assert.equal(reactions[4]!.state.armed, false);
  assert.equal(reactions[5]!.preventNavigation, true, 'a first tap again');
  assert.equal(reduce(INITIAL_STATE, { type: 'outside' }).state, INITIAL_STATE);
});
