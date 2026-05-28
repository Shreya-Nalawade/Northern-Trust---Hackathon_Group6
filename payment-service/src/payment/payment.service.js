import crypto from 'crypto';
import { razorpayInstance, razorpayConfig } from '../config/razorpay.config.js';

export class PaymentService {
  /**
   * Creates a new Razorpay Order.
   * @param {number} amount - Amount in INR (e.g. 10000)
   * @returns {Promise<object>} The created order details
   */
  async createOrder(amount) {
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new Error('Invalid amount provided. Amount must be a positive number.');
    }

    // Razorpay expects amount in paise (1 INR = 100 paise)
    const amountInPaise = Math.round(amount * 100);

    const options = {
      amount: amountInPaise,
      currency: 'INR',
      receipt: `receipt_order_${Date.now()}`,
    };

    try {
      const order = await razorpayInstance.orders.create(options);
      return {
        id: order.id,
        amount: order.amount / 100, // back to INR
        currency: order.currency,
        receipt: order.receipt,
        status: order.status,
        keyId: razorpayConfig.keyId, // Return keyId for frontend configuration
      };
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      const errMsg = error.message || 
                     error.description || 
                     (error.error && error.error.description) || 
                     JSON.stringify(error);
      throw new Error(`Razorpay Order Creation Failed: ${errMsg}`);
    }
  }

  /**
   * Verifies the Razorpay payment signature.
   * @param {string} orderId - The Razorpay Order ID
   * @param {string} paymentId - The Razorpay Payment ID
   * @param {string} signature - The Razorpay Signature
   * @returns {boolean} True if signature is valid, false otherwise
   */
  verifyPayment(orderId, paymentId, signature) {
    if (!orderId || !paymentId || !signature) {
      throw new Error('Missing signature verification parameters (orderId, paymentId, signature).');
    }

    const secret = razorpayConfig.keySecret;
    if (!secret || secret === 'placeholder_secret') {
      throw new Error('Razorpay Key Secret is not configured. Signature verification failed.');
    }

    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body.toString())
      .digest('hex');

    return expectedSignature === signature;
  }
}
export const paymentService = new PaymentService();
