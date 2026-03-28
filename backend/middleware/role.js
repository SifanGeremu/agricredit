import { AppError } from './errorHandler.js';

/**
 * Role-based access after authenticate — pass allowed roles
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      next(new AppError('Authentication required', 401));
      return;
    }
    if (!roles.includes(req.user.role)) {
      next(new AppError('Forbidden: insufficient role', 403));
      return;
    }
    next();
  };
}
