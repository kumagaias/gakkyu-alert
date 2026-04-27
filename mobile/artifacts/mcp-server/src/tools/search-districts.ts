import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Request } from "express";
import { fetchStatus } from "../client/api.js";
import { districtsToLocationBundle } from "../fhir/converters.js";
import type { IMcpTool } from "../IMcpTool.js";

export class SearchDistrictsTool implements IMcpTool {
  registerTool(server: McpServer, _req: Request): void {
    server.tool(
      "search_districts",
      "List all monitored districts as FHIR Location resources. Returns 練馬区, 杉並区, and 武蔵野市 (Tokyo) with current outbreak levels.",
      {},
      async () => {
        const status = await fetchStatus();
        const bundle = districtsToLocationBundle(status.districts);
        return { content: [{ type: "text" as const, text: JSON.stringify(bundle, null, 2) }] };
      }
    );
  }
}
