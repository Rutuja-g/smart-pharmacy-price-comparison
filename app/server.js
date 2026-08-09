/**
 * Application entry point.
 *
 * This file boots the HTTP server by listening on the configured port.
 * The Express app itself lives in app.js. Start with:
 *   npm start        (production)
 *   npm run dev      (development with nodemon auto-restart)
 */

const app = require("./app");
const config = require("./config/env");

const server = app.listen(config.port, () => {
  console.log(`Server is running in ${config.env} mode.`);
  console.log(`Listening on http://localhost:${config.port}`);
});

// Graceful shutdown on Ctrl+C / SIGTERM.
const shutdown = () => {
  console.log("\nShutting down gracefully...");
  server.close(() => {
    console.log("Server closed.");
    process.exit(0);
  });
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

module.exports = server;
