import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Request } from "express";
import { z } from "zod";
import { fetchStatus } from "../client/api.js";
import { schoolClosuresToObservationBundle } from "../fhir/converters.js";
import type { IMcpTool } from "../IMcpTool.js";

const inputSchema = {
  districtId: z
    .string()
    .optional()
    .describe("District ID (nerima, suginami, musashino). Omit for aggregated data."),
  weeks: z
    .number()
    .int()
    .min(1)
    .max(8)
    .optional()
    .describe("Number of recent weeks to include in the trend (1-8, default 8)."),
};

export class GetSchoolClosureTrendTool implements IMcpTool {
  registerTool(server: McpServer, _req: Request): void {
    server.tool(
      "get_school_closure_trend",
      "Get school class closure counts as FHIR Bundle<Observation>, with weekly trend history. School closures are an early warning signal — children get sick 2-3 days before adults, making this data a leading indicator for community outbreaks.",
      inputSchema,
      async ({ districtId, weeks = 8 }) => {
        const status = await fetchStatus();

        // Trim weekly history to requested weeks
        const trimmed = {
          ...status,
          schoolClosures: {
            ...status.schoolClosures,
            entries: status.schoolClosures.entries.map((e) => ({
              ...e,
              weeklyHistory: e.weeklyHistory.slice(-weeks),
            })),
          },
        };

        const bundle = schoolClosuresToObservationBundle(trimmed, districtId);
        return { content: [{ type: "text" as const, text: JSON.stringify(bundle, null, 2) }] };
      }
    );
  }
}
