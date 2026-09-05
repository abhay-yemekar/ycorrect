# WriteRight flagship gap report

Audit date: 2026-09-05. Baseline: `712fb44`. Branch: `audit/writeright-trust-and-structure`.

VERIFIED-IN-CODE means source inspection, not a browser pass. VERIFIED-AUTOMATED means a named check actually ran. NEEDS-BROWSER-CHECK and UNVERIFIED are open, never passes. Historical counts and commit narratives are not current evidence.

## P0 — core trust (fix order)

| ID | Claim / finding | Actual implementation and evidence | Baseline status / disposition |
|---|---|---|---|
| T01 | Tests make no external calls | `test/synonyms.test.js` uses real fetch; valid words reach `server/routes/synonyms.js` and DataMuse. Its mocking comment is false. | Broken; make tests hermetic before further checks. |
| U01 | User reviews every replacement | `extension/content-grammar.js:rewriteWithSentence` calls `setFieldText` immediately on response. This is the **single highest-priority UX gap**. Selection Replace reads the live selection instead of preserving the requested field/range. Grammar chips preview a word but lack undo; Fix All mutates repeatedly without batch review. | Broken; one review transaction with before/after, accept, reject, guarded undo. |
| H01 | ProseMirror stale-text guard is implemented (PROGRESS 2026-09-02) | `_lastCheckedText` is assigned but never read. `findMatchRange` compares a slice with itself, then falls back to the first occurrence. `runGrammarCheck` can attach results from field A to field B. | Claimed-but-broken; preserve checked field/text, discard stale results, map exact offsets across current nodes. NEEDS-BROWSER-CHECK for actual geometry/host editor behavior. |
| E01 | Offline server produces toast, not successful empty check | `background.js` swallows HTTP/network failures into empty matches/suggestion. `content-grammar.js` sees success; AI catches silently. | Broken; propagate failure and show it. |
| S01 | Disabling a site/grammar takes effect | `content-events.js` reads sync storage only at init; no onChanged listener. Disabled sites cannot reactivate without reload. | Broken; live settings must invalidate requests and remove UI. |
| P01 | Store draft: text never leaves machine / never a third-party cloud | `server/services/languagetool.js` hardcodes public LanguageTool; Gemini service calls Google; synonyms route calls DataMuse. Hosting the Node proxy locally does not make these local. | False; store correction requires owner approval under brief's submission rule. Proposed wording below. |

## P1 — affordable parity and reliability

| ID | Claim / finding | Implementation / evidence | Baseline status / disposition |
|---|---|---|---|
| W01 | Seven content parts share one isolated world, no duplicate declarations | Manifest has one ordered list, no MAIN world, no dynamic reinjection. Existing `test/extension-split.test.js` concatenation/standalone/declaration checks pass. Per-file no-undef is disabled in ESLint. | VERIFIED-AUTOMATED parsing, not browser loading; add executed shared-context coverage with runtime regressions, no speculative isolation rewrite. |
| L01 | Debounced grammar and AI loading | 800ms scheduler exists, but polling can repeat unchanged checks; grammar spinner leaks for short text; AI has no pending state. | Add deduplication and visible AI loading. No measured latency claim. |
| K01 | Extension keyboard shortcuts | `onKeyDown` only closes some popups; no accept/reject/undo, Escape leaves sidebar/rewrite result. | Add scoped review shortcuts. |
| B01 | Branding is unified | See exact inventory below. | Owner chose WriteRight; preserve identifiers and repository URL. |
| Z01 | Node 18+ packaging works | `scripts/package-extension.js` imports `crc32` from node:zlib, unavailable on the declared Node 18 baseline. Local Node run passes but cannot substantiate Node 18 compatibility. | Replace with portable ZIP CRC implementation; verify ZIP bytes. |
| O01 | Open app honors configured URL | `background.js` and `popup.js` hardcode localhost:3000 for Open app, unlike health/API requests. | Fix URL use. |

## P2 — polish / defer

