// Tests for the no-flash theme script (themeInitScript in src/lib/theme.ts), run as-is in a sandbox with
// a fake document and localStorage: a saved "light"/"dark" sets <html data-theme>; nothing saved, an
// invalid value, or blocked storage sets nothing, so global.css follows the OS setting. The same script sets
// <html data-style="terminal"> for a saved terminal view (Task F.7), and nothing otherwise.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { STYLE_STORAGE_KEY, THEME_STORAGE_KEY, THEMES, themeInitScript as script } from '../src/lib/theme.ts';

type Storage = { getItem(key: string): string | null };

/** Runs the script once; returns the resulting dataset of <html>. */
function runAll(storage: Storage | (() => never)): Record<string, string> {
  const dataset: Record<string, string> = {};
  const context: Record<string, unknown> = { document: { documentElement: { dataset } } };
  if (typeof storage === 'function') Object.defineProperty(context, 'localStorage', { get: storage });
  else context.localStorage = storage;
  vm.runInNewContext(script, context);
  return dataset;
}

/** Runs the script once; returns the resulting data-theme (undefined = not set). */
function run(storage: Storage | (() => never)): string | undefined {
  return runAll(storage).theme;
}

/** A storage holding these values by key. */
function store(values: Record<string, string>): Storage {
  return { getItem: (key) => values[key] ?? null };
}

/** A storage holding `saved` under the theme key (null = nothing saved). */
function saved(value: string | null): Storage {
  return { getItem: (key) => (key === THEME_STORAGE_KEY ? value : null) };
}

for (const theme of THEMES) {
  test(`a saved "${theme}" is applied`, () => {
    assert.equal(run(saved(theme)), theme);
  });
}

test('nothing saved: no data-theme, so the OS setting applies', () => {
  assert.equal(run(saved(null)), undefined);
});

for (const value of ['blue', '', 'LIGHT', 'Dark', 'null', ' light', '{"theme":"dark"}']) {
  test(`an invalid saved value (${JSON.stringify(value)}) is ignored`, () => {
    assert.equal(run(saved(value)), undefined);
  });
}

test('getItem throwing is caught: no data-theme', () => {
  const throwing: Storage = {
    getItem() {
      throw new Error('SecurityError');
    },
  };
  assert.equal(run(throwing), undefined);
});

test('accessing localStorage itself throwing (storage blocked) is caught: no data-theme', () => {
  assert.equal(
    run(() => {
      throw new Error('SecurityError: access denied');
    }),
    undefined,
  );
});

test('localStorage missing entirely is caught: no data-theme', () => {
  const dataset: Record<string, string> = {};
  vm.runInNewContext(script, { document: { documentElement: { dataset } } });
  assert.equal(dataset.theme, undefined);
});

// --- terminal view (Task F.7) ---

test('a saved "terminal" sets data-style, next to the saved theme', () => {
  assert.deepEqual(runAll(store({ [STYLE_STORAGE_KEY]: 'terminal', [THEME_STORAGE_KEY]: 'light' })), {
    style: 'terminal',
    theme: 'light',
  });
});

test('a saved "terminal" with no saved theme sets only data-style', () => {
  assert.deepEqual(runAll(store({ [STYLE_STORAGE_KEY]: 'terminal' })), { style: 'terminal' });
});

for (const value of ['regular', 'Terminal', 'TERMINAL', ' terminal', 'dark', '', 'null']) {
  test(`a saved style of ${JSON.stringify(value)} sets no data-style (the regular look)`, () => {
    assert.equal(runAll(store({ [STYLE_STORAGE_KEY]: value })).style, undefined);
  });
}

test('the theme is applied even if reading the style throws, and the other way round', () => {
  const styleThrows: Storage = {
    getItem(key) {
      if (key === STYLE_STORAGE_KEY) throw new Error('SecurityError');
      return key === THEME_STORAGE_KEY ? 'light' : null;
    },
  };
  assert.deepEqual(runAll(styleThrows), { theme: 'light' });

  const themeThrows: Storage = {
    getItem(key) {
      if (key === THEME_STORAGE_KEY) throw new Error('SecurityError');
      return key === STYLE_STORAGE_KEY ? 'terminal' : null;
    },
  };
  assert.deepEqual(runAll(themeThrows), { style: 'terminal' });
});

test('blocked storage sets neither data-theme nor data-style', () => {
  assert.deepEqual(
    runAll(() => {
      throw new Error('SecurityError: access denied');
    }),
    {},
  );
});

test('the script is self-contained (inlined as-is, so no imports or exports)', () => {
  assert.doesNotMatch(script, /^\s*(import|export)\b/m);
});
