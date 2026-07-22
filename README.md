# ZecQuiz Discord Bot and Trivia Platform

The platform runtime provides the API, dashboard, and Discord bot:

- `npm start` builds and starts the TypeScript API and persisted Discord trivia runtime.
- `npm run dev:platform` starts the platform in watch mode.

## Local development setup

Requires Node.js 22.12 or newer.

```bash
npm install
cp .env.example .env
```

Generate a development JWT secret, place the output in `JWT_ACCESS_SECRET` in the ignored `.env`, and configure the Discord values that apply to this installation:

```bash
openssl rand -hex 32
npm run build
npm run db:migrate
```

The database defaults to `dbs/trivia-platform.sqlite`; it and its WAL files are ignored by Git. Startup applies pending versioned migrations and does not recreate existing tables.

SQL query logging is disabled by default. Set `SQL_LOGGING=true` temporarily when debugging database behavior; it prints every Sequelize statement and is normally very noisy.

Create the initial API administrator:

```bash
export ADMIN_USERNAME=admin
read -rsp 'Administrator password: ' ADMIN_PASSWORD && echo
export ADMIN_PASSWORD
npm run admin:create
unset ADMIN_PASSWORD ADMIN_USERNAME
```

The password must contain at least 6 characters. Run this bootstrap command once; it fails rather than replacing an existing administrator with the same username.

Start the platform in development:

```bash
npm run dev:platform
```

The HTTP API defaults to `http://127.0.0.1:3000`, with OpenAPI UI at `/docs` and health endpoints at `/health/live` and `/health/ready`.

The local management dashboard is available at `http://127.0.0.1:3000/dashboard`. Configure the API administrator credentials in its Credentials view; the dashboard stores them in that browser's local storage and uses them to obtain short-lived tokens for protected management calls. Use this only on a trusted local machine.

Management endpoints support `Idempotency-Key` on trivia creation/publication. Collection and ranking endpoints use opaque `cursor` pagination. Frontends can discover supported quiz languages from `GET /api/v1/public/languages`. Ranking seasons and run exclusions are managed through `/api/v1/ranking-seasons` and `/api/v1/trivia-runs/:runId/ranking-exclusion`.

Register the new `/trivia` and `/rank` commands after configuring Discord credentials:

```bash
npm run commands:deploy:platform
```

Guild command registration is used when `GUILD_ID` is configured; otherwise commands are registered globally. The registration operation replaces the target command set atomically and does not issue a separate delete request.

Discord trivia content supports `en` and `pt-BR`. Select the language when authoring a quiz; the bot uses it for the intro, question and result embeds, moderator buttons, answer confirmations, and final ranking. Active question embeds show a live participant count as answers are recorded.

## Production deployment

The included dashboard is intentionally local-only. It stores the management password in browser local storage to avoid a login flow. Do not expose `/dashboard` or the protected management API to the public internet. Keep the service on a private network, use an SSH tunnel or VPN for dashboard access, or restrict those routes at a TLS reverse proxy. Public read-only `/api/v1/public/*` routes may be exposed separately.

Use the following deployment sequence:

1. Install the exact locked dependencies and run verification in CI or during the release build:

   ```bash
   npm ci
   npm run typecheck
   npm test
   npm run build
   ```

2. Supply production configuration through the deployment platform's secret manager or protected service environment. Do not commit a production `.env` file. Required production values include:

   ```dotenv
   NODE_ENV=production
   HOST=127.0.0.1
   PORT=3000
   DATABASE_PATH=/var/lib/zecquiz/trivia-platform.sqlite
   SQL_LOGGING=false
   JWT_ACCESS_SECRET=<at-least-32-cryptographically-random-characters>
   COOKIE_SECURE=true
   CORS_ORIGINS=https://your-public-origin.example
   DISCORD_TOKEN=<secret>
   CLIENT_ID=<discord-application-id>
   GUILD_ID=<optional-discord-guild-id>
   DISCORD_MODERATOR_ROLE_IDS=<comma-separated-role-ids>
   DISCORD_RANK_ADMIN_ROLE_IDS=<comma-separated-role-ids>
   ```

   Generate `JWT_ACCESS_SECRET` with a cryptographically secure generator such as `openssl rand -hex 32`. Keep `CORS_ORIGINS` empty for a same-origin private deployment, or set only exact HTTPS origins that need browser access. Rotate compromised secrets; changing the JWT secret invalidates existing access tokens.

3. Put the SQLite database on persistent local storage owned by the service account. Do not place a WAL-mode database on NFS or another network filesystem, and run only one application instance against it. Restrict access to the database, its directory, and any local environment file.

4. Before starting the new release, back up the database using SQLite's backup API or `VACUUM INTO`; do not copy only the live database file while WAL writes may be active. Then apply migrations once:

   ```bash
   npm run db:migrate
   ```

5. Bootstrap the administrator using the hidden-input procedure from the local setup section, preferably from the host console or a one-time deployment job. Do not put `ADMIN_PASSWORD` directly in a command line or shell history.

6. Run the already-built application under a service manager with automatic restart and graceful `SIGTERM` shutdown:

   ```bash
   npm run start:platform
   ```

   Terminate HTTPS at a reverse proxy, keep `COOKIE_SECURE=true`, and monitor `/health/live` and `/health/ready`. Preserve the database and backups independently of application releases.

These recommendations follow the [Node.js production security guidance](https://nodejs.org/en/learn/getting-started/security-best-practices), [OWASP secrets-management guidance](https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html), and SQLite's documentation for [WAL deployments](https://sqlite.org/wal.html) and [safe live backups](https://sqlite.org/howtocorrupt.html#_backup_or_restore_while_a_transaction_is_active).

## Verification

```bash
npm run typecheck
npm test
npm run build
```

The approved architecture and rollout plan is documented in [docs/trivia-platform-plan.md](docs/trivia-platform-plan.md).
