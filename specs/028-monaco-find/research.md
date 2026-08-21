# Research: Monaco Text Search

## Decision 1: Load Monaco's built-in Find contribution

- **Decision**: Import `monaco-editor/esm/vs/editor/contrib/find/browser/findController.js`.
- **Rationale**: Cacablu currently imports the lightweight `editor.api.js` entrypoint. That entrypoint creates editors but does not register optional contributions such as Find. The existing Monaco version already contains the complete find controller and widget.
- **Alternatives considered**:
  - Build a custom search widget: rejected because it would duplicate Monaco behavior, accessibility, options, decorations, focus, and disposal.
  - Import Monaco's full editor bundle: rejected because it registers unrelated contributions and broadens bundle/runtime behavior unnecessarily.
  - Add only a DOM `keydown` listener: rejected because the `actions.find` command and widget do not exist until the contribution is registered.

## Decision 2: Use scoped Monaco keybindings

- **Decision**: Rely on the Find contribution's existing `CtrlCmd+F` keybinding.
- **Rationale**: Monaco handles the shortcut only while its editor/keybinding context is active and prevents browser Find for that keystroke. Outside Monaco, no Cacablu listener runs, so native browser behavior is preserved.
- **Alternatives considered**:
  - Global window listener: rejected because it would capture `Ctrl+F` outside editors and require manual focus routing.
  - Add a duplicate editor command in every panel: rejected because the registered contribution already defines the command and its context correctly.

## Decision 3: Validate through real-browser behavior

- **Decision**: Add a Playwright smoke/regression script covering all three panels.
- **Rationale**: Registration, focus, keybinding dispatch, widget rendering, and keyboard navigation are integration behavior inside Monaco. A mock-based unit test would mainly retest the import wrapper rather than the feature.
- **Alternatives considered**:
  - Unit-test Monaco private controller APIs: rejected because they are implementation details and require a browser-like service graph.
  - Manual-only testing: rejected because shortcut registration can regress silently when imports are reorganized.
