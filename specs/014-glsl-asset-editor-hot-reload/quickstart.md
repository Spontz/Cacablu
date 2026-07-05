# Quickstart: GLSL Asset Editor Hot Reload

1. Start Phoenix with the editor API enabled.
2. Start Cacablu and load a project containing a published `.glsl` asset used by at least one bar.
3. Double-click the `.glsl` asset in Assets or Resources.
4. Edit the shader text in Monaco.
5. Press `Actualizar`.
6. Verify Phoenix preview changes without modifying the project DB value.
7. Press `Guardar`.
8. Verify the project DB asset content changes and Phoenix receives a persisted asset write.
9. Delete or unpublish the same asset.
10. Verify Events lists dependent section IDs reported by Phoenix.
