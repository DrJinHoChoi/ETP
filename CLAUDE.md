# CLAUDE.md - ETP (Energy Trading Platform)

RE100 전력 중개거래 플랫폼 — a blockchain-backed renewable energy P2P trading platform with EPC stablecoin and REC NFT token systems.

## Project Structure

This is a **pnpm monorepo** with three workspace packages and a blockchain config directory:

```
ETP/
├── shared/          # @etp/shared — shared TypeScript types (User, Trading, Metering, Token)
├── backend/         # @etp/backend — NestJS REST API + WebSocket server
├── frontend/        # @etp/frontend — React SPA (Vite + TailwindCSS)
├── blockchain/      # Hyperledger Fabric chaincode & network config (not a pnpm package)
└── docker/          # Docker Compose & Dockerfiles for dev/prod
```

## Quick Reference Commands

```bash
# Install all dependencies
pnpm install

# Start dev (backend + frontend concurrently)
pnpm dev

# Start individually
pnpm dev:backend          # NestJS on :3000
pnpm dev:frontend         # Vite on :5173

# Build (order matters: shared -> backend -> frontend)
pnpm build

# Lint all packages
pnpm lint

# Run all tests
pnpm test
pnpm test:backend         # Jest
pnpm test:frontend        # Vitest

# Database
pnpm db:generate          # Generate Prisma client
pnpm db:migrate           # Run Prisma migrations
pnpm db:seed              # Seed sample data

# Docker (dev infra: Postgres + Redis)
pnpm docker:up
pnpm docker:down
```

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS 10, TypeScript 5.7, Prisma ORM, PostgreSQL 16, Redis 7 |
| **Frontend** | React 18, Vite 6, TailwindCSS 3, Zustand 5, React Router 7 |
| **Testing** | Backend: Jest 30 + `@nestjs/testing` / Frontend: Vitest 4 + Testing Library |
| **Blockchain** | Hyperledger Fabric chaincode (Go), toggled via `FABRIC_ENABLED` env |
| **Realtime** | Socket.IO (NestJS WebSocket gateway on `/events` namespace) |
| **Auth** | JWT (passport-jwt) + DID challenge-response authentication |
| **API Docs** | Swagger at `/api/docs` |
| **Token System** | EPC stablecoin (basket-price oracle) + REC NFT tokens |

## Backend Architecture

### Module Structure (`backend/src/`)

| Module | Purpose |
|--------|---------|
| `auth/` | JWT + DID authentication, guards, strategies, decorators |
| `users/` | User CRUD |
| `trading/` | Order book, matching engine, trade lifecycle |
| `metering/` | Smart meter readings (production/consumption) |
| `settlement/` | Trade settlement with EPC/KRW payment |
| `token/` | EPC stablecoin (mint/burn/transfer/lock) + REC NFT tokens |
| `oracle/` | Multi-source price oracle (EIA, ENTSO-E, KPX) with weighted basket |
| `analytics/` | Trading statistics and dashboard data |
| `aggregator/` | Supply/demand aggregation services |
| `blockchain/` | Hyperledger Fabric integration, DID + trading blockchain services |
| `common/` | Shared filters, interceptors, WebSocket gateway |
| `prisma/` | Prisma service & module |
| `health/` | Health check endpoint |

### Key Patterns

- **Global prefix**: All API routes start with `/api`
- **Validation**: Global `ValidationPipe` with `whitelist`, `forbidNonWhitelisted`, `transform`
- **Rate limiting**: ThrottlerGuard (100 requests/60s)
- **Exception handling**: `GlobalExceptionFilter` in `common/filters/`
- **Logging**: `LoggingInterceptor` in `common/interceptors/`
- **NestJS module pattern**: Each domain has `*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/` directory
- **Path alias**: `@/*` maps to `src/*`

### Database (Prisma)

- Schema: `backend/prisma/schema.prisma`
- Models: User, DIDCredential, Order, Trade, MeterReading, Settlement, RECCertificate, TokenBalance, TokenTransaction, PriceOracle, PriceBasket, RECToken, BlockchainTransaction
- Column mapping: Uses `@map("snake_case")` for DB columns, camelCase in TypeScript
- Enums: UserRole, OrderType, OrderStatus, EnergySource, TradeStatus, SettlementStatus, TokenTxType, PaymentCurrency, etc.
- Seed data: `backend/prisma/seed.ts` creates admin/supplier/consumer accounts, sample orders, meter readings, and price data

### Test Conventions (Backend)

- Test files: `*.service.spec.ts` co-located with source files
- Framework: Jest with `ts-jest`
- Mocking: `backend/src/__mocks__/` directory for shared mocks
- Run: `pnpm test:backend` or `cd backend && jest`

## Frontend Architecture

### Directory Structure (`frontend/src/`)

| Directory | Purpose |
|-----------|---------|
| `pages/` | Route-level page components (Dashboard, Trading, Metering, Settlement, Wallet, PriceOracle, RECMarketplace, Admin, Login) |
| `components/` | Layout, ErrorBoundary, LoadingSkeleton |
| `components/ui/` | Reusable UI kit: Button, Card, Badge, Modal, DataTable, StatCard, EmptyState, Toast |
| `services/` | API service modules (one per backend domain), `api.ts` is the Axios instance |
| `store/` | Zustand stores (`authStore.ts`, `tokenStore.ts`) |
| `hooks/` | Custom hooks (`useWebSocket.ts`) |

