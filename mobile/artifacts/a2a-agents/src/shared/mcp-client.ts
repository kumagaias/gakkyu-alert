// Lightweight MCP tool caller — calls gakkyu-alert MCP server via HTTP

const MCP_BASE_URL = process.env.MCP_BASE_URL ?? "http://localhost:5000";

interface McpToolResult {
  content: Array<{ type: string; text: string }>;
}

interface McpResponse {
  result?: McpToolResult;
  error?: { code: number; message: string };
}

let sessionId: string | undefined;

async function callMcp(toolName: string, args: Record<string, unknown>): Promise<string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(sessionId ? { "mcp-session-id": sessionId } : {}),
  };

  const body = JSON.stringify({
    jsonrpc: "2.0",
    id: Date.now(),
    method: "tools/call",
    params: { name: toolName, arguments: args },
  });

  const res = await fetch(`${MCP_BASE_URL}/mcp`, {
    method: "POST",
    headers,
    body,
    signal: AbortSignal.timeout(15_000),
  });

  // Capture session from initial response
  const newSession = res.headers.get("mcp-session-id");
  if (newSession) sessionId = newSession;

  const data = (await res.json()) as McpResponse;
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
