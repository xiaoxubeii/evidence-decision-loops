# V4 Live Comparison

Records: 390
Traces: 780
Mode: live
Setting: evidence-seeking
Model: gpt-5.5
Reasoning effort: default

| Method | Decision accuracy | Citation validity | Required evidence recall | Required evidence precision | Search required evidence recall | Read required evidence recall | Process validity | Human review rate | Review reasons | Missed review rate | Unnecessary review rate | Failure stages | Citation granularity | Primary metric | Invalid decision rate |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: | ---: | --- | ---: | ---: | ---: |
| react | 0.928 | 0.997 | 0.773 | 0.786 | 0.06 | 0.896 | 0.997 | 0.003 | missing_citation:1, invalid_citation:1 | 0 | 0.003 | retrieval_miss:363, citation_miss:20, none:6, read_miss:1 | 0.685 | 0.654 | 0 |
| edl | 0.882 | 1 | 0.9 | 0.819 | 0.937 | 0.937 | 1 | 0.285 | insufficient_evidence:101, forced_source_label_without_abstain:49, material_gap:10, material_conflict:13 | 0 | 0.1 | none:284, retrieval_miss:9, citation_miss:58, decision_miss_after_evidence:39 | 0.828 | 0.728 | 0 |
