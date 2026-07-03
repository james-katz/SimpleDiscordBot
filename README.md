# ZecQuiz Discord Bot and Trivia Platform

The platform runtime is now the default:

- `npm start` builds and starts the TypeScript API and persisted Discord trivia runtime.
- `npm run dev:platform` starts the platform in watch mode.
- `npm run start:legacy` starts the previous bot only for rollback.

Legacy quiz and reset commands require `LEGACY_COMMANDS_ENABLED=true`; platform command registration never exposes them.

## Platform setup

Requires Node.js 22.12 or newer.

```bash
npm install
cp .env.example .env
npm run db:migrate
```

Set a unique `JWT_ACCESS_SECRET` of at least 32 characters and the Discord/API settings in `.env`. The new database defaults to `dbs/trivia-platform.sqlite`; it and its WAL files are ignored by Git. Startup only applies pending versioned migrations and does not recreate existing tables.

Create the initial API administrator:

```bash
export ADMIN_USERNAME=admin
read -s ADMIN_PASSWORD && export ADMIN_PASSWORD
npm run admin:create
unset ADMIN_PASSWORD
```

Start the platform in development:

```bash
npm run dev:platform
```

The HTTP API defaults to `http://127.0.0.1:3000`, with OpenAPI UI at `/docs` and health endpoints at `/health/live` and `/health/ready`.

Management endpoints support `Idempotency-Key` on trivia creation/publication. Collection and ranking endpoints use opaque `cursor` pagination. Ranking seasons and run exclusions are managed through `/api/v1/ranking-seasons` and `/api/v1/trivia-runs/:runId/ranking-exclusion`.

Register the new `/trivia` and `/rank` commands after configuring Discord credentials:

```bash
npm run commands:deploy:platform
```

Guild command registration is used when `GUILD_ID` is configured; otherwise commands are registered globally. The registration operation replaces the target command set atomically and does not issue a separate delete request.

## Legacy data import

To import standalone questions and cumulative ranking data from `dbs/zecquiz.sqlite`:

```bash
npm run db:import-legacy
```

The importer is transactional and repeat-safe. Existing scores become a hidden synthetic run so overall totals are preserved. Existing standalone questions become the hidden `Legacy Question Bank` draft.

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The approved architecture and rollout plan is documented in [docs/trivia-platform-plan.md](docs/trivia-platform-plan.md).
