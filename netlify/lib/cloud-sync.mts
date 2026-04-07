import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

const ACCOUNT_PATTERN = /^[a-z0-9](?:[a-z0-9._@-]{1,46}[a-z0-9])?$/;
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72;
const SESSION_TTL = 90 * 24 * 60 * 60 * 1000;
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Cloud-Session",
  Vary: "Origin",
};

type SimpleStore = {
  delete: (key: string) => Promise<void>;
  get: (key: string, options?: { type?: "json" | "text" }) => Promise<unknown>;
  setJSON: (
    key: string,
    value: unknown,
    options?: { onlyIfNew?: boolean },
  ) => Promise<{ modified: boolean }>;
};

type BlobsEnvironmentContext = {
  apiURL?: string;
  siteID?: string;
  token?: string;
};

const SIGNED_URL_ACCEPT_HEADER = "application/json;type=signed-url";

function readEnvironmentValue(key: string) {
  const netlifyEnv = globalThis.Netlify?.env;
  if (netlifyEnv?.has?.(key)) {
    return netlifyEnv.get(key);
  }
  return process.env[key];
}

function decodeBase64Json(value: string) {
  try {
    return JSON.parse(Buffer.from(value, "base64").toString("utf8")) as BlobsEnvironmentContext;
  } catch {
    return {};
  }
}

function getBlobsEnvironmentContext() {
  const rawContext =
    (globalThis as typeof globalThis & { netlifyBlobsContext?: string }).netlifyBlobsContext ||
    readEnvironmentValue("NETLIFY_BLOBS_CONTEXT");

  if (typeof rawContext !== "string" || !rawContext) {
    return {};
  }

  return decodeBase64Json(rawContext);
}

function getBlobsClientConfig() {
  const context = getBlobsEnvironmentContext();
  const siteID = String(context.siteID || "").trim();
  const token = String(context.token || "").trim();

  if (!siteID || !token) {
    throw new Error("Netlify Blobs runtime context is missing.");
  }

  return {
    apiURL: String(context.apiURL || "https://api.netlify.com").trim() || "https://api.netlify.com",
    siteID,
    token,
  };
}

function buildBlobsApiUrl(storeName: string, key?: string) {
  const { apiURL, siteID } = getBlobsClientConfig();
  const base = new URL(`/api/v1/blobs/${siteID}/${storeName}`, apiURL);
  if (key) {
    const normalizedKey = key
      .split("/")
      .filter(Boolean)
      .map((part) => encodeURIComponent(part))
      .join("/");
    base.pathname = `${base.pathname}/${normalizedKey}`;
  }
  return base;
}

async function fetchBlobsApi(
  storeName: string,
  key: string,
  options: {
    body?: BodyInit;
    headers?: HeadersInit;
    method: "DELETE" | "GET" | "PUT";
    signedPut?: boolean;
  },
) {
  const { token } = getBlobsClientConfig();
  const apiUrl = buildBlobsApiUrl(storeName, key);

  if (options.signedPut) {
    const signedUrlResponse = await fetch(apiUrl, {
      method: "PUT",
      headers: {
        Accept: SIGNED_URL_ACCEPT_HEADER,
        Authorization: `Bearer ${token}`,
      },
    });

    if (!signedUrlResponse.ok) {
      throw new Error(`Netlify Blobs signed URL request failed with ${signedUrlResponse.status}.`);
    }

    const payload = (await signedUrlResponse.json().catch(() => null)) as { url?: string } | null;
    if (!payload?.url) {
      throw new Error("Netlify Blobs signed URL response is invalid.");
    }

    return fetch(payload.url, {
      method: "PUT",
      headers: {
        "Cache-Control": "max-age=0, stale-while-revalidate=60",
        ...(options.headers || {}),
      },
      body: options.body,
    });
  }

  return fetch(apiUrl, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(options.headers || {}),
    },
    body: options.body,
  });
}

function createSimpleStore(name: string): SimpleStore {
  const storeName = `site:${name}`;

  return {
    async delete(key) {
      const response = await fetchBlobsApi(storeName, key, { method: "DELETE" });
      if (![200, 204, 404].includes(response.status)) {
        throw new Error(`Netlify Blobs delete failed with ${response.status}.`);
      }
    },
    async get(key, options = {}) {
      const response = await fetchBlobsApi(storeName, key, { method: "GET" });
      if (response.status === 404) {
        return null;
      }
      if (!response.ok) {
        throw new Error(`Netlify Blobs read failed with ${response.status}.`);
      }
      if (options.type === "json") {
        return response.json();
      }
      return response.text();
    },
    async setJSON(key, value, options = {}) {
      const response = await fetchBlobsApi(storeName, key, {
        method: "PUT",
        signedPut: true,
        headers: {
          "Content-Type": "application/json; charset=utf-8",
          ...(options.onlyIfNew ? { "If-None-Match": "*" } : {}),
        },
        body: JSON.stringify(value),
      });

      if (options.onlyIfNew && response.status === 412) {
        return { modified: false };
      }

      if (!response.ok) {
        throw new Error(`Netlify Blobs write failed with ${response.status}.`);
      }

      return { modified: true };
    },
  };
}

