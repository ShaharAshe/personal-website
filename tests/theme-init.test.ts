// Tests for the no-flash theme script (themeInitScript in src/lib/theme.ts), run as-is in a sandbox with
// a fake document and localStorage: a saved "light"/"dark" sets <html data-theme>; nothing saved, an
// invalid value, or blocked storage sets nothing, so global.css follows the OS setting.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { THEME_STORAGE_KEY, THEMES, themeInitScript as script } from '../src/lib/theme.ts';

type Storage = { getItem(key: string): string | null };

/** Runs the script once; returns the resulting data-theme (undefined = not set). */
function run(storage: Storage | (() => never)): string | undefined {
  const dataset: Record<string, string> = {};
  const context: Record<string, unknown> = { document: { documentElement: { dataset } } };
  if (typeof storage === 'function') Object.defineProperty(context, 'localStorage', { get: storage });
  else context.localStorage = storage;
  vm.runInNewContext(script, context);
  return dataset.theme;
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

test('the script is self-contained (inlined as-is, so no imports or exports)', () => {
  assert.doesNotMatch(script, /^\s*(import|export)\b/m);
});
