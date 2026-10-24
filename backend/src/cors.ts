import type { RequestHandler } from "express";

const localOrigins = "http://localhost:5175,http://127.0.0.1:5175";
const configuredOrigins =
  process.env.CORS_ORIGINS ??
  (process.env.NODE_ENV === "production" ? "" : localOrigins);

const allowedOrigins = new Set(
  configuredOrigins
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);
for (const origin of allowedOrigins) {
  const url = new URL(origin);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== origin) {
    throw new Error(
      "CORS_ORIGINS must contain exact HTTP(S) origins without paths or trailing slashes.",
    );
  }
}

// Exact allowlist; production defaults to no cross-origin access until configured.
export const cors: RequestHandler = (request, response, next) => {
  response.vary("Origin");
  const origin = request.get("Origin");
  if (origin) {
    if (!allowedOrigins.has(origin)) {
      response
        .status(403)
        .json({ success: false, error: "Origin not allowed" });
      return;
    }
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Accept, Content-Type");
  }
  if (request.method === "OPTIONS") {
    response.sendStatus(204);
    return;
  }
  next();
};
