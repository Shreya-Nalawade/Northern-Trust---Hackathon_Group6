import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

const keyId = process.env.RAZORPAY_KEY_ID;
const keySecret = process.env.RAZORPAY_KEY_SECRET;

if (!keyId || keyId === 'rzp_test_placeholder') {
  console.warn('\x1b[33m%s\x1b[0m', 'WARNING: RAZORPAY_KEY_ID is not configured or is a placeholder. Payments will fail.');
}

export const razorpayConfig = {
  keyId,
  keySecret,
};

// Initialize the Razorpay instance
export const razorpayInstance = new Razorpay({
  key_id: keyId || 'placeholder',
  key_secret: keySecret || 'placeholder',
});
