# EDL component ablation used in Supplementary Table S18

This artifact records the final source paths, configurations, and values used in Supplementary Table S18. Full EDL rows are references reused from the main evidence-seeking experiment; they did not trigger additional model inference. Each feature-removal row contains one completed output per record, and repeated-run variability was not estimated.

## SciFact

- Dataset: `src/data/react-clinical-source-v4-agree-scifact-135.jsonl`
- Records: 135
- Full reference: `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-results.json`
- Variant configuration: `gpt-5.5`; `reasoningEffort=medium`; BM25; controller-fixed `topK=5`; maximum evidence rounds 3; minimum evidence rounds 2; minimum viewed segments before sufficiency 3; citation self-check off.

| Variant | Result path | Traces | Accuracy | Primary metric | Required recall | Required precision | Citation identifier validity | Review rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Full EDL reference | `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-results.json` | 135 | 0.948 | 0.874 | 0.933 | 0.608 | 1.000 | 0.385 |
| Without iterative seeking | `results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-iterative/live-comparison-v4-results.json` | 135 | 0.933 | 0.785 | 0.822 | 0.602 | 1.000 | 0.481 |
| Without sufficiency assessment | `results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-sufficiency/live-comparison-v4-results.json` | 135 | 0.948 | 0.815 | 0.870 | 0.637 | 0.985 | 0.015 |
| Without citation validation | `results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-citation-validation/live-comparison-v4-results.json` | 135 | 0.941 | 0.059 | 0.067 | 0.731 | 0.067 | 0.948 |

## NLI4CT

- Dataset: `src/data/react-clinical-source-v4-nli4ct-fulltrial-rawline-audited-main.jsonl`
- Records: 130
- Full reference: `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-results.json`
- Variant configuration: the source-specific NLI4CT component configuration, including source-aware query planning, BM25 neighbor expansion, and controller-fixed `topK=5`. Citation self-check was retained except in the no-citation-validation variant. In that variant, the cited-identifier output rule and citation-error validation/repair gate were disabled; post-submission benchmark scoring still calculated citation-identifier validity.

| Variant | Result path | Traces | Accuracy | Primary metric | Required recall | Required precision | Citation identifier validity | Review rate |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Full EDL reference | `results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-results.json` | 130 | 0.923 | 0.538 | 0.768 | 0.864 | 1.000 | 0.300 |
| Without iterative seeking | `results/edl-ablation-nli4ct130-no-iterative-seeking/live-comparison-v4-results.json` | 130 | 0.869 | 0.423 | 0.691 | 0.852 | 1.000 | 0.385 |
| Without sufficiency assessment | `results/edl-ablation-nli4ct130-no-sufficiency-assessment/live-comparison-v4-results.json` | 130 | 0.931 | 0.577 | 0.777 | 0.877 | 1.000 | 0.000 |
| Without citation validation | `results/edl-ablation-nli4ct130-no-citation-validation/live-comparison-v4-results.json` | 130 | 0.923 | 0.115 | 0.144 | 0.801 | 0.200 | 0.831 |

The SciFact variants were executed after the Full reference run. These single-output comparisons do not estimate temporal or stochastic model-service drift. SciFact and NLI4CT used source-specific runtime configurations, so the rows are interpreted within source rather than pooled as one uniform cross-source experiment.
