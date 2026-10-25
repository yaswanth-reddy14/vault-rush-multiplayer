import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

// Exercise the compiled entry point on a host-assigned port outside the repo cwd.
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, "127.0.0.1", resolve));
const { port } = reservation.address();
await new Promise((resolve) => reservation.close(resolve));
const base = `http://127.0.0.1:${port}`;
const child = spawn(
  process.execPath,
  [fileURLToPath(new URL("../dist/server/index.js", import.meta.url))],
  {
    cwd: tmpdir(),
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "development",
      PUBLIC_ORIGIN: base,
    },
    stdio: ["ignore", "pipe", "pipe"],
  },
);
let logs = "";
child.stdout.on("data", (chunk) => {
  logs += chunk;
});
child.stderr.on("data", (chunk) => {
  logs += chunk;
});
const exited = new Promise((resolve) => child.once("exit", resolve));
try {
  let ready = false;
  for (let i = 0; i < 50; i++) {
    if (child.exitCode !== null)
      throw new Error(`Production exited before readiness: ${logs}`);
    try {
      const response = await fetch(`${base}/health`);
      ready = response.ok;
    } catch {
      /* startup */
    }
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, `Production failed readiness: ${logs}`);
  assert.deepEqual(await (await fetch(`${base}/health`)).json(), { ok: true });
  const response = await fetch(`${base}/heist/ABC234`, {
    headers: { Accept: "text/html" },
  });
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-security-policy"),
    /script-src 'self';/,
  );
  const asset = html.match(/src="(\/assets\/[^" ]+)"/);
  assert.ok(asset, "Compiled frontend entry is present");
  assert.equal((await fetch(new URL(asset[1], base))).status, 200);
  assert.equal((await fetch(`${base}/assets/missing.js`)).status, 404);
  console.log(
    "Production smoke passed: dynamic PORT, default production mode, different cwd, health, SPA, asset serving and asset 404.",
  );
} finally {
  child.kill("SIGTERM");
  await exited;
}
