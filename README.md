# Async Job Process

Production-inspired asynchronous job platform built with **NestJS**, **PostgreSQL**, **Redis**, **BullMQ**, and **sequelize-typescript**.

```
Client → NestJS API → PostgreSQL (truth) + Redis/BullMQ (dispatch) → NestJS Worker
```

## Monorepo layout

| Path | Role |
|---|---|
| `apps/api` | HTTP API + Swagger |
| `apps/worker` | Background consumers |
| `libs/config` | Typed env configuration |
| `libs/common` | Filters, correlation IDs |
| `libs/database` | Sequelize-TypeScript (Step 2) |
| `libs/jobs` | Job domain module |
| `libs/queue` | BullMQ boundary |
| `libs/health` | `/api/health` |
| `libs/metrics` | `/api/metrics` |
| `docker/` | Compose + Dockerfiles |

## Setup & running locally

```bash
cp .env.example .env

# Infra only (Redis — local Postgres on 5432 is used by default)
npm run docker:infra
npm run db:migrate

# API (watch)
npm run start:api:dev

# Worker (watch) — separate terminal
npm run start:worker:dev
```

Then open the **web console** at http://localhost:3000/ (login: `admin` / `admin123`).  
Swagger remains at http://localhost:3000/docs.

## Run with Docker (full stack)

```bash
# From project root
cp .env.example .env   # if needed

# Build + start Postgres, Redis, API, Worker
npm run docker:up

# Check
docker compose -f docker/docker-compose.yml ps
```

- Web console: http://localhost:3000/  
- API / Swagger: http://localhost:3000/docs  
- Postgres (from host): `localhost:5433` (avoids clash with local Postgres on 5432)  
- Redis: `localhost:6379`

Inside containers, API/Worker talk to `postgres:5432` and `redis:6379` automatically.  
The API container runs migrations on startup.

```bash
# Logs
docker logs -f async_jobs_api
docker logs -f async_jobs_worker

# Stop
npm run docker:down

# Reset Docker DB if you changed DATABASE_USER / DATABASE_PASSWORD
# (Postgres only applies those on first volume init)
npm run docker:down -- -v && npm run docker:up
```

### Infra only (local Node process)

```bash
npm run docker:infra      # Redis only
# or
npm run docker:infra:all  # Postgres (5433) + Redis
npm run db:migrate        # if using Docker Postgres: DATABASE_PORT=5433 npm run db:migrate
npm run start:api:dev
npm run start:worker:dev
```

## Scripts

| Script | Purpose |
|---|---|
| `npm run start:api:dev` | API with hot reload |
| `npm run start:worker:dev` | Worker with hot reload |
| `npm run build` | Build API + Worker |
| `npm run docker:infra` | Start Redis only (local Postgres on 5432) |
| `npm run docker:up` | Build & start all services |
| `npm run db:migrate` | Apply Sequelize migrations |
| `npm test` | Unit + lifecycle integration tests |

## Logs

API and worker write JSONL step logs to files (and still print to the console):

- `logs/api.log`
- `logs/worker.log`

Configure directory with `LOG_DIR` (default `logs`). In Docker the folder is mounted from the host `./logs`.

```bash
tail -f logs/api.log
tail -f logs/worker.log
```

## Database

```bash
npm run docker:infra   # Redis (local Postgres on 5432)
npm run db:migrate
```

## API documentation

Interactive OpenAPI: **http://localhost:3000/docs** (Swagger).

All responses: `{ "message": "Successful", "statusCode": 200, "data": { ... } }`.

Protected routes need `Authorization: Bearer <token>` (see Auth below).

