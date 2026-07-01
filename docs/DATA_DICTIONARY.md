# Data Dictionary and Provenance Notes

## Benchmark Files

| File | Description |
| --- | --- |
| `data/canonical_main_390.jsonl` | Main evaluation benchmark with 390 audit-retained records from SciFact, PubMedQA, and NLI4CT. |
| `data/canonical_main_390_manifest.json` | Construction manifest for the main evaluation dataset. |
| `data/scifact135_ablation_subset.jsonl` | SciFact subset used in EDL component-ablation analyses. |

Each JSONL record contains source metadata, a source-native statement or question, allowed decisions, source-native gold decision, source documents, segment-level evidence text, and required evidence identifiers.

## Result Files

| Path | Description |
| --- | --- |
| `results/live-comparison-v4-main-three-source-canonical-nli4ct-frozen-evidence-full/` | Main given-evidence traces and scores. |
| `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/` | Main evidence-seeking traces and scores. |
| `results/live-comparison-v4-minimax-m3-canonical-nli4ct-frozen-evidence-full/` | MiniMax-M3 given-evidence supplementary traces and scores. |
| `results/live-comparison-v4-minimax-m3-canonical-nli4ct-evidence-seeking-react-edl-full/` | MiniMax-M3 evidence-seeking supplementary traces and scores. |
| `results/edl-ablation-*` | Component-ablation outputs for EDL variants. |

## Human-Audit Materials

| File | Description |
| --- | --- |
| `human_audit/study.json` | Study-bundle metadata for the ongoing blind human-audit protocol. |
| `human_audit/stimuli.json` | Anonymized case materials used by the protocol. |
| `human_audit/assignments.json` | Planned assignment structure. |

Private study administration files, response logs, event logs, and expert access links are intentionally excluded.

## Source Dataset Notes

This artifact package uses public-source biomedical evidence resources and preserves source-native labels and evidence annotations. Users should consult the original SciFact, PubMedQA, and NLI4CT publications and licenses before redistributing derivative datasets outside this reproducibility context.
