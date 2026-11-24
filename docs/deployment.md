# Deployment

Local development uses Docker Compose for PostgreSQL and Redis. Production should build the web and API workspaces separately, inject environment variables through the deployment platform, run Prisma migrations as a controlled release step, expose health checks, and use managed data services with backups and TLS.

For Razorpay test mode, configure `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the API environment. Configure the Razorpay webhook URL as `/api/v1/payments/webhook` and subscribe to payment captured/failed and refund processed/failed events. Never expose the key secret or webhook secret to the frontend; only the public key ID is returned when opening Checkout.
