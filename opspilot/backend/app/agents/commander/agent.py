"""
Commander Agent — orchestration and synthesis node.

Responsibilities:
  1. commander_intake node:
     - Parse and classify the incoming incident description
     - Determine severity and extract affected service names
     - Decide which specialist agents to dispatch (not all incidents need all agents)
     - Set initial agent_status entries to PENDING

  2. commander_synthesize node:
     - Aggregate findings from all completed specialist agents
     - Build structured evidence correlation matrix
     - Produce multi-hypothesis root cause assessment with confidence scores
     - Assess blast radius and business impact
     - Rank remediation recommendations
     - Generate 3-sentence executive summary

Model: GPT-4o (commander_model_deployment)
  Uses full 128k context window to hold all agent findings simultaneously.
  Structured output via Pydantic response model enforced by LangChain.

Prompt loaded from: Azure AI Foundry Prompt Registry
  Name: "commander-intake-v1" / "commander-synthesize-v1"
"""
