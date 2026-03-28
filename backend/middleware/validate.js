import { validationResult } from 'express-validator';
import { AppError } from './errorHandler.js';

/** Run after express-validator chains */
export function validateRequest(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const msg = errors
      .array()
      .map((e) => e.msg)
      .join('; ');
    next(new AppError(msg, 400));
    return;
  }
  next();
}
