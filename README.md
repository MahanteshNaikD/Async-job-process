# Async Job Process

Production-inspired asynchronous job platform built with **NestJS**, **PostgreSQL**, **Redis**, **BullMQ**, and **sequelize-typescript**.

## Architecture (Step 1)

See [docs/STEP-01-architecture.md](docs/STEP-01-architecture.md), [docs/SYSTEM-DESIGN.md](docs/SYSTEM-DESIGN.md) (Mermaid), and [docs/INTERVIEW-ARCHITECTURE-WALKTHROUGH.md](docs/INTERVIEW-ARCHITECTURE-WALKTHROUGH.md) (interview talk track + Q&A, no diagrams).

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

## Quick start

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

## Job APIs (Step 3)

All responses: `{ "message": "Successful", "statusCode": 200, "data": { ... } }`.

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
```

Docs: [docs/STEP-02-database.md](docs/STEP-02-database.md) · [docs/STEP-03-job-apis.md](docs/STEP-03-job-apis.md) · [docs/STEP-04-worker.md](docs/STEP-04-worker.md) · [docs/STEP-05-observability-security.md](docs/STEP-05-observability-security.md)

## Auth (Step 5)

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

## Worker (Step 4)

```bash
npm run start:worker:dev
```

Test handlers: `demo.success`, `demo.fail` (→ DLQ), `demo.flaky`, `email.send`.

Queue ops: `POST /api/v1/queue/pause` · `POST /api/v1/queue/resume` · `GET /api/v1/queue/status`

## Step roadmap

1. **Architecture & scaffold** 
2. **Database schema (sequelize-typescript)** 
3. **Job APIs + enqueue** 
4. **Worker, retries, DLQ, pause/resume**   
5. **JWT, rate limit, logging, metrics**
6. Tests 

## Requirements

See `requerments.txt`.
