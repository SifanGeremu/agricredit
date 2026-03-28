import { Router } from 'express';
import { body } from 'express-validator';
import * as auth from '../controllers/authController.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

const registerRules = [
  body('name').trim().notEmpty().withMessage('Name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('nationalId')
    .matches(/^\d{12}$/)
    .withMessage('National ID must be exactly 12 digits'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('farmSize').optional().trim(),
  body('cropType').optional().trim(),
  body('location').optional().trim(),
];

const registerVendorRules = [
  body('businessName').trim().notEmpty().withMessage('Business name is required'),
  body('ownerName').trim().notEmpty().withMessage('Owner name is required'),
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('location').trim().notEmpty().withMessage('Location is required'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  body('walletNumber').optional().trim(),
];

const loginRules = [
  body('phone').trim().notEmpty().withMessage('Phone is required'),
  body('password').notEmpty().withMessage('Password is required'),
];

router.post('/register', registerRules, validateRequest, asyncHandler(auth.register));
router.post(
  '/register/vendor',
  registerVendorRules,
  validateRequest,
  asyncHandler(auth.registerVendor),
);
router.post('/login', loginRules, validateRequest, asyncHandler(auth.login));

export default router;
