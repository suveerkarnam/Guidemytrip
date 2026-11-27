# GuideMyTrip

GuideMyTrip is a modular-monolith foundation for a tourist guide booking platform.

## Quick start

```bash
npm install
cp .env.example .env
cp .env.example apps/api/.env
# Enter your Supabase password in .env and URL-encode reserved characters in DATABASE_URL.
# Keep the same DATABASE_URL in apps/api/.env because Prisma and the API run from that workspace.
npm run db:generate
npm run db:migrate
npm run dev
```

The web app runs at `http://localhost:5173` and the API at `http://localhost:4000`. The default configuration uses the Supabase PostgreSQL instance. Docker Compose remains an optional local PostgreSQL/Redis fallback.

For development-only demo destinations, guides, packages, and accounts, run `npm run db:seed` after reviewing the seed data. This writes demo data to the configured database.

## Commands

`npm run build`, `npm run test`, `npm run lint`, `npm run typecheck`, `npm run db:validate`, and `npm run db:migrate` verify the workspaces and database setup.

See `docs/architecture.md` and `docs/implementation-plan.md` for the current design and roadmap.
