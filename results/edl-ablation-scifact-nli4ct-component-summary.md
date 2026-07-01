# EDL Component Ablation: SciFact + NLI4CT

Generated from V4 live comparison trace files. This table uses the P1 shared EDL component ablation variants.

## SciFact

Dataset: `src/data/react-clinical-source-v4-agree-scifact-135.jsonl`
Records: 135

| Variant | Traces | Decision acc. | Primary metric | Evidence recall | Evidence precision | Search recall | Read recall | Citation validity | Human review | Parse error | Review reasons | Failure stages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Full EDL | 135 | 0.956 | 0.837 | 0.889 | 0.603 | n/a | n/a | 1 | 0.4 | 0 | insufficient_evidence:54 |  |
| w/o Iterative Seeking | 135 | 0.933 | 0.726 | 0.785 | 0.611 | n/a | n/a | 1 | 0.474 | 0 | insufficient_evidence:63, material_conflict:2, material_gap:46 |  |
| w/o Sufficiency Assessment | 135 | 0.948 | 0.793 | 0.856 | 0.631 | n/a | n/a | 0.97 | 0.03 | 0 | invalid_citation:4 |  |
| w/o Citation Validation | 135 | 0.948 | 0.081 | 0.081 | 0.577 | n/a | n/a | 0.096 | 0.911 | 0 | insufficient_evidence:56, invalid_citation:122, material_conflict:1, material_gap:44, missing_citation:9 |  |

## NLI4CT

Dataset: `src/data/react-clinical-source-v4-nli4ct-fulltrial-rawline-audited-main.jsonl`
Records: 130

| Variant | Traces | Decision acc. | Primary metric | Evidence recall | Evidence precision | Search recall | Read recall | Citation validity | Human review | Parse error | Review reasons | Failure stages |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| Full EDL | 130 | 0.923 | 0.538 | 0.768 | 0.864 | n/a | n/a | 1 | 0.3 | 0 | forced_source_label_without_abstain:29, insufficient_evidence:29, material_conflict:13, material_gap:10 |  |
| w/o Iterative Seeking | 130 | 0.869 | 0.423 | 0.691 | 0.852 | n/a | n/a | 1 | 0.385 | 0 | forced_source_label_without_abstain:44, insufficient_evidence:44, material_conflict:9, material_gap:23 |  |
| w/o Sufficiency Assessment | 130 | 0.931 | 0.577 | 0.777 | 0.877 | n/a | n/a | 1 | 0 | 0 |  |  |
| w/o Citation Validation | 130 | 0.923 | 0.115 | 0.144 | 0.801 | n/a | n/a | 0.2 | 0.831 | 0 | forced_source_label_without_abstain:34, insufficient_evidence:34, invalid_citation:104, material_conflict:13, material_gap:14 |  |