const usersStore = createSimpleStore("cloud-sync-users");
const sessionsStore = createSimpleStore("cloud-sync-sessions");
const progressStore = createSimpleStore("cloud-sync-progress");

type UnknownJson = Record<string, unknown>;

type CloudUser = {
  accountId: string;
  normalizedId: string;
  salt: string;
  passwordHash: string;
  createdAt: number;
  updatedAt: number;
};

type CloudSession = {
  token: string;
  accountId: string;
  normalizedId: string;
  issuedAt: number;
  expiresAt: number;
  lastActiveAt: number;
};

type CloudProgressSnapshot = {
  accountId: string;
  updatedAt: number;
  state: UnknownJson | null;
  savedAt: number;
};

export class CloudSyncError extends Error {
  status: number;
  code: string;

  constructor(message: string, status = 400, code = "bad_request") {
    super(message);
    this.name = "CloudSyncError";
    this.status = status;
    this.code = code;
  }
}

function normalizeAccountId(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function normalizeToken(value: unknown) {
  return String(value || "").trim();
}

function accountKey(normalizedId: string) {
  return `account:${encodeURIComponent(normalizedId)}`;
}

function sessionKey(token: string) {
  return `session:${token}`;
}

function progressKey(normalizedId: string) {
  return `progress:${encodeURIComponent(normalizedId)}`;
}

function hashPassword(password: string, salt: string) {
  return scryptSync(password, salt, 64).toString("hex");
}

function safeEqualHex(leftHex: string, rightHex: string) {
  const left = Buffer.from(leftHex, "hex");
  const right = Buffer.from(rightHex, "hex");
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

function verifyPassword(password: string, user: CloudUser) {
  return safeEqualHex(hashPassword(password, user.salt), user.passwordHash);
}

function validateAccountId(accountId: unknown) {
  const normalizedId = normalizeAccountId(accountId);
  if (!normalizedId) {
    throw new CloudSyncError("请先填写同步账号。", 400, "account_required");
  }
  if (normalizedId.length < 3 || normalizedId.length > 48 || !ACCOUNT_PATTERN.test(normalizedId)) {
    throw new CloudSyncError(
      "同步账号请使用 3-48 位英文、数字、点号、下划线、中横线或邮箱格式。",
      400,
      "account_invalid",
    );
  }
  return normalizedId;
}

function validatePassword(password: unknown) {
  const normalizedPassword = String(password || "");
  if (normalizedPassword.length < MIN_PASSWORD_LENGTH) {
    throw new CloudSyncError(`同步口令至少需要 ${MIN_PASSWORD_LENGTH} 位。`, 400, "password_too_short");
  }
  if (normalizedPassword.length > MAX_PASSWORD_LENGTH) {
    throw new CloudSyncError(`同步口令最长支持 ${MAX_PASSWORD_LENGTH} 位。`, 400, "password_too_long");
  }
  return normalizedPassword;
}

async function getUserByNormalizedId(normalizedId: string) {
  return (await usersStore.get(accountKey(normalizedId), {
    type: "json",
    consistency: "strong",
  })) as CloudUser | null;
}

async function createSessionForUser(user: CloudUser) {
  const now = Date.now();
  const session: CloudSession = {
    token: randomBytes(24).toString("base64url"),
    accountId: user.accountId,
    normalizedId: user.normalizedId,
    issuedAt: now,
    expiresAt: now + SESSION_TTL,
    lastActiveAt: now,
  };

  await sessionsStore.setJSON(sessionKey(session.token), session);
  return session;
}

export function jsonResponse(payload: UnknownJson, status = 200, extraHeaders: Record<string, string> = {}) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...CORS_HEADERS,
      ...extraHeaders,
    },
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "no-store",
    },
  });
}

export function getCloudSessionToken(req: Request) {
  return normalizeToken(req.headers.get("X-Cloud-Session"));
}

