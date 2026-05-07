import type { A2ATask, A2ATaskSendParams } from "../shared/a2a.js";
import { createAgentServer } from "../shared/agent-server.js";
import { invokeNova } from "../shared/bedrock.js";

const PORT = parseInt(process.env.PORT ?? "5002", 10);

const card = {
  name: "Gakkyu Alert Analysis Agent",
  description:
    "Analyzes school-based disease surveillance data to predict outbreak risk. Uses AI to identify trends and generate actionable public health recommendations.",
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
      id: "outbreak-analysis",
      name: "Outbreak Risk Analysis",
      description:
        "Analyzes FHIR surveillance data using AI to predict outbreak risk and generate school/parent recommendations",
      tags: ["ai", "analysis", "outbreak", "prediction", "public-health"],
      examples: [
        "Analyze outbreak risk from surveillance data",
        "Predict flu trend for next week in Tokyo",
        "Assess community spread risk from school closures",
      ],
    },
  ],
};

const SYSTEM_PROMPT = `You are an infectious disease surveillance analyst specializing in school-based outbreak detection in Tokyo, Japan.
School class closures are a 2-3 day leading indicator of community disease spread.
Alert levels: 0=Normal, 1=Caution, 2=Warning, 3=Epidemic.

Respond in JSON with these fields:
{
  "riskLevel": "Low" | "Moderate" | "High" | "Critical",
  "risingDiseases": ["disease names with upward trend"],
  "fallingDiseases": ["disease names with downward trend"],
  "prediction": "7-day outlook in 1-2 sentences",
  "recommendations": ["3-5 actionable items for parents and schools"],
  "advisory": "overall public health advisory in 2-3 sentences"
}`;

async function handleTask(params: A2ATaskSendParams): Promise<A2ATask> {
  const surveillanceData = params.message.content.map((c) => c.text).join("\n");

  const prompt = `${SYSTEM_PROMPT}

Analyze this school disease surveillance data from Tokyo:

${surveillanceData}`;

  const analysis = await invokeNova(prompt);

  return {
    id: params.id,
    status: {
      state: "completed",
      timestamp: new Date().toISOString(),
      message: {
        role: "agent",
        content: [{ type: "text", text: "Outbreak risk analysis complete." }],
      },
    },
    artifacts: [
      {
        name: "outbreak-analysis",
        description: "AI-generated outbreak risk analysis and public health recommendations",
        parts: [{ type: "text", text: analysis }],
        index: 0,
      },
    ],
  };
}

const app = createAgentServer(card, handleTask);
app.listen(PORT, () => {
  console.log(`AnalysisAgent running on port ${PORT}`);
  console.log(`AWS_REGION: ${process.env.AWS_REGION ?? "ap-northeast-1"}`);
});
