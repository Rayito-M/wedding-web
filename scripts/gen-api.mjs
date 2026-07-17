#!/usr/bin/env node
/**
 * Regenerates the Angular API client from the hub OpenAPI contract.
 *
 * Usage:
 *   node scripts/gen-api.mjs           # regenerate into src/app/core/api/
 *   node scripts/gen-api.mjs --check   # regenerate into a temp dir and diff
 *                                      # against the committed output (drift gate)
 *
 * Environment:
 *   OPENAPI_SOURCE  overrides the input spec path (defaults to the sibling
 *                   ../wedding-architecture/contracts/openapi.json, as pinned
 *                   in openapitools.json)
 *
 * The generator version and typescript-angular options are pinned in
 * openapitools.json (generator key: "wedding-api"); this script only resolves
 * the input/output paths and invokes the CLI. Requires a JVM (see README.md).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checkMode = process.argv.includes('--check');

const openapitools = JSON.parse(readFileSync(path.join(repoRoot, 'openapitools.json'), 'utf8'));
const generator = openapitools['generator-cli'].generators['wedding-api'];

const inputSpec = process.env.OPENAPI_SOURCE
  ? path.resolve(process.cwd(), process.env.OPENAPI_SOURCE)
  : path.resolve(repoRoot, generator.inputSpec);

if (!existsSync(inputSpec)) {
  console.error(`gen-api: input spec not found: ${inputSpec}`);
  console.error(
    'gen-api: checkout ../wedding-architecture next to this repo, or point OPENAPI_SOURCE at contracts/openapi.json',
  );
  process.exit(1);
}

const committedOutput = path.resolve(repoRoot, generator.output);

if (checkMode && !existsSync(committedOutput)) {
  console.error(`gen-api: no committed client at ${generator.output}; run \`pnpm gen:api\` first`);
  process.exit(1);
}

const output = checkMode ? mkdtempSync(path.join(tmpdir(), 'wedding-api-client-')) : committedOutput;

const additionalProperties = Object.entries(generator.additionalProperties)
  .map(([key, value]) => `${key}=${value}`)
  .join(',');

const run = (command, args) => {
  const result = spawnSync(command, args, { cwd: repoRoot, stdio: 'inherit' });
  if (result.error) {
    console.error(`gen-api: failed to run ${command}: ${result.error.message}`);
    process.exit(1);
  }
  return result.status ?? 1;
};

// Regenerate from scratch so files removed from the contract do not linger.
if (!checkMode) {
  rmSync(committedOutput, { recursive: true, force: true });
}

const generateArgs = [
  'generate',
  '--generator-name', generator.generatorName,
  '--input-spec', inputSpec,
  '--output', output,
  '--additional-properties', additionalProperties,
];
if (generator.enumNameMappings) {
  // Maps enum values that sanitize to invalid TS identifiers (e.g. '€€') to
  // explicit names; without this the generator emits syntactically broken enums.
  generateArgs.push(
    '--enum-name-mappings',
    Object.entries(generator.enumNameMappings)
      .map(([value, name]) => `${value}=${name}`)
      .join(','),
  );
}
if (generator.skipValidateSpec) {
  // The hub contract declares OpenAPI 3.0 but uses 3.1 keywords (const,
  // propertyNames); strict validation rejects it while generation is fine.
  generateArgs.push('--skip-validate-spec');
}

const generateStatus = run(
  path.join(repoRoot, 'node_modules', '.bin', 'openapi-generator-cli'),
  generateArgs,
);

if (generateStatus !== 0) {
  console.error('gen-api: generation failed');
  process.exit(generateStatus);
}

if (!checkMode) {
  console.log(`gen-api: client regenerated into ${generator.output}`);
  process.exit(0);
}

// Drift gate: compare the committed client with the fresh generation.
const diffStatus = run('git', [
  'diff', '--no-index', '--exit-code', '--stat',
  committedOutput, output,
]);

rmSync(output, { recursive: true, force: true });

if (diffStatus !== 0) {
  console.error(
    `gen-api: drift detected between ${generator.output} and the contract; run \`pnpm gen:api\` and commit the result`,
  );
  process.exit(1);
}

console.log('gen-api: committed client matches the contract (no drift)');
