import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { registerSearchJobs } from "./searchJobs.js";
import { registerGetJobDetails } from "./jobDetails.js";
import { registerGetMyProfile } from "./getMyProfile.js";

export function registerTools(server: McpServer, transport: "stdio" | "http") {
  registerSearchJobs(server, transport);
  registerGetJobDetails(server, transport);
  registerGetMyProfile(server, transport);
}
