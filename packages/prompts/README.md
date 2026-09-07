# WriteRight prompts

Reserved workspace for versioned Gemini prompt templates. The live prompt
vocabulary remains in `apps/server/services/modes.js` and prompt construction
remains in `apps/server/services/gemini.js`. No duplicate implementation is
introduced. The server move is complete; extraction now waits on the same
unpacked-extension browser gate that gates the remaining structure work, so
the import graph is not churned before behavior is verified in a browser.
