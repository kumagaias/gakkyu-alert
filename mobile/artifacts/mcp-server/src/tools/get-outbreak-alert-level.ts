import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Request } from "express";
import { z } from "zod";
import { fetchStatus } from "../client/api.js";
import type { IMcpTool } from "../IMcpTool.js";

const LEVEL_LABELS: Record<number, string> = {
  0: "正常",
  1: "注意",
  2: "警戒",
  3: "流行",
};

const inputSchema = {
  districtId: z
    .string()
    .optional()
    .describe("District ID (nerima, suginami, musashino). Omit to get all districts."),
};

export class GetOutbreakAlertLevelTool implements IMcpTool {
  registerTool(server: McpServer, _req: Request): void {
    server.tool(
      "get_outbreak_alert_level",
      "Get current outbreak alert level for one or all monitored districts. Level 0=Normal, 1=Caution, 2=Warning, 3=Epidemic. School closures in the monitored Tokyo districts are a 2-3 day leading indicator of community spread.",
      inputSchema,
      async ({ districtId }) => {
        const status = await fetchStatus();
        const districts = districtId
          ? status.districts.filter((d) => d.id === districtId)
          : status.districts;

        const result = districts.map((d) => ({
          districtId: d.id,
          level: d.level,
          label: LEVEL_LABELS[d.level] ?? "不明",
          aiSummary: d.aiSummary,
          asOf: status.asOf,
        }));

        return {
          content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
        };
      }
    );
  }
}
