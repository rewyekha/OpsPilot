"""
Azure AI Foundry service client.

Responsibilities:
  - Initialize the Azure AI Projects client using managed identity or API key
  - Provide a factory method for creating LangChain-compatible chat model instances
    with Foundry tracing automatically attached
  - Load versioned system prompts from the Foundry Prompt Registry
  - Submit evaluation runs to Foundry Evaluation Hub

All LLM instances created through this module automatically emit traces to
Azure AI Foundry, providing full reasoning transparency for every agent call.
"""
