# V4 Live Comparison

Records: 390
Traces: 1560
Mode: live
Setting: frozen-evidence
Model: MiniMax-M3
Reasoning effort: medium

| Method | Decision accuracy | Citation validity | Required evidence recall | Required evidence precision | Search required evidence recall | Read required evidence recall | Process validity | Human review rate | Review reasons | Missed review rate | Unnecessary review rate | Failure stages | Citation granularity | Primary metric | Invalid decision rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| direct | 0.877 | 0.995 | 0.8 | 0.828 | n/a | n/a | n/a | 0.005 | missing_citation:2, invalid_citation:2 | 0 | 0 | n/a | 0.677 | 0.562 | 0 |
| cot | 0.859 | 0.995 | 0.797 | 0.834 | n/a | n/a | n/a | 0.005 | missing_citation:2, invalid_citation:2 | 0 | 0 | n/a | 0.674 | 0.546 | 0 |
| react | 0.864 | 0.997 | 0.816 | 0.819 | 0.072 | 0.244 | 0.092 | 0.003 | invalid_citation:1 | 0 | 0.003 | retrieval_miss:348, none:13, read_miss:10, decision_miss_after_evidence:1, citation_miss:18 | 0.685 | 0.562 | 0 |
| edl | 0.874 | 0.992 | 0.906 | 0.785 | 0 | 1 | 1 | 0.469 | material_gap:104, insufficient_evidence:85, material_conflict:78, missing_citation:2, invalid_citation:3, forced_source_label_without_abstain:31 | 0 | 0.469 | retrieval_miss:390 | 0.831 | 0.718 | 0 |
