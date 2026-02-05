import Fastify from 'fastify';
import multipart from '@fastify/multipart';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { stampRoute } from './routes/stamp.js';
import { errorHandler } from './lib/errors.js';

const fastify = Fastify({
  logger: {
    level: 'info',
    // Security: redact sensitive fields from logs
    redact: ['req.headers.authorization'],
    serializers: {
      req(request) {
        return {
          method: request.method,
          url: request.url,
          hostname: request.hostname,
          remoteAddress: request.ip,
          // Explicitly exclude body content for privacy
        };
      },
    },
  },
  // Hard timeout: 20s as per spec
  requestTimeout: 20000,
  bodyLimit: 200 * 1024 * 1024, // 200MB
});

// Register plugins
await fastify.register(cors);

await fastify.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
});

await fastify.register(multipart, {
  limits: {
    fileSize: 200 * 1024 * 1024, // 200MB max
    files: 1, // Single file only
  },
});

// Custom error handler
fastify.setErrorHandler(errorHandler);

// Health check
fastify.get('/health', async () => ({ status: 'ok' }));

// Register stamp route
fastify.register(stampRoute, { prefix: '/v1' });

// Start server
const start = async () => {
  try {
    const port = process.env.PORT || 3000;
    await fastify.listen({ port, host: '0.0.0.0' });
    console.log(`PDF Stamp API running on port ${port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
