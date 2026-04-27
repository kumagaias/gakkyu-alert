import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Request } from "express";

export interface IMcpTool {
  registerTool(server: McpServer, req: Request): void;
}
