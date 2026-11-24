# Testing and QA

## Automated checks

The repository runs workspace-wide checks with:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

Vitest covers bcrypt authentication and password-reset behavior, booking pricing and ranking, payment signatures, dashboard ownership/review/availability rules, notification delivery retries, and contact persistence. The current suite contains 17 passing tests.

## Security and integrity scenarios

- Refresh-token rotation revokes the previous session and rejects reuse.
- Mobile/email normalization, generic credential errors, bcrypt password verification, reset-token hashing, and session invalidation are covered.
- Booking holds and payment capture use PostgreSQL/advisory locking in the critical path.
- Payment signature and webhook HMAC behavior is covered by payment adapter tests.
- Tourist ownership and guide availability conflict rules are covered by dashboard tests.
- Duplicate reviews are blocked by the unique booking relation and service eligibility checks.

## E2E status

Playwright is not currently installed in the workspace, so browser E2E scenarios have not been claimed as passing. The next QA step is to add a Playwright project against seeded disposable PostgreSQL data and exercise registration, exploration, booking, checkout mock mode, dashboards, cancellation, refund, and review moderation.

Live Razorpay and SMS provider tests require provider test credentials and must run in a controlled environment; secrets are never committed.
