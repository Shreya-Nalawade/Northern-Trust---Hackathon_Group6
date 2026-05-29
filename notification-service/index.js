require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const sendgrid = require('@sendgrid/mail');
const Twilio = require('twilio');
const emailTemplates = require('./templates/emailTemplates');
const smsTemplates = require('./templates/smsTemplates');
const db = require('./common/db');

const PORT = process.env.PORT || 3001;

if (process.env.SENDGRID_API_KEY) sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
const twilioClient = (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN)
  ? Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const app = express();
app.use(bodyParser.json());

function renderTemplate(str, data = {}){
  const replaced = String(str).replace(/{{\s*(\w+)\s*}}/g, (_, key) => {
    const v = data?.[key];
    return v === undefined || v === null ? '' : String(v);
  });
  const cleaned = replaced.split('\n').map(l => l.trim()).join('\n');
  return cleaned.replace(/^\s+|\s+$/g, '').replace(/\n{2,}/g, '\n\n');
}

async function persistNotification({ workflow_execution_id = null, notification_type, channel, recipient, subject, message, payload, provider_response = null, notification_status = 'PENDING' }){
  const sql = `INSERT INTO notifications (workflow_execution_id, notification_type, channel, recipient, subject, message, payload, provider_response, notification_status, sent_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, NOW()) RETURNING *`;
  const params = [workflow_execution_id, notification_type, channel, recipient, subject, message, payload || null, provider_response || null, notification_status];
  try{
    const r = await db.query(sql, params);
    return r.rows[0];
  }catch(err){
    console.error('Failed to persist notification', err.message);
    return null;
  }
}

async function sendEmail({ to, template, data, workflow_execution_id = null }){
  const t = emailTemplates[template];
  if (!t) throw new Error('unknown email template');
  const subject = renderTemplate(t.subject, data);
  const html = renderTemplate(t.html, data);
  const msg = { to, from: process.env.SENDGRID_FROM || 'no-reply@example.com', subject, html };
  if (!process.env.SENDGRID_API_KEY){
    console.log('Simulated email send:', JSON.stringify(msg, null, 2));
    const saved = await persistNotification({ workflow_execution_id, notification_type: template, channel: 'email', recipient: to, subject, message: html, payload: data, provider_response: { simulated: true }, notification_status: 'SENT' });
    return { ok: true, simulated: true, saved };
  }
  try {
    const resp = await sendgrid.send(msg);
    const saved = await persistNotification({ workflow_execution_id, notification_type: template, channel: 'email', recipient: to, subject, message: html, payload: data, provider_response: resp, notification_status: 'SENT' });
    return { ok: true, resp, saved };
  } catch (error) {
    console.warn('[Notification Service] SendGrid send failed. Falling back to simulation mode. Error:', error.message);
    const saved = await persistNotification({ workflow_execution_id, notification_type: template, channel: 'email', recipient: to, subject, message: html, payload: data, provider_response: { simulated: true, error: error.message }, notification_status: 'SENT' });
    return { ok: true, simulated: true, saved };
  }
}

async function sendSms({ to, template, data, workflow_execution_id = null }){
  const t = smsTemplates[template] ?? smsTemplates.generic;
  const body = renderTemplate(t, data);
  if (!twilioClient){
    console.log('Simulated SMS send:', JSON.stringify({ to, body }, null, 2));
    const saved = await persistNotification({ workflow_execution_id, notification_type: template, channel: 'sms', recipient: to, subject: null, message: body, payload: data, provider_response: { simulated: true }, notification_status: 'SENT' });
    return { ok: true, simulated: true, saved };
  }
  const message = await twilioClient.messages.create({ body, from: process.env.TWILIO_FROM_NUMBER, to });
  const saved = await persistNotification({ workflow_execution_id, notification_type: template, channel: 'sms', recipient: to, subject: null, message: body, payload: data, provider_response: message, notification_status: 'SENT' });
  return { ok: true, sid: message.sid, saved };
}

app.post('/notify/email', async (req,res)=>{
  try{
    const { to, template, data, workflow_execution_id } = req.body;
    const r = await sendEmail({ to, template, data, workflow_execution_id });
    res.json(r);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/notify/sms', async (req,res)=>{
  try{
    const { to, template, data, workflow_execution_id } = req.body;
    const r = await sendSms({ to, template, data, workflow_execution_id });
    res.json(r);
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/notify/order-failed', async (req,res)=>{
  try{
    const { toEmail, toPhone, template='payment_failed', data, workflow_execution_id } = req.body;
    const ops = [];
    if (toEmail) ops.push(sendEmail({ to: toEmail, template, data, workflow_execution_id }));
    if (toPhone) ops.push(sendSms({ to: toPhone, template, data, workflow_execution_id }));
    const results = await Promise.all(ops);
    res.json({ ok: true, results });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/notify/bulk', async (req,res)=>{
  try{
    const items = req.body.items || [];
    const batches = [];
    for (let i=0;i<items.length;i+=20) batches.push(items.slice(i,i+20));
    const results = [];
    for (const batch of batches){
      const promises = batch.map(it=>{
        if (it.type === 'email') return sendEmail({ to: it.to, template: it.template, data: it.data, workflow_execution_id: it.workflow_execution_id });
        if (it.type === 'sms') return sendSms({ to: it.to, template: it.template, data: it.data, workflow_execution_id: it.workflow_execution_id });
        return Promise.resolve({ error: 'unknown type' });
      });
      const r = await Promise.all(promises);
      results.push(...r);
    }
    res.json({ ok: true, results });
  }catch(err){
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

app.get('/health',(req,res)=>res.json({ status: 'ok', sendgrid: !!process.env.SENDGRID_API_KEY, twilio: !!twilioClient }));

app.listen(PORT, ()=>console.log(`Notification Service listening on ${PORT}`));
