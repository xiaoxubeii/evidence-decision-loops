# V4 Live Comparison

Records: 390
Traces: 780
Mode: live
Setting: evidence-seeking
Model: MiniMax-M3
Reasoning effort: medium

| Method | Decision accuracy | Citation validity | Required evidence recall | Required evidence precision | Search required evidence recall | Read required evidence recall | Process validity | Human review rate | Review reasons | Missed review rate | Unnecessary review rate | Failure stages | Citation granularity | Primary metric | Invalid decision rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| react | 0.887 | 0.997 | 0.814 | 0.796 | 0.909 | 0.917 | 0.99 | 0.003 | invalid_citation:1 | 0 | 0.003 | none:235, citation_miss:107, retrieval_miss:12, read_miss:4, decision_miss_after_evidence:32 | 0.697 | 0.615 | 0 |
| edl | 0.854 | 0.997 | 0.89 | 0.795 | 0.932 | 0.932 | 1 | 0.526 | material_gap:130, material_conflict:78, insufficient_evidence:108, forced_source_label_without_abstain:57, missing_citation:1, invalid_citation:1 | 0 | 0.526 | none:267, retrieval_miss:6, citation_miss:74, decision_miss_after_evidence:43 | 0.795 | 0.685 | 0.003 |
