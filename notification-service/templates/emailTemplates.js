const templates = {
  order_confirmed: {
    subject: 'Your order {{orderId}} is confirmed',
    html: `
      <html><body>
        <h1>Order {{orderId}} confirmed</h1>
        <p>Hi {{customerName}},</p>
        <p>Thanks for your order. We'll start processing it shortly.</p>
        <p><strong>Total:</strong> {{total}}</p>
      </body></html>
    `
  },
  payment_failed: {
    subject: 'Payment failed for order {{orderId}}',
    html: `
      <html><body>
        <h1>Payment Failed</h1>
        <p>Order {{orderId}} could not be charged.</p>
        <p>Please retry payment or contact support.</p>
      </body></html>
    `
  },
  shipped: {
    subject: 'Your order {{orderId}} has shipped',
    html: `
      <html><body>
        <h1>Shipped</h1>
        <p>Your order is on the way. Tracking: {{awb}}</p>
      </body></html>
    `
  },
  delivered: {
    subject: 'Order {{orderId}} delivered',
    html: `
      <html><body>
        <h1>Delivered</h1>
        <p>Order {{orderId}} was delivered. Enjoy!</p>
      </body></html>
    `
  },
  high_value_approval: {
    subject: 'Approval required for order {{orderId}}',
    html: `
      <html><body>
        <h1>Manual approval required</h1>
        <p>Order {{orderId}} requires manual approval. Value: {{total}}</p>
      </body></html>
    `
  }
}

module.exports = templates;
