import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { PaymentModule } from './payment/payment.module.js';

const app = express();

// Global Middlewares
app.use(cors({
  origin: '*', // Allow all origins for local hackathon testing
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check / Home Route
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'UP',
    timestamp: new Date().toISOString(),
    service: 'payment-service'
  });
});

app.get('/', (req, res) => {
  res.status(200).send(`
    <html>
      <head>
        <title>Payment Service Dashboard</title>
        <style>
          body { font-family: sans-serif; text-align: center; padding: 50px; background-color: #0f172a; color: #f8fafc; }
          .container { max-width: 600px; margin: 0 auto; background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.5); }
          h1 { color: #38bdf8; }
          p { color: #94a3b8; font-size: 1.1em; }
          .status { font-weight: bold; color: #4ade80; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>Payment Service API Gateway</h1>
          <p>Status: <span class="status">ONLINE</span></p>
          <p>Base URL: <code>/api/v1/payment</code></p>
        </div>
      </body>
    </html>
  `);
});

// Initialize Modular Components
PaymentModule.init(app);

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('\x1b[31m%s\x1b[0m', 'Unhandled error inside Express application:', err);
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal Server Error'
  });
});

export default app;
