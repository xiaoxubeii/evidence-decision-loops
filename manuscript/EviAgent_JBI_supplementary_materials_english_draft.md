# Supplementary Materials for "Evidence Decision Loops"

Updated: 2026-07-01

This draft supplement supports the English JBI manuscript. It contains dataset composition, trace completeness, full metric matrices, schema and prompt indexes, supplementary model and ablation results, blind human-audit protocol status, and reproducibility paths.

## Supplementary Table S1. Source composition of candidate, main evaluation, and audit-excluded records

| Split | Records | SciFact | PubMedQA | NLI4CT | Required evidence segments |
| --- | ---: | ---: | ---: | ---: | ---: |
| Candidate set | 460 | 150 | 150 | 160 | 1635 |
| Main evaluation set | 390 | 135 | 125 | 130 | 1413 |
| Audit-excluded or review-queue records | 70 | 15 | 25 | 30 | 222 |

## Supplementary Table S2. Source-label distribution

| Source | Label | Candidate set | Main evaluation set |
| --- | --- | ---: | ---: |
| SciFact | SUPPORT | 50 | 42 |
| SciFact | CONTRADICT | 50 | 44 |
| SciFact | NEI | 50 | 49 |
| PubMedQA | yes | 50 | 43 |
| PubMedQA | no | 50 | 43 |
| PubMedQA | maybe | 50 | 39 |
| NLI4CT | Entailment | 80 | 65 |
| NLI4CT | Contradiction | 80 | 65 |

## Supplementary Table S3. Main evaluation trace completeness

| Model | Setting | Expected traces | Observed traces | Methods | Invalid | Missing | Provider failures | Parse or fallback flags |
| --- | --- | ---: | ---: | --- | ---: | ---: | ---: | --- |
| `gpt-5.5` | Given evidence | 1560 | 1560 | direct,cot,react,edl | 0 | 0 | 0 | none |
| `gpt-5.5` | Evidence seeking | 780 | 780 | react,edl | 0 | 0 | 0 | forced_submit:83 |

## Supplementary Table S3a. Evaluation metric dictionary

| Metric | Scope and role | Definition |
| --- | --- | --- |
| Decision accuracy | All methods; final-label correctness | Exact agreement between the submitted decision and the source-native gold decision. |
| Primary metric | All methods; joint answer-and-evidence success | Binary record-level score equal to 1 only when the final decision is correct, citations are valid, and required evidence recall is 1. |
| Required evidence recall | All methods; evidence coverage | Proportion of gold required evidence segments covered by valid final citations. |
| Required evidence precision | All methods; citation specificity | Proportion of valid final citations that correspond to required evidence segments. |
| Citation validity | All methods; structural citation correctness | Whether every cited evidence segment exists in the current record and contains valid `documentId` and `segmentId` fields. |
| Search recall | Evidence-seeking setting; retrieval coverage | Proportion of required evidence segments returned by search outputs before reading. |
| Read recall | Evidence-seeking setting; inspected-evidence coverage | Proportion of required evidence segments opened by read tools or EDL inspection. |
| Process validity | EDL and process traces; audit conformance | Whether externally recorded process steps satisfy the evaluation protocol; hidden model reasoning is not scored. |
| Human review rate and reasons | EDL review routing; review-queue characterization | Proportion of records flagged for human review and the associated review reasons. |
| Invalid decision rate | All methods; output-contract failure | Proportion of submitted decisions outside the source-native allowed label space or not parseable as a final decision. |

## Supplementary Table S4. EDL review routing in the evidence-seeking setting

| Source | Traces | Review rate | Insufficient evidence | Forced source label | Material gap or conflict |
| --- | ---: | ---: | ---: | ---: | ---: |
| All | 390 | 0.285 | 101 | 49 | 23 |
| SciFact | 135 | 0.385 | 52 | 0 | 0 |
| PubMedQA | 125 | 0.160 | 20 | 20 | 0 |
| NLI4CT | 130 | 0.300 | 29 | 29 | 23 |

## Supplementary Table S5. SciFact evidence-seeking cross-model replication

