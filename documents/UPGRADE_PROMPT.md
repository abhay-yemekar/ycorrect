# WriteRight - Flagship Upgrade Prompt

## Purpose

This document is the single-source blueprint for upgrading WriteRight from a solid self-hosted writing assistant into a **flagship product** that matches or exceeds Grammarly and QuillBot in every dimension. Every session should read this file, pick the next uncompleted phase, and implement it fully.

---

## Current State (August 2026)

WriteRight is a self-hosted, zero-runtime-dependency writing assistant:

- **Grammar**: LanguageTool API + 35 local pattern rules (13 original + 22 added)
- **AI Paraphrasing**: 9 modes (Standard, Fluency, Formal, Academic, Simple, Creative, Expand, Shorten, Humanize) via Gemini
- **Summarization**: Key sentences, bullet points, paragraph format
- **Tone Detection**: Live tone and formality analysis
- **Chrome Extension**: In-page badge, toolbar, grammar underlines, fix cards, synonyms, AI continuation, per-sentence rewrite, spinner, toast, Escape
- **Web App**: Multi-document with IndexedDB, dark mode, find/replace, export, backup, writing goals, readability score, shortcuts, ARIA
- **Server**: Raw node:http, zero deps, rate limiting, strict CSP, CORS, validation
- **Tests**: 120 passing across 12 files, ESLint 9, CI on GitHub Actions

---

## Gap Analysis: WriteRight vs Grammarly vs QuillBot

### Grammarly Features We Lack
1. **Generative AI** - compose emails, blog posts, social captions from a prompt
2. **6-language grammar** - English, Spanish, French, German, Portuguese, Italian
3. **Inline translation** - translate any sentence in-place
4. **Plagiarism detection** - scan text against web sources
5. **Citation generator** - APA, MLA, Chicago, Harvard formats
6. **Brand/business tone** - custom tone profiles per organization
7. **AI content detection score** - how likely text is AI-generated
8. **Advanced vocabulary enhancement** - suggest stronger word choices with context
9. **Conciseness improvements** - flag wordy phrases with specific rewrites
10. **Formality level control** - casual, neutral, formal per sentence
11. **Full-sentence clarity rewrites** - whole paragraph rewrites (not just word-level)
12. **Delivery predictions** - predict how readers will perceive tone/intent
13. **Brand tones** - save custom tone profiles (e.g., friendly professional)
14. **Snippets/templates** - save and insert frequently used text blocks
15. **Knowledge sharing** - team style guides and glossaries

### QuillBot Features We Lack
1. **Translator** - 30+ languages with quality translation
2. **Plagiarism checker** - academic + web source scanning
3. **Word flipper** - click any word to see 4+ contextual synonyms
4. **AI detection score** - probability of AI-generated text
5. **Summarizer with length slider** - control summary length with a slider
6. **Citation generator** - auto-format references in 10+ styles
7. **Document upload** - import .docx, .pdf for checking
8. **Co-Writer** - AI-assisted writing in a full editor with suggestions
9. **Custom modes** - user-defined paraphrase rules
10. **Tone detection** - formal, casual, professional, simple detection

### Industry-Leading Features (2025-2026)
1. **AI humanizer** - rewrite AI text to pass as human-written
2. **Writing style guides** - per-project rules
3. **Real-time collaboration** - multiple users editing same document
4. **Cross-platform sync** - writing state syncs across devices
5. **Analytics dashboard** - writing improvement over time
6. **Voice-to-text** - dictate and check simultaneously
7. **Browser extension sidebar** - Grammarly-style sidebar panel
8. **Contextual AI** - AI suggestions that understand document context
9. **Writing statistics** - daily/weekly goals, streak tracking
10. **API for developers** - REST API for integration
11. **Mobile-responsive** - works on tablets and phones
12. **Offline mode** - local grammar checking without internet

---

## Upgrade Plan - 6 Phases

### Phase 1: Grammar Engine Hardening (Foundation) [PARTIAL]
Make the grammar checker bulletproof and comprehensive.

| Task | Status | Description |
|------|--------|-------------|
| Fix open defects | DONE | All 23 numbered defects + N1-N3 fixed |
| 22+ new local rules | DONE | then/than, could-care-less, less/fewer, comprised/composed, tense-shift, subject-verb, a/an, who/whom, missing apostrophes, wordy phrases, filler words, cliches, split infinitive, passive voice, semicolon, comma rules |
| Extension UX | DONE | Loading spinner, error toast, Escape key |

**Remaining:**
- [ ] Add 30+ more rules: dangling modifiers, comma splices, parallel structure, pronoun agreement, misplaced modifiers, run-on sentences, double negatives, faulty comparisons, redundant pairs, illogical comparisons
- [ ] Improve replacement quality: show contextual alternatives, not just first match
- [ ] Add rule confidence scores for auto-highlight vs suggestion

### Phase 2: Multilingual + Translation
Break the English-only barrier. Grammarly supports 6 languages; we should match.

| Task | Priority | Description |
|------|----------|-------------|
| Language selector | High | Add language dropdown to web app + extension (EN, ES, FR, DE, PT, IT) |
| Multilingual grammar | High | LanguageTool supports 20+ languages natively - wire them up |
| Translation route | High | New /api/translate endpoint using Gemini for 30+ languages |
| Language auto-detect | Medium | Detect input language, switch grammar rules automatically |
| Multilingual UI | Medium | Internationalize the UI labels (i18n with JSON bundles) |
| RTL support | Low | Right-to-left for Arabic, Hebrew |