| ID | Claim / finding | Evidence / disposition |
|---|---|---|
| D01 | Root server and server/ are competing implementations | `server.js` is only a compatibility shim importing `server/app.js`; npm start runs the latter. No losing duplicate to delete. Keep shim unless owner explicitly authorizes removal. |
| D02 | Root web page is a marketing/demo prototype | `server/app.js` serves root/index.html; it loads `js/app.js` and the full editor. It is the live web editor. Extension is a separate live surface, not a duplicate. |
| D03 | .freebuff is dead product code | Ignored directory contains only project-id; no product imports. Owner says it was used to start development. Preserve pending explicit removal decision. |
| D04 | New advanced features establish competitor parity | AI score, citations, translate, compose, vocabulary routes/UI exist. Quality, accuracy, competitor comparisons, plagiarism/AI detection claims UNVERIFIED. Defer expansion. |
| D05 | Synonyms cached for five minutes, grouped by POS | Current synonyms route has no cache and returns string arrays. Web/extension UI requires separate browser review. Historical audit claim false. |
| D06 | All editors work, including Google Docs | Generic contenteditable/textarea detection is not proof of support for canvas editors. Named site matrix remains NEEDS-BROWSER-CHECK. |
| D07 | Specific model sunset date / review fee and time / worker lifetime claims | Historical AUDIT/STORE assertions are UNVERIFIED external facts; do not rely on them for release decisions. Model remains configurable. |
| D08 | Underline geometry / paragraphs | Flat text joins contenteditable blocks without separators; textareas use a malformed font shorthand and do not subtract internal scroll. Needs targeted geometry repair and human matrix; do not claim pixel perfection. |
| D09 | Self-hosted security is complete | No auth/TLS; binds 0.0.0.0; open CORS by default; static root exposes non-dot repository files. Local trusted-user deployment only. Public deployment out of scope. |

## Claim reconciliation

