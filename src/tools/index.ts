import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { registerSearchJobs } from "./searchJobs.js";
import { registerGetJobDetails } from "./jobDetails.js";
import { registerGetMyProfile } from "./getMyProfile.js";

export function registerTools(server: McpServer) {
  registerSearchJobs(server);
  registerGetJobDetails(server);
  registerGetMyProfile(server);
}
