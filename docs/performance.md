# Performance considerations

- Catalog and availability queries use destination/status/date indexes and bounded result sets.
- Admin list queries are capped to 100 records; production pagination should be enabled before high-volume operations.
- Booking discovery filters eligibility in PostgreSQL and uses half-open date overlap predicates, rather than loading unrelated guides into the application.
- Guide payment confirmation takes a transaction-scoped advisory lock keyed by booking ID to serialize duplicate capture requests.
- Global compression, request size limits, and lazy-loaded images reduce response and asset costs.
- React pages use explicit loading/empty/error states; booking state is persisted only in session storage and no payment token is stored in browser storage.
- Public review responses are restricted to approved reviews and bounded to 50 records.

Before production scale-up, add Redis-backed shared rate limits, a queue worker for notification/retry/reminder jobs, cursor pagination for admin lists, query timing metrics, and CDN-backed image transformations.
