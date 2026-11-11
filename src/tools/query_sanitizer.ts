export interface SanitizedQuery {
  raw: string;
  sanitized: string;
  isValid: boolean;
  reason?: string;
}

/**
 * Sanitizes and normalizes user or agent-generated search queries
 * to protect against malformed requests, excessively long inputs, and special character issues.
 */
export function sanitizeSearchQuery(query: string, maxLength: number = 250): SanitizedQuery {
  if (!query || typeof query !== "string") {
    return {
      raw: String(query || ""),
      sanitized: "",
      isValid: false,
      reason: "Query is empty or not a string",
    };
  }

  const raw = query.trim();

  // Strip excessive whitespace, newlines, and tabs
  let sanitized = raw.replace(/[\r\n\t]+/g, " ").replace(/\s{2,}/g, " ");

  // Strip non-printable ASCII control characters
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, "");

  // Remove surrounding single or double quotes if whole query is wrapped
  if ((sanitized.startsWith('"') && sanitized.endsWith('"')) ||
      (sanitized.startsWith("'") && sanitized.endsWith("'"))) {
    sanitized = sanitized.slice(1, -1).trim();
  }

  if (sanitized.length === 0) {
    return {
      raw,
      sanitized: "",
      isValid: false,
      reason: "Query contains only whitespace or invalid characters",
    };
  }

  // Cap at maxLength safely without breaking in the middle of a word if possible
  if (sanitized.length > maxLength) {
    const cut = sanitized.slice(0, maxLength);
    const lastSpace = cut.lastIndexOf(" ");
    sanitized = (lastSpace > maxLength * 0.8 ? cut.slice(0, lastSpace) : cut).trim();
  }

  return {
    raw,
    sanitized,
    isValid: true,
  };
}
