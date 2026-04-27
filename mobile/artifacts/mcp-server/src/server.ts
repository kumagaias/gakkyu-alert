import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import cors from "cors";
import express, { type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { GetDiagnosticReportTool } from "./tools/get-diagnostic-report.js";
import { GetDiseaseObservationsTool } from "./tools/get-disease-observations.js";
import { GetOutbreakAlertLevelTool } from "./tools/get-outbreak-alert-level.js";
import { GetSchoolClosureTrendTool } from "./tools/get-school-closure-trend.js";
import { SearchDistrictsTool } from "./tools/search-districts.js";
import type { IMcpTool } from "./IMcpTool.js";

const PORT = parseInt(process.env.PORT ?? "5000", 10);
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? "*";

const tools: IMcpTool[] = [
  new SearchDistrictsTool(),
  new GetDiseaseObservationsTool(),
  new GetOutbreakAlertLevelTool(),
  new GetSchoolClosureTrendTool(),
  new GetDiagnosticReportTool(),
];

function createMcpServer(req: Request): McpServer {
  const server = new McpServer({
    name: "gakkyu-alert-fhir",
    version: "1.0.0",
  });
  for (const tool of tools) {
    tool.registerTool(server, req);
  }
  return server;
}

// Session map for streaming connections
const sessions = new Map<string, StreamableHTTPServerTransport>();

const app = express();
app.use(express.json());
app.use(cors({ origin: ALLOWED_ORIGIN }));

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok", server: "gakkyu-alert-fhir-mcp" });
});

app.post("/mcp", async (req: Request, res: Response) => {
  try {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;

    if (sessionId && sessions.has(sessionId)) {
      const transport = sessions.get(sessionId)!;
      await transport.handleRequest(req, res, req.body);
      return;
    }

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
    });

    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    const server = createMcpServer(req);
    await server.connect(transport);

    if (transport.sessionId) {
      sessions.set(transport.sessionId, transport);
    }

    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal error" },
        id: null,
      });
    }
  }
});

app.get("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const transport = sessions.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handleRequest(req, res);
});

app.delete("/mcp", async (req: Request, res: Response) => {
  const sessionId = req.headers["mcp-session-id"] as string;
  const transport = sessions.get(sessionId);
  if (!transport) {
    res.status(404).json({ error: "Session not found" });
    return;
  }
  await transport.handleRequest(req, res);
  sessions.delete(sessionId);
});

app.listen(PORT, () => {
  console.log(`gakkyu-alert FHIR MCP server running on port ${PORT}`);
  console.log(`API_BASE_URL: ${process.env.API_BASE_URL ?? "http://localhost:3000"}`);
});
