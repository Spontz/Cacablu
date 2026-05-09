# Contract: Engine Data Pool

## Purpose

When the user presses Play after loading a SQLite project, the app asks the user to select the visualization engine folder and recreates a `data` folder inside it. The `data` folder contains a `pool` subtree with the files stored in the SQLite project, one `.spo` file per demo bar or section, a copied `resources` folder from the selected engine folder, and `config/graphics.spo`, `config/loader.spo`, and `config/control.spo` generated from the SQLite project data.

## Folder Layout

```text
<selected-engine-folder>/
`-- data/
    |-- <bar id>-<bar type>.spo
    |-- config/
    |   |-- control.spo
    |   |-- graphics.spo
    |   `-- loader.spo
    `-- pool/
        |-- <root resource files>
        `-- <resource folders>/
            `-- <nested resource files>
    `-- resources/
        `-- <copied engine resources>
```

## Producer And Consumer

- Producer: Cacablu browser app
- Consumer: Visualization engine
- Write timing: after user presses Play and grants folder write access
- Data source: SQLite `folders` and `files` records already loaded into the app

## Rules

- If `data` already exists, the app must remove it recursively before writing the new export.
- The app must create `data` as a folder.
- The app must create `data/config` as a folder.
- The app must create or reuse `data/pool` as a folder.
- Root-level SQLite files are written directly under `data/pool`.
- SQLite files inside folders are written under matching folders inside `data/pool`.
- Folder names and file names are taken from the SQLite project records.
- File contents are the binary bytes stored for each SQLite file record.
- Existing files with the same path may be replaced by the current SQLite contents.
- The app must create one `.spo` file directly inside `data` for each SQLite bar.
- `.spo` filenames use `<bar id>-<bar type>.spo`; empty bar types use `section`.
- The app must create `data/config/graphics.spo`.
- The app must create `data/config/loader.spo`.
- The app must create `data/config/control.spo`.
- The app must copy the selected engine folder's `resources` directory recursively to `data/resources`.
- `graphics.spo` starts with exactly these entries in order: `gl_fullscreen`, `gl_width`, `gl_height`, `gl_aspect`, `gl_vsync`.
- `gl_fullscreen`, `gl_width`, `gl_height`, and `gl_vsync` are read from `fullScreen`, `screenWidth`, `screenHeight`, and `vsync` in the SQLite `variables` table.
- `gl_aspect` is calculated as `screenWidth / screenHeight`.
- After one blank line, `graphics.spo` contains one block per FBO from FBOs.
- FBO blocks use `fbo_<id minus 1>_ratio` when no width/height is set, or `fbo_<id minus 1>_width` and `fbo_<id minus 1>_height` when explicit size is set.
- FBO blocks always include `fbo_<id minus 1>_format` and `fbo_<id minus 1>_colorAttachments`.
- `loader.spo` starts with `:::loading` followed by the `loaderCode` value from the SQLite `variables` table. If `loaderCode` already starts with `:::loading`, the header is not duplicated.
- `control.spo` contains project control lines derived from the SQLite `variables` table plus fixed debug/playback flags.

## SPO File Format

```text
:::drawVolumeImage
id 51
start 0
end 200
enabled 1
layer 50
blend ONE ONE_MINUS_SRC_ALPHA
blendequation ADD

<section script text>
```

Field mapping:

- `:::` prefix plus bar `type`
- `id`: bar id
- `start`: bar start time
- `end`: bar end time
- `enabled`: `1` when enabled, otherwise `0`
- `layer`: bar layer
- `blend`: source and destination blend values
- `blendequation`: blend equation value
- blank line
- raw section script text

## Graphics Config Format

```text
gl_fullscreen 0
gl_width 640
gl_height 360
gl_aspect 1.7777777777777777
gl_vsync 1

fbo_0_ratio 1
fbo_0_format RGBA
fbo_0_colorAttachments 2

fbo_20_width 512
fbo_20_height 512
fbo_20_format RGB
fbo_20_colorAttachments 1
```

## Loader Config Format

```text
:::loading
<loaderCode text>
```

## Control Config Format

```text
demo_name Phoenix demo engine
debug 1
loop 1
sound 1
demo_start 0.0
demo_end 10
slave 1
debugEnableAxis 1
debugEnableFloor 1
```

Field mapping:

- `demo_name`: `demoName` from SQLite `variables`
- `debug`: fixed `1`
- `loop`: `demoLoop` from SQLite `variables`
- `sound`: fixed `1`
- `demo_start`: `startTime` from SQLite `variables`
- `demo_end`: `endTime` from SQLite `variables`
- `slave`: fixed `1`
- `debugEnableAxis`: fixed `1`
- `debugEnableFloor`: fixed `1`

## Example

If the Pool panel shows:

```text
assets/
  images/
    logo.png
root.txt
```

The selected engine folder receives:

```text
data/
|-- 51-drawVolumeImage.spo
|-- config/
|   |-- control.spo
|   |-- graphics.spo
|   `-- loader.spo
|-- pool/
    |-- root.txt
    `-- assets/
        `-- images/
            `-- logo.png
`-- resources/
    `-- <copied engine resources>
```

## Error Behavior

- If no project is open, the app must not prompt for an engine folder.
- If the user cancels folder selection, the app must not create or modify `data/pool`.
- If write permission is denied, the app must show a recoverable error.
- If removing the previous `data` entry fails, the app must report a clear write error.
- If the source `resources` folder is missing or cannot be read, the app must report a clear write error.
- If a folder or file write fails, the app must not report preparation success.

## Non-Goals

- This contract does not launch the visualization engine.
- This contract does not define WebSocket playback messages.
- This contract does not write a JSON manifest.
- This contract does not require validating that the selected folder contains a real executable.
