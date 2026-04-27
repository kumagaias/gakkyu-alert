// A2A JSON-RPC 2.0 protocol types
// Ref: https://google.github.io/A2A/

export interface A2AMessage {
  role: "user" | "agent";
  content: Array<{ type: "text"; text: string }>;
}

export interface A2ATaskStatus {
  state: "submitted" | "working" | "completed" | "failed" | "canceled";
  message?: A2AMessage;
  timestamp: string;
}

export interface A2AArtifact {
  name?: string;
  description?: string;
  parts: Array<{ type: "text"; text: string }>;
  index: number;
}

export interface A2ATask {
  id: string;
  sessionId?: string;
  status: A2ATaskStatus;
  artifacts?: A2AArtifact[];
  metadata?: Record<string, unknown>;
}

export interface A2ATaskSendParams {
  id: string;
  sessionId?: string;
  message: A2AMessage;
  metadata?: Record<string, unknown>;
  historyLength?: number;
}

export interface A2AAgentCard {
  name: string;
  description: string;
  url: string;
  version: string;
  capabilities: {
    streaming: boolean;
    pushNotifications: boolean;
    stateTransitionHistory: boolean;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  skills: Array<{
    id: string;
    name: string;
    description: string;
    tags: string[];
    examples?: string[];
  }>;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: string | number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: T;
  error?: { code: number; message: string; data?: unknown };
}

export function jsonRpcOk<T>(id: string | number | null, result: T): JsonRpcResponse<T> {
  return { jsonrpc: "2.0", id: id ?? null, result };
}

export function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string
): JsonRpcResponse {
  return { jsonrpc: "2.0", id: id ?? null, error: { code, message } };
}
