# V4 Live Comparison

Records: 390
Traces: 1560
Mode: live
Setting: frozen-evidence
Model: gpt-5.5
Reasoning effort: default

| Method | Decision accuracy | Citation validity | Required evidence recall | Required evidence precision | Search required evidence recall | Read required evidence recall | Process validity | Human review rate | Review reasons | Missed review rate | Unnecessary review rate | Failure stages | Citation granularity | Primary metric | Invalid decision rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| direct | 0.897 | 0.995 | 0.802 | 0.851 | n/a | n/a | n/a | 0.005 | missing_citation:2, invalid_citation:2 | 0 | 0 | n/a | 0.69 | 0.595 | 0 |
| cot | 0.913 | 0.997 | 0.808 | 0.852 | n/a | n/a | n/a | 0.003 | missing_citation:1, invalid_citation:1 | 0 | 0 | n/a | 0.69 | 0.613 | 0 |
| react | 0.915 | 1 | 0.827 | 0.85 | 0.868 | 0.857 | 1 | 0 | n/a | 0 | 0 | none:248, retrieval_miss:18, citation_miss:94, decision_miss_after_evidence:29, read_miss:1 | 0.728 | 0.654 | 0 |
| edl | 0.897 | 1 | 0.935 | 0.797 | 0 | 1 | 1 | 0.246 | insufficient_evidence:87, forced_source_label_without_abstain:31, material_conflict:13, material_gap:1 | 0 | 0.051 | retrieval_miss:390 | 0.879 | 0.785 | 0 |
