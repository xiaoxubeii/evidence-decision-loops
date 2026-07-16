# Evidence Decision Loops (EDL)

This repository contains the reference implementation, benchmark, and reproducibility resources for **Evidence Decision Loops (EDL)**: an evidence-decision protocol for record-level, structurally auditable LLM-supported biomedical reasoning.

The main evaluation uses an audit-evaluable public benchmark cohort and evaluates **benchmark-defined answer-and-evidence binding**. Structural citation and process validity do not independently establish citation entailment, substantive evidence sufficiency, gap/conflict correctness, clinical safety, or deployment readiness.

## Intended Use

EDL is intended for pre-deployment evaluation and research-stage audits of LLM-supported biomedical evidence reasoning operating on a record-scoped evidence corpus. It is not a diagnostic, treatment-recommendation, patient-ranking, or autonomous clinical-decision system. Review-routing signals require qualified human assessment.

## Reproducibility

The fixed reproducibility target for the current manuscript is the [v0.2.6 release](https://github.com/xiaoxubeii/evidence-decision-loops/releases/tag/v0.2.6), not the mutable `main` branch. Its release assets include the English manuscript PDF/TeX, supplementary-materials PDF/TeX, the final source package, the submission ZIP, and `SHA256SUMS-v0.2.6.txt`.

The supplementary-materials TeX source uses page-width-constrained `adjustbox` tables and compiles with XeLaTeX in landscape layout.

```bash
npm install
npm run validate
```

Saved traces and result summaries permit inspection of manuscript results without rerunning paid model APIs. Re-running live provider calls requires credentials and may yield different outputs as provider-side models change.

## Human-Audit Materials

The repository documents the blinded clinical-expert audit design and provides permitted study materials for reproducibility. The audit uses selected benchmark report classes; its descriptive rating-level results characterize conditional interception patterns in that sample rather than overall error prevalence, prospective reviewer effectiveness, or clinical safety. Raw expert-response records, access links, event logs, and direct identifiers are not publicly distributed. Requests for deidentified rating data and corresponding audit-analysis outputs may be directed to the corresponding author through the manuscript submission contact and are considered under the ethics determination and institutional data-governance requirements.

## Citation

Use the repository's `CITATION.cff` file and cite the fixed v0.2.6 release for the current manuscript analyses.
