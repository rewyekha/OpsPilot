"""
Accuracy evaluator for Foundry Evaluation Hub.

Evaluates whether OpsPilot's root cause analysis matches the expected output
in the golden dataset.

Metrics produced:
  - root_cause_keyword_match (0.0–1.0): fraction of expected keywords present
  - confidence_appropriate (bool): confidence >= expected_confidence_min
  - recommendation_keyword_match (0.0–1.0): fraction of expected rec keywords present
"""
