import paymentRouter from './payment.routes.js';

export class PaymentModule {
  /**
   * Initializes the payment module by registering its routes.
   * @param {import('express').Express} app - The main Express application
   */
  static init(app) {
    app.use('/api/v1/payment', paymentRouter);
    console.log('PaymentModule initialized successfully.');
  }
}
