import { Router } from 'express';
import { body } from 'express-validator';
import * as vendor from '../controllers/vendorController.js';
import * as product from '../controllers/productController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { validateRequest } from '../middleware/validate.js';

const router = Router();

router.use(authenticate, requireRole('vendor'));

router.get('/loans', asyncHandler(vendor.getVendorLoans));
router.post('/loan/:id/confirm-delivery', asyncHandler(vendor.confirmDelivery));

router.get('/farmers', asyncHandler(vendor.listRelatedFarmers));
router.get('/blocks', asyncHandler(vendor.listBlockedFarmers));
router.post(
  '/blocks',
  [body('farmerId').trim().notEmpty().withMessage('farmerId is required')],
  validateRequest,
  asyncHandler(vendor.blockFarmer),
);
router.delete('/blocks/:farmerId', asyncHandler(vendor.unblockFarmer));

router.get('/products', asyncHandler(product.listProducts));
router.post(
  '/products',
  [
    body('name').trim().notEmpty(),
    body('category').trim().notEmpty(),
    body('price').isFloat({ gt: 0 }),
    body('stock').isInt({ min: 0 }),
  ],
  validateRequest,
  asyncHandler(product.createProduct),
);
router.patch('/products/:id', asyncHandler(product.updateProduct));
router.delete('/products/:id', asyncHandler(product.deleteProduct));

export default router;
