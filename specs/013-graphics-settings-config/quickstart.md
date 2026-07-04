# Quickstart: Graphics Settings Config

## Manual Validation

1. Start Phoenix.
2. Open Cacablu.
3. Connect Cacablu to Phoenix.
4. Open a project with graphics variables and FBO rows.
5. Open `Edit > Graphics`.
6. Confirm the panel shows rendering context fields and 25 FBO rows.
7. Change width, height, V-sync, one ratio row, one explicit-size row, one format, and one filter.
8. Press OK.
9. Confirm the panel remains open and shows applied feedback after Phoenix returns success.
10. Confirm Phoenix has written `data/config/graphics.spo`.
11. Confirm `graphics.spo` contains the changed `gl_` and `fbo_` values.
12. Disconnect Phoenix, reopen the panel, press OK, and confirm Cacablu writes an Event instead of showing an alert.

## Test Focus

- Local normalization from project DB values to `GraphicsConfig`.
- Dialog validation for context and FBO rows.
- API client success and failure response handling.
- Events emission for disconnected Phoenix and endpoint errors.

