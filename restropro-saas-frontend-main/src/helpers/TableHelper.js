/**
 * Generates a unique, smart incremented title for a duplicated table.
 * If the source ends with numbers (e.g. "Table 1" -> "Table 2", "1" -> "2"), it increments to the next available number.
 * If non-numeric, it appends " (Copy)" or " (Copy N)".
 * 
 * @param {string} sourceTitle 
 * @param {Array<{table_title: string}>} existingTables 
 * @returns {string}
 */
export function generateDuplicateTableTitle(sourceTitle, existingTables = []) {
  const existingTitles = new Set(
    existingTables.map((t) => (t.table_title || "").trim().toLowerCase())
  );

  const title = (sourceTitle || "").trim();
  if (!title) return "Table 1";

  // Check if ends with digits: e.g. "Table 1", "Table-01", "10"
  const match = title.match(/^(.*?)(\d+)$/);

  if (match) {
    const prefix = match[1];
    const digits = match[2];
    let num = parseInt(digits, 10);
    const padLength = digits.startsWith("0") && digits.length > 1 ? digits.length : 0;

    while (true) {
      num += 1;
      const candidateNum = padLength > 0 ? String(num).padStart(padLength, "0") : String(num);
      const candidate = `${prefix}${candidateNum}`;
      if (!existingTitles.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }

  // Check if it already has " (Copy)" or " (Copy N)"
  const copyMatch = title.match(/^(.*?)\s*\(Copy(?:\s+(\d+))?\)$/i);
  if (copyMatch) {
    const base = copyMatch[1];
    let copyNum = copyMatch[2] ? parseInt(copyMatch[2], 10) : 1;
    while (true) {
      copyNum += 1;
      const candidate = `${base} (Copy ${copyNum})`;
      if (!existingTitles.has(candidate.toLowerCase())) {
        return candidate;
      }
    }
  }

  // First copy attempt
  const firstCandidate = `${title} (Copy)`;
  if (!existingTitles.has(firstCandidate.toLowerCase())) {
    return firstCandidate;
  }

  let i = 2;
  while (true) {
    const candidate = `${title} (Copy ${i})`;
    if (!existingTitles.has(candidate.toLowerCase())) {
      return candidate;
    }
    i += 1;
  }
}