| Model | Method | Traces | Accuracy | Primary metric | Required recall | Search recall | Read recall | Parse or fallback flags |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| `gpt-5.5` | ReAct | 135 | 0.993 | 0.859 | 0.874 | 0.000 | 0.985 | forced_submit:4 |
| `gpt-5.5` | EDL | 135 | 0.948 | 0.874 | 0.933 | 0.967 | 0.967 | none |
| MiniMax-M3 | ReAct | 135 | 0.904 | 0.800 | 0.900 | 0.937 | 0.941 | forced_submit:31 |
| MiniMax-M3 | EDL | 135 | 0.889 | 0.830 | 0.948 | 0.974 | 0.974 | none |

## Supplementary Table S6. Given-evidence results by required evidence segment count

| Method | Required evidence segments | Traces | Accuracy | Primary metric | Required evidence recall |
| --- | ---: | ---: | ---: | ---: | ---: |
| Direct | 1 | 250 | 0.856 | 0.788 | 0.932 |
| Direct | 2 | 42 | 0.976 | 0.524 | 0.762 |
| Direct | 3--5 | 54 | 0.981 | 0.241 | 0.634 |
| Direct | 6+ | 44 | 0.955 | 0.000 | 0.305 |
| CoT | 1 | 250 | 0.884 | 0.820 | 0.936 |
| CoT | 2 | 42 | 0.976 | 0.476 | 0.738 |
| CoT | 3--5 | 54 | 0.981 | 0.259 | 0.628 |
| CoT | 6+ | 44 | 0.932 | 0.000 | 0.371 |
| ReAct | 1 | 250 | 0.888 | 0.828 | 0.940 |
| ReAct | 2 | 42 | 0.976 | 0.619 | 0.798 |
| ReAct | 3--5 | 54 | 0.981 | 0.407 | 0.715 |
| ReAct | 6+ | 44 | 0.932 | 0.000 | 0.348 |
| EDL | 1 | 250 | 0.852 | 0.816 | 0.964 |
| EDL | 2 | 42 | 1.000 | 0.952 | 0.964 |
| EDL | 3--5 | 54 | 0.981 | 0.889 | 0.941 |
| EDL | 6+ | 44 | 0.955 | 0.318 | 0.735 |

## Supplementary Table S7. Evidence-seeking results by required evidence segment count

| Method | Required evidence segments | Traces | Accuracy | Primary metric | Required evidence recall | Search recall | Read recall |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| ReAct | 1 | 250 | 0.952 | 0.892 | 0.940 | 0.000 | 0.992 |
| ReAct | 2 | 42 | 0.952 | 0.571 | 0.690 | 0.095 | 0.821 |
| ReAct | 3--5 | 54 | 0.870 | 0.148 | 0.456 | 0.228 | 0.668 |
| ReAct | 6+ | 44 | 0.841 | 0.000 | 0.290 | 0.160 | 0.702 |
| EDL | 1 | 250 | 0.856 | 0.828 | 0.972 | 0.984 | 0.984 |
| EDL | 2 | 42 | 0.952 | 0.833 | 0.917 | 0.964 | 0.964 |
| EDL | 3--5 | 54 | 0.944 | 0.630 | 0.848 | 0.884 | 0.884 |
| EDL | 6+ | 44 | 0.886 | 0.182 | 0.535 | 0.705 | 0.705 |

## Supplementary Table S8. Schema and field-definition index

| Artifact | Path | Main role |
| --- | --- | --- |
| EDL decision record schema | `src/schema/decision-record.schema.json` | Defines benchmark record fields and prediction fields, including final decision, cited claims, cited evidence, claim evaluations, gaps, conflicts, and expert review. |
| Live comparison trace schema | `src/schema/live-comparison-trace.schema.json` | Defines trace-level fields including `recordId`, `method`, `model`, `reasoningEffort`, `promptSha256`, `steps`, `finalDecision`, `citedEvidenceIds`, `requiredHumanReview`, `edlGuard`, `processCheck`, and `scores`. |
| V4 audit output schema | `src/schema/react-clinical-source-v4-audit-output.schema.json` | Constrains LLM-audit outputs, including audit decision, suggested decision, confidence, rationale, and segment-level cited evidence. |
| Human audit study schema | `results/human-audit-scifact-nli4ct-balanced/study.json` | Records blind-audit sample size, source targets, rater count, seed, source data, and trace path. |

