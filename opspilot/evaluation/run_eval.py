"""
Foundry Evaluation runner.

Runs OpsPilot against the golden incident dataset and submits results
to Azure AI Foundry Evaluation Hub.

Golden dataset: evaluation/datasets/golden_incidents.jsonl
Each record: { "input": { incident_description, affected_services },
               "expected_output": { root_cause, recommendations[] } }

Metrics evaluated:
  - root_cause_accuracy: does the primary hypothesis match expected?
  - confidence_calibration: is confidence score appropriate for accuracy?
  - recommendation_relevance: do recommendations address the root cause?
  - time_to_finding: seconds from incident creation to complete findings

Results are uploaded to Foundry Evaluation Hub for tracking over time.
"""
