// Lightweight MCP tool caller — calls gakkyu-alert MCP server via HTTP

const MCP_BASE_URL = process.env.MCP_BASE_URL ?? "http://localhost:5000";
const MCP_ACCEPT = "application/json, text/event-stream";

interface McpToolResult {
  content: Array<{ type: string; text: string }>;
}

interface McpResponse {
  result?: McpToolResult;
  error?: { code: number; message: string };
}

// SSE response body is "event: message\ndata: {...}\n\n"
function parseSseBody(text: string): McpResponse {
  for (const line of text.split("\n")) {
    if (line.startsWith("data:")) {
      return JSON.parse(line.slice(5)) as McpResponse;
    }
  }
  return JSON.parse(text) as McpResponse;
}

let sessionId: string | undefined;

async function ensureSession(): Promise<void> {
  if (sessionId) return;

  const res = await fetch(`${MCP_BASE_URL}/mcp`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: MCP_ACCEPT },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 0,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "gakkyu-alert-a2a", version: "1.0.0" },
      },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  sessionId = res.headers.get("mcp-session-id") ?? undefined;
}

async function callMcp(toolName: string, args: Record<string, unknown>): Promise<string> {
  await ensureSession();

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: MCP_ACCEPT,
    ...(sessionId ? { "mcp-session-id": sessionId } : {}),
  };

  const res = await fetch(`${MCP_BASE_URL}/mcp`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: Date.now(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
    signal: AbortSignal.timeout(15_000),
  });

  const newSession = res.headers.get("mcp-session-id");
  if (newSession) sessionId = newSession;

  const text = await res.text();
  const data = parseSseBody(text);
  if (data.error) throw new Error(`MCP error ${data.error.code}: ${data.error.message}`);
  return data.result?.content[0]?.text ?? "{}";
}

export async function getOutbreakAlertLevel(districtId?: string): Promise<string> {
  return callMcp("get_outbreak_alert_level", districtId ? { districtId } : {});
}

export async function getDiseaseObservations(districtId?: string, diseaseId?: string): Promise<string> {
  const args: Record<string, unknown> = {};
  if (districtId) args.districtId = districtId;
  if (diseaseId) args.diseaseId = diseaseId;
  return callMcp("get_disease_observations", args);
}

export async function getSchoolClosureTrend(districtId?: string, weeks?: number): Promise<string> {
  const args: Record<string, unknown> = {};
  if (districtId) args.districtId = districtId;
  if (weeks) args.weeks = weeks;
  return callMcp("get_school_closure_trend", args);
}

export async function getDiagnosticReport(districtId?: string): Promise<string> {
  return callMcp("get_diagnostic_report", districtId ? { districtId } : {});
}

export async function searchDistricts(): Promise<string> {
  return callMcp("search_districts", {});
}
