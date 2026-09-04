#!/usr/bin/env node
/**
 * Runs stylelint against every SCSS file under `src/` and fails only on violations that
 * were not already present when `.stylelint-baseline.json` was captured.
 *
 * Why a baseline instead of `stylelint --fix` or a bare pass/fail: hub
 * ADR-0041 §8 forbids a one-cut rewrite of a live app, and there are
 * ~1,037 raw `px` literals and 34 hand-spelled media queries already in
 * the tree (T342). Auto-fixing or hard-failing on all of them the day
 * stylelint is introduced would either mass-rewrite CSS nobody reviewed
 * screen by screen, or make `pnpm lint` permanently red and therefore
 * ignored — exactly the "guidance alone" failure mode ADR-0041 §7 names
 * as the reason stylelint exists at all.
 *
 * Mechanism: for every (file, rule) pair, the baseline records how many
 * violations existed on the day it was captured. A run fails only if a
 * pair's current count *exceeds* its baseline count — i.e. new code
 * introduced a violation stylelint wasn't already failing to flag. This is
 * the same shape as ESLint's own built-in suppressions feature
 * (`eslint --suppress-all` / `eslint-suppressions.json`, shipped 2024):
 * counts per (file, rule), not exact line numbers, because a line number
 * drifts the moment an unrelated edit lands above it and would otherwise
 * make the baseline noisy rather than useful. The trade-off is the same
 * one ESLint accepted: precision is at (file, rule) granularity, not the
 * exact declaration — a file that already has 3 raw-px violations and
 * gains a 4th is caught; distinguishing which one is "new" when 2 of the
 * original 3 also moved is not attempted.
 *
 * Regenerate the baseline (e.g. after cleaning some violations up, or the
 * first time this runs) with `node scripts/stylelint-check.mjs --write`.
 */

import stylelint from 'stylelint';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(fileURLToPath(import.meta.url), '../..');
const baselinePath = path.join(repoRoot, '.stylelint-baseline.json');
const configPath = path.join(repoRoot, 'stylelint.config.mjs');

const writeMode = process.argv.includes('--write');

async function loadBaseline() {
  try {
    const raw = await readFile(baselinePath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

function relPath(absPath) {
  return path.relative(repoRoot, absPath).split(path.sep).join('/');
}

async function main() {
  const config = (await import(configPath)).default;
  const lintResult = await stylelint.lint({
    files: ['src/**/*.scss'],
    cwd: repoRoot,
    config,
  });

  /** @type {Record<string, Record<string, {line:number,column:number,text:string}[]>>} */
  const current = {};
  for (const fileResult of lintResult.results) {
    if (fileResult.ignored) continue;
    const file = relPath(fileResult.source);
    for (const warning of fileResult.warnings) {
      current[file] ??= {};
      current[file][warning.rule] ??= [];
      current[file][warning.rule].push({
        line: warning.line,
        column: warning.column,
        text: warning.text,
      });
    }
  }

  if (writeMode) {
    /** @type {Record<string, Record<string, number>>} */
    const baseline = {};
    for (const [file, rules] of Object.entries(current)) {
      baseline[file] = {};
      for (const [rule, warnings] of Object.entries(rules)) {
        baseline[file][rule] = warnings.length;
      }
    }
    await writeFile(baselinePath, JSON.stringify(baseline, null, 2) + '\n');
    const total = Object.values(baseline).reduce(
      (sum, rules) => sum + Object.values(rules).reduce((a, b) => a + b, 0),
      0,
    );
    console.log(
      `stylelint baseline written: ${total} violation(s) across ${Object.keys(baseline).length} file(s) → ${relPath(baselinePath)}`,
    );
    return;
  }

  const baseline = await loadBaseline();
  const newViolations = [];

  for (const [file, rules] of Object.entries(current)) {
    for (const [rule, warnings] of Object.entries(rules)) {
      const baselineCount = baseline[file]?.[rule] ?? 0;
      if (warnings.length > baselineCount) {
        const excess = warnings.slice(baselineCount);
        for (const w of excess) {
          newViolations.push({ file, rule, ...w });
        }
      }
    }
  }

  if (newViolations.length === 0) {
    const totalBaselined = Object.values(baseline).reduce(
      (sum, rules) => sum + Object.values(rules).reduce((a, b) => a + b, 0),
      0,
    );
    console.log(
      `stylelint: no new violations (${totalBaselined} pre-existing, baselined — run with --write to refresh after cleanup).`,
    );
    process.exitCode = 0;
    return;
  }

  console.error(`stylelint: ${newViolations.length} new violation(s) not covered by the baseline:\n`);
  for (const v of newViolations) {
    console.error(`  ${v.file}:${v.line}:${v.column}  ${v.rule}\n    ${v.text}`);
  }
  console.error(
    '\nIf these are intentional and reviewed, refresh the baseline with `node scripts/stylelint-check.mjs --write` and commit it — never as a blanket rewrite (hub ADR-0041 §8).',
  );
  process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
