# WriteRight prompts

Reserved workspace for versioned Gemini prompt templates. During the staged
migration, the live prompt vocabulary remains in `server/services/modes.js`
and prompt construction remains in `server/services/gemini.js`. No duplicate
implementation is introduced. Extraction belongs with the server move after
the required unpacked-extension browser gate.
