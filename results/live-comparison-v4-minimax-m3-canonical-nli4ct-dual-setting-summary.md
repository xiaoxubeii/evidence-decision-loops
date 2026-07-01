# MiniMax-M3 Canonical NLI4CT Dual-Setting Summary

Dataset: `src/data/react-clinical-source-v4-main-three-source-canonical-nli4ct.jsonl`

## Frozen Evidence

Result directory: `results/live-comparison-v4-minimax-m3-canonical-nli4ct-frozen-evidence-full`

| Method | Traces | Decision Acc. | Citation Validity | Evidence Recall | Evidence Precision | Primary Metric | Human Review | Invalid Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| direct | 390.000 | 0.877 | 0.995 | 0.800 | 0.828 | 0.562 | 0.005 | 0.000 |
| cot | 390.000 | 0.859 | 0.995 | 0.797 | 0.834 | 0.546 | 0.005 | 0.000 |
| react | 390.000 | 0.864 | 0.997 | 0.816 | 0.819 | 0.562 | 0.003 | 0.000 |
| edl | 390.000 | 0.874 | 0.992 | 0.906 | 0.785 | 0.718 | 0.469 | 0.000 |

## Evidence Seeking

Result directory: `results/live-comparison-v4-minimax-m3-canonical-nli4ct-evidence-seeking-react-edl-full`

| Method | Traces | Decision Acc. | Citation Validity | Search Recall | Read Recall | Final Recall | Final Precision | Primary Metric | Human Review | Invalid Decision |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| react | 390.000 | 0.887 | 0.997 | 0.909 | 0.917 | 0.814 | 0.796 | 0.615 | 0.003 | 0.000 |
| edl | 390.000 | 0.854 | 0.997 | 0.932 | 0.932 | 0.890 | 0.795 | 0.685 | 0.526 | 0.003 |
