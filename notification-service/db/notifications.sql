-- Notifications table for Notification Service
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID,
  notification_type VARCHAR(50),
  channel VARCHAR(20),
  recipient VARCHAR(255),
  subject TEXT,
  message TEXT,
  payload JSONB,
  provider_response JSONB,
  notification_status VARCHAR(50),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_status ON notifications(notification_status);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient);
