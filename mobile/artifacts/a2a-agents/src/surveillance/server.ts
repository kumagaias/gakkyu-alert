import type { A2ATask, A2ATaskSendParams } from "../shared/a2a.js";
import { createAgentServer } from "../shared/agent-server.js";
import {
  getDiseaseObservations,
  getOutbreakAlertLevel,
  getSchoolClosureTrend,
} from "../shared/mcp-client.js";

const PORT = parseInt(process.env.PORT ?? "5001", 10);

const card = {
  name: "Gakkyu Alert Surveillance Agent",
  description:
    "Fetches real-time school-based disease surveillance data from Tokyo districts (Nerima, Suginami, Musashino) as FHIR R4 resources. School closures are a 2-3 day leading indicator of community spread.",
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
      id: "surveillance",
      name: "Disease Surveillance",
      description:
        "Retrieves FHIR Observation bundles with outbreak alert levels, disease counts, and school closure trends",
      tags: ["fhir", "surveillance", "disease", "school-closures", "tokyo"],
      examples: [
        "Get outbreak data for Nerima district",
        "What is the current flu alert level in Tokyo?",
        "Show disease observations for all districts",
      ],
    },
  ],
};

function extractDistrictId(text: string): string | undefined {
  const lower = text.toLowerCase();
  if (lower.includes("nerima") || text.includes("練馬")) return "nerima";
  if (lower.includes("suginami") || text.includes("杉並")) return "suginami";
  if (lower.includes("musashino") || text.includes("武蔵野")) return "musashino";
  return undefined;
}

async function handleTask(params: A2ATaskSendParams): Promise<A2ATask> {
  const text = params.message.content.map((c) => c.text).join(" ");
  const districtId = extractDistrictId(text);

  const [alertRaw, obsRaw, closureRaw] = await Promise.all([
    getOutbreakAlertLevel(districtId),
    getDiseaseObservations(districtId),
    getSchoolClosureTrend(districtId),
  ]);

  const payload = JSON.stringify(
    {
      asOf: new Date().toISOString(),
      districtId: districtId ?? "all",
      alertLevel: JSON.parse(alertRaw),
      diseaseObservations: JSON.parse(obsRaw),
      schoolClosures: JSON.parse(closureRaw),
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
        content: [{ type: "text", text: "Surveillance data retrieved as FHIR resources." }],
      },
    },
    artifacts: [
      {
        name: "fhir-surveillance-bundle",
        description: "FHIR R4 Observation bundles with disease surveillance data",
        parts: [{ type: "text", text: payload }],
        index: 0,
      },
    ],
  };
}

const app = createAgentServer(card, handleTask);
app.listen(PORT, () => {
  console.log(`SurveillanceAgent running on port ${PORT}`);
  console.log(`MCP_BASE_URL: ${process.env.MCP_BASE_URL ?? "http://localhost:5000"}`);
});
