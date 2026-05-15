import { McpServer } from "@modelcontextprotocol/sdk/server/mcp";
import { z } from "zod";

export function registerSearchJobs(server: McpServer) {
  server.registerTool(
    "search_jobs",
    {
      title: "Search Jobs",
      description: `Search GetHired's job listings with filters. 
            Use this when the user wants to find jobs, browse opportunities, 
            or search for roles matching specific criteria.`,
      inputSchema: {
        // Multi-value params use | separator (matches your parseMultiSelectParam)
        jobTitleKeywords: z
          .array(z.string())
          .optional()
          .describe("Job title keywords e.g. ['React', 'Frontend', 'Next.js']"),
        locations: z
          .array(z.string())
          .optional()
          .describe("Locations e.g. ['remote', 'New York', 'London']"),
        jobType: z
          .array(z.enum(["Fulltime", "Intern", "Contract", "Part-time"]))
          .optional()
          .describe("Job types"),
        platforms: z
          .array(
            z.enum([
              "ycombinator",
              "wellfound",
              "remoteok",
              "weworkremotely",
              "greenhouse",
              "glassdoor",
              "jobleads",
              "workingnomads",
              "uplers",
              "khosla",
              "sierra",
              "accel",
              "susa",
              "sapphire",
              "gethired",
            ]),
          )
          .optional()
          .describe("Filter by specific job platforms/sources"),
        companyNames: z
          .array(z.string())
          .optional()
          .describe("Filter by specific company names"),
        minSalary: z
          .number()
          .optional()
          .describe("Minimum salary in USD e.g. 100000"),
        minExperience: z
          .number()
          .optional()
          .describe("Minimum years of experience"),
        visaRequirement: z
          .array(z.string())
          .optional()
          .describe("Visa requirements e.g. ['visa_sponsorship']"),
        sortBy: z
          .enum(["created_at", "salary_min", "experience_min", "relevance"])
          .optional()
          .default("created_at")
          .describe(
            "Sort results by this field. Use 'relevance' when user wants to find jobs relevant to their profile.",
          ),
        sortOrder: z
          .enum(["asc", "desc"])
          .optional()
          .default("desc")
          .describe("Sort order"),
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("Number of results to return, max 50"),
        cursor: z
          .string()
          .optional()
          .describe("Cursor for pagination from previous search_jobs call"),
        tab: z
          .enum(["all", "saved", "applied"])
          .optional()
          .default("all")
          .describe(
            "Use saved if user asks for saved jobs and applied if user asks for applied jobs",
          ),
        jobId: z
          .string()
          .optional()
          .describe(
            "Use this along with sortBy set to 'relevance' when user asks for similar jobs. This will be the id of the job they want to see similar entries of.",
          ),
      },
    },
    async (
      {
        jobTitleKeywords,
        locations,
        jobType,
        platforms,
        companyNames,
        minSalary,
        minExperience,
        visaRequirement,
        sortBy,
        sortOrder,
        limit,
        cursor,
        tab,
        jobId,
      },
      { authInfo },
    ) => {
      const params = new URLSearchParams();

      // Multi-value params joined with | separator
      if (jobTitleKeywords?.length)
        params.set("jobTitleKeywords", jobTitleKeywords.join("|"));
      if (locations?.length) params.set("location", locations.join("|"));
      if (jobType?.length) params.set("jobType", jobType.join("|"));
      if (platforms?.length) params.set("platform", platforms.join("|"));
      if (companyNames?.length)
        params.set("companyName", companyNames.join("|"));
      if (visaRequirement?.length)
        params.set("visaRequirement", visaRequirement.join("|"));

      // Single value params
      if (minSalary) params.set("minSalary", minSalary.toString());
      if (minExperience) params.set("minExperience", minExperience.toString());
      if (sortBy) params.set("sortBy", sortBy);
      if (sortOrder) params.set("sortOrder", sortOrder);
      if (limit) params.set("limit", Math.min(limit, 20).toString());
      if (cursor) params.set("cursor", cursor);
      if (tab) params.set("tab", tab);
      if (jobId) params.set("jobId", jobId);

      const res = await fetch(
        `${process.env.GETHIRED_URL}/api/jobs?${params.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${authInfo?.token}`,
          },
        },
      );

      if (!res.ok) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch jobs: ${res.status} ${res.statusText}`,
            },
          ],
        };
      }

      const data = await res.json();
      const jobs = data.data || [];

      if (jobs.length === 0) {
        return {
          content: [
            { type: "text", text: "No jobs found matching your criteria." },
          ],
        };
      }

      // Return a clean summary instead of raw JSON
      // Raw JSON of 20 jobs is too noisy for the LLM to reason about
      const summary = jobs.map((job: any, i: number) => ({
        index: i + 1,
        id: job.id,
        title: job.job_name,
        company: job.company_name,
        type: job.job_type,
        locations: job.locations,
        salary: job.salary_range,
        experience: job.experience,
        visa: job.visa_requirement,
        platform: job.platform,
        url: job.job_url,
        posted: job.created_at,
      }));

      return {
        content: [
          {
            type: "text",
            text: [
              `Found ${data.totalCount ?? jobs.length} total jobs. Showing ${
                jobs.length
              }.`,
              data.nextCursor
                ? `More results available. Pass cursor: "${data.nextCursor}" to get the next page.`
                : "No more pages.",
              "",
              JSON.stringify(summary, null, 2),
            ].join("\n"),
          },
        ],
      };
    },
  );
}
