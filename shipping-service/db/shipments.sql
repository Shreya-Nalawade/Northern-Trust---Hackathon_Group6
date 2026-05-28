-- Shipments table for Shipping Service
CREATE TABLE IF NOT EXISTS shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_execution_id UUID,
  order_id VARCHAR(120),
  tracking_number VARCHAR(120),
  courier_name VARCHAR(100),
  shipment_status VARCHAR(50),
  label_url TEXT,
  awb_or_tracking_metadata JSONB,
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipments_order_id ON shipments(order_id);
CREATE INDEX IF NOT EXISTS idx_shipments_status ON shipments(shipment_status);
CREATE INDEX IF NOT EXISTS idx_shipments_tracking ON shipments(tracking_number);
