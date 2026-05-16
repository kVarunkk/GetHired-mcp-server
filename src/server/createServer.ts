import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools/index.js";

export function createMcpServer(transport: "stdio" | "http") {
  const server = new McpServer({
    name: "GetHired",
    version: "1.0.0",
  });

  registerTools(server, transport);

  return server;
}
