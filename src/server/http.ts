import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { mcpAuthMetadataRouter } from "@modelcontextprotocol/sdk/server/auth/router.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { oauthMetadata } from "../auth/oauth.js";
import { createMcpServer } from "./createServer.js";
import { transports } from "./transports.js";
import { MCP_SERVER_URL, PORT } from "../config/env.js";
import { authMiddleware } from "../auth/middleware.js";

export async function startHttpServer() {
  const app = express();

  app.use(express.json());
  app.use(
    cors({
      origin: "*",
      exposedHeaders: ["Mcp-Session-Id"],
    }),
  );
  app.use(
    mcpAuthMetadataRouter({
      oauthMetadata,
      resourceServerUrl: new URL(MCP_SERVER_URL),
      scopesSupported: ["openid", "email", "profile"],
      resourceName: "GetHired MCP Server",
    }),
  );

  app.post("/", async (req, res) => {
    if (!isInitializeRequest(req.body)) {
      await new Promise<void>((resolve, reject) => {
        authMiddleware(req, res, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
    }

    const sessionId = req.headers["mcp-session-id"] as string;

    let transport: StreamableHTTPServerTransport;

    if (sessionId && transports[sessionId]) {
      transport = transports[sessionId];
    } else {
      transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
        onsessioninitialized: (id) => {
          transports[id] = transport;
        },
      });

      transport.onclose = () => {
        if (transport.sessionId) delete transports[transport.sessionId];
      };

      await createMcpServer().connect(transport);
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
    console.log(`HTTP MCP server running on ${MCP_SERVER_URL}`);
  });
}