export async function registerCloudAccount(accountId: unknown, password: unknown) {
  const normalizedId = validateAccountId(accountId);
  const normalizedPassword = validatePassword(password);
  const existing = await getUserByNormalizedId(normalizedId);

  if (existing) {
    throw new CloudSyncError("这个云端同步账号已经存在了，直接登录就好。", 409, "account_exists");
  }

  const now = Date.now();
  const user: CloudUser = {
    accountId: normalizedId,
    normalizedId,
    salt: randomBytes(16).toString("hex"),
    passwordHash: "",
    createdAt: now,
    updatedAt: now,
  };
  user.passwordHash = hashPassword(normalizedPassword, user.salt);

  const result = await usersStore.setJSON(accountKey(normalizedId), user, { onlyIfNew: true });
  if (!result.modified) {
    throw new CloudSyncError("这个云端同步账号已经存在了，直接登录就好。", 409, "account_exists");
  }

  return createSessionForUser(user);
}

export async function loginCloudAccount(accountId: unknown, password: unknown) {
  const normalizedId = validateAccountId(accountId);
  const normalizedPassword = validatePassword(password);
  const user = await getUserByNormalizedId(normalizedId);

  if (!user || !verifyPassword(normalizedPassword, user)) {
    throw new CloudSyncError("账号或同步口令不对，请再检查一下。", 401, "invalid_credentials");
  }

  return createSessionForUser(user);
}

export async function logoutCloudSession(token: unknown) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    return;
  }
  await sessionsStore.delete(sessionKey(normalizedToken));
}

export async function requireCloudSession(token: unknown) {
  const normalizedToken = normalizeToken(token);
  if (!normalizedToken) {
    throw new CloudSyncError("请先登录云端同步账号。", 401, "missing_session");
  }

  const session = (await sessionsStore.get(sessionKey(normalizedToken), {
    type: "json",
    consistency: "strong",
  })) as CloudSession | null;

  if (!session) {
    throw new CloudSyncError("登录状态已经失效，请重新登录云端同步账号。", 401, "session_invalid");
  }

  const now = Date.now();
  if (Number(session.expiresAt || 0) <= now) {
    await sessionsStore.delete(sessionKey(normalizedToken));
    throw new CloudSyncError("登录状态已经过期，请重新登录云端同步账号。", 401, "session_expired");
  }

  const refreshedSession: CloudSession = {
    ...session,
    lastActiveAt: now,
    expiresAt: now + SESSION_TTL,
  };
  await sessionsStore.setJSON(sessionKey(normalizedToken), refreshedSession);
  return refreshedSession;
}

export async function readCloudProgress(token: unknown) {
  const session = await requireCloudSession(token);
  const snapshot = (await progressStore.get(progressKey(session.normalizedId), {
    type: "json",
    consistency: "strong",
  })) as CloudProgressSnapshot | null;

  return {
    session,
    snapshot: snapshot || {
      accountId: session.accountId,
      updatedAt: 0,
      state: null,
      savedAt: 0,
    },
  };
}

export async function writeCloudProgress(token: unknown, incomingState: unknown, incomingUpdatedAt: unknown) {
  if (!incomingState || typeof incomingState !== "object" || Array.isArray(incomingState)) {
    throw new CloudSyncError("云端同步请求里缺少有效的 state 对象。", 400, "state_invalid");
  }

  const session = await requireCloudSession(token);
  const current = (await progressStore.get(progressKey(session.normalizedId), {
    type: "json",
    consistency: "strong",
  })) as CloudProgressSnapshot | null;

  const fallbackUpdatedAt = Number((incomingState as UnknownJson)?.meta?.updatedAt || 0) || Date.now();
  const updatedAt = Number(incomingUpdatedAt || fallbackUpdatedAt) || Date.now();
  const currentUpdatedAt = Number(current?.updatedAt || 0) || 0;

  if (current && currentUpdatedAt > updatedAt) {
    return {
      conflict: true,
      accountId: session.accountId,
      updatedAt: currentUpdatedAt,
      state: current.state,
    };
  }

  const nextSnapshot: CloudProgressSnapshot = {
    accountId: session.accountId,
    updatedAt,
    state: incomingState as UnknownJson,
    savedAt: Date.now(),
  };

  await progressStore.setJSON(progressKey(session.normalizedId), nextSnapshot);
  return {
    conflict: false,
    accountId: session.accountId,
    updatedAt,
    state: nextSnapshot.state,
  };
}

export function handleCloudSyncError(error: unknown) {
  if (error instanceof CloudSyncError) {
    return jsonResponse(
      {
        ok: false,
        error: error.message,
        code: error.code,
      },
      error.status,
    );
  }

  return jsonResponse(
    {
      ok: false,
      error: "云端同步服务暂时不可用，请稍后再试。",
      code: "cloud_sync_unavailable",
    },
    500,
  );
}
