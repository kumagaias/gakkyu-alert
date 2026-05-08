import { app } from "./app.js";

const PORT = parseInt(process.env.PORT ?? "5000", 10);

app.listen(PORT, () => {
  console.log(`gakkyu-alert FHIR MCP server running on port ${PORT}`);
  console.log(`API_BASE_URL: ${process.env.API_BASE_URL ?? "http://localhost:3000"}`);
  console.log(`SYNTHETIC_MODE: ${process.env.SYNTHETIC_MODE ?? "false"}`);
});
