# Deployment

The application is configured to use the Supabase PostgreSQL instance through `DATABASE_URL` with TLS (`sslmode=require`). Keep `DATABASE_PASSWORD` and the complete connection URL in the deployment platform's secret manager. Production should build the web and API workspaces separately, inject environment variables through the deployment platform, run Prisma migrations as a controlled release step, expose health checks, and use managed data services with backups and TLS.

For Razorpay test mode, configure `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in the API environment. Configure the Razorpay webhook URL as `/api/v1/payments/webhook` and subscribe to payment captured/failed and refund processed/failed events. Never expose the key secret or webhook secret to the frontend; only the public key ID is returned when opening Checkout.

For password reset, configure `FRONTEND_URL`, `EMAIL_PROVIDER=smtp`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASSWORD`, and `SMTP_FROM_EMAIL` in the API secret manager. Local development can keep `EMAIL_PROVIDER=mock`; the mock provider does not send email and is intended only for tests.
