require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const db = require('../common/db');

const PORT = process.env.PORT || 3002;
const app = express();
app.use(bodyParser.json());

// Basic mock behavior when Shiprocket credentials are not provided.
function mockCreateShipment(order){
  const awb = 'AWB' + Math.floor(Math.random()*1000000);
  return {
    awb,
    courier: 'MockCourier',
    labelUrl: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'
  };
}

async function persistShipment({ workflow_execution_id = null, order_id = null, tracking_number = null, courier_name = null, shipment_status = 'CREATED', label_url = null, metadata = null }){
  const sql = `INSERT INTO shipments (workflow_execution_id, order_id, tracking_number, courier_name, shipment_status, label_url, awb_or_tracking_metadata, dispatched_at, created_at, updated_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,NOW(),NOW(),NOW()) RETURNING *`;
  const params = [workflow_execution_id, order_id, tracking_number, courier_name, shipment_status, label_url, metadata ? JSON.stringify(metadata) : null];
  try{
    const r = await db.query(sql, params);
    return r.rows[0];
  }catch(err){
    console.error('Failed to persist shipment', err.message);
    return null;
  }
}

app.post('/shipping/create-order', async (req, res) => {
  try {
    const payload = req.body;
    if (!process.env.SHIPROCKET_API_KEY){
      // return a mock response so orchestrator can proceed
      const r = mockCreateShipment(payload);
      // persist mock shipment
      await persistShipment({ workflow_execution_id: payload.workflow_execution_id, order_id: payload.orderId || payload.order_id, tracking_number: r.awb, courier_name: r.courier, shipment_status: 'CREATED', label_url: r.labelUrl, metadata: r });
      return res.json({ ok: true, data: r, simulated: true });
    }
    // Example: call Shiprocket API (this is provider-specific; adapt as needed)
    const token = process.env.SHIPROCKET_API_KEY;
    const resp = await axios.post('https://apiv2.shiprocket.in/v1/external/...', payload, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // when integrated, persist response if possible
    const respData = resp.data;
    await persistShipment({ workflow_execution_id: payload.workflow_execution_id, order_id: payload.orderId || payload.order_id, tracking_number: respData.awb || respData.tracking_number, courier_name: respData.courier || null, shipment_status: 'CREATED', label_url: respData.label_url || null, metadata: respData });
    res.json({ ok: true, data: respData });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/shipping/track/:awb', async (req, res) => {
  try {
    const { awb } = req.params;
    if (!process.env.SHIPROCKET_API_KEY){
      // try read from DB first
      const r = await db.query('SELECT * FROM shipments WHERE tracking_number = $1 LIMIT 1', [awb]);
      if (r.rows.length){
        return res.json({ ok: true, awb, shipment: r.rows[0], simulated: true });
      }
      return res.json({ ok: true, awb, events: [
        { ts: Date.now()-3600*1000, status: 'created' },
        { ts: Date.now()-1800*1000, status: 'in_transit' },
        { ts: Date.now(), status: 'out_for_delivery' }
      ], simulated: true });
    }
    const token = process.env.SHIPROCKET_API_KEY;
    const resp = await axios.get(`https://apiv2.shiprocket.in/v1/external/track/${awb}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json({ ok: true, data: resp.data });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/shipping/cancel', async (req, res) => {
  try {
    const { awb } = req.body;
    if (!process.env.SHIPROCKET_API_KEY) return res.json({ ok: true, awb, cancelled: true, simulated: true });
    const token = process.env.SHIPROCKET_API_KEY;
    const resp = await axios.post('https://apiv2.shiprocket.in/v1/external/cancel', { awb }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    // update DB status if present
    try{ await db.query('UPDATE shipments SET shipment_status=$1, updated_at=NOW() WHERE tracking_number=$2', ['CANCELLED', awb]); }catch(e){console.error('DB update failed', e.message);}    
    res.json({ ok: true, data: resp.data });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.post('/shipping/serviceability', async (req, res) => {
  try {
    const { pincode } = req.body;
    if (!process.env.SHIPROCKET_API_KEY){
      return res.json({ ok: true, pincode, couriers: [
        { name: 'Delhivery', rate: 100 }, { name: 'BlueDart', rate: 120 }
      ], simulated: true });
    }
    const token = process.env.SHIPROCKET_API_KEY;
    const resp = await axios.post('https://apiv2.shiprocket.in/v1/external/serviceability', { pincode }, {
      headers: { Authorization: `Bearer ${token}` }
    });
    res.json({ ok: true, data: resp.data });
  } catch (err) {
    console.error(err?.response?.data || err.message);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health', (req, res) => res.json({ status: 'ok', shiprocket: !!process.env.SHIPROCKET_API_KEY }));

app.listen(PORT, () => console.log(`Shipping Service listening on ${PORT}`));
