import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Request } from "express";
import { z } from "zod";
import { fetchStatus } from "../client/api.js";
import { toDiagnosticReport } from "../fhir/converters.js";
import type { IMcpTool } from "../IMcpTool.js";

const inputSchema = {
  districtId: z
    .string()
    .optional()
    .describe("District ID (nerima, suginami, musashino). Defaults to nerima."),
};

export class GetDiagnosticReportTool implements IMcpTool {
  registerTool(server: McpServer, _req: Request): void {
    server.tool(
      "get_diagnostic_report",
      "Get a FHIR DiagnosticReport for a district — a weekly surveillance summary including AI-generated analysis and contained Observations for all diseases. This is the primary resource for integrating with clinical decision support systems.",
      inputSchema,
      async ({ districtId = "nerima" }) => {
        const status = await fetchStatus();
        const report = toDiagnosticReport(status, districtId);
        return { content: [{ type: "text" as const, text: JSON.stringify(report, null, 2) }] };
      }
    );
  }
}
