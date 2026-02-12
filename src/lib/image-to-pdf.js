import { PDFDocument } from "pdf-lib";

const SUPPORTED_IMAGE_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

/**
 * Check if a mimetype is a supported image format
 */
export function isSupportedImage(mimetype) {
  return SUPPORTED_IMAGE_TYPES.has(mimetype);
}

/**
 * Convert an image buffer to a single-page PDF.
 * The page size matches the image dimensions (1 pixel = 1 PDF point).
 */
export async function imageToPdf(imageBuffer, mimetype) {
  const pdfDoc = await PDFDocument.create();

  let image;
  if (mimetype === "image/png") {
    image = await pdfDoc.embedPng(imageBuffer);
  } else {
    image = await pdfDoc.embedJpg(imageBuffer);
  }

  const { width, height } = image.scale(1);
  const page = pdfDoc.addPage([width, height]);
  page.drawImage(image, { x: 0, y: 0, width, height });

  return Buffer.from(await pdfDoc.save());
}
