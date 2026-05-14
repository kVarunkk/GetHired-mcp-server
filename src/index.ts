import "dotenv/config";
import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import {
  mcpAuthMetadataRouter,
  getOAuthProtectedResourceMetadataUrl,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { requireBearerAuth } from "@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js";
import { z } from "zod";
import cors from "cors";
import { createRemoteJWKSet, jwtVerify } from "jose";

const PORT = process.env.PORT || 3001;
const mcpServerUrl = new URL(
  process.env.MCP_SERVER_URL || "http://localhost:3001",
);
const supabaseUrl = process.env.SUPABASE_URL!;

// Point to Supabase's built-in OAuth endpoints
const oauthMetadata = {
  issuer: `${supabaseUrl}/auth/v1`,
  authorization_endpoint: `${supabaseUrl}/auth/v1/oauth/authorize`,
  token_endpoint: `${supabaseUrl}/auth/v1/oauth/token`,
  jwks_uri: `${supabaseUrl}/auth/v1/.well-known/jwks.json`,
  response_types_supported: ["code"],
  grant_types_supported: ["authorization_code", "refresh_token"],
  code_challenge_methods_supported: ["S256"],
  scopes_supported: ["openid", "email", "profile"],
};

// Verify tokens using Supabase JWKS (no introspection endpoint needed)
const JWKS = createRemoteJWKSet(
  new URL(`${supabaseUrl}/auth/v1/.well-known/jwks.json`),
);

const tokenVerifier = {
  verifyAccessToken: async (token: string) => {
    try {
      const { payload } = await jwtVerify(token, JWKS, {
        issuer: `${supabaseUrl}/auth/v1`,
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

const app = express();
app.use(express.json());
app.use(cors({ origin: "*", exposedHeaders: ["Mcp-Session-Id"] }));

// Expose OAuth metadata — MCP clients discover this automatically
app.use(
  mcpAuthMetadataRouter({
    oauthMetadata,
    resourceServerUrl: mcpServerUrl,
    scopesSupported: ["openid", "email", "profile"],
    resourceName: "GetHired MCP Server",
  }),
);

const authMiddleware = requireBearerAuth({
  verifier: tokenVerifier,
  requiredScopes: [],
  resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(mcpServerUrl),
});

// Session management
const transports: Record<string, StreamableHTTPServerTransport> = {};

function createMcpServer() {
  const server = new McpServer({
    name: "GetHired",
    version: "1.0.0",
  });

  server.registerTool(
    "search_jobs",
    {
      title: "Search Jobs",
      description: "Search GetHired's job listings",
      inputSchema: {
        query: z.string().describe("Job title or keywords"),
        location: z.string().optional().describe("Location or 'remote'"),
        salary_min: z.number().optional().describe("Minimum salary"),
        job_type: z.enum(["Fulltime", "Intern", "Contract"]).optional(),
        visa_sponsorship: z.boolean().optional(),
      },
    },
    async ({ query, location, salary_min, job_type }, { authInfo }) => {
      const params = new URLSearchParams();
      if (query) params.set("jobTitleKeywords", query);
      if (location) params.set("location", location);
      if (salary_min) params.set("minSalary", salary_min.toString());
      if (job_type) params.set("jobType", job_type);

      const res = await fetch(
        `${process.env.GETHIRED_URL}/api/jobs?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${authInfo?.token}`,
          },
        },
      );

      const data = await res.json();
      return {
        content: [{ type: "text", text: JSON.stringify(data.data, null, 2) }],
      };
    },
  );

  server.registerTool(
    "get_job_details",
    {
      title: "Get Job Details",
      description: "Get full details of a specific job",
      inputSchema: {
        job_id: z.string().describe("The job ID"),
      },
    },
    async ({ job_id }, { authInfo }) => {
      const res = await fetch(
        `${process.env.GETHIRED_URL}/api/jobs/${job_id}`,
        { headers: { Authorization: `Bearer ${authInfo?.token}` } },
      );
      const data = await res.json();
      return {
        content: [
          { type: "text", text: JSON.stringify(data.data?.[0], null, 2) },
        ],
      };
    },
  );

  return server;
}

app.post("/", async (req, res) => {
  console.log("BODY:", req.body);
  console.log("AUTH HEADER:", req.headers.authorization);
  console.log(
    isInitializeRequest(req.body)
      ? "Initialize request detected"
      : "Not an initialize request",
  );
  // Allow initialize request without auth
  if (!isInitializeRequest(req.body)) {
    try {
      await new Promise<void>((resolve, reject) => {
        authMiddleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      console.log("Auth passed");
    } catch (error) {
      console.error("AUTH ERROR:", error);

      res.status(401).json({
        jsonrpc: "2.0",
        error: {
          code: -32001,
          message: "Unauthorized",
        },
        id: req.body?.id ?? null,
      });

      return;
    }
  }

  const sessionId = req.headers["mcp-session-id"] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  console.log("Session ID:", sessionId);

  if (sessionId && transports[sessionId]) {
    transport = transports[sessionId];
  } else if (isInitializeRequest(req.body)) {
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport;
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) delete transports[transport.sessionId];
    };

    console.log("Creating new transport for session initialization");

    await createMcpServer().connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Bad Request" },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get("/", authMiddleware, async (req, res) => {
  const transport = transports[req.headers["mcp-session-id"] as string];
  if (!transport) {
    res.status(400).send("Invalid session");
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/", authMiddleware, async (req, res) => {
  const transport = transports[req.headers["mcp-session-id"] as string];
  if (!transport) {
    res.status(400).send("Invalid session");
    return;
  }
  await transport.handleRequest(req, res);
});

app.listen(PORT, () => {
  console.log(`GetHired MCP Server running at ${mcpServerUrl.origin}`);
});
