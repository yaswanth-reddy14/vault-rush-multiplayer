import { spawnSync } from "node:child_process";
const result = spawnSync(
  process.execPath,
  ["node_modules/@playwright/test/cli.js", "test", ...process.argv.slice(2)],
  {
    stdio: "inherit",
    env: { ...process.env, E2E_PRODUCTION: "1" },
  },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
