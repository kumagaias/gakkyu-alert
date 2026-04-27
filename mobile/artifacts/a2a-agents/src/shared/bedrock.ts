import {
  BedrockRuntimeClient,
  InvokeModelCommand,
} from "@aws-sdk/client-bedrock-runtime";

const client = new BedrockRuntimeClient({
  region: process.env.AWS_REGION ?? "ap-northeast-1",
});

const MODEL_ID = "amazon.nova-lite-v1:0";

interface NovaResponse {
  output: { message: { content: Array<{ text: string }> } };
}

export async function invokeNova(prompt: string): Promise<string> {
  const body = JSON.stringify({
    messages: [{ role: "user", content: [{ text: prompt }] }],
    inferenceConfig: { maxTokens: 1024, temperature: 0.3 },
  });

  const res = await client.send(
    new InvokeModelCommand({ modelId: MODEL_ID, body, contentType: "application/json" })
  );

  const parsed = JSON.parse(Buffer.from(res.body).toString()) as NovaResponse;
  return parsed.output.message.content[0]?.text ?? "";
}
