import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { registerTools } from "../tools/index.js";

export function createMcpServer() {
  const server = new McpServer({
    name: "GetHired",
    version: "1.0.0",
  });

  registerTools(server);

  return server;
}