## Supplementary Table S9. Prompt and template index

| Method or stage | Path | Contract summary |
| --- | --- | --- |
| V4 base evidence contract | `src/prompts/v4_evidence_verification_base.md` | Use only frozen evidence; do not use external knowledge; final decision must be one of `allowedDecisions`; citations must include `documentId` and `segmentId`; return JSON only. |
| Direct | `src/prompts/v4_method_direct.md` | Read the record prompt and submit one JSON answer. |
| CoT | `src/prompts/v4_method_cot.md` | Use internal reasoning if needed, but return only final JSON. |
| ReAct | `src/prompts/v4_method_react.md` | Search before reading, continue when evidence is insufficient, and submit a JSON-compatible decision with segment-level citations. |
| EDL | `src/prompts/v4_method_edl.md` | Search, read, assess sufficiency, validate citations, repair invalid citations, and submit one final decision. |
| LLM-audit | `src/scripts/run_v4_llm_audit.js` | Judges whether source-native gold decisions are supported by frozen segment-level evidence and emits structured JSON. |

## Supplementary Table S10. LLM-audit filtering summary

| Source | Candidate records | Main inclusion rule | Included | Audit-excluded or review queue | Audit artifact |
| --- | ---: | --- | ---: | ---: | --- |
| SciFact | 150 | `auditDecision=agree` | 135 | 15 | `results/v4-llm-audit-full/v4-llm-audit-summary.md` |
| PubMedQA | 150 | `auditDecision=agree` | 125 | 25 | `results/v4-llm-audit-full/v4-llm-audit-summary.md` |
| NLI4CT | 160 | `includeInMain=true` | 130 | 30 | `results/v4-llm-audit-nli4ct-fulltrial-rawline-validation-160-full/v4-llm-audit-summary.md` |
| All | 460 | Unified LLM-audit and canonical dataset construction | 390 | 70 | `results/react-clinical-source-v4-main-three-source-canonical-nli4ct-manifest.json` |

The NLI4CT canonical audit over 160 records produced 138 agree, 11 disagree, and 11 uncertain audit decisions; 130 records were marked `includeInMain=true`. The audit recorded 24 partial-evidence cases, 16 granularity issues, and no material conflicts.

## Supplementary Table S11. Full given-evidence source x method x metric matrix

| Source | Method | Traces | Accuracy | Primary metric | Required recall | Required precision | Citation validity | Review rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SciFact | Direct | 135 | 0.948 | 0.800 | 0.859 | 0.645 | 0.985 | 0.015 |
| SciFact | CoT | 135 | 0.963 | 0.800 | 0.856 | 0.649 | 0.993 | 0.007 |
| SciFact | ReAct | 135 | 0.956 | 0.815 | 0.867 | 0.648 | 1.000 | 0.000 |
| SciFact | EDL | 135 | 0.963 | 0.881 | 0.922 | 0.621 | 1.000 | 0.415 |
| PubMedQA | Direct | 125 | 0.760 | 0.760 | 1.000 | 1.000 | 1.000 | 0.000 |
| PubMedQA | CoT | 125 | 0.800 | 0.800 | 1.000 | 1.000 | 1.000 | 0.000 |
| PubMedQA | ReAct | 125 | 0.816 | 0.816 | 1.000 | 1.000 | 1.000 | 0.000 |
| PubMedQA | EDL | 125 | 0.744 | 0.744 | 1.000 | 1.000 | 1.000 | 0.160 |
| NLI4CT | Direct | 130 | 0.977 | 0.223 | 0.551 | 0.917 | 1.000 | 0.000 |
| NLI4CT | CoT | 130 | 0.969 | 0.238 | 0.575 | 0.919 | 1.000 | 0.000 |
| NLI4CT | ReAct | 130 | 0.969 | 0.331 | 0.619 | 0.916 | 1.000 | 0.000 |
| NLI4CT | EDL | 130 | 0.977 | 0.723 | 0.886 | 0.786 | 1.000 | 0.154 |