| Claim (README / PROGRESS / AUDIT / CLAUDE / STORE / SMOKE) | Where implemented / checked | Current verdict |
|---|---|---|
| Zero runtime dependencies, ESM, raw HTTP, no frontend build | package.json; server/app.js; index.html module entry | VERIFIED-IN-CODE |
| npm start is supported entry; root server.js compatible | package scripts; server.js import | VERIFIED-IN-CODE |
| Lint and 136 tests pass | Actual baseline `npm run check`: 136 tests, 25 suites, no failures | VERIFIED-AUTOMATED locally; external-call claim false (T01) |
| CI Node 18/22 | .github/workflows/ci.yml config exists | VERIFIED-IN-CODE configuration only; remote CI UNVERIFIED |
| 14 built-in + 76 data rules | server/services/localRules.js and extraRulesData.json; localRules tests | Source/test evidence; counts rechecked at closeout |
| Horizontal whitespace preserves paragraphs; sorted merged matches | localRules rule; routes/grammar.js:mergeMatches; regression tests | VERIFIED-AUTOMATED |
| Offset-safe web mutations and pure overlay | js/editor.js:setText, replaceAt, shiftIssues, renderOverlayHtml; editorShift/overlay tests | VERIFIED-AUTOMATED arithmetic; visual pass pending |
| Document UUIDs, IndexedDB migration, backup collision handling | js/documents.js; js/backup.js; documents tests | VERIFIED-IN-CODE persistence; VERIFIED-AUTOMATED import merge only |
| Underline popover, one issue-count writer, per-document ignores | js/grammar.js; js/documents.js | VERIFIED-IN-CODE; interaction/persistence NEEDS-BROWSER-CHECK |
| Dark theme follows system, bootstrap prevents flash | js/theme.js; index.html; security CSP | VERIFIED-IN-CODE; first paint NEEDS-BROWSER-CHECK |
| Creative temperature band; nine validated modes; header-carried key | server/services/modes.js, gemini.js; routes/ai.js; modes/gemini tests | VERIFIED-AUTOMATED |
| Route validation, rate limits, trusted-proxy gate, malformed/traversal/dotfile responses, CSP | server/middleware/*; static.js; server/rateLimit tests | VERIFIED-AUTOMATED covered cases, not comprehensive security certification |
| Eleven API endpoints documented | server/app.js route table including synonyms special case | VERIFIED-IN-CODE; AI quality UNVERIFIED |
| Web undo/redo, export, find/replace, document search, shortcuts, writing goals | js/shortcuts.js, export.js, findReplace.js, search.js, ai.js | VERIFIED-IN-CODE; full browser flow UNVERIFIED |
| Flesch score accepts negatives | js/stats.js; stats tests | VERIFIED-AUTOMATED calculation |
| Accessibility live regions, skip link, focus trap, generic tabs | js/accessibility.js, tabs.js, grammar.js; index.html | VERIFIED-IN-CODE; screen reader/keyboard browser pass UNVERIFIED |
| Synonyms / continuation / sentence alternatives | js/synonyms.js, continuation.js, sentenceRewrite.js | VERIFIED-IN-CODE paths; quality/host behavior UNVERIFIED |
| Extension synonyms on double click / toolbar mode selection | events doesn't wire double click; _showToolbar has no callers | False in current extension; old claims superseded |
| Settings persist, reset and disabled-site chips | extension/options.js and popup.js | VERIFIED-IN-CODE persistence paths; live application broken (S01) |
| Credentials skipped | content-core.js:isSkipField checks explicit password and exact autocomplete values | VERIFIED-IN-CODE limited cases; sensitive-site browser pass pending |
| Context menu shows original and suggestion with Copy | background.js:improveSelection/openResult; result.js | VERIFIED-IN-CODE; does not insert into host page |
| ZIP contains every referenced file, byte faithful | scripts/package-extension.js; packaging tests | VERIFIED-AUTOMATED local Node; Node 18 issue Z01 |
| Store submission ready | STORE has draft text, but no screenshots or submission evidence and false privacy statement | UNVERIFIED / blocked by P01 and human smoke |
| Every historical session's test count, pushed commits, byte-exact split, fixed checkmarks | Historical journal and audit are claims, not current runtime evidence | UNVERIFIED historically unless independently evidenced above; retained as history |

## Branding inventory (baseline exact matches)

| Location | Value / disagreement |
|---|---|
| extension/manifest.json:3,5,18 | WriteRight; product title uses “Writing assistant” |
| STORE.md:17 | WriteRight; draft capitalizes “Writing Assistant”; no substantive identity conflict |
| package.json:2,5 | Internal name ycorrect; description WriteRight |
| README.md:1,3,23,148 | Public yCorrect title/introduction/menu label contradict actual WriteRight UI |
| README.md:30,31; STORE.md:36 | ycorrect repository URL/directory are valid technical identity, preserve |
| README.md:139,140; options.html:63 | YCORRECT_* compatibility environment keys, preserve |
| extension/popup.html:5,100,125,128 | WriteRight throughout |
| extension/options.html:5,52,59,61,77 | WriteRight throughout |
| CLAUDE.md introductory sentence | yCorrect public name; update to WriteRight |
| Domain/deployment config | No domain/hosting configuration in tracked tree; localhost defaults in manifest, popup, options, worker. GitHub slug is ycorrect. No rename required. |

## Proposed store correction (P01; approval required before editing STORE)

Short description: “Grammar checking and optional AI rewriting through your self-hosted WriteRight server. Review suggestions before applying.”

Detailed/privacy disclosure: “The extension sends writing to your configured local server. Grammar checks send text to the public LanguageTool API. Optional AI features send text to Google Gemini using your server-side key. Synonym lookups send the selected word to DataMuse. The extension has no analytics and does not send writing to the extension developer. Self-hosting the server does not make these providers local. Review each provider’s data practices before use.”

No manifest permission, version, extension identity, or published listing change is authorized by this proposal. Store submission remains a separate owner step.

## Execution gates

One fix per Conventional Commit; corresponding human checklist row after each fix. No fake browser passes. Structure work uses git mv. The brief requires unpacked-extension smoke §0.2 after each folder move before the next folder; this requires a human result and must not be silently bypassed. Root shim is retained, and both web and extension surfaces are live. README positioning can proceed independently. Final status must name remaining human/store gates.
