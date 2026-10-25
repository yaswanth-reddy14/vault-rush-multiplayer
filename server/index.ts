import { createApp } from "./app.js";
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readConfig } from "./config.js";
const development = process.argv.includes("--dev");
process.env.NODE_ENV = development ? "development" : "production";
const config = readConfig();
const { app, http, close } = createApp(config);
if (development) {
  const { createServer } = await import("vite");
  const vite = await createServer({
    server: { middlewareMode: true },
    appType: "spa",
  });
  app.use(vite.middlewares);
} else {
  const root = fileURLToPath(new URL("../client/", import.meta.url));
  app.use(express.static(root));
  app.get("/{*path}", (req, res, next) => {
    // Missing assets must stay 404s, rather than receiving an HTML response.
    if (path.extname(req.path) || !req.accepts("html")) return next();
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(root, "index.html"));
  });
}
const port = config.port;
http.listen(port, "0.0.0.0", () =>
  console.log(`VAULT RUSH listening on port ${port}`),
);
http.on("error", (error: NodeJS.ErrnoException) => {
  console.error(
    `VAULT RUSH failed to listen: ${error.code || "unknown error"}`,
  );
  close();
  process.exitCode = 1;
});
let stopping = false;
for (const signal of ["SIGTERM", "SIGINT"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    console.log("VAULT RUSH shutting down; in-memory rooms will be lost.");
    const forceExit = setTimeout(() => process.exit(1), 10000);
    forceExit.unref();
    close();
    http.close(() => process.exit(0));
  });
