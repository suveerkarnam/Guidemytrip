# Architecture

GuideMyTrip uses a modular monolith in an npm workspace. `apps/web` is a React/Vite client and `apps/api` is an Express REST API. `packages/shared` contains validated contracts and `packages/config` is reserved for cross-application configuration.

## Frontend

React Router owns navigation, TanStack Query owns server-state caching, React Hook Form and Zod will own form validation, and Tailwind provides utility styling. Pages, layouts, API clients, hooks, and domain components remain separate as features grow.

The Phase 2 visual system uses deep teal (`#17484a`) as the trust/heritage anchor, warm ivory (`#fbfaf5`) for breathing room, sand (`#eee9da`) for section contrast, muted gold (`#d8aa55`) for wayfinding and calls to action, and clay (`#e7b198`) for warm editorial accents. Playfair Display carries the destination/story voice while DM Sans keeps navigation and utility copy clear.

## Backend

Express is organized around versioned routes, controllers, services, repositories, validators, and integration adapters. The baseline includes security headers, CORS, compression, JSON limits, rate limiting, structured HTTP logging, a health endpoint, and centralized error handling.

## Database

PostgreSQL is accessed through Prisma. Schema migrations, constraints, indexes, and seed data will be added with domain phases. Redis is provided for expiring holds, throttling, and cache use cases where justified.

## Authentication and payments

Authentication will use secure, HTTP-only cookie sessions with Google OAuth as an adapter and role checks at the API boundary. Razorpay will be isolated behind a payment adapter; server-side order and signature verification is authoritative.

## Booking lifecycle and guide availability

Future booking modules will model discovery, availability, short-lived holds, payment authorization, confirmation, completion, cancellation, and refunds. PostgreSQL transactions and exclusion/locking strategies will prevent overlapping confirmed guide bookings.

## Notifications

Notifications will be emitted from domain events and delivered through replaceable email/SMS adapters, with retries and audit records.

## Deployment and security

Docker Compose supports local PostgreSQL and Redis. Production deployment should use managed PostgreSQL/Redis, secret injection, TLS termination, structured logs, health checks, backups, least-privilege credentials, and observability. Input validation, secure headers, rate limits, output encoding, webhook verification, audit logs, and PII minimization are required.

## Technology choices and scalability

The selected TypeScript stack shares types without coupling runtime boundaries. The modular monolith keeps transactions local and can scale horizontally behind a load balancer; queue workers and service extraction remain future options only when operational pressure justifies them.
