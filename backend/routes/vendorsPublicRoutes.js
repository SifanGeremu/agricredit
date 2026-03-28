import { Router } from 'express';
import * as user from '../controllers/userController.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/role.js';
import { asyncHandler } from '../middleware/errorHandler.js';

/** GET /vendors — farmers browse verified vendors */
const router = Router();

router.get('/', authenticate, requireRole('user'), asyncHandler(user.listVendors));

export default router;
