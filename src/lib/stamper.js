import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { ApiError } from './errors.js';

/**
 * Apply text stamp to PDF
 */
export async function stampPdf(pdfBuffer, payload, requestId) {
  const pdfDoc = await PDFDocument.load(pdfBuffer, {
    ignoreEncryption: true,
  });

  const pages = pdfDoc.getPages();
  const totalPages = pages.length;

  // Resolve target pages
  const targetPageIndices = resolvePages(payload.pages, totalPages, requestId);

  // Load font
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Style config with defaults
  const style = {
    fontSize: payload.style?.fontSize ?? 48,
    opacity: (payload.style?.opacity ?? 30) / 100, // Convert 0-100 to 0-1
    rotation: payload.style?.rotation ?? 0,
  };

  // Position config with defaults
  const position = {
    anchor: payload.position?.anchor ?? 'center',
    marginX: payload.position?.marginX ?? 0,
    marginY: payload.position?.marginY ?? 0,
  };

  // Color: always red in v1
  const color = rgb(1, 0, 0);

  // Stamp each target page
  for (const pageIndex of targetPageIndices) {
    const page = pages[pageIndex];
    const { width, height } = page.getSize();

    // Build stamp text with variable substitution
    const stampText = buildStampText(payload.text, pageIndex + 1, totalPages);
    const lines = stampText.split('\n');

    // Calculate text dimensions
    const lineHeight = style.fontSize * 1.2;
    const textBlockHeight = lines.length * lineHeight;
    const textWidths = lines.map((line) => font.widthOfTextAtSize(line, style.fontSize));
    const maxTextWidth = Math.max(...textWidths);

    // Calculate text block position (top-left corner in PDF coordinates)
    // Text dimensions are used to ensure the stamp never overflows the page
    const blockPos = calculateBlockPosition(
      position.anchor,
      width,
      height,
      position.marginX,
      position.marginY,
      maxTextWidth,
      textBlockHeight
    );

    // Rotation center is the center of the text block
    const rotationCenter = {
      x: blockPos.x + maxTextWidth / 2,
      y: blockPos.y - textBlockHeight / 2,
    };

    // Draw each line
    lines.forEach((line, i) => {
      const lineWidth = textWidths[i];

      // Center each line horizontally within the text block
      const x = blockPos.x + (maxTextWidth - lineWidth) / 2;
      // Baseline position: top of block, minus line offset, minus ascent (~70% of lineHeight)
      const y = blockPos.y - (i + 0.7) * lineHeight;

      page.drawText(line, {
        x,
        y,
        size: style.fontSize,
        font,
        color,
        opacity: style.opacity,
        rotate: degrees(style.rotation),
        rotateAboutPoint: rotationCenter,
      });
    });
  }

  return await pdfDoc.save();
}

/**
 * Resolve page specification to array of 0-indexed page numbers
 */
function resolvePages(pagesSpec, totalPages, requestId) {
  if (pagesSpec === 'all' || pagesSpec === undefined) {
    return Array.from({ length: totalPages }, (_, i) => i);
  }

  if (!Array.isArray(pagesSpec)) {
    throw new ApiError(400, 'INVALID_INPUT', 'pages must be "all" or an array of page numbers', requestId);
  }

  const indices = [];
  for (const pageNum of pagesSpec) {
    if (typeof pageNum !== 'number' || !Number.isInteger(pageNum)) {
      throw new ApiError(400, 'INVALID_INPUT', `Invalid page number: ${pageNum}`, requestId);
    }
    if (pageNum < 1 || pageNum > totalPages) {
      throw new ApiError(400, 'INVALID_INPUT', `Page ${pageNum} does not exist (document has ${totalPages} pages)`, requestId);
    }
    indices.push(pageNum - 1); // Convert to 0-indexed
  }

  return [...new Set(indices)]; // Dedupe
}

/**
 * Build stamp text with variable substitution
 */
function buildStampText(textConfig, currentPage, totalPages) {
  let result = textConfig.main;

  if (textConfig.secondary) {
    result += '\n' + textConfig.secondary;
  }

  if (textConfig.showPageNumbers) {
    result += '\n' + `Page ${currentPage} / ${totalPages}`;
  }

  return result;
}

/**
 * Calculate the text block position ensuring the stamp stays within page bounds.
 * Returns the top-left corner of the text block in PDF coordinates (y-axis goes up).
 *
 * With margin 0, the text is flush against the edge but never outside the page.
 * Margins always push the text further inward from the chosen anchor edge.
 */
function calculateBlockPosition(anchor, pageWidth, pageHeight, marginX, marginY, blockWidth, blockHeight) {
  let x, y;

  // Horizontal positioning
  if (anchor.includes('left')) {
    // Left edge of text block is flush with left page edge + margin
    x = marginX;
  } else if (anchor.includes('right')) {
    // Right edge of text block is flush with right page edge - margin
    x = pageWidth - marginX - blockWidth;
  } else {
    // Center column (top-center, center, bottom-center)
    x = (pageWidth - blockWidth) / 2 + marginX;
  }

  // Vertical positioning (y = top edge of text block in PDF coords)
  if (anchor.startsWith('top')) {
    // Top of text block is flush with top page edge - margin
    y = pageHeight - marginY;
  } else if (anchor.startsWith('bottom')) {
    // Bottom of text block is flush with bottom page edge + margin
    y = marginY + blockHeight;
  } else {
    // Center row (center-left, center, center-right)
    y = (pageHeight + blockHeight) / 2 + marginY;
  }

  return { x, y };
}
