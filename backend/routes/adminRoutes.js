import { Router } from 'express';
import { body } from 'express-validator';
import * as admin from '../controllers/adminController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requireRole('admin'));

router.get('/loans', asyncHandler(admin.listLoans));
router.post('/loan/:id/approve', asyncHandler(admin.approveLoan));
router.post(
  '/loan/:id/reject',
  body('reason').optional().isString(),
  validateRequest,
  asyncHandler(admin.rejectLoan),
);
router.post('/loan/:id/disburse', asyncHandler(admin.disburseLoan));

const vendorCreateRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('walletNumber').trim().notEmpty().withMessage('walletNumber is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
];

router.post(
  '/vendors',
  vendorCreateRules,
  validateRequest,
  asyncHandler(admin.createVendor),
);
router.get('/vendors', asyncHandler(admin.listAdminVendors));
router.get('/stats', asyncHandler(admin.adminStats));

export default router;
