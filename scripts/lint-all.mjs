#!/usr/bin/env node
/**
 * `pnpm lint`'s real entry point. Runs both lint tools unconditionally and
 * fails if either fails — neither can mask the other.
 *
 * Why this exists rather than `ng lint && node scripts/stylelint-check.mjs`:
 * this repo carries 5 accepted-but-unfixed ESLint errors (CLAUDE.md hard
 * rule 11's documented exception, 4 in `src/app/shared/modal/` plus one in
 * `guest-profile-modal.ts`), which are permanent, not transient. With `&&`,
 * `ng lint`'s non-zero exit short-circuits the chain and
 * `scripts/stylelint-check.mjs` never runs — "wired into `pnpm lint`" was
 * true of the text of the script but false of its behaviour on every real
 * invocation of this command. That is exactly the "enforcement that isn't"
 * failure mode hub ADR-0041 §7 exists to prevent, and it would have stayed
 * invisible indefinitely: those 5 errors are not expected to reach zero.
 *
 * Both children run unconditionally (`;`, not `&&`), inheriting stdio, and
 * the aggregate exit code is non-zero if either is.
 */

import { spawnSync } from 'node:child_process';

function run(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { stdio: 'inherit', shell: false });
  const failed = result.status !== 0;
  console.log(`${failed ? '✖' : '✔'} ${label} ${failed ? 'failed' : 'passed'} (exit ${result.status})`);
  return result.status ?? 1;
}

const eslintExit = run('ESLint (ng lint)', 'ng', ['lint']);
const stylelintExit = run('stylelint (scripts/stylelint-check.mjs)', 'node', ['scripts/stylelint-check.mjs']);

const overall = eslintExit !== 0 || stylelintExit !== 0 ? 1 : 0;
console.log(
  `\npnpm lint: ESLint ${eslintExit === 0 ? 'passed' : 'FAILED'}, stylelint ${stylelintExit === 0 ? 'passed' : 'FAILED'}.`,
);
process.exit(overall);
