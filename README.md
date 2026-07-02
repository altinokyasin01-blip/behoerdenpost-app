# Behördenpost-Assistent

B2C web app that helps users understand German administrative letters. Upload a
PDF or photo of a letter, and Claude summarizes it, extracts deadlines, and
drafts a reply.

## Stack

- **Backend:** Node.js + Express, multer, Anthropic SDK (`claude-sonnet-4-6`)
- **Frontend:** React + Vite

## Project layout

```
behoerdenpost-app/
├── backend/
│   ├── index.js           # Express server entry
│   ├── routes/analyze.js  # POST /api/analyze
│   ├── services/claude.js # Anthropic Vision API wrapper
│   ├── .env.example
│   └── package.json
├── frontend/              # Vite React app
└── README.md
```

## Setup

### Backend

```bash
cd backend
cp .env.example .env      # add your ANTHROPIC_API_KEY
npm install
npm run dev               # http://localhost:3001
```

### Frontend

```bash
cd frontend
npm install
npm run dev               # http://localhost:5173
```

The Vite dev server proxies `/api/*` to the backend on port 3001.

## API

### `POST /api/analyze`

Multipart form upload.

| Field      | Type | Notes                                    |
| ---------- | ---- | ---------------------------------------- |
| `document` | file | PDF or image (jpg/png/gif/webp), max 15MB |

**Response**

```json
{
  "documentType": "Bußgeldbescheid",
  "summary": "…",
  "deadline": "2026-08-15",
  "replyDraft": "Sehr geehrte Damen und Herren, …"
}
```
