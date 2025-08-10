const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error for debugging
  console.error('Error:', err);

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = {
      message,
      statusCode: 404
    };
  }

  // Mongoose duplicate key error
  if (err.code === 11000) {
    let message = 'Duplicate field value entered';
    
    // Extract field name from error
    const field = Object.keys(err.keyValue)[0];
    if (field === 'email') {
      message = 'Email already exists';
    } else if (field === 'phone') {
      message = 'Phone number already exists';
    } else if (field === 'name') {
      message = 'Name already exists';
    }
    
    error = {
      message,
      statusCode: 400
    };
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = {
      message,
      statusCode: 400
    };
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error = {
      message: 'Invalid token',
      statusCode: 401
    };
  }

  if (err.name === 'TokenExpiredError') {
    error = {
      message: 'Token expired',
      statusCode: 401
    };
  }

  // File upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    error = {
      message: 'File size too large',
      statusCode: 400
    };
  }

  if (err.code === 'LIMIT_FILE_COUNT') {
    error = {
      message: 'Too many files uploaded',
      statusCode: 400
    };
  }

  if (err.code === 'LIMIT_UNEXPECTED_FILE') {
    error = {
      message: 'Unexpected file field',
      statusCode: 400
    };
  }

  // Database connection errors
  if (err.name === 'MongoNetworkError') {
    error = {
      message: 'Database connection error',
      statusCode: 500
    };
  }

  if (err.name === 'MongoTimeoutError') {
    error = {
      message: 'Database timeout error',
      statusCode: 500
    };
  }

  // Payment gateway errors
  if (err.type === 'StripeCardError') {
    error = {
      message: err.message || 'Payment failed',
      statusCode: 400
    };
  }

  if (err.type === 'RazorpayError') {
    error = {
      message: err.description || 'Payment processing failed',
      statusCode: 400
    };
  }

  // Rate limiting errors
  if (err.status === 429) {
    error = {
      message: 'Too many requests, please try again later',
      statusCode: 429
    };
  }

  // Default error response
  const statusCode = error.statusCode || err.statusCode || 500;
  const message = error.message || 'Server Error';

  // Different error responses based on environment
  const errorResponse = {
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      error: err
    })
  };

  // Add additional error details for specific status codes
  if (statusCode === 400) {
    errorResponse.type = 'ValidationError';
  } else if (statusCode === 401) {
    errorResponse.type = 'AuthenticationError';
  } else if (statusCode === 403) {
    errorResponse.type = 'AuthorizationError';
  } else if (statusCode === 404) {
    errorResponse.type = 'NotFoundError';
  } else if (statusCode === 429) {
    errorResponse.type = 'RateLimitError';
    errorResponse.retryAfter = err.retryAfter || 60;
  } else if (statusCode >= 500) {
    errorResponse.type = 'ServerError';
    
    // Don't expose internal server errors in production
    if (process.env.NODE_ENV === 'production') {
      errorResponse.message = 'Internal Server Error';
    }
  }

  res.status(statusCode).json(errorResponse);
};

// Async error handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Custom error class
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Specific error classes
class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401);
    this.name = 'AuthenticationError';
  }
}

class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403);
    this.name = 'AuthorizationError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict') {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfter = 60) {
    super(message, 429);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

class PaymentError extends AppError {
  constructor(message = 'Payment processing failed') {
    super(message, 402);
    this.name = 'PaymentError';
  }
}

class ServiceUnavailableError extends AppError {
  constructor(message = 'Service temporarily unavailable') {
    super(message, 503);
    this.name = 'ServiceUnavailableError';
  }
}

module.exports = {
  errorHandler,
  asyncHandler,
  AppError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ConflictError,
  RateLimitError,
  PaymentError,
  ServiceUnavailableError
};
