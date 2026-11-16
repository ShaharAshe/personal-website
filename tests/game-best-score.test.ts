// The 404 game's best score in localStorage (Task F.3, src/lib/game/best-score.ts): saved only when beaten, read back
// safely, and never throwing when storage fails, like the theme (tests/theme-toggle.test.ts).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BEST_SCORE_KEY, readBest, saveBest } from '../src/lib/game/best-score.ts';

const memory = (initial: Record<string, string> = {}) => {
  const map = new Map(Object.entries(initial));
  return {
    map,
    storage: {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
    },
  };
};

const throwing = {
  getItem(): string | null {
    throw new Error('SecurityError');
  },
  setItem() {
    throw new Error('QuotaExceededError');
  },
};

test('a higher score is saved under the key and becomes the best', () => {
  const { map, storage } = memory();
  assert.equal(
    saveBest(120, 40, () => storage),
    120,
  );
  assert.deepEqual([...map], [[BEST_SCORE_KEY, '120']]);
  assert.equal(
    readBest(() => storage),
    120,
  );
});

test('a lower or equal score is not saved', () => {
  const { map, storage } = memory({ [BEST_SCORE_KEY]: '300' });
  assert.equal(
    saveBest(120, 300, () => storage),
    300,
  );
  assert.equal(
    saveBest(300, 300, () => storage),
    300,
  );
  assert.equal(map.get(BEST_SCORE_KEY), '300');
});

test('nothing saved, or something that is not a whole positive number, reads as 0', () => {
  for (const value of [undefined, '', 'abc', '-5', '1.5', 'NaN', 'Infinity', '1e400']) {
    const { storage } = memory(value === undefined ? {} : { [BEST_SCORE_KEY]: value });
    assert.equal(
      readBest(() => storage),
      0,
      `value ${value}`,
    );
  }
});

test('throwing getItem/setItem never throws; the best still counts for this visit', () => {
  assert.equal(
    readBest(() => throwing),
    0,
  );
  assert.equal(
    saveBest(50, 0, () => throwing),
    50,
  );
});

test('blocked storage (reading localStorage itself throws) never throws', () => {
  const blocked = () => {
    throw new Error('SecurityError: access denied');
  };
  assert.equal(readBest(blocked), 0);
  assert.doesNotThrow(() => saveBest(10, 0, blocked));
  assert.equal(saveBest(10, 0, blocked), 10);
});
