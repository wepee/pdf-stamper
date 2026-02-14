import { v4 as uuidv4 } from 'uuid';
import archiver from 'archiver';
import { ApiError } from '../lib/errors.js';
import { authenticate } from '../lib/auth.js';
import { isPdf, splitPdf } from '../lib/split-pdf.js';

/**
 * Validate the schema of a single split instruction object.
 * Returns an error message string, or null if valid.
 *
 * @param {unknown} s
 * @returns {string | null}
 */
function validateSplitItem(s) {
  if (typeof s !== 'object' || s === null) {
    return 'Each split must be an object';
  }
  if (typeof s.name !== 'string' || s.name.length === 0) {
    return 'Each split requires a non-empty "name" string';
  }
  if (!Number.isInteger(s.start_page)) {
    return 'Each split requires "start_page" as an integer';
  }
  if (!Number.isInteger(s.end_page)) {
    return 'Each split requires "end_page" as an integer';
  }
  return null;
}

/**
 * Parse the raw `splits` field value into a validated array of split objects.
 *
 * Accepts either a bare JSON array or an object with a `splits` key that
 * contains the array (both documented formats).
 *
 * @param {string} raw        – the raw string value from the multipart field
 * @param {string} requestId
 * @returns {Array}
 */
function parseSplits(raw, requestId) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new ApiError(400, 'INVALID_SPLITS', 'splits must be valid JSON', requestId);
  }

  // Accept { splits: [...] } wrapper or a bare array
  const splits = Array.isArray(parsed) ? parsed : parsed?.splits;

  if (!Array.isArray(splits) || splits.length === 0) {
    throw new ApiError(400, 'EMPTY_SPLITS', 'splits array cannot be empty', requestId);
  }

  // Validate every item
  for (const item of splits) {
    const err = validateSplitItem(item);
    if (err) {
      throw new ApiError(400, 'INVALID_SPLITS', err, requestId);
    }
  }

  return splits;
}

/**
 * Fastify route plugin — POST /split
 *
 * Splits a PDF into sub-documents based on page-range instructions.
 * Returns either a ZIP archive or a JSON+base64 response depending on the
 * Accept header.
 */
export async function splitRoute(fastify) {
  fastify.post(
    '/split',
    { preHandler: authenticate },
    async (request, reply) => {
      const requestId = uuidv4();
      reply.header('X-Request-Id', requestId);

      let pdfBuffer = null;
      let splitsRaw = null;

      // --- Parse multipart fields ----------------------------------------
      const parts = request.parts();

      for await (const part of parts) {
        if (part.type === 'file' && part.fieldname === 'file') {
          const chunks = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          pdfBuffer = Buffer.concat(chunks);
        } else if (part.fieldname === 'splits') {
          splitsRaw = part.value;
        }
      }

      // --- Validate file -------------------------------------------------
      if (!pdfBuffer) {
        throw new ApiError(400, 'NO_FILE', 'No PDF file provided', requestId);
      }
      if (!isPdf(pdfBuffer)) {
        throw new ApiError(400, 'INVALID_FORMAT', 'File must be a PDF', requestId);
      }

      // --- Validate & parse splits ---------------------------------------
      if (splitsRaw === null || splitsRaw === undefined) {
        throw new ApiError(400, 'INVALID_SPLITS', 'splits field is required', requestId);
      }
      const splits = parseSplits(splitsRaw, requestId);

      // --- Perform the split ---------------------------------------------
      let result;
      try {
        result = await splitPdf(pdfBuffer, splits, requestId);
      } catch (err) {
        if (err instanceof ApiError) throw err;
        request.log.error({ err, requestId }, 'PDF split failed');
        throw new ApiError(500, 'SPLIT_FAILED', err.message, requestId);
      } finally {
        pdfBuffer = null; // free memory
      }

      // --- Respond -------------------------------------------------------
      const acceptHeader = request.headers.accept || '';
      const wantsJson = acceptHeader.includes('application/json');

      if (wantsJson) {
        return reply.code(200).send({
          success: true,
          total_pages: result.total_pages,
          documents: result.documents.map((doc) => ({
            name: doc.name,
            filename: doc.filename,
            pages: doc.pages,
            page_count: doc.page_count,
            data_base64: doc.buffer.toString('base64'),
          })),
        });
      }

      // ZIP mode
      reply.header('Content-Type', 'application/zip');
      reply.header('Content-Disposition', 'attachment; filename="split_result.zip"');

      const archive = archiver('zip', { zlib: { level: 6 } });

      for (const doc of result.documents) {
        archive.append(doc.buffer, { name: doc.filename });
      }

      archive.finalize();
      return reply.send(archive);
    },
  );
}
