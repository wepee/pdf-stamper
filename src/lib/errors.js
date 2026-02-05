/**
 * Custom API error class
 */
export class ApiError extends Error {
  constructor(statusCode, code, message, requestId) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.requestId = requestId;
  }
}

/**
 * Fastify error handler
 */
export function errorHandler(error, request, reply) {
  const requestId = reply.getHeader('X-Request-Id') || 'unknown';

  // Handle our custom ApiError
  if (error instanceof ApiError) {
    return reply.status(error.statusCode).send({
      error: {
        code: error.code,
        message: error.message,
        requestId: error.requestId,
      },
    });
  }

  // Handle Fastify-specific errors
  if (error.code === 'FST_REQ_FILE_TOO_LARGE') {
    return reply.status(413).send({
      error: {
        code: 'FILE_TOO_LARGE',
        message: 'File exceeds 200MB limit',
        requestId,
      },
    });
  }

  if (error.code === 'FST_ERR_CTP_INVALID_MEDIA_TYPE') {
    return reply.status(415).send({
      error: {
        code: 'UNSUPPORTED_MEDIA',
        message: 'Content-Type must be multipart/form-data',
        requestId,
      },
    });
  }

  // Handle timeout
  if (error.code === 'FST_ERR_SEND_TIMEOUT' || error.code === 'ERR_STREAM_PREMATURE_CLOSE') {
    return reply.status(504).send({
      error: {
        code: 'TIMEOUT',
        message: 'Request timed out',
        requestId,
      },
    });
  }

  // Handle authorization (if you add auth middleware)
  if (error.statusCode === 401) {
    return reply.status(401).send({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or missing API key',
        requestId,
      },
    });
  }

  // Generic server error
  request.log.error({ err: error, requestId }, 'Unhandled error');
  
  return reply.status(500).send({
    error: {
      code: 'PROCESSING_FAILED',
      message: 'Internal server error',
      requestId,
    },
  });
}
