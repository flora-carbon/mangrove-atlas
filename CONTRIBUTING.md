# Contributing

Thanks for helping make mangrove data more open.

1. Fork the repo, then `pnpm install` and `pnpm dev`.
2. Keep Earth Engine logic in `src/lib/server/ee/recipes.ts` (pure, no Node imports) so it can be exported to the Code Editor with `pnpm ee:script`.
3. Any new dataset needs an entry in `src/lib/datasets.ts` with producer, version, licence, citation and asset ID. **Only add datasets whose licence allows commercial reuse with attribution** (e.g. CC BY 4.0, CC0, Copernicus). Do not add NICFI/Planet or other non-commercial data to the default layers.
4. Put result-shaping logic in pure functions with unit tests (`tests/unit`).
5. Before opening a PR, run `pnpm typecheck && pnpm lint && pnpm test && pnpm build && pnpm test:e2e`.

By contributing you agree that your contributions are licensed under Apache-2.0.
