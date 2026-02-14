import { PDFDocument } from 'pdf-lib';
import { ApiError } from './errors.js';
import { slugify } from './slugify.js';

/**
 * Check whether a buffer starts with PDF magic bytes (%PDF-).
 *
 * @param {Buffer} buffer
 * @returns {boolean}
 */
export function isPdf(buffer) {
  return buffer.length >= 5 && buffer.subarray(0, 5).toString() === '%PDF-';
}

/**
 * Split a PDF buffer into multiple sub-documents according to the given
 * split instructions.
 *
 * Each split instruction must contain:
 * - label    (string)  – human-readable description
 * - piece_no (string)  – piece identifier used in filenames
 * - start_page (int)   – first page (1-indexed, inclusive)
 * - end_page   (int)   – last page  (1-indexed, inclusive)
 *
 * @param {Buffer} pdfBuffer  – the source PDF
 * @param {Array}  splits     – array of split instruction objects
 * @param {string} requestId  – for error tracing
 * @returns {Promise<{ total_pages: number, documents: Array }>}
 */
export async function splitPdf(pdfBuffer, splits, requestId) {
  const sourcePdf = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
  });
  const totalPages = sourcePdf.getPageCount();

  // --- Validate every split range against the actual page count -----------
  for (const split of splits) {
    if (split.start_page < 1) {
      throw new ApiError(400, 'INVALID_RANGE', 'Pages are 1-indexed', requestId);
    }
    if (split.start_page > split.end_page) {
      throw new ApiError(400, 'INVALID_RANGE', 'start_page must be <= end_page', requestId);
    }
    if (split.end_page > totalPages) {
      throw new ApiError(
        400,
        'PAGE_OUT_OF_RANGE',
        `Page ${split.end_page} exceeds document length (${totalPages} pages)`,
        requestId,
        { requested: split.end_page, total_pages: totalPages },
      );
    }
  }

  // --- Extract sub-documents ---------------------------------------------
  const documents = [];

  for (const split of splits) {
    const newPdf = await PDFDocument.create();

    // pdf-lib uses 0-based indices; the API uses 1-based
    const pageIndices = [];
    for (let i = split.start_page - 1; i <= split.end_page - 1; i++) {
      pageIndices.push(i);
    }

    const copiedPages = await newPdf.copyPages(sourcePdf, pageIndices);
    for (const page of copiedPages) {
      newPdf.addPage(page);
    }

    const pdfBytes = await newPdf.save();
    const slug = slugify(split.label);
    const filename = `Piece_${split.piece_no}_${slug}.pdf`;

    documents.push({
      piece_no: split.piece_no,
      label: split.label,
      filename,
      pages: { start: split.start_page, end: split.end_page },
      page_count: pageIndices.length,
      buffer: Buffer.from(pdfBytes),
    });
  }

  return { total_pages: totalPages, documents };
}