### Phase 3: Advanced AI Features
Add the premium features that make Grammarly Pro worth 2/month.

| Task | Priority | Description |
|------|----------|-------------|
| Generative AI compose | High | New mode: write from prompt (Write a professional email about...) |
| AI detection score | High | Score how likely text is AI-generated |
| Plagiarism detection | Medium | Search web for similar text passages using Gemini |
| Citation generator | Medium | New /api/cite endpoint: URL/DOI -> APA, MLA, Chicago, Harvard |
| AI humanizer v2 | Medium | Advanced humanizer with varied sentence structure |
| Vocabulary enhancement | Medium | Underline weak words, suggest stronger alternatives |
| Conciseness detection | Medium | Flag wordy phrases with one-click fixes |
| Style guide builder | Low | Custom rules: Oxford comma, no passive voice, etc. |
| Writing goals panel | Low | Audience, formality, genre settings that guide AI rewrites |

### Phase 4: Premium UX Features
Make the writing experience feel polished and professional.

| Task | Priority | Description |
|------|----------|-------------|
| Summarizer length slider | High | Replace fixed formats with a length slider (1-10 sentences) |
| Fix-all button | High | One click to apply all high-confidence fixes |
| Comparison view | High | Side-by-side original vs rewritten with highlighted changes |
| Vocabulary underlines | Medium | Blue underlines for weak words, click for alternatives |
| Word flipper | Medium | Click any word for 4+ contextual synonyms |
| Snippets/templates | Medium | Save and insert frequently used text blocks |
| Writing statistics | Medium | Word count trends, error patterns, improvement over time |
| Export enhancements | Low | PDF, DOCX, Markdown with formatting |
| Theme customization | Low | Multiple color themes beyond dark/light |

### Phase 5: Extension Flagship Polish
Make the Chrome extension feel like a premium product.

| Task | Priority | Description |
|------|----------|-------------|
| Sidebar panel | High | Grammarly-style sidebar showing all issues, fixes, suggestions |
| Full options page | High | Server URL, feature toggles, per-site list, theme, language |
| Context menu | Medium | Right-click: Check grammar, Rewrite, Summarize, Translate |
| Onboarding flow | Medium | First-run tutorial showing features |
| Badge animations | Medium | Pulse on new issues, smooth transitions |
| Toast notifications | Medium | Non-intrusive feedback for all actions |
| Site compatibility | Medium | Test and document compatibility with top 100 sites |
| Tab-to-accept v2 | Low | Show preview of AI continuation before accepting |
| Keyboard shortcuts | Low | Ctrl+Shift+G to check, Ctrl+Shift+R to rewrite |
| Performance | Low | Lazy-load UI, cache results, reduce DOM operations |

### Phase 6: Production Readiness
Ship a production-quality product that can scale.

| Task | Priority | Description |
|------|----------|-------------|
| Chrome Web Store | High | Package, sign, create store listing with screenshots |
| Performance profiling | High | Extension loads <100ms, grammar check <2s |
| Document upload | Medium | Import .docx, .pdf, .odt for checking |
| API for developers | Medium | Document REST API with OpenAPI spec |
| Mobile responsive | Medium | Make web app work on tablets and phones |
| Offline mode | Low | Local grammar checking without internet |
| Privacy policy | Low | Clear data handling documentation |
| Analytics (opt-in) | Low | Privacy-respecting usage stats |

---

## Success Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Extension works on | ChatGPT, Gmail, Google Docs, Notion, Slack, LinkedIn, Twitter, Medium, WordPress, Reddit | Partially tested |
| Grammar rules | 100+ (local + LanguageTool) | 35 local + LT |
| Languages supported | 6 (EN, ES, FR, DE, PT, IT) | English only |
| Paraphrase modes | 10+ | 9 |
| Extension load time | <100ms | Unknown |
| Grammar check response | <2s | Depends on LT |
| Tests passing | 120+ | 120 |
| Zero runtime deps | Yes | Yes |
| Sites compatibility | 50+ sites tested | ~5 tested |

---

## Implementation Rules

1. **Always run npm run check before committing** (lint + tests must pass)
2. **Zero runtime dependencies** - devDependencies only (currently ESLint)
3. **Never git push** - stage, commit, hand push command to owner
4. **Count, dont estimate** - file counts, rule counts, test counts are exact numbers
5. **Update PROGRESS.md** every session with what was done
6. **Update this UPGRADE_PROMPT.md** when phases are completed
7. **Test on real browsers** - verify it works in Chrome on actual websites
8. **Match existing conventions** - vanilla JS, ES modules, no framework, no bundler
9. **Keep the Shadow DOM architecture** - extension UI must not clash with host pages
10. **Document every API change** - update README.md with new endpoints, env vars, features

---

## Priority Order

1. **Phase 1 remaining** (grammar rules) - foundation must be solid
2. **Phase 4** (UX polish) - immediate user impact, no new dependencies
3. **Phase 3** (advanced AI) - differentiating features
4. **Phase 5** (extension polish) - makes it feel premium
5. **Phase 2** (multilingual) - expands audience
6. **Phase 6** (production) - ship to Web Store

---

## How to Use This Document

Each session should:
1. Read this file to understand the full picture
2. Pick the next uncompleted task from the priority order
3. Implement it fully (code + tests + docs)
4. Run npm run check to verify
5. Update PROGRESS.md with what was done
6. Update the checkbox in this file
7. Commit with a descriptive message

---

*Last updated: August 2026*
