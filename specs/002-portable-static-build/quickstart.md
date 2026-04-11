# Quickstart: Portable Static Build

## Goal

Verify that the generated application output can be opened by double-clicking the
built entry HTML file and that the same output still works when served normally.

## Run

```bash
npm install
npm run dev
```

Use this during active development.

## Package

```bash
npm run package
```

This generates the portable static app in `dist/`.

## Preview Built Output

```bash
npm run preview
```

Use this to serve the already-built `dist/` output over HTTP.

## Manual Validation Checklist

1. Run `npm run package`.
2. Open `dist/index.html` directly from the local filesystem in a supported browser.
3. Confirm the menu bar and workspace render instead of a blank page.
4. Confirm the connection status is visible without a running local engine.
5. Copy the `dist/` folder to a different path and repeat the local-open test.
6. Run `npm run preview` and confirm the app still opens over HTTP.

## Quality Checks

```bash
npm run typecheck
npm run lint
npm run test
npm run package
```

## Notes

- The portable artifact is the built output, not the development source files.
- The intended workflow is:
  - `npm run dev` for development
  - `npm run package` for the portable local-openable build
  - `npm run preview` to serve the built output
