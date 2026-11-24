# GuideMyTrip

GuideMyTrip is a modular-monolith foundation for a tourist guide booking platform.

## Quick start

```bash
npm install
cp .env.example .env
npm run dev
```

The web app runs at `http://localhost:5173` and the API at `http://localhost:4000`. Start local services with `docker compose up -d`.

## Commands

`npm run build`, `npm run test`, `npm run lint`, and `npm run typecheck` verify all workspaces.

See `docs/architecture.md` and `docs/implementation-plan.md` for the current design and roadmap.
