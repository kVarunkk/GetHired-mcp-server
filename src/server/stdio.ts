import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { createMcpServer } from "./createServer.js";

export async function startStdioServer() {
  const transport = new StdioServerTransport();
  const server = createMcpServer("stdio");
  await server.connect(transport);
}
