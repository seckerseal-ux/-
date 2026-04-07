import {
  getCloudSessionToken,
  handleCloudSyncError,
  jsonResponse,
  optionsResponse,
  readCloudProgress,
  writeCloudProgress,
} from "../lib/cloud-sync.mts";

export default async (req: Request) => {
  if (req.method === "OPTIONS") {
    return optionsResponse();
  }

  const token = getCloudSessionToken(req);

  try {
    if (req.method === "GET") {
      const { session, snapshot } = await readCloudProgress(token);
      return jsonResponse({
        ok: true,
        accountId: session.accountId,
        updatedAt: snapshot.updatedAt,
        state: snapshot.state,
      });
    }

    if (req.method === "POST") {
      const payload = await req.json().catch(() => ({}));
      const result = await writeCloudProgress(token, payload.state, payload.updatedAt);
      return jsonResponse({
        ok: true,
        accountId: result.accountId,
        updatedAt: result.updatedAt,
        state: result.state,
        conflict: result.conflict,
      });
    }

    return jsonResponse(
      {
        ok: false,
        error: "Method Not Allowed",
      },
      405,
      { Allow: "OPTIONS, GET, POST" },
    );
  } catch (error) {
    return handleCloudSyncError(error);
  }
};

export const config = {
  path: "/api/cloud-sync/state",
};
