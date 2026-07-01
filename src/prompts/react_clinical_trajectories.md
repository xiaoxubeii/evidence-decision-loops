# Held-Out ReAct Clinical Trajectories

These examples teach the interaction pattern only. They are not V1 test records and
their ids must not appear in `src/data/react-clinical-source-v1.jsonl`.

## Example 1: Supported Evidence Claim

Question: Does the frozen abstract support the claim that marker A increases after
intervention B?

Thought: I need to find the evidence document for marker A and intervention B.
Action: search({"query":"marker A intervention B"})
Observation: doc-heldout-support-001: Abstract reports marker A increased after intervention B.
Thought: I should inspect the cited document before finishing.
Action: open_document({"document_id":"doc-heldout-support-001"})
Observation: The abstract states that marker A increased after intervention B in the study cohort.
Thought: The claim is directly supported by the frozen abstract.
Action: submit_decision({"decision":"supported","citedEvidenceIds":["doc-heldout-support-001"],"requiredHumanReview":false})
Observation: Decision accepted.
Finish: supported

## Example 2: Refuted Trial Statement

Question: Does the frozen trial excerpt support the statement that the candidate
has stage M1 disease?

Thought: I need the trial document with the staging criteria.
Action: search({"query":"trial staging M0 M1 disease"})
Observation: doc-heldout-refute-001: Trial excerpt lists T1 N1 M0 and excludes distant metastasis.
Thought: The statement says M1, so I need to inspect the criterion.
Action: inspect_evidence({"evidence_id":"doc-heldout-refute-001"})
Observation: The frozen criterion includes M0 staging and does not include M1.
Thought: The statement conflicts with the frozen criterion, so the statement is refuted.
Action: submit_decision({"decision":"refuted","citedEvidenceIds":["doc-heldout-refute-001"],"requiredHumanReview":false})
Observation: Decision accepted.
Finish: refuted

## Example 3: Insufficient Evidence

Question: Does the packet establish that the intervention improves one-year mortality?

Thought: I need to search for mortality outcome evidence.
Action: search({"query":"intervention one-year mortality outcome"})
Observation: doc-heldout-nei-001: Abstract reports feasibility and recruitment but no mortality outcome.
Thought: The available document lacks the requested outcome.
Action: open_document({"document_id":"doc-heldout-nei-001"})
Observation: The abstract reports feasibility endpoints and does not report one-year mortality.
Thought: Evidence is insufficient, and review is required before making a clinical claim.
Action: submit_decision({"decision":"insufficient_evidence","citedEvidenceIds":["doc-heldout-nei-001"],"requiredHumanReview":true})
Observation: Decision accepted.
Finish: insufficient_evidence
