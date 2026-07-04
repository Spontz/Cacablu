# Contract: Graphics Settings

## Menu Command

Location:

```text
Edit
|-- Undo
|-- separator
|-- Cut
|-- Copy
|-- Paste
|-- Delete
|-- separator
`-- Graphics
```

Selecting `Graphics` opens the floating Graphics panel.

## Dialog Layout

Top group: `Rendering Context Settings`

- Color Depth dropdown
- Width numeric input
- Height numeric input
- V-sync dropdown
- Full Screen checkbox

Table:

| FBO | Ratio | Format | Width | Height | Attachments | Filter |
|-----|-------|--------|-------|--------|-------------|--------|

The table always contains rows `0..24`.

## Phoenix Endpoint

### PUT /api/graphics

Cacablu sends a complete graphics configuration.

Request:

```json
{
  "requestId": "graphics-mr-example",
  "context": {
    "colorDepth": 32,
    "width": 640,
    "height": 400,
    "fullscreen": false,
    "vsync": true,
    "targetFps": 60
  },
  "fbos": [
    {
      "index": 0,
      "ratio": 1,
      "format": "RGB",
      "width": null,
      "height": null,
      "attachments": 2,
      "filter": "bilinear"
    },
    {
      "index": 20,
      "ratio": null,
      "format": "RGB",
      "width": 4096,
      "height": 4096,
      "attachments": 1,
      "filter": "bilinear"
    }
  ]
}
```

Successful response:

```json
{
  "requestId": "graphics-mr-example",
  "ok": true,
  "config": {
    "context": {
      "colorDepth": 32,
      "width": 640,
      "height": 400,
      "fullscreen": false,
      "vsync": true,
      "targetFps": 60
    },
    "fbos": []
  },
  "warnings": []
}
```

Error response:

```json
{
  "requestId": "graphics-mr-example",
  "ok": false,
  "code": "invalid-graphics-config",
  "message": "Invalid graphics configuration.",
  "details": [
    {
      "path": "fbos[20].width",
      "message": "Width must be a positive integer."
    }
  ]
}
```

## Cacablu Behavior

- Cacablu validates before sending.
- Cacablu sends only when Phoenix is connected.
- Cacablu closes the panel only after Phoenix returns `ok: true`.
- Cacablu writes failures and warnings to Events.
- Cacablu does not write Phoenix's `graphics.spo` directly.

## Phoenix File Mapping

Phoenix persists the accepted config as `data/config/graphics.spo`.

Expected mapping:

```text
gl_fullscreen false
gl_width 640
gl_height 400
gl_aspect 1.6
gl_vsync true
gl_colorDepth 32

fbo_0_ratio 1
fbo_0_format RGB
fbo_0_colorAttachments 2
fbo_0_useFilter true

fbo_20_width 4096
fbo_20_height 4096
fbo_20_format RGB
fbo_20_colorAttachments 1
fbo_20_useFilter true
```

