/**
 * Local grammar rules — pattern-based checks that run alongside LanguageTool.
 *
 * These catch common issues that the remote API may miss or that we want
 * to enforce regardless of connectivity.
 */

/**
 * @typedef {object} LocalMatch
 * @property {number} offset
 * @property {number} length
 * @property {string} message
 * @property {{ value: string }[]} replacements
 * @property {{ issueType: string, category: { name: string } }} rule
 */

const rules = [
  {
    pattern: /\b(very very|really really)\b/gi,
    message: 'This phrase can be more concise.',
    replacement: (m) => m[0].toLowerCase().startsWith('very') ? 'very' : 'really',
    category: 'Clarity',
  },
  {
    pattern: /\bin order to\b/gi,
    message: '"In order to" can usually be simplified to "to".',
    replacement: () => 'to',
    category: 'Clarity',
  },
  {
    pattern: /\s{2,}/g,
    message: 'Remove extra spaces.',
    replacement: () => ' ',
    category: 'Typography',
  },
  {
    pattern: /\b([A-Za-z]+)\s+\1\b/gi,
    message: 'Avoid repeating the same word.',
    replacement: (m) => m[1],
    category: 'Clarity',
  },
  {
    pattern: /\b(could of|should of|would of|might of|must of)\b/gi,
    message: 'Use "could have" instead of "could of".',
    replacement: (m) => m[0].replace(' of', ' have'),
    category: 'Grammar',
  },
  {
    pattern: /\b(your)\s+(a|an|the|very|really|going|own|self)\b/gi,
    message: 'Did you mean "you\'re" (you are)?',
    replacement: (m) => `you're ${m[2]}`,
    category: 'Grammar',
  },
  {
    pattern: /\b(its)\s+(own|way|place|self|time)\b/gi,
    message: 'Check if "its" (possessive) or "it\'s" (it is) is correct here.',
    replacement: null, // flag only, no auto-replace
    category: 'Clarity',
  },
  {
    pattern: /\b(teh|adn|hte|taht|wiht|thn|fro|fo)\b/gi,
    message: 'Possible typo.',
    replacement: (m) => {
      const fixes = { teh: 'the', adn: 'and', hte: 'the', taht: 'that', wiht: 'with', thn: 'then', fro: 'for', fo: 'of' };
      return fixes[m[0].toLowerCase()] || m[0];
    },
    category: 'Misspelling',
  },
  {
    pattern: /\b(i)\b/g,
    message: '"I" should always be capitalized.',
    replacement: () => 'I',
    category: 'Capitalization',
    // Only match standalone lowercase 'i' — require word boundaries handled by \b
  },
  {
    pattern: /\bas well as\b/gi,
    message: 'Consider using "and" for simpler writing.',
    replacement: () => 'and',
    category: 'Clarity',
  },
  {
    pattern: /\bdue to the fact that\b/gi,
    message: '"Due to the fact that" can be simplified to "because".',
    replacement: () => 'because',
    category: 'Clarity',
  },
  {
    pattern: /\bat this point in time\b/gi,
    message: 'Can be simplified to "now" or "currently".',
    replacement: () => 'currently',
    category: 'Clarity',
  },
  {
    pattern: /\bin the event that\b/gi,
    message: 'Can be simplified to "if".',
    replacement: () => 'if',
    category: 'Clarity',
  },
];

/**
 * @param {string} text
 * @returns {LocalMatch[]}
 */
export function checkLocal(text) {
  if (!text) return [];

  const matches = [];

  for (const rule of rules) {
    // Reset lastIndex for global regexes
    rule.pattern.lastIndex = 0;

    let m;
    while ((m = rule.pattern.exec(text)) !== null) {
      const offset = m.index;
      const length = m[0].length;
      const replacement = rule.replacement ? rule.replacement(m) : null;

      matches.push({
        offset,
        length,
        message: rule.message,
        replacements: replacement ? [{ value: replacement }] : [],
        rule: {
          issueType: rule.category === 'Misspelling' ? 'misspelling' :
                     rule.category === 'Grammar' ? 'grammar' : 'style',
          category: { name: rule.category },
        },
      });
    }
  }

  return matches;
}
