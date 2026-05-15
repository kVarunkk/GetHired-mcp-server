import { SUPABASE_URL } from "../config/env.js";

export const oauthMetadata = {
  issuer: `${SUPABASE_URL}/auth/v1`,
  authorization_endpoint: `${SUPABASE_URL}/auth/v1/oauth/authorize`,
  token_endpoint: `${SUPABASE_URL}/auth/v1/oauth/token`,
  jwks_uri: `${SUPABASE_URL}/auth/v1/.well-known/jwks.json`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  scopes_supported: ["openid", "email", "profile"],
};
