# Testing

This document currently covers the web app's testing setup.

## Web

Vitest for logic tests (env helpers, parsers, claim mappers). Tests are co-located with source as `*.test.ts(x)`. Configured in [`src/Ignis.Web/vitest.config.ts`](../src/Ignis.Web/vitest.config.ts).

```
npm test            # single run, for CI
npm run test:watch  # local iteration
```

Pattern: stub `process.env` via `vi.stubEnv` with `vi.unstubAllEnvs` in `afterEach`.
