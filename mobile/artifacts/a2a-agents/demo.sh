#!/usr/bin/env bash
# Demo: Gakkyu Alert A2A multi-agent pipeline
# Calls OrchestratorAgent which chains SurveillanceAgent → AnalysisAgent
set -e

ORCHESTRATOR_URL="${ORCHESTRATOR_URL:-http://localhost:5003}"

echo "=== Gakkyu Alert — A2A Multi-Agent Outbreak Surveillance Demo ==="
echo "Orchestrator: ${ORCHESTRATOR_URL}"
echo ""
echo "Pipeline: OrchestratorAgent → SurveillanceAgent (FHIR/MCP) → AnalysisAgent (Bedrock Nova Lite)"
echo ""

TASK_ID=$(uuidgen 2>/dev/null || cat /proc/sys/kernel/random/uuid)

RESPONSE=$(curl -s -X POST "${ORCHESTRATOR_URL}/" \
  -H "Content-Type: application/json" \
  -d "{
    \"jsonrpc\": \"2.0\",
    \"id\": \"demo-1\",
    \"method\": \"tasks/send\",
    \"params\": {
      \"id\": \"${TASK_ID}\",
      \"message\": {
        \"role\": \"user\",
        \"content\": [{\"type\": \"text\", \"text\": \"Check outbreak risk for Tokyo school districts\"}]
      }
    }
  }")

echo "${RESPONSE}" | python3 -m json.tool 2>/dev/null || echo "${RESPONSE}"
