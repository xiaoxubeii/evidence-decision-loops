# V4 Main Three-Source Canonical NLI4CT Summary

This summary reports the canonical three-source main evaluation:

- SciFact and PubMedQA records are retained from the V4 agree main run.
- NLI4CT is represented by the full-trial raw-line audited-main arm.
- Evidence-seeking ReAct uses the forced-submit runner for all three sources.
- No model calls are made by this combiner; it filters archived traces and recomputes metrics.

Dataset: `src/data/react-clinical-source-v4-main-three-source-canonical-nli4ct.jsonl`

## Frozen Evidence

Result directory: `results/live-comparison-v4-main-three-source-canonical-nli4ct-frozen-evidence-full`

| Method | Traces | Decision Acc. | Citation Validity | Evidence Recall | Evidence Precision | Primary Metric | Human Review | Invalid Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| direct | 390.000 | 0.897 | 0.995 | 0.802 | 0.851 | 0.595 | 0.005 | 0.000 |
| cot | 390.000 | 0.913 | 0.997 | 0.808 | 0.852 | 0.613 | 0.003 | 0.000 |
| react | 390.000 | 0.915 | 1.000 | 0.827 | 0.850 | 0.654 | 0.000 | 0.000 |
| edl | 390.000 | 0.897 | 1.000 | 0.935 | 0.797 | 0.785 | 0.246 | 0.000 |

## Evidence Seeking

Result directory: `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full`

| Method | Traces | Decision Acc. | Citation Validity | Search Recall | Read Recall | Final Recall | Final Precision | Primary Metric | Human Review | Invalid Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| react | 390.000 | 0.928 | 0.997 | 0.060 | 0.896 | 0.773 | 0.786 | 0.654 | 0.003 | 0.000 |
| edl | 390.000 | 0.882 | 1.000 | 0.937 | 0.937 | 0.900 | 0.819 | 0.728 | 0.285 | 0.000 |
