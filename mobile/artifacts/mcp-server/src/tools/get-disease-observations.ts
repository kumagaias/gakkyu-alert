import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Request } from "express";
import { z } from "zod";
import { fetchStatus } from "../client/api.js";
import { diseasesToObservationBundle } from "../fhir/converters.js";
import type { IMcpTool } from "../IMcpTool.js";

const inputSchema = {
  districtId: z
    .string()
    .optional()
    .describe("District ID (nerima, suginami, musashino). Omit for all-district aggregated data."),
  diseaseId: z
    .string()
    .optional()
    .describe("Disease ID (flu-a, covid, rsv, etc.). Omit for all diseases."),
};

export class GetDiseaseObservationsTool implements IMcpTool {
  registerTool(server: McpServer, _req: Request): void {
    server.tool(
      "get_disease_observations",
      "Get disease surveillance data as FHIR Bundle<Observation>. Each Observation includes current count, alert level (0-3), weekly history (8 weeks), and AI comment.",
      inputSchema,
      async ({ districtId, diseaseId }) => {
        const status = await fetchStatus();
        let diseases = status.diseases;
        if (diseaseId) {
          diseases = diseases.filter((d) => d.id === diseaseId);
        }
        const bundle = diseasesToObservationBundle(diseases, status.asOf, districtId);
        return { content: [{ type: "text" as const, text: JSON.stringify(bundle, null, 2) }] };
      }
    );
  }
}
