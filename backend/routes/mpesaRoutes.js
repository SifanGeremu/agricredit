import { Router } from 'express';
import { body } from 'express-validator';
import * as mpesa from '../controllers/mpesaController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

const repayRules = [
  body('loanId').trim().notEmpty().withMessage('loanId is required'),
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number'),
];

router.post('/repay', authenticate, requireRole('user'), repayRules, validateRequest, asyncHandler(mpesa.repayLoan));

export default router;
