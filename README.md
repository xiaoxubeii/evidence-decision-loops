# Evidence Decision Loops (EDL)

This repository contains the reference implementation, benchmark, and reproducibility resources for **Evidence Decision Loops (EDL)**: an evidence-decision protocol for record-level, structurally auditable LLM-supported biomedical reasoning.

The repository accompanies the EDL manuscript and includes source-native benchmark records, controller and scoring code, prompts and schemas, saved traces, result summaries, figures, and manuscript materials.

## What EDL Evaluates

EDL structures a record-scoped evidence loop in which a system seeks or receives evidence, records its evidence state, validates cited identifiers and process fields, and routes unresolved records for review. The evaluated controller implementation is compared with Direct, chain-of-thought, and ReAct workflows on public-source biomedical benchmark records from SciFact, PubMedQA, and NLI4CT.

The main evaluation is restricted to an audit-evaluable benchmark cohort. Its primary endpoint is **benchmark-defined answer-and-evidence binding**: a submitted decision must be correct, cite valid identifiers, and cover the required evidence segments. Structural citation validity and process validity do not independently establish citation entailment, substantive evidence sufficiency, gap/conflict correctness, clinical safety, or deployment readiness.

## Intended Use

EDL is intended for pre-deployment evaluation and research-stage audits of LLM-supported biomedical evidence reasoning operating on a record-scoped evidence corpus. It is not a diagnostic, treatment-recommendation, patient-ranking, or autonomous clinical-decision system. Review-routing signals require qualified human assessment.

## Repository Contents

- `data/`: canonical benchmark JSONL files and construction manifests.
- `results/`: saved model traces, primary and supplementary result summaries, bootstrap artifacts, and component-ablation outputs.
- `src/` and `scripts/`: controller, scoring, benchmark, audit, and analysis code.
- `src/prompts/` and `src/schema/`: prompts and record, trace, and output schemas.
- `figures/`: manuscript figure assets and source data.
- `manuscript/`: manuscript source, PDF, and supplementary materials.
- `human_audit/`: blinded expert-audit protocol, assignments, anonymized stimuli, and permitted derived exports. Raw expert-response data and direct identifiers are access controlled.
- `docs/`: artifact manifest, data dictionary, and reproduction guidance.

## Reproducibility

The fixed reproducibility target for the current manuscript is the [v0.2.1 release](https://github.com/xiaoxubeii/evidence-decision-loops/releases/tag/v0.2.1), not the mutable `main` branch. Its release assets include the final manuscript source package, PDF, TeX source, supplementary material, and `SHA256SUMS-v0.2.1.txt` checksum manifest.

```bash
npm install
npm run validate
```

Saved traces and result summaries permit inspection of manuscript results without rerunning paid model APIs. Re-running live provider calls requires credentials and may yield different outputs as provider-side models change.

The evidence-seeking environment is record scoped: `search_segments` searches only the fixed evidence library attached to each record, and `read_segment` opens frozen segment text by `documentId` and `segmentId`.

## Human-Audit Materials

The repository documents the blinded clinical-expert audit design and provides permitted study materials for reproducibility. The audit uses selected benchmark report classes; its descriptive rating-level results characterize conditional interception patterns in that sample rather than overall error prevalence, prospective reviewer effectiveness, or clinical safety. Raw expert-response records, access links, event logs, and direct identifiers are not publicly distributed. Requests for deidentified rating data and corresponding audit-analysis outputs may be directed to the corresponding author through the manuscript submission contact and are considered under the ethics determination and institutional data-governance requirements.

## Citation

Use the repository's `CITATION.cff` file and cite the fixed v0.2.1 release for the current manuscript analyses.

## License

Code is released under the MIT License. Data, manuscript materials, figures, and documentation are released under Creative Commons Attribution 4.0 International unless source-dataset terms require otherwise. See `docs/DATA_DICTIONARY.md` for provenance notes.
