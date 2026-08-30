/**
 * POST /api/cite
 *
 * Citation generator — formats a reference in APA, MLA, Chicago, or Harvard style.
 * Client sends a URL or DOI; server generates the citation via Gemini.
 */

import * as gemini from "../services/gemini.js";
import { requireString, sanitizeText } from "../middleware/validate.js";

const STYLES = ["APA", "MLA", "Chicago", "Harvard", "IEEE", "Vancouver"];

export default async function citeRoute(req, res, body) {
  const sourceError = requireString(body, "source", { maxLength: 2000 });
  if (sourceError) return sourceError;

  const source = sanitizeText(body.source);
  if (!source.trim()) {
    return { status: 400, error: "Source URL or DOI is required" };
  }

  const style = (body.style || "APA").toUpperCase();
  if (!STYLES.includes(style)) {
    return { status: 400, error: "Style must be one of: " + STYLES.join(", ") };
  }

  const result = await gemini.cite(source, style);
  return { citation: result, style };
}
