# WeddingApp

Angular 22 single-page app for the wedding system (see `../wedding-architecture/README.md` for the four-repo overview). Generated with [Angular CLI](https://github.com/angular/angular-cli) 22.0.5.

## Prerequisites

- **Node.js 20 LTS**
- **pnpm** — this repo's package manager (pinned via the `packageManager` field in `package.json`). Use `pnpm`, not `npm` or `yarn`, for every script below.
- **Java runtime (JVM), version 11+** — required only for `pnpm gen:api` / `pnpm gen:api:check`: the API client is generated with [openapi-generator](https://openapi-generator.tech/), whose CLI wrapper (`@openapitools/openapi-generator-cli`) runs a Java jar. Install via e.g. `brew install openjdk` (macOS) or Temurin. Must also be available in CI for the drift gate.

Install dependencies:

```bash
pnpm install
```

## Development server

To start a local development server, run:

```bash
pnpm start
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## API client generation

The API contract lives in the architecture hub: `../wedding-architecture/contracts/openapi.json` (written by `wedding-api`, never edited here). The Angular client in `src/app/core/api/` is **generated from that contract, committed, and never hand-edited** (see in-repo ADR `docs/decisions/W-0001-api-client-and-data-layer.md` and hub ADR-0005/ADR-0016).

- **Regenerate the client** (after the hub contract changes):

  ```bash
  pnpm gen:api
  ```

  Reads `../wedding-architecture/contracts/openapi.json` and rewrites `src/app/core/api/` from scratch. Commit the result.

- **Check for drift** (CI gate):

  ```bash
  pnpm gen:api:check
  ```

  Regenerates into a temp directory and diffs against the committed `src/app/core/api/`; exits non-zero if they differ.

- **Non-sibling checkout?** Point `OPENAPI_SOURCE` at the spec:

  ```bash
  OPENAPI_SOURCE=/path/to/openapi.json pnpm gen:api
  ```

The generator version (openapi-generator 7.23.0) and the `typescript-angular` options (Angular 22, `providedIn: 'root'` services, interface models, kebab-case file naming, single request-parameter objects) are pinned in `openapitools.json`. Spec validation is skipped (`skipValidateSpec`) because the contract declares OpenAPI 3.0 while using 3.1 keywords (`const`, `propertyNames`); generation is unaffected.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
pnpm ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
pnpm ng generate --help
```

> Note: components in this repo always use three separate files (`<name>.ts`, `<name>.html`, `<name>.scss`) — see `CLAUDE.md`.

## Building

To build the project run:

```bash
pnpm build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
pnpm test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
pnpm ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
