import { Router } from 'express';
import * as vendor from '../controllers/vendorController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate, requireRole('vendor'));

router.get('/loans', asyncHandler(vendor.getVendorLoans));
router.post('/loan/:id/confirm-delivery', asyncHandler(vendor.confirmDelivery));

export default router;
