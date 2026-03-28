import { Router } from 'express';
import * as notification from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = Router();

router.use(authenticate);

router.get('/', asyncHandler(notification.listNotifications));
router.post('/read-all', asyncHandler(notification.markAllRead));

export default router;