```bash
# Create
curl -s -X POST http://localhost:3000/api/v1/jobs \
  -H 'content-type: application/json' \
  -H 'Idempotency-Key: demo-1' \
  -d '{"type":"email.send","payload":{"to":"a@b.com"},"priority":10}'

# List
curl -s 'http://localhost:3000/api/v1/jobs?page=1&limit=20'

# Get
curl -s http://localhost:3000/api/v1/jobs/<id>

# Cancel (queued / delayed / retrying only)
curl -s -X DELETE http://localhost:3000/api/v1/jobs/<id> \
  -H "Authorization: Bearer $TOKEN"

# Dead-letter jobs (exhausted retries)
curl -s 'http://localhost:3000/api/v1/dead-letter-jobs?page=1&limit=20' \
  -H "Authorization: Bearer $TOKEN"
```

## Auth

```bash
# Login (default admin / admin123)
curl -s -X POST http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"username":"admin","password":"admin123"}'

# Use token
curl -s http://localhost:3000/api/v1/jobs \
  -H "Authorization: Bearer <accessToken>"
```

In Swagger: Authorize → `Bearer <token>`.

## Worker

```bash
npm run start:worker:dev
```

Test handlers: `demo.success`, `demo.fail` (→ DLQ), `demo.flaky`, `email.send`.

Queue ops: `POST /api/v1/queue/pause` · `POST /api/v1/queue/resume` · `GET /api/v1/queue/status`

## Documentation

This README covers **setup**, **running locally**, and **API quick start**.

Full design write-ups, diagrams, and interview notes live under **[`docs/`](docs/)**:

| Path | Contents |
|------|----------|
| [`docs/architecture.md`](docs/architecture.md) | High-level architecture, design decisions, tradeoffs, data flow |
| [`docs/HLD.png`](docs/HLD.png) | High-level design diagram |
| [`docs/job submit squence.png`](docs/job%20submit%20squence.png) | Job submit sequence |
| [`docs/priority model.png`](docs/priority%20model.png) | Priority mapping |
| [`docs/mono repo.png`](docs/mono%20repo.png) | Monorepo / module layout |
| [`docs/read & write.png`](docs/read%20%26%20write.png) | Read vs write paths |

**Interactive API docs (OpenAPI):** http://localhost:3000/docs (Swagger)

Assignment brief: [`requerments.txt`](requerments.txt)

## Design decisions (summary)

- **PostgreSQL** = source of truth for job metadata, status, listing, and idempotency.
- **Redis + BullMQ** = dispatch layer (claim, delay, priority, retries, locks). Workers never “run jobs from the DB.”
- **Separate API and worker processes** so HTTP and compute scale independently.
- **BullMQ** chosen over a custom Redis queue for delay, priority, stalled recovery, and retries.
- **At-least-once** delivery; handlers should be idempotent. Exactly-once is not claimed.
- **Dual-write:** persist job in Postgres, then enqueue to BullMQ (same UUID). Enqueue failure is logged/surfaced; a transactional outbox would be the production upgrade.
- After max retries, jobs become **`dead_letter`** (and enter the DLQ), not a generic `failed`-only path.

Details and alternatives: [`docs/architecture.md`](docs/architecture.md).

## Assumptions

- External providers (real email/SMS/SMTP) are **not** integrated; handlers simulate work (logging is enough).
- API routes are versioned under **`/api/v1`** (e.g. `POST /api/v1/jobs`), not bare `/jobs`.
- Responses use a uniform envelope: `{ message, statusCode, data }`.
- Job id field is **`id`** (UUID); retry counter is **`attempts`** (spec’s “retryCount”).
- Priority is a **number** (higher = more urgent). UI maps High/Medium/Normal → `100` / `50` / `0`.
- Delay field is **`delayMs`** (relative) or **`runAt`** (absolute ISO); not both.
- Demo auth: JWT with `admin` / `admin123` (see `.env.example`). Health/metrics/login are public.
- One Docker Compose stack runs Postgres, Redis, API, and Worker; local Node can use Homebrew Postgres + Docker Redis.

## Step roadmap

1. **Architecture & scaffold**
2. **Database schema (sequelize-typescript)**
3. **Job APIs + enqueue**
4. **Worker, retries, DLQ, pause/resume**
5. **JWT, rate limit, logging, metrics**
6. Tests
