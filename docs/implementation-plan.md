# Implementation plan

1. **Phase 1 — Foundation:** workspace, web/API shells, shared contracts, documentation, local PostgreSQL/Redis, health endpoint.
2. **Phase 2 — Design system and homepage:** premium responsive tourism experience, reusable UI, destinations and route shells.
3. **Phase 3 — Database:** normalized PostgreSQL/Prisma schema, migrations, constraints, seed inputs and booking integrity.
4. **Phase 4 — Identity:** password-based mobile/email and Google authentication, secure sessions, password reset, role and ownership middleware.
5. **Phase 5 — Availability and booking:** guide discovery, schedules, holds, transactional booking and conflict prevention.
6. **Phase 6 — Payments:** Razorpay adapter, server-side pricing, idempotency, webhooks, refunds and reconciliation.
7. **Phase 7 — Dashboards and operations:** tourist, guide, admin workflows, moderation, reporting and availability management.
8. **Future hardening:** notifications, observability, integration/E2E tests, performance, deployment automation and security review.

Each phase must update implementation status and run build, typecheck, lint, and relevant tests.
