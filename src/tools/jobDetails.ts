import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import z from "zod";

export function registerGetJobDetails(
  server: McpServer,
  transport: "stdio" | "http",
) {
  server.registerTool(
    "get_job_details",
    {
      title: "Get Job Details",
      description:
        "Get full details of a specific job including description, salary, company info and application link. Use this after search_jobs when the user wants to know more about a specific role.",
      inputSchema: {
        job_id: z.string().describe("The job ID from search_jobs results"),
      },
    },
    async ({ job_id }, { authInfo }) => {
      const token =
        transport === "http" ? authInfo?.token : process.env.GETHIRED_API_TOKEN;
      const res = await fetch(
        `${process.env.GETHIRED_URL}/api/jobs/${job_id}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      if (!res.ok) {
        return {
          content: [
            {
              type: "text",
              text:
                res.status === 404
                  ? `Job ${job_id} not found or no longer active.`
                  : `Failed to fetch job details: ${res.status}`,
            },
          ],
        };
      }

      const data = await res.json();

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                id: data.id,
                title: data.job_name,
                company: data.company_name,
                company_url: data.company_url,
                type: data.job_type,
                locations: data.locations,
                salary: data.salary_range,
                salary_min: data.salary_min,
                salary_max: data.salary_max,
                experience: data.experience,
                visa: data.visa_requirement,
                equity: data.equity_range,
                platform: data.platform,
                apply_url: data.job_url,
                description: data.description?.slice(0, 2000),
                posted: data.created_at,
                company_info: data.job_postings?.[0]?.company_info ?? null,
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
