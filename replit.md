# QuantSignal Workspace

## Overview

QuantSignal is an AI-powered quant signal validation platform for traders and small quant teams. The system analyzes trade setups using structured inputs (symbol, timeframe, strategy notes, optional chart screenshot, optional trade CSV) and returns a structured signal — Buy/Sell/Hold/Avoid — with confidence score, risk assessment, market regime classification, stop-loss suggestion, invalidation zone, and a plain-English explanation powered by Gemini AI.

**This is NOT a prediction bot.** It is a trade setup validation and signal-assistance tool.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Frontend**: React + Vite + Tailwind CSS v4 + shadcn/ui
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **File uploads**: Multer
- **AI provider**: Google Gemini API (optional, graceful fallback if not configured)
- **Forms**: React Hook Form + Zod
- **File drops**: react-dropzone

## Architecture

```text
workspace/
├── artifacts/
│   ├── api-server/           # Express 5 API server (backend)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── analyze.ts   # POST /analyze, GET /settings/check
│   │   │   │   ├── signals.ts   # GET /signals/history
│   │   │   │   └── uploads.ts   # POST /upload/screenshot, POST /upload/trades
│   │   │   └── services/
│   │   │       ├── ingestionService.ts   # Parse inputs, CSV parsing
│   │   │       ├── regimeService.ts      # Market regime detection
│   │   │       ├── riskService.ts        # Risk score, stop-loss calculation
│   │   │       ├── signalService.ts      # Candidate signal generation
│   │   │       ├── judgeService.ts       # Final signal adjudication
│   │   │       ├── reportService.ts      # Report formatting
│   │   │       └── geminiService.ts      # Gemini AI integration (optional)
│   │   └── uploads/            # Uploaded files storage
│   └── quant-signal/           # React + Vite frontend
│       └── src/
│           └── pages/
│               ├── dashboard.tsx        # Signal history and stats
│               ├── analyze.tsx          # Analysis form
│               ├── upload-screenshot.tsx # Chart upload
│               ├── upload-trades.tsx    # Trade CSV upload
│               ├── signal-result.tsx    # Signal result display
│               └── settings.tsx        # API key check, settings
├── lib/
│   ├── api-spec/             # OpenAPI 3.1 spec + Orval codegen
│   ├── api-client-react/     # Generated React Query hooks
│   ├── api-zod/              # Generated Zod schemas from OpenAPI
│   └── db/
│       └── src/schema/
│           ├── analysisRuns.ts   # analysis_runs table
│           ├── signals.ts        # signals table
│           ├── uploadedFiles.ts  # uploaded_files table
│           ├── tradeHistory.ts   # trade_history table
│           └── strategyNotes.ts  # strategy_notes table
└── scripts/
```

## API Endpoints

- `GET /api/healthz` — Health check
- `POST /api/analyze` — Analyze a trade setup (symbol, timeframe, optional fields)
- `GET /api/signals/history` — Paginated signal history
- `POST /api/upload/screenshot` — Upload chart screenshot (PNG/JPG/WEBP, multipart)
- `POST /api/upload/trades` — Upload trade history CSV (multipart, auto-parsed)
- `GET /api/settings/check` — Check Gemini API key and DB status

## Database Tables

- `analysis_runs` — Records of each analysis request
- `signals` — Generated signal results with all scores and breakdown
- `uploaded_files` — Metadata for uploaded screenshots and CSVs
- `trade_history` — Parsed rows from uploaded trade CSVs
- `strategy_notes` — Strategy notes from analysis runs

## Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `GEMINI_API_KEY` — Google Gemini API key (optional; analysis works without it using deterministic logic)
- `REDIS_URL` — Redis URL (optional, not implemented in MVP)
- `PORT` — Server port (auto-assigned by Replit)

## Service Architecture (Modular)

1. **IngestionService** — Parses all inputs into structured context
2. **SignalService** — Generates candidate Buy/Sell/Hold/Avoid signal with reasoning
3. **RegimeService** — Classifies market regime: trend/range/breakout/breakdown/volatile
4. **RiskService** — Calculates risk score, stop-loss suggestion, invalidation zone
5. **JudgeService** — Combines signal + risk + regime into final adjudicated result
6. **ReportService** — Formats the final structured JSON + human-readable explanation
7. **GeminiService** — Optional AI enhancement of explanation text (graceful fallback)

## Development

```bash
# Run codegen after changing OpenAPI spec
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes
pnpm --filter @workspace/db run push

# Build API server
pnpm --filter @workspace/api-server run build

# Run typecheck
pnpm run typecheck
```

## MVP Scope Notes

- No live market data API (manual inputs only)
- Screenshot upload flow is ready; AI vision processing is placeholder
- No user authentication
- No Redis caching (env var ready, not implemented)
- Advanced TradingView charting: not included in MVP
