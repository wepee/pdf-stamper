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
    const pageRotation = page.getRotation().angle;

    // Build stamp text with variable substitution
    const stampText = buildStampText(payload.text, pageIndex + 1, totalPages);
    const lines = stampText.split('\n');

    // Calculate text dimensions
    const lineHeight = style.fontSize * 1.2;
    const textHeight = lines.length * lineHeight;
    const textWidths = lines.map((line) => font.widthOfTextAtSize(line, style.fontSize));
    const maxTextWidth = Math.max(...textWidths);

    // Calculate anchor position
    const anchorPos = calculateAnchorPosition(
      position.anchor,
      width,
      height,
      position.marginX,
      position.marginY
    );

    // Draw each line centered around anchor
    lines.forEach((line, i) => {
      const lineWidth = textWidths[i];
      
      // Center text block around anchor point
      const x = anchorPos.x - lineWidth / 2;
      const y = anchorPos.y + textHeight / 2 - (i + 1) * lineHeight + lineHeight * 0.3;

      page.drawText(line, {
        x,
        y,
        size: style.fontSize,
        font,
        color,
        opacity: style.opacity,
        rotate: degrees(style.rotation),
        // Handle existing page rotation
        rotateAboutPoint: {
          x: anchorPos.x,
          y: anchorPos.y,
        },
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
 * Calculate position based on anchor and margins
 * Margins are always positive and applied intuitively:
 * - top anchors: marginY moves text down into the page
 * - bottom anchors: marginY moves text up into the page
 * - left anchors: marginX moves text right into the page
 * - right anchors: marginX moves text left into the page
 */
function calculateAnchorPosition(anchor, pageWidth, pageHeight, marginX, marginY) {
  const positions = {
    'top-left': { x: 0, y: pageHeight },
    'top-center': { x: pageWidth / 2, y: pageHeight },
    'top-right': { x: pageWidth, y: pageHeight },
    'center-left': { x: 0, y: pageHeight / 2 },
    'center': { x: pageWidth / 2, y: pageHeight / 2 },
    'center-right': { x: pageWidth, y: pageHeight / 2 },
    'bottom-left': { x: 0, y: 0 },
    'bottom-center': { x: pageWidth / 2, y: 0 },
    'bottom-right': { x: pageWidth, y: 0 },
  };

  const base = positions[anchor] || positions['center'];

  // Apply margins intuitively based on anchor position
  let adjustedMarginX = marginX;
  let adjustedMarginY = marginY;

  // For top anchors, positive marginY should move text DOWN (into the page)
  if (anchor.startsWith('top-')) {
    adjustedMarginY = -marginY;
  }

  // For left anchors, positive marginX should move text RIGHT (into the page)
  // This is already correct (positive X)
  
  // For right anchors, positive marginX should move text LEFT (into the page)
  if (anchor.endsWith('-right')) {
    adjustedMarginX = -marginX;
  }

  return {
    x: base.x + adjustedMarginX,
    y: base.y + adjustedMarginY,
  };
}
