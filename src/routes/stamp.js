import { v4 as uuidv4 } from "uuid";
import { stampPdf } from "../lib/stamper.js";
import { validatePayload } from "../lib/validation.js";
import { ApiError } from "../lib/errors.js";
import { authenticate } from "../lib/auth.js";
import { isSupportedImage, imageToPdf } from "../lib/image-to-pdf.js";

const ACCEPTED_MIMETYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
]);

export async function stampRoute(fastify) {
  fastify.post(
    "/stamp",
    { preHandler: authenticate },
    async (request, reply) => {
      const requestId = uuidv4();
      reply.header("X-Request-Id", requestId);

      let pdfBuffer = null;
      let payload = null;
      let originalFilename = "document.pdf";

      // Parse multipart
      const parts = request.parts();

      for await (const part of parts) {
        if (part.type === "file" && part.fieldname === "file") {
          // Validate content type
          if (!ACCEPTED_MIMETYPES.has(part.mimetype)) {
            throw new ApiError(
              415,
              "UNSUPPORTED_MEDIA",
              "File must be a PDF or image (JPEG, PNG)",
              requestId,
            );
          }
          // Capture original filename
          if (part.filename) {
            originalFilename = part.filename;
          }
          // Buffer the file
          const chunks = [];
          for await (const chunk of part.file) {
            chunks.push(chunk);
          }
          const fileBuffer = Buffer.concat(chunks);

          // Convert image to PDF if needed, otherwise use as-is
          if (isSupportedImage(part.mimetype)) {
            try {
              pdfBuffer = await imageToPdf(fileBuffer, part.mimetype);
            } catch (err) {
              throw new ApiError(
                422,
                "INVALID_IMAGE",
                "Failed to convert image to PDF",
                requestId,
              );
            }
          } else {
            pdfBuffer = fileBuffer;
          }
        } else if (part.fieldname === "payload") {
          try {
            payload = JSON.parse(part.value);
          } catch {
            throw new ApiError(
              400,
              "INVALID_INPUT",
              "payload must be valid JSON",
              requestId,
            );
          }
        }
      }

      // Validate required fields
      if (!pdfBuffer) {
        throw new ApiError(
          400,
          "INVALID_INPUT",
          "file field is required",
          requestId,
        );
      }
      if (!payload) {
        throw new ApiError(
          400,
          "INVALID_INPUT",
          "payload field is required",
          requestId,
        );
      }

      // Validate payload schema
      const validationError = validatePayload(payload);
      if (validationError) {
        throw new ApiError(400, "INVALID_INPUT", validationError, requestId);
      }

      // Process PDF
      let stampedPdf;
      try {
        stampedPdf = await stampPdf(pdfBuffer, payload, requestId);
      } catch (err) {
        if (err instanceof ApiError) throw err;

        // Handle pdf-lib specific errors
        if (err.message?.includes("Invalid PDF")) {
          throw new ApiError(
            422,
            "INVALID_PDF",
            "File is not a valid PDF",
            requestId,
          );
        }

        request.log.error({ err, requestId }, "PDF processing failed");
        throw new ApiError(
          500,
          "PROCESSING_FAILED",
          "Failed to process PDF",
          requestId,
        );
      } finally {
        // Security: clear buffer from memory
        pdfBuffer = null;
      }

      // Build output filename: strip original extension, add "-stamped.pdf"
      const baseName = originalFilename.replace(/\.(pdf|png|jpe?g)$/i, "");
      const outputFilename = `${baseName}-stamped.pdf`;

      // Return stamped PDF
      reply
        .code(200)
        .header("Content-Type", "application/pdf")
        .header(
          "Content-Disposition",
          `attachment; filename="${outputFilename}"`,
        )
        .send(Buffer.from(stampedPdf));
    },
  );
}
