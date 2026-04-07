import {
  getCloudSessionToken,
  handleCloudSyncError,
  jsonResponse,
  loginCloudAccount,
  logoutCloudSession,
  optionsResponse,
  registerCloudAccount,
} from "../lib/cloud-sync.mts";

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  if (req.method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "Method Not Allowed",
      },
      405,
      { Allow: "OPTIONS, POST" },
    );
  }

  try {
    const payload = await req.json().catch(() => ({}));
    const action = String(payload?.action || "").trim();

    if (action === "register") {
      const session = await registerCloudAccount(payload.accountId, payload.password);
      return jsonResponse({
        ok: true,
        accountId: session.accountId,
        token: session.token,
        expiresAt: session.expiresAt,
      });
    }

    if (action === "login") {
      const session = await loginCloudAccount(payload.accountId, payload.password);
      return jsonResponse({
        ok: true,
        accountId: session.accountId,
        token: session.token,
        expiresAt: session.expiresAt,
      });
    }

    if (action === "logout") {
      await logoutCloudSession(payload.token || getCloudSessionToken(req));
      return jsonResponse({ ok: true });
    }

    return jsonResponse(
      {
        ok: false,
        error: "Unsupported action.",
      },
      400,
    );
  } catch (error) {
    return handleCloudSyncError(error);
  }
};

export const config = {
  path: "/api/cloud-sync/auth",
};
