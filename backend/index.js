/**
 * AgriCredit API — Express + Prisma (MongoDB) + JWT
 * Flow: request → admin → vendor select → disburse → delivery → repay
 */
import 'dotenv/config';
import http from 'http';
import express from 'express';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import loanRoutes from './routes/loanRoutes.js';
import userRoutes from './routes/userRoutes.js';
import vendorsPublicRoutes from './routes/vendorsPublicRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import vendorRoutes from './routes/vendorRoutes.js';
import mpesaRoutes from './routes/mpesaRoutes.js';
import { errorHandler, AppError } from './middleware/errorHandler.js';

const app = express();
const basePort = Number(process.env.PORT) || 4000;
const maxPort = basePort + 30;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({
    success: true,
    service: 'AgriCredit API',
    message: 'Backend is running. This API has no HTML UI — use /health or call JSON endpoints (see README).',
    endpoints: {
      health: 'GET /health',
      auth: 'POST /auth/register, POST /auth/login',
    },
  });
});

app.get('/health', (req, res) => {
  res.json({ success: true, service: 'AgriCredit API' });
});

app.use('/auth', authRoutes);
app.use('/loan', loanRoutes);
app.use('/user', userRoutes);
app.use('/vendors', vendorsPublicRoutes);
app.use('/admin', adminRoutes);
app.use('/vendor', vendorRoutes);
app.use('/mpesa', mpesaRoutes);

app.use((req, res, next) => {
  next(new AppError(`Not found: ${req.method} ${req.path}`, 404));
});

app.use(errorHandler);

function listen(port) {
  if (port > maxPort) {
    console.error(`No free port found between ${basePort} and ${maxPort}. Stop other apps using those ports or set PORT in .env.`);
    process.exit(1);
  }
  const server = http.createServer(app);
  server.once('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} is in use, trying ${port + 1}...`);
      listen(port + 1);
    } else {
      console.error(err);
      process.exit(1);
    }
  });
  server.listen(port, () => {
    console.log(`AgriCredit API listening on http://localhost:${port}`);
  });
}

listen(basePort);
