import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";

export async function registerGetMyProfile(
  server: McpServer,
  transport: "stdio" | "http",
) {
  server.registerTool(
    "get_my_profile",
    {
      title: "Get My Profile",
      description: `Get the authenticated user's GetHired profile including 
            name, AI credits balance, onboarding status, weekly metrics, 
            and recent applications. Use this when the user asks about their 
            account, credits, or application activity.`,
      inputSchema: {},
    },
    async (_, { authInfo }) => {
      const token =
        transport === "http" ? authInfo?.token : process.env.GETHIRED_API_TOKEN;
      const res = await fetch(`${process.env.GETHIRED_URL}/api/user/profile`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch profile: ${res.status}`,
            },
          ],
        };
      }

      const { data } = await res.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                name: data.full_name,
                email: data.email,
                ai_credits: data.ai_credits,
                onboarding_complete: data.onboarding_complete,
                invitations_count: data.invitations_count,
                weekly_metrics: data.metrics,
                recent_applications: data.recent_applications,
              },
              null,
              2,
            ),
          },
        ],
      };
    },
  );
}
