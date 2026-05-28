import crypto from 'crypto';
import { razorpayInstance, razorpayConfig } from '../config/razorpay.config.js';
import { query } from '../config/database.js';

export class PaymentService {
  /**
   * Creates a new Razorpay Order and saves it to the database.
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
      
      const orderAmountINR = order.amount / 100;

      // Store the initial order payment record in PostgreSQL
      try {
        await query(
          `INSERT INTO payments (order_id, amount, payment_status, payment_method) 
           VALUES ($1, $2, $3, $4)`,
          [order.id, orderAmountINR, 'PENDING', 'razorpay']
        );
        console.log(`Inserted pending payment record for order_id: ${order.id} into database.`);
      } catch (dbError) {
        console.error('Failed to save order payment record to database:', dbError.message);
      }

      return {
        id: order.id,
        amount: orderAmountINR, // back to INR
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
   * Verifies the Razorpay payment signature and updates the status in the database.
   * @param {string} orderId - The Razorpay Order ID
   * @param {string} paymentId - The Razorpay Payment ID
   * @param {string} signature - The Razorpay Signature
   * @returns {Promise<boolean>} True if signature is valid, false otherwise
   */
  async verifyPayment(orderId, paymentId, signature) {
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

    const isValid = expectedSignature === signature;

    // Update database status of the payment record
    try {
      if (isValid) {
        await query(
          `UPDATE payments 
           SET payment_transaction_id = $1, payment_status = $2, payment_method = $3
           WHERE order_id = $4`,
          [paymentId, 'COMPLETED', 'razorpay', orderId]
        );
        console.log(`Updated payment status to COMPLETED for order_id: ${orderId} in database.`);
      } else {
        await query(
          `UPDATE payments 
           SET payment_status = $1, failure_reason = $2
           WHERE order_id = $3`,
          ['FAILED', 'Signature verification failed', orderId]
        );
        console.log(`Updated payment status to FAILED for order_id: ${orderId} in database.`);
      }
    } catch (dbError) {
      console.error('Failed to update payment status in database:', dbError.message);
    }

    return isValid;
  }
}
export const paymentService = new PaymentService();
