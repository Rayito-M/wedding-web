// stylelint-rules/no-unpaired-overflow-hidden.test.mjs
//
// A small regression fixture for `no-unpaired-overflow-hidden.mjs` — T351.
// There was no test file for this rule before T351; adding one turned out
// to be small (four inline CSS fixtures run through stylelint's own `code`
// option), so it is included here rather than deferred.
//
// Not wired into `pnpm test` (`ng test` / `@angular/build:unit-test` is
// scoped to `src/**/*.spec.ts` — `angular.json`'s `test.options.include` —
// and this rule lives outside `src/`, by design: it is repo tooling, not
// application code) or into `pnpm lint` (`scripts/lint-all.mjs` runs
// `ng lint` and `scripts/stylelint-check.mjs`, neither of which executes
// arbitrary test files). Uses Node's built-in test runner — no new
// dependency — and is run directly:
//
//   node --test stylelint-rules/no-unpaired-overflow-hidden.test.mjs

import { test } from 'node:test';
import assert from 'node:assert/strict';
import stylelint from 'stylelint';

const config = {
  customSyntax: 'postcss-scss',
  plugins: ['./stylelint-rules/no-unpaired-overflow-hidden.mjs'],
  rules: {
    'wedding/no-unpaired-overflow-hidden': true,
  },
};

async function lint(code) {
  const result = await stylelint.lint({ code, config });
  return result.results[0].warnings;
}

test('flags a genuine unpaired layout `hidden`', async () => {
  const warnings = await lint(`
    .shell {
      position: relative;
      overflow: hidden;
    }
  `);
  assert.equal(warnings.length, 1);
  assert.equal(warnings[0].rule, 'wedding/no-unpaired-overflow-hidden');
});

test('does not flag `hidden` paired with a following `clip`', async () => {
  const warnings = await lint(`
    .shell {
      overflow: hidden;
      overflow: clip;
    }
  `);
  assert.equal(warnings.length, 0);
});

test('does not flag the single-line ellipsis tell (`text-overflow`/`white-space: nowrap`)', async () => {
  const warnings = await lint(`
    .truncated {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  `);
  assert.equal(warnings.length, 0);
});

test('does not flag the visually-hidden tell (`clip-path`)', async () => {
  const warnings = await lint(`
    .sr-only {
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
    }
  `);
  assert.equal(warnings.length, 0);
});

test('does not flag the multi-line clamp tell (`-webkit-line-clamp`) — T351', async () => {
  const warnings = await lint(`
    .row-snippet {
      display: -webkit-box;
      overflow: hidden;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
    }
  `);
  assert.equal(warnings.length, 0);
});
