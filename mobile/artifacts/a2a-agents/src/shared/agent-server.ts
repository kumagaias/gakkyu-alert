// Reusable Express-based A2A agent server factory
import cors from "cors";
import express, { type Request, type Response } from "express";
import { v4 as uuidv4 } from "uuid";
import {
  jsonRpcError,
  jsonRpcOk,
  type A2AAgentCard,
  type A2ATask,
  type A2ATaskSendParams,
  type JsonRpcRequest,
} from "./a2a.js";

export type TaskHandler = (params: A2ATaskSendParams) => Promise<A2ATask>;

export function createAgentServer(
  card: A2AAgentCard,
  handleTask: TaskHandler
): ReturnType<typeof express> {
  const app = express();
  app.use(express.json());
  app.use(cors());

  // Agent card discovery
  app.get("/.well-known/agent.json", (_req, res) => {
    res.json(card);
  });

  app.get("/healthz", (_req, res) => {
    res.json({ status: "ok", agent: card.name });
  });

  // A2A JSON-RPC endpoint
  app.post("/", async (req: Request, res: Response) => {
    const rpc = req.body as JsonRpcRequest;

    if (rpc.jsonrpc !== "2.0") {
      res.status(400).json(jsonRpcError(null, -32600, "Invalid Request"));
      return;
    }

    try {
      if (rpc.method === "agent/authenticatedExtendedCard") {
        res.json(jsonRpcOk(rpc.id, card));
        return;
      }

      if (rpc.method === "tasks/send") {
        const params = rpc.params as A2ATaskSendParams;
        if (!params?.id) {
          res.json(jsonRpcError(rpc.id, -32602, "Missing task id"));
          return;
        }
        const task = await handleTask(params);
        res.json(jsonRpcOk(rpc.id, task));
        return;
      }

      if (rpc.method === "tasks/get") {
        // Stateless — return empty completed task
        const taskId = (rpc.params as { id: string }).id ?? uuidv4();
        res.json(
          jsonRpcOk(rpc.id, {
            id: taskId,
            status: { state: "completed", timestamp: new Date().toISOString() },
          })
        );
        return;
      }

      res.json(jsonRpcError(rpc.id, -32601, `Method not found: ${rpc.method}`));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      res.json(jsonRpcError(rpc.id, -32603, message));
    }
  });

  return app;
}
