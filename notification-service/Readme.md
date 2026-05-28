# Services Workspace
- Notification Service (port 3001) — integrates with SendGrid and Twilio.

Quick start (local):

1. Copy the example env files and add your credentials:

```bash
cp notification-service/.env.example notification-service/.env
# Edit the .env files and add real keys
```

2. Run with Docker Compose:

```bash
docker compose up --build
```

3. APIs:

- Notification: `http://localhost:3001/notify/email`, `/notify/sms`, `/notify/bulk`, `/health`

Next steps: integrate these services with the Orchestrator service and UI.
