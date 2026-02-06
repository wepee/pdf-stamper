# PDF Text Stamp API

Stateless REST API for adding text watermarks/stamps to PDFs.

## Quick Start

```bash
npm install
npm run dev
```

## Deploy to Railway

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new)

1. Click the button above or push your repo to GitHub
2. Connect your repository in Railway
3. Set environment variables in Railway dashboard:
   - `API_KEYS`: Comma-separated list of API keys (e.g., `key1,key2,key3`)
   - `PORT` and `NODE_ENV` are auto-configured
4. Railway will automatically detect the `Dockerfile` and deploy

The service will be available at your Railway-provided URL.

## Configuration

| Variable   | Description                    | Default         |
| ---------- | ------------------------------ | --------------- |
| `PORT`     | Server port                    | `3000`          |
| `API_KEYS` | Comma-separated valid API keys | (auth disabled) |

Example:

```bash
API_KEYS=key1,key2,key3 npm start
```

## Usage

```bash
curl -X POST http://localhost:3000/v1/stamp \
  -H "Authorization: Bearer your-api-key" \
  -F "file=@input.pdf" \
  -F 'payload={
    "text": {
      "main": "CONFIDENTIAL",
      "secondary": "Document N° 2024-001",
      "showPageNumbers": true
    },
    "pages": "all",
    "position": {
      "anchor": "center",
      "marginX": 0,
      "marginY": 0
    },
    "style": {
      "fontSize": 48,
      "opacity": 30,
      "rotation": 45
    }
  }' \
  --output stamped.pdf
```

## Payload Reference

### text (required)

- `main` (string, required): Primary stamp text, max 1000 chars
- `secondary` (string, optional): Secondary text line, max 1000 chars
- `showPageNumbers` (boolean, optional): If true, adds "Page X / Y" automatically after main and secondary text (default: false)

### pages

- `"all"` (default) or array of page numbers `[1, 3, 5]`
- 1-indexed, strict mode (invalid pages = error)

### position

- `anchor`: `top-left`, `top-center`, `top-right`, `center-left`, `center` (default), `center-right`, `bottom-left`, `bottom-center`, `bottom-right`
- `marginX`: Horizontal offset in PDF points (default: 0, must be positive)
- `marginY`: Vertical offset in PDF points (default: 0, must be positive)

**Margin Behavior:**
The stamp text block size is automatically accounted for: with margin 0, the text is flush against the edge but never overflows outside the page.

Margins are always positive and push the text further inward from the chosen anchor edge:
- **Top anchors** (`top-*`): positive `marginY` moves text DOWN into the page
- **Bottom anchors** (`bottom-*`): positive `marginY` moves text UP into the page
- **Left anchors** (`*-left`): positive `marginX` moves text RIGHT into the page
- **Right anchors** (`*-right`): positive `marginX` moves text LEFT into the page

Example: `"anchor": "top-right", "marginX": 0, "marginY": 0` places the stamp flush in the top-right corner, fully visible.

### style

- `fontSize`: 6-200 (default: 48)
- `opacity`: 0-100 (default: 30)
- `rotation`: -360 to 360 degrees (default: 0)
- Color: Always red (RGB 255,0,0) in v1

## Errors

| Code                | Status | Description             |
| ------------------- | ------ | ----------------------- |
| `INVALID_INPUT`     | 400    | Bad request data        |
| `UNAUTHORIZED`      | 401    | Missing/invalid API key |
| `FILE_TOO_LARGE`    | 413    | Exceeds 200MB           |
| `UNSUPPORTED_MEDIA` | 415    | Not a PDF               |
| `INVALID_PDF`       | 422    | Corrupted PDF           |
| `PROCESSING_FAILED` | 500    | Server error            |
| `TIMEOUT`           | 504    | Exceeded 20s            |

## Constraints

- Max file size: 200MB
- Request timeout: 20s
- Single file, single stamp per request
- Stateless (no file storage)
- Overlay only (stamp over content)
