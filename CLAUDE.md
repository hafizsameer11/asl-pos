# ASL Luxury POS

Interactive prototype of an in-store POS (the till) plus a new "POS" menu for the store's existing admin. **Prototype only**: sample data in the browser, no backend. The user's developer builds the real version against their own custom backend (not WordPress or WooCommerce). See [README.md](README.md).

ASL Luxury is similar to Kokolet Luxury but is **not** Kokolet: don't use Kokolet's name, logo or assets.

## Repo & GitHub

- **GitHub repo:** `Flipit-app/asl-luxury-pos`. Check `git remote -v` before pushing.
- **Account:** `Flipit-app`, shared with other sessions. Never run `gh auth switch` or `gh auth logout`.
- **Workflow:** branch, commit, push, `gh pr create`, give the user the link. The user merges. Never push to or merge into `main`.

## Working on it

- Design: brand is black and white with a small burnt-orange accent (the `gold` token holds the orange). Black sidebars, light content area, no loud gradients or glows.
- Money is whole naira. Pricing rules live in `src/lib/pricing.ts` with tests.
- Zustand v5: never return a new array or object from a `useDb(...)` selector (React error #185, infinite render). Select the raw slice and filter in `useMemo`.
- Before a PR: `pnpm test` and `pnpm build` (the build runs the typecheck).
- Service workers don't run in `pnpm dev`, and the Claude desktop browser pane refuses to register them, so test offline and install against `pnpm preview` in Edge or Chrome.
