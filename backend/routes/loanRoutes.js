import { Router } from 'express';
import { body } from 'express-validator';
import * as loan from '../controllers/loanController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requireRole('user'));

const requestRules = [
  body('amount')
    .isFloat({ gt: 0 })
    .withMessage('Amount must be a positive number'),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
];

const selectVendorRules = [
  body('loanId').trim().notEmpty().withMessage('loanId is required'),
  body('vendorId').trim().notEmpty().withMessage('vendorId is required'),
];

router.post('/request', requestRules, validateRequest, asyncHandler(loan.requestLoan));
router.post(
  '/select-vendor',
  selectVendorRules,
  validateRequest,
  asyncHandler(loan.selectVendor),
);

export default router;
