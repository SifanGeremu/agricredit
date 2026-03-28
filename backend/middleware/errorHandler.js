/**
 * Centralized error handler — consistent JSON shape for all errors.
 */
export class AppError extends Error {
  constructor(message, statusCode = 500) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  const body = {
    success: false,
    message: err.message || 'Internal server error',
  };
  if (process.env.NODE_ENV === 'development' && err.stack) {
    body.stack = err.stack;
  }
  res.status(status).json(body);
}

/** Wrap async route handlers so rejections reach errorHandler */
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}
