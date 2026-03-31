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
  /** Same MSISDN as Postman STK PhoneNumber / PartyA — receives the push prompt. */
  body('phone').optional().trim(),
];

const stkPushRawRules = [
  body('BusinessShortCode').optional(),
  body('Password').optional(),
  body('Timestamp').optional(),
  body('TransactionType').optional(),
  body('Amount')
    .exists()
    .withMessage('Amount is required in the STK payload')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number'),
  body('PartyA').optional(),
  body('PartyB').optional(),
  body('PhoneNumber').optional(),
  body('CallBackURL').optional(),
  body('AccountReference').optional(),
];

router.post('/repay', authenticate, requireRole('user'), repayRules, validateRequest, asyncHandler(mpesa.repayLoan));

router.post(
  '/stk/push',
  authenticate,
  requireRole('user'),
  stkPushRawRules,
  validateRequest,
  asyncHandler(mpesa.stkPushRaw),
);

router.get('/status', authenticate, requireRole('user'), asyncHandler(mpesa.mpesaStatus));

router.post('/webhook/stk', asyncHandler(mpesa.stkWebhook));

router.post('/dev/confirm-stk', asyncHandler(mpesa.devConfirmStk));

export default router;
