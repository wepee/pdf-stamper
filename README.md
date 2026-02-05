# PDF Text Stamp API

Stateless REST API for adding text watermarks/stamps to PDFs.

## Quick Start

```bash
npm install
npm run dev
```

## Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
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
      "secondary": "Page {{page}} / {{total}}"
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
- `secondary` (string, optional): Secondary text with variables `{{page}}` and `{{total}}`

### pages
- `"all"` (default) or array of page numbers `[1, 3, 5]`
- 1-indexed, strict mode (invalid pages = error)

### position
- `anchor`: `top-left`, `top-center`, `top-right`, `center-left`, `center` (default), `center-right`, `bottom-left`, `bottom-center`, `bottom-right`
- `marginX`: Horizontal offset in PDF points (default: 0)
- `marginY`: Vertical offset in PDF points (default: 0)

### style
- `fontSize`: 6-200 (default: 48)
- `opacity`: 0-100 (default: 30)
- `rotation`: -360 to 360 degrees (default: 0)
- Color: Always red (RGB 255,0,0) in v1

## Errors

| Code | Status | Description |
|------|--------|-------------|
| `INVALID_INPUT` | 400 | Bad request data |
| `UNAUTHORIZED` | 401 | Missing/invalid API key |
| `FILE_TOO_LARGE` | 413 | Exceeds 200MB |
| `UNSUPPORTED_MEDIA` | 415 | Not a PDF |
| `INVALID_PDF` | 422 | Corrupted PDF |
| `PROCESSING_FAILED` | 500 | Server error |
| `TIMEOUT` | 504 | Exceeded 20s |

## Constraints

- Max file size: 200MB
- Request timeout: 20s
- Single file, single stamp per request
- Stateless (no file storage)
- Overlay only (stamp over content)
