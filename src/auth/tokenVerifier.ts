import { createRemoteJWKSet, jwtVerify } from "jose";
import { SUPABASE_URL } from "../config/env.js";

const JWKS = createRemoteJWKSet(
  new URL(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`),
);

export const tokenVerifier = {
  verifyAccessToken: async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${SUPABASE_URL}/auth/v1`,
        audience: "authenticated",
      });

      if (!payload.sub) throw new Error("Missing sub claim");

      const scopes =
        typeof payload.scope === "string" ? payload.scope.split(" ") : [];

      const clientId =
        typeof payload.client_id === "string" ? payload.client_id : "unknown";

      return {
        token,
        clientId,
        scopes,
        expiresAt: payload.exp ?? 0,
        extra: {
          userId: payload.sub,
          email: payload.email,
        },
      };
    } catch (error) {
      console.error("[auth] Token verification failed:", error);
      throw new Error("Invalid or expired token");
    }
  },
};
