# Deployment

Local development uses Docker Compose for PostgreSQL and Redis. Production should build the web and API workspaces separately, inject environment variables through the deployment platform, run Prisma migrations as a controlled release step, expose health checks, and use managed data services with backups and TLS.