## Supplementary Table S12. Full evidence-seeking source x method x metric matrix

| Source | Method | Traces | Accuracy | Primary metric | Final required recall | Required precision | Search recall | Read recall | Citation validity | Review rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| SciFact | ReAct | 135 | 0.993 | 0.859 | 0.874 | 0.643 | 0.000 | 0.985 | 1.000 | 0.000 |
| SciFact | EDL | 135 | 0.948 | 0.874 | 0.933 | 0.608 | 0.967 | 0.967 | 1.000 | 0.385 |
| PubMedQA | ReAct | 125 | 0.912 | 0.912 | 1.000 | 1.000 | 0.000 | 1.000 | 1.000 | 0.000 |
| PubMedQA | EDL | 125 | 0.768 | 0.768 | 1.000 | 1.000 | 1.000 | 1.000 | 1.000 | 0.160 |
| NLI4CT | ReAct | 130 | 0.877 | 0.192 | 0.449 | 0.727 | 0.180 | 0.703 | 0.992 | 0.008 |
| NLI4CT | EDL | 130 | 0.923 | 0.538 | 0.768 | 0.864 | 0.844 | 0.844 | 1.000 | 0.300 |

## Supplementary Table S13. MiniMax-M3 three-source supplementary evaluation

| Setting | Method | Traces | Accuracy | Primary metric | Required recall | Required precision | Search recall | Read recall | Citation validity | Review rate | Invalid decision |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Given evidence | Direct | 390 | 0.877 | 0.562 | 0.800 | 0.828 | n/a | n/a | 0.995 | 0.005 | 0.000 |
| Given evidence | CoT | 390 | 0.859 | 0.546 | 0.797 | 0.834 | n/a | n/a | 0.995 | 0.005 | 0.000 |
| Given evidence | ReAct | 390 | 0.864 | 0.562 | 0.816 | 0.819 | n/a | n/a | 0.997 | 0.003 | 0.000 |
| Given evidence | EDL | 390 | 0.874 | 0.718 | 0.906 | 0.785 | n/a | n/a | 0.992 | 0.469 | 0.000 |
| Evidence seeking | ReAct | 390 | 0.887 | 0.615 | 0.814 | 0.796 | 0.909 | 0.917 | 0.997 | 0.003 | 0.000 |
| Evidence seeking | EDL | 390 | 0.854 | 0.685 | 0.890 | 0.795 | 0.932 | 0.932 | 0.997 | 0.526 | 0.003 |

MiniMax-M3 is a supplementary evaluation and not a co-primary replacement for the `gpt-5.5` main evaluation.

## Supplementary Table S14. EDL component ablation matrix

| Source | Variant | Traces | Accuracy | Primary metric | Required recall | Required precision | Citation validity | Review rate | Main review reasons |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| SciFact | Full EDL | 135 | 0.956 | 0.837 | 0.889 | 0.603 | 1.000 | 0.400 | insufficient_evidence:54 |
| SciFact | Without iterative seeking | 135 | 0.933 | 0.726 | 0.785 | 0.611 | 1.000 | 0.474 | insufficient_evidence:63, material_conflict:2, material_gap:46 |
| SciFact | Without sufficiency assessment | 135 | 0.948 | 0.793 | 0.856 | 0.631 | 0.970 | 0.030 | invalid_citation:4 |
| SciFact | Without citation validation | 135 | 0.948 | 0.081 | 0.081 | 0.577 | 0.096 | 0.911 | insufficient_evidence:56, invalid_citation:122, material_conflict:1, material_gap:44, missing_citation:9 |
| NLI4CT | Full EDL | 130 | 0.923 | 0.538 | 0.768 | 0.864 | 1.000 | 0.300 | forced_source_label_without_abstain:29, insufficient_evidence:29, material_conflict:13, material_gap:10 |
| NLI4CT | Without iterative seeking | 130 | 0.869 | 0.423 | 0.691 | 0.852 | 1.000 | 0.385 | forced_source_label_without_abstain:44, insufficient_evidence:44, material_conflict:9, material_gap:23 |
| NLI4CT | Without sufficiency assessment | 130 | 0.931 | 0.577 | 0.777 | 0.877 | 1.000 | 0.000 | none |
| NLI4CT | Without citation validation | 130 | 0.923 | 0.115 | 0.144 | 0.801 | 0.200 | 0.831 | forced_source_label_without_abstain:34, insufficient_evidence:34, invalid_citation:104, material_conflict:13, material_gap:14 |

