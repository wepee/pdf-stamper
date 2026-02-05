import { ApiError } from './errors.js';

/**
 * Bearer token authentication middleware
 * 
 * Usage in route:
 * fastify.addHook('preHandler', authenticate);
 */
export async function authenticate(request, reply) {
  const requestId = reply.getHeader('X-Request-Id') || 'unknown';
  const authHeader = request.headers.authorization;

  if (!authHeader) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Missing Authorization header', requestId);
  }

  const [scheme, token] = authHeader.split(' ');

  if (scheme !== 'Bearer' || !token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid Authorization header format', requestId);
  }

  // Validate token against configured API keys
  const validKeys = (process.env.API_KEYS || '').split(',').filter(Boolean);

  if (validKeys.length === 0) {
    // No keys configured = auth disabled (dev mode)
    request.log.warn('No API_KEYS configured - authentication disabled');
    return;
  }

  if (!validKeys.includes(token)) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Invalid API key', requestId);
  }
}
