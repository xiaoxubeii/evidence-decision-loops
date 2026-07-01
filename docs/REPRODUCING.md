# Reproducing the Reported Analyses

This document describes the recommended verification path for the EviAgent JBI artifact package.

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

EDL component-ablation summaries are available in:

- `results/edl-ablation-scifact-nli4ct-component-summary.md`
- `results/edl-ablation-scifact-nli4ct-component-summary.json`

The underlying ablation trace directories for SciFact and NLI4CT subsets are included under `results/edl-ablation-*`.

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
