/**
 * Convert a label string into a filesystem-safe slug.
 *
 * - Transliterates accented characters (NFD decomposition + diacritics removal)
 * - Lowercases
 * - Replaces spaces, hyphens, and underscores with a single underscore
 * - Strips all other non-alphanumeric characters
 * - Trims leading/trailing underscores
 * - Truncates to maxLength
 *
 * @param {string} text
 * @param {number} [maxLength=50]
 * @returns {string}
 */
export function slugify(text, maxLength = 50) {
  return text
    .normalize('NFD')                    // decompose accented characters
    .replace(/[\u0300-\u036f]/g, '')     // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, '')      // remove punctuation & special chars
    .replace(/[\s_-]+/g, '_')           // collapse whitespace/hyphens/underscores → single _
    .replace(/^_|_$/g, '')              // trim leading/trailing underscores
    .substring(0, maxLength);
}
