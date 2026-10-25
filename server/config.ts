export interface ServerConfig {
  port: number;
  roomTtlMs: number;
  publicOrigin?: string;
}

function positiveInteger(
  value: string | undefined,
  fallback: number,
  name: string,
  max = Number.MAX_SAFE_INTEGER,
) {
  if (value === undefined || value === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1 || parsed > max) {
    throw new Error(`${name} must be an integer between 1 and ${max}.`);
  }
  return parsed;
}

export function readConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const origin = env.PUBLIC_ORIGIN || env.RENDER_EXTERNAL_URL;
  let publicOrigin: string | undefined;
  if (origin) {
    let url: URL;
    try {
      url = new URL(origin);
    } catch {
      throw new Error("PUBLIC_ORIGIN must be an absolute HTTP(S) origin.");
    }
    if (
      !["http:", "https:"].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.pathname !== "/" ||
      url.search ||
      url.hash
    ) {
      throw new Error(
        "PUBLIC_ORIGIN must contain only an HTTP(S) scheme and host, without a path, credentials, query or fragment.",
      );
    }
    publicOrigin = url.origin;
  }
  return {
    port: positiveInteger(env.PORT, 3000, "PORT", 65535),
    roomTtlMs: positiveInteger(env.ROOM_TTL_MS, 1800000, "ROOM_TTL_MS"),
    publicOrigin,
  };
}
