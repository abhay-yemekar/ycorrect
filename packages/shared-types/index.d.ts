/** Existing JSON contract. No runtime dependency or compilation required. */
export interface GrammarMatch {
  offset: number;
  length: number;
  message: string;
  replacements: Array<{ value: string }>;
  rule?: { id?: string; issueType?: string; category?: { name?: string } };
}
export interface GrammarResponse { matches: GrammarMatch[] }
export interface RewriteResponse { text: string }
