import { Router } from 'express';
import * as user from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate, requireRole('user'));

router.get('/loans', asyncHandler(user.getMyLoans));
router.get('/group', asyncHandler(user.getMyGroup));
router.get('/catalog/products', asyncHandler(user.listCatalogProducts));
router.get('/blocked-vendors', asyncHandler(user.listBlockedVendorIds));

export default router;
