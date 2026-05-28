const sms = {
  order_confirmed: 'Your order {{orderId}} is confirmed. Thank you, {{customerName}}.',
  payment_failed: 'Payment failed for order {{orderId}}. Please retry.',
  shipped: 'Order {{orderId}} shipped. AWB: {{awb}}.',
  delivered: 'Order {{orderId}} delivered. Thank you!',
  high_value_approval: 'Order {{orderId}} needs approval. Value: {{total}}.',
  generic: '{{message}}'
}

module.exports = sms;
