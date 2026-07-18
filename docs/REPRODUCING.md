# Reproducing the Reported Analyses

This document describes the recommended verification path for the Evidence Decision Loops JBI artifact package.

## 1. Install Dependencies

```bash
npm install
```

## 2. Validate Package Integrity

```bash
npm run validate
```

The validation script checks that expected data, result, manuscript, prompt, schema, and human-audit protocol files are present and that intentionally excluded private human-audit files are absent.

## 3. Check Main Automated Results

The main `gpt-5.5` results are precomputed in:

- `results/live-comparison-v4-main-three-source-canonical-nli4ct-frozen-evidence-full/`
- `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/`
- `results/live-comparison-v4-main-three-source-canonical-nli4ct-dual-setting-summary.md`

The summary file corresponds to the manuscript's main automated evaluation.

## 4. Check Supplementary Model Results

MiniMax-M3 supplementary results are precomputed in:

- `results/live-comparison-v4-minimax-m3-canonical-nli4ct-frozen-evidence-full/`
- `results/live-comparison-v4-minimax-m3-canonical-nli4ct-evidence-seeking-react-edl-full/`
- `results/live-comparison-v4-minimax-m3-canonical-nli4ct-dual-setting-summary.md`

These results are treated as a cross-model check, not as a replacement for the primary model evaluation.

## 5. Check Component Ablations

The final EDL component-ablation summary used for Supplementary Table S18 is available in:

- `results/edl-ablation-s18-final-summary.md`
- `results/edl-ablation-s18-final-summary.json`

The summary lists the exact main-run Full references and the underlying SciFact and NLI4CT feature-removal trace directories. The updated SciFact variants are stored under `results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-*`. Older component summaries remain only as historical artifacts and are not the source for Supplementary Table S18.

## 6. Re-running Live Model Comparisons

Live re-runs require model-provider credentials and may incur API costs. The primary runner is:

```bash
node src/scripts/run_live_comparison_v4.js --help
```

For reproducibility, prefer comparing against the included precomputed trace files unless a deliberate live replication is planned.

## 7. Human-Audit Protocol

The human-audit protocol is ongoing. Protocol materials are included under `human_audit/`, and supporting code is in:

- `src/scripts/build_human_audit_study.js`
- `src/scripts/serve_human_audit_study.js`
- `src/scripts/analyze_human_audit_study.js`
- `src/scripts/lib/human_audit/`

No completed expert-response outcomes are included in this release.
