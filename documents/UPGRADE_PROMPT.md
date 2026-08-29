# WriteRight Flagship Upgrade Prompt

## Current State
WriteRight is a self-hosted, zero-dependency writing assistant with: grammar checking (LanguageTool + 13 local rules), 9 AI rewrite modes, summarization, tone detection, dark mode, multi-document with IndexedDB, Chrome extension with in-page badge/toolbar/grammar underlines/fix cards/synonyms, Tab-to-accept AI continuation, and per-sentence rewrite.

## What Grammarly Has That We're Missing
1. **Generative AI** — compose emails, blog posts, social captions from a prompt (not just rewrite existing text)
2. **6-language grammar checking** — English, Spanish, French, German, Portuguese, Italian
3. **Inline translation** — translate any sentence in-place
4. **Plagiarism detection** — scan text against web sources
5. **Citation generator** — APA, MLA, Chicago, Harvard formats
6. **Brand/business tone** — custom tone profiles
7. **AI content detection score** — how likely is this text AI-generated
8. **Advanced vocabulary enhancement** — suggest stronger word choices
9. **Conciseness improvements** — flag wordy phrases
10. **Formality level control** — casual, neutral, formal per sentence

## What QuillBot Has That We're Missing
1. **10 paraphrase modes** (we have 9, missing: "Simple" mode)
2. **Full translator** — 30+ languages
3. **Plagiarism checker** — scan against academic + web sources
4. **Word flipper** — click any word to see 4+ synonyms (we have basic synonyms)
5. **AI detection score** — probability of AI-generated text
6. **Summarizer with length slider** — control summary length with a slider
7. **Citation generator** — auto-format references
8. **Video caption generation** — transcribe + caption videos
9. **Document upload** — import .docx, .pdf for checking

## What Advanced Tools Are Doing (2025-2026)
1. **AI humanizer** — rewrite AI text to pass as human-written
2. **Writing style guides** — per-project style rules
3. **Real-time collaboration** — multiple users editing same document
4. **Cross-platform sync** — writing state syncs across devices
5. **Analytics dashboard** — writing improvement over time
6. **Voice-to-text** — dictate and check simultaneously

---

## Upgrade Plan — 6 Phases

### Phase 1: Grammar Engine Hardening (Foundation)
- Fix all 13 remaining open defects from the defect ledger
- Add 50+ more local grammar rules (subject-verb agreement, article usage, comma splices, dangling modifiers, passive voice)
- Add "Simple" mode to reach QuillBot's 10 paraphrase modes
- Extension: loading spinner, error toast, keyboard shortcuts

### Phase 2: Multilingual + Translation
- Language selector (English, Spanish, French, German, Portuguese, Italian)
- Translation route using Gemini
- Multilingual grammar checking via LanguageTool
- Language auto-detection

### Phase 3: Advanced AI Features
- Generative AI compose mode
- Plagiarism detection
- AI detection score
- Citation generator (APA, MLA, Chicago, Harvard)
- AI humanizer mode

### Phase 4: Premium UX Features
- Vocabulary enhancement underlines
- Conciseness detection
- Writing goals panel
- Enhanced readability dashboard
- Word flipper with 4+ synonyms
- Fix-all button
- Comparison view (original vs rewritten)

### Phase 5: Extension Flagship Polish
- Sidebar panel
- Full options page
- Context menu integration
- Badge animations
- Toast notifications
- Onboarding flow
- Popup redesign

### Phase 6: Production Readiness
- Chrome Web Store packaging
- Performance optimization
- Privacy-respecting analytics
- Document upload (.docx, .pdf)
- Enhanced export
- Comprehensive test suite
- Full documentation

## Priority Order
1. Phase 1 → 2. Phase 4 → 3. Phase 3 → 4. Phase 5 → 5. Phase 2 → 6. Phase 6

## Success Metrics
- Extension works on: ChatGPT, Gmail, Google Docs, Notion, Slack, LinkedIn, Twitter, Medium
- Grammar check finds 95%+ of errors LanguageTool finds
- Underlines render correctly on all contenteditable editors
- Extension loads in <100ms, grammar check responds in <2s
- Zero runtime dependencies maintained
