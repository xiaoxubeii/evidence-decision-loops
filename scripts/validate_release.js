"use strict";

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");

const required = [
  "README.md",
  "LICENSE",
  "CITATION.cff",
  "data/canonical_main_390.jsonl",
  "data/canonical_main_390_manifest.json",
  "data/scifact135_ablation_subset.jsonl",
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-dual-setting-summary.md",
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-frozen-evidence-full/live-comparison-v4-results.json",
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-frozen-evidence-full/live-comparison-v4-traces.jsonl",
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-results.json",
  "results/live-comparison-v4-main-three-source-canonical-nli4ct-evidence-seeking-full/live-comparison-v4-traces.jsonl",
  "results/live-comparison-v4-minimax-m3-canonical-nli4ct-dual-setting-summary.md",
  "results/edl-ablation-s18-final-summary.md",
  "results/edl-ablation-s18-final-summary.json",
  "results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-iterative/live-comparison-v4-results.json",
  "results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-iterative/live-comparison-v4-traces.jsonl",
  "results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-sufficiency/live-comparison-v4-results.json",
  "results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-sufficiency/live-comparison-v4-traces.jsonl",
  "results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-citation-validation/live-comparison-v4-results.json",
  "results/edl-ablation-scifact135-s14-medium-bm25-topk5-no-selfcheck-no-citation-validation/live-comparison-v4-traces.jsonl",
  "human_audit/study.json",
  "human_audit/stimuli.json",
  "human_audit/assignments.json",
  "src/scripts/run_live_comparison_v4.js",
  "src/scripts/lib/v4_edl_controller.js",
  "src/scripts/lib/v4_source_scorer.js",
  "src/scripts/lib/v4_tool_runtime.js",
  "src/prompts/v4_method_edl.md",
  "src/schema/react-clinical-source-v4.schema.json",
  "manuscript/EDL_JBI_manuscript_en.tex",
  "manuscript/EDL_JBI_manuscript_en.pdf",
  "manuscript/EDL_JBI_supplementary_materials_en.tex",
  "manuscript/EDL_JBI_supplementary_materials_en.pdf",
  "docs/ARTIFACT_MANIFEST.md",
  "docs/DATA_DICTIONARY.md",
  "docs/REPRODUCING.md"
];

const forbidden = [
  ".env",
  ".env.local",
  "human_audit/private/admin.json",
  "human_audit/private/raters.json",
  "human_audit/private/responses.jsonl",
  "human_audit/private/events.jsonl",
  "human_audit/expert-access-links.csv",
  "human_audit/expert-access-links.xlsx"
];

const secretPatterns = [
  /sk-[A-Za-z0-9_-]{20,}/,
  /ghp_[A-Za-z0-9_]{20,}/,
  /OPENAI_API_KEY\s*=/,
  /ANTHROPIC_API_KEY\s*=/,
  /MINIMAX_API_KEY\s*=/
];

function exists(rel) {
  return fs.existsSync(path.join(root, rel));
}

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    if (entry.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const errors = [];

for (const rel of required) {
  if (!exists(rel)) errors.push(`missing required file: ${rel}`);
}

for (const rel of forbidden) {
  if (exists(rel)) errors.push(`forbidden file present: ${rel}`);
}

for (const file of walk(root)) {
  const stat = fs.statSync(file);
  if (stat.size > 8 * 1024 * 1024) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const pattern of secretPatterns) {
    if (pattern.test(text)) {
      errors.push(`possible secret pattern in ${path.relative(root, file)}`);
      break;
    }
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log("release package validation passed");