### Key Patterns

- **Routing**: React Router v7 with lazy-loaded pages via `React.lazy()` + `Suspense`
- **Auth**: `PrivateRoute` wrapper checks `useAuthStore.isAuthenticated`; unauthenticated users redirect to `/login`
- **API client**: Axios instance in `services/api.ts` — auto-attaches JWT from `localStorage`, redirects to `/login` on 401
- **State**: Zustand for global state (auth, token balances)
- **Styling**: TailwindCSS utility classes
- **Path alias**: `@/*` maps to `./src/*`

### Test Conventions (Frontend)

- Test files: `*.test.ts` co-located with source
- Framework: Vitest + `@testing-library/react` + `jsdom`
- Run: `pnpm test:frontend` or `cd frontend && vitest run`

## Shared Package (`@etp/shared`)

- Type definitions in `shared/src/types/`: `user.types.ts`, `trading.types.ts`, `metering.types.ts`, `token.types.ts`
- Exports everything from `shared/src/index.ts`
- Must be built (`pnpm build:shared`) before backend/frontend can use it
- Referenced as `@etp/shared` via `workspace:*` in consumer packages

## Blockchain Layer

- **Not a pnpm package** — standalone Hyperledger Fabric configuration
- Chaincode modules in `blockchain/chaincode/`: `did`, `trading`, `settlement`, `metering`, `epc`, `rec-token`
- Network config in `blockchain/network/`: `configtx.yaml`, `crypto-config.yaml`, `docker-compose.yaml`, scripts
- Toggled via `FABRIC_ENABLED=false` in `.env` (disabled by default for dev)

## WebSocket Events

The `EventsGateway` (`common/gateways/events.gateway.ts`) emits these events on the `/events` namespace:

| Event | Payload |
|-------|---------|
| `trade:matched` | Trade object |
| `order:updated` | Order object |
| `meter:reading` | MeterReading object |
| `settlement:completed` | Settlement object |
| `stats:update` | Stats object |
| `price:update` | Price object |
| `token:balance` | `{ userId, balance, lockedBalance }` |
| `rec:update` | REC token data |

## Environment Configuration

Copy `.env.example` to `.env` at the project root. Key variables:

| Variable | Default | Notes |
|----------|---------|-------|
| `DATABASE_URL` | `postgresql://etp_user:etp_password@localhost:5432/etp_db` | Prisma connection |
| `REDIS_HOST` / `REDIS_PORT` | `localhost` / `6379` | BullMQ job queue |
| `JWT_SECRET` | — | Must change in production |
| `BACKEND_PORT` | `3000` | NestJS listen port |
| `VITE_API_URL` | `http://localhost:3000/api` | Frontend API base URL |
| `FABRIC_ENABLED` | `false` | Enable Hyperledger Fabric integration |
| `EIA_API_KEY`, `ENTSOE_API_TOKEN`, `KPX_API_KEY` | — | Price oracle data sources |
| `ORACLE_WEIGHT_*` | EIA=0.40, ENTSOE=0.35, KPX=0.25 | Basket price weights |

## CI/CD

GitHub Actions workflow in `.github/workflows/ci.yml`:
- Triggers on push/PR to `master`/`main`
- Services: PostgreSQL 16
- Steps: install deps -> build shared -> generate Prisma -> build backend -> build frontend -> run backend tests -> run frontend tests

## Docker

- **Dev** (`docker/docker-compose.yml`): PostgreSQL 16 + Redis 7 only
- **Prod** (`docker/docker-compose.prod.yml`): Full stack — PostgreSQL, Redis, backend, frontend (nginx)
- Dockerfiles: `docker/Dockerfile.backend`, `docker/Dockerfile.frontend`
- Nginx config: `docker/nginx.conf`

## Development Setup

1. `pnpm install`
2. `pnpm docker:up` (starts PostgreSQL + Redis)
3. Copy `.env.example` to `.env`
4. `pnpm db:generate` (generate Prisma client)
5. `pnpm db:migrate` (run migrations)
6. `pnpm db:seed` (optional — populate sample data)
7. `pnpm dev` (starts backend on :3000 and frontend on :5173)

## Coding Conventions

- **Language**: TypeScript throughout (strict mode in frontend, strict null checks in backend)
- **Commit messages**: Korean descriptions with conventional prefix (`feat:`, `fix:`)
- **Backend module pattern**: Follow NestJS conventions — module/controller/service/dto per domain
- **DTO validation**: Use `class-validator` decorators in DTOs
- **Database columns**: snake_case in DB, camelCase in TypeScript (Prisma `@map`)
- **Frontend components**: Functional components with TypeScript, TailwindCSS for styling
- **State management**: Zustand stores (not Redux)
- **API services**: One service file per backend domain in `frontend/src/services/`
- **Imports**: Use `@/*` path alias in both backend and frontend

## Seed Accounts (Development)

| Email | Password | Role |
|-------|----------|------|
| `admin@etp.com` | `admin1234` | ADMIN |
| `solar@etp.com` | `supplier1234` | SUPPLIER |
| `wind@etp.com` | `supplier1234` | SUPPLIER |
| `hydro@etp.com` | `supplier1234` | SUPPLIER |
| `samsung@etp.com` | `consumer1234` | CONSUMER |
| `sk@etp.com` | `consumer1234` | CONSUMER |
| `lg@etp.com` | `consumer1234` | CONSUMER |
