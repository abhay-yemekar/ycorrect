/**
 * Backwards-compatible entry point.
 *
 * The server lives in server/app.js with modular routes, middleware, and
 * services. This file starts it for anyone still running `node server.js`.
 * Prefer `npm start`.
 */
import { startServer } from './server/app.js';

startServer();
