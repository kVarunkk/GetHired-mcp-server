import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./createServer.js";

export async function startStdioServer() {
  const transport = new StdioServerTransport();

  const server = createMcpServer();

  await server.connect(transport);

  //   console.log("STDIO MCP server running");
}
