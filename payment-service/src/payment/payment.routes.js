import { Router } from 'express';
import { paymentController } from './payment.controller.js';

const router = Router();

// Route to create a Razorpay order
router.post('/order', (req, res) => paymentController.createOrder(req, res));

// Route to verify the payment signature
router.post('/verify', (req, res) => paymentController.verifyPayment(req, res));

export default router;
