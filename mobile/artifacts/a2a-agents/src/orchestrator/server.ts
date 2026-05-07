import { v4 as uuidv4 } from "uuid";
import type { A2ATask, A2ATaskSendParams, JsonRpcResponse } from "../shared/a2a.js";
import { createAgentServer } from "../shared/agent-server.js";

const PORT = parseInt(process.env.PORT ?? "5003", 10);
const SURVEILLANCE_AGENT_URL = process.env.SURVEILLANCE_AGENT_URL ?? "http://localhost:5001";
const ANALYSIS_AGENT_URL = process.env.ANALYSIS_AGENT_URL ?? "http://localhost:5002";

const card = {
  name: "Gakkyu Alert Orchestrator Agent",
  description:
    "Orchestrates a multi-agent school outbreak surveillance pipeline: SurveillanceAgent → AnalysisAgent. Delivers a complete outbreak report with FHIR data and AI risk analysis for Tokyo school districts.",
  url: `http://localhost:${PORT}`,
  version: "1.0.0",
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  defaultInputModes: ["text"],
  defaultOutputModes: ["text"],
  skills: [
    {
      id: "orchestrate-surveillance",
      name: "Full Surveillance Report",
      description:
        "Coordinates surveillance and analysis agents to produce a complete outbreak report",
      tags: ["orchestration", "a2a", "fhir", "outbreak", "multi-agent"],
      examples: [
        "Check outbreak risk for Tokyo school districts",
        "Generate weekly disease surveillance report",
        "What is the current infection risk in Nerima?",
      ],
    },
  ],
};

async function callAgent(agentUrl: string, message: string): Promise<A2ATask> {
  const params: A2ATaskSendParams = {
    id: uuidv4(),
    message: { role: "user", content: [{ type: "text", text: message }] },
  };

  const res = await fetch(`${agentUrl}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: uuidv4(), method: "tasks/send", params }),
    signal: AbortSignal.timeout(30_000),
  });

  const data = (await res.json()) as JsonRpcResponse<A2ATask>;
  if (data.error) throw new Error(`Agent error: ${data.error.message}`);
  return data.result!;
}

async function handleTask(params: A2ATaskSendParams): Promise<A2ATask> {
  const userQuery = params.message.content.map((c) => c.text).join(" ");

  // Step 1: Fetch FHIR surveillance data
  const survTask = await callAgent(SURVEILLANCE_AGENT_URL, userQuery);
  const survData = survTask.artifacts?.[0]?.parts[0]?.text ?? "{}";

  // Step 2: AI analysis of the surveillance data
  const analysisTask = await callAgent(
    ANALYSIS_AGENT_URL,
    `Analyze the following disease surveillance data from Tokyo school districts:\n\n${survData}`
  );
  const analysis = analysisTask.artifacts?.[0]?.parts[0]?.text ?? "";

  const report = JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      query: userQuery,
      pipeline: ["SurveillanceAgent", "AnalysisAgent"],
      surveillanceData: JSON.parse(survData),
      riskAnalysis: analysis,
      note: "School closures lead community spread by 2-3 days. Data from Nerima, Suginami, and Musashino districts.",
    },
    null,
    2
  );

  return {
    id: params.id,
    status: {
      state: "completed",
      timestamp: new Date().toISOString(),
      message: {
        role: "agent",
        content: [
          {
            type: "text",
            text: "School outbreak surveillance report generated via SurveillanceAgent → AnalysisAgent pipeline.",
          },
        ],
      },
    },
    artifacts: [
      {
        name: "outbreak-report",
        description: "Complete school outbreak surveillance report with FHIR data and AI analysis",
        parts: [{ type: "text", text: report }],
        index: 0,
      },
    ],
  };
}

const app = createAgentServer(card, handleTask);
app.listen(PORT, () => {
  console.log(`OrchestratorAgent running on port ${PORT}`);
  console.log(`SurveillanceAgent: ${SURVEILLANCE_AGENT_URL}`);
  console.log(`AnalysisAgent: ${ANALYSIS_AGENT_URL}`);
});