## Supplementary Table S15. Blind human-audit protocol and current status

| Item | Current value |
| --- | --- |
| Main protocol bundle | `results/human-audit-scifact-nli4ct-balanced/` |
| Created at | 2026-07-01T00:50:40.216Z |
| Random seed | `eviagent-human-audit-scifact-nli4ct-balanced-v1` |
| Sample size | 60 cases |
| Source stratification | 30 SciFact cases and 30 NLI4CT cases |
| Correct/error targets | 15 correct-target and 15 error-target cases per source |
| Planned raters | 8 raters (`RATER_A`--`RATER_H`) |
| Assignment mode | `all_raters_balanced` |
| Raters per case/format | 4 |
| Method anonymization | ReAct and EDL displayed as formats X/Y; method names hidden |
| Input data | `src/data/react-clinical-source-v4-main-three-source-canonical-nli4ct.jsonl` |
| Input traces | `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-traces.jsonl` |
| Current expert responses | Data collection is ongoing; no expert-response outcomes are reported in this draft |
| Reporting status | Protocol placeholder prepared; not a completed expert-result analysis |

An older SciFact-only pilot bundle exists in the working project but is not included in this release and is not used as the balanced blind human-audit result.

## Supplementary Table S16. Reproducibility paths and verification entry points

| Category | Path or command | Role |
| --- | --- | --- |
| Main dataset manifest | `results/react-clinical-source-v4-main-three-source-canonical-nli4ct-manifest.json` | Records main dataset composition, labels, required evidence distribution, and result paths. |
| Main dataset | `src/data/react-clinical-source-v4-main-three-source-canonical-nli4ct.jsonl` | Canonical three-source main dataset. |
| `gpt-5.5` given-evidence results | `results/live-comparison-v4-main-three-source-canonical-nli4ct-frozen-evidence-full/live-comparison-v4-results.json` | 390 records x 4 methods = 1560 traces. |
| `gpt-5.5` evidence-seeking results | `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-results.json` | 390 records x 2 methods = 780 traces. |
| Dual-setting main summary | `results/live-comparison-v4-main-three-source-canonical-nli4ct-dual-setting-summary.md` | Source for main given-evidence and evidence-seeking summaries. |
| MiniMax-M3 summary | `results/live-comparison-v4-minimax-m3-canonical-nli4ct-dual-setting-summary.md` | Three-source supplementary model evaluation. |
| EDL ablation summary | `results/edl-ablation-scifact-nli4ct-component-summary.md` | SciFact and NLI4CT component ablation. |
| Human audit build | `npm run human-audit:build` | Generates balanced blind-audit study bundle. |
| Human audit analysis | `npm run human-audit:analyze` | Exports human-audit results after expert responses are collected. |
| Repository tests | `npm test` | Project-level test entry point. |
| English draft compile | `cd content && pdflatex -interaction=nonstopmode -halt-on-error EviAgent_JBI_manuscript_english_draft.tex` | Compiles the English manuscript draft. |

Trace metadata note: main trace files retain `model` and `reasoningEffort` fields. The manuscript therefore describes the main analysis as the `gpt-5.5` evaluation and reports exact run metadata through the reproducibility package rather than asserting a single uniform reasoning-effort value for every merged trace.

## Remaining decisions before submission

- Whether to collect and report balanced blind human-audit expert responses. Until then, the human-audit component is a protocol appendix.
- Whether to add a small static one-shot BM25-RAG supplementary comparator. The current draft treats ReAct as the tool-using / agentic RAG baseline.
- Whether to add bootstrap confidence intervals or paired tests. The current draft reports descriptive paired evaluation results.
