# Artifact Manifest

## Core Data

- `data/canonical_main_390.jsonl`
- `data/canonical_main_390_manifest.json`
- `data/scifact135_ablation_subset.jsonl`

## Code

- `src/scripts/run_live_comparison_v4.js`
- `src/scripts/run_v4_llm_audit.js`
- `src/scripts/build_v4_main_three_source_canonical_nli4ct_results.js`
- `src/scripts/build_v4_minimax_canonical_nli4ct_results.js`
- `src/scripts/analyze_edl_component_ablation.js`
- `src/scripts/build_human_audit_study.js`
- `src/scripts/serve_human_audit_study.js`
- `src/scripts/analyze_human_audit_study.js`
- `src/scripts/lib/`

## Prompts and Schemas

- `src/prompts/`
- `src/schema/`

## Main Results

- `results/live-comparison-v4-main-three-source-canonical-nli4ct-dual-setting-summary.md`
- `results/live-comparison-v4-main-three-source-canonical-nli4ct-frozen-evidence-full/`
- `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/`

## Supplementary Results

- `results/live-comparison-v4-minimax-m3-canonical-nli4ct-dual-setting-summary.md`
- `results/live-comparison-v4-minimax-m3-canonical-nli4ct-dual-setting-summary.json`
- `results/live-comparison-v4-minimax-m3-canonical-nli4ct-frozen-evidence-full/`
- `results/live-comparison-v4-minimax-m3-canonical-nli4ct-evidence-seeking-react-edl-full/`
- `results/edl-ablation-scifact-nli4ct-component-summary.md`
- `results/edl-ablation-scifact-nli4ct-component-summary.json`
- `results/edl-ablation-*`

## Manuscript and Figures

- `manuscript/EviAgent_JBI_manuscript_english_draft.tex`
- `manuscript/EviAgent_JBI_manuscript_english_draft.pdf`
- `manuscript/EviAgent_JBI_supplementary_materials_english_draft.md`
- `figures/`

## Intentionally Excluded

- API keys, `.env` files, provider tokens, and local credential files.
- `node_modules/`.
- Private human-audit administration files.
- Expert response files and event logs.
- Historical smoke-test and intermediate experiment directories not reported in the manuscript.
