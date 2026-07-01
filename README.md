# EviAgent Evidence Decision Loop Artifacts

This repository contains the data, code, prompts, schemas, results, manuscript files, and protocol materials supporting the manuscript:

**Evidence Decision Loops: A Biomedical Informatics Method for Auditable AI Agent Decisions**

The package is intended to support peer review and reproducibility for the Journal of Biomedical Informatics submission. It includes the canonical benchmark records used in the main analyses, precomputed model traces and result summaries, EDL controller/scoring code, prompt and schema files, manuscript source, and an ongoing blind human-audit protocol bundle.

## What Is Included

- `data/`: canonical benchmark JSONL files and construction manifest.
- `results/`: main `gpt-5.5` traces/results, MiniMax-M3 supplementary traces/results, and EDL component-ablation outputs.
- `src/scripts/`: EDL controller, scoring, trace metrics, benchmark runners, and human-audit protocol scripts.
- `src/prompts/`: method prompts used by Direct, CoT, ReAct, and EDL.
- `src/schema/`: benchmark, trace, and output schemas.
- `figures/`: manuscript figure assets and source data.
- `manuscript/`: English manuscript TeX/PDF and supplementary-material draft.
- `human_audit/`: ongoing blind human-audit protocol materials. This directory does not include completed expert-response outcome data.
- `docs/`: artifact manifest, data dictionary, and reproduction guide.

## Quick Start

Install Node dependencies:

```bash
npm install
```

Run the release sanity check:

```bash
npm run validate
```

Inspect the main result summaries:

```bash
cat results/live-comparison-v4-main-three-source-canonical-nli4ct-dual-setting-summary.md
cat results/live-comparison-v4-minimax-m3-canonical-nli4ct-dual-setting-summary.md
cat results/edl-ablation-scifact-nli4ct-component-summary.md
```

## Reproducibility Notes

The repository includes precomputed traces and result summaries so that manuscript tables and figures can be checked without re-running paid model APIs. Re-running live model comparisons requires provider credentials and may produce small changes if provider-side model implementations change.

The evidence-seeking tools are record-scoped: `search_segments` searches only the fixed evidence library attached to each benchmark record, and `read_segment` opens frozen segment text by `documentId` and `segmentId`.

## Human-Audit Status

The blind human-audit component is ongoing. This repository includes protocol and study-bundle materials for transparency, but it does not report or include completed expert-response outcomes, inter-rater reliability, or human-subjects effect estimates.

Private study administration files, expert access links, event logs, and response files are intentionally excluded.

## Citation

If this repository is used, cite the manuscript and archived release. A `CITATION.cff` file is included for citation managers.

## License

Code is released under the MIT License. Data, manuscript materials, figures, and documentation are released under Creative Commons Attribution 4.0 International unless a source dataset imposes additional restrictions. See `docs/DATA_DICTIONARY.md` for provenance notes.
