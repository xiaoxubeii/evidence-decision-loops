"use strict";

function analyzeResponses({ stimuli, responses }) {
  const stimuliById = new Map(stimuli.map((stimulus) => [stimulus.stimulusId, stimulus]));
  const finalResponses = latestResponses(responses);
  const enriched = finalResponses.map((response) => ({ ...response, stimulus: stimuliById.get(response.stimulusId) })).filter((item) => item.stimulus);
  const byMethod = {};
  for (const method of ["react", "edl"]) {
    const rows = enriched.filter((item) => item.stimulus.hiddenMethod === method);
    const errorRows = rows.filter((item) => isErrorStimulus(item.stimulus));
    const intercepted = errorRows.filter((item) => item.acceptability === "intercept" || item.acceptability === "return");
    const unsafeAccepted = errorRows.filter((item) => item.acceptability === "accept");
    byMethod[method] = {
      responses: rows.length,
      errorCases: errorRows.length,
      errorIntercepted: intercepted.length,
      errorInterceptionRate: rate(intercepted.length, errorRows.length),
      unsafeAccepted: unsafeAccepted.length,
      unsafeAcceptanceRate: rate(unsafeAccepted.length, errorRows.length),
      meanTimeSeconds: mean(rows.map((item) => Number(item.clientElapsedMs) / 1000)),
      meanConfidence: mean(rows.map((item) => Number(item.confidence))),
      meanCognitiveLoad: mean(rows.map((item) => Number(item.cognitiveLoad))),
    };
  }
  const agreement = computeAgreement(enriched);
  return {
    generatedAt: new Date().toISOString(),
    totalResponses: finalResponses.length,
    byMethod,
    agreement,
    markdown: renderMarkdown({ byMethod, agreement, totalResponses: finalResponses.length }),
  };
}

function latestResponses(responses) {
  const latest = new Map();
  for (const [index, response] of responses.entries()) {
    const key = response.assignmentId || `row-${index}`;
    latest.set(key, response);
  }
  return Array.from(latest.values());
}

function isErrorStimulus(stimulus) {
  return !(stimulus.decisionCorrect === true && stimulus.primaryMetric === 1);
}

function computeAgreement(enriched) {
  const byRaterPair = {};
  const byStimulus = groupBy(enriched, (item) => item.stimulusId);
  let pairedStimuli = 0;
  for (const rows of Object.values(byStimulus)) {
    if (rows.length < 2) continue;
    pairedStimuli += 1;
    const sorted = rows.slice().sort((a, b) => a.raterId.localeCompare(b.raterId));
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const key = `${sorted[i].raterId}|${sorted[j].raterId}`;
        byRaterPair[key] = byRaterPair[key] || { a: [], b: [] };
        byRaterPair[key].a.push(sorted[i].acceptability);
        byRaterPair[key].b.push(sorted[j].acceptability);
      }
    }
  }
  const pairwise = Object.entries(byRaterPair).map(([raterPair, ratings]) => ({
    raterPair,
    n: ratings.a.length,
    kappa: cohenKappa(ratings.a, ratings.b),
  }));
  return {
    pairedStimuli,
    pairwise,
    meanPairwiseKappa: mean(pairwise.map((item) => item.kappa)),
  };
}

function cohenKappa(a, b) {
  if (a.length !== b.length) throw new Error("Rating arrays must have equal length");
  if (a.length === 0) return null;
  const labels = Array.from(new Set(a.concat(b)));
  const observed = a.filter((value, index) => value === b[index]).length / a.length;
  let expected = 0;
  for (const label of labels) {
    const pa = a.filter((value) => value === label).length / a.length;
    const pb = b.filter((value) => value === label).length / b.length;
    expected += pa * pb;
  }
  if (expected === 1) return observed === 1 ? 1 : 0;
  return (observed - expected) / (1 - expected);
}

function renderMarkdown({ byMethod, agreement, totalResponses }) {
  const lines = [];
  lines.push("# Human Auditability Results");
  lines.push("");
  lines.push(`Total responses: ${totalResponses}`);
  lines.push("");
  lines.push("| Method | Responses | Error cases | Error intercepted | Unsafe accepted | Mean time (s) | Confidence | Cognitive load |");
  lines.push("|---|---:|---:|---:|---:|---:|---:|---:|");
  for (const method of ["react", "edl"]) {
    const row = byMethod[method];
    lines.push(
      `| ${method} | ${row.responses} | ${row.errorCases} | ${formatRate(row.errorInterceptionRate)} | ${formatRate(row.unsafeAcceptanceRate)} | ${formatNumber(row.meanTimeSeconds)} | ${formatNumber(row.meanConfidence)} | ${formatNumber(row.meanCognitiveLoad)} |`
    );
  }
  lines.push("");
  lines.push(`Paired-stimulus agreement count: ${agreement.pairedStimuli}`);
  lines.push(`Mean pairwise kappa: ${formatNumber(agreement.meanPairwiseKappa)}`);
  return `${lines.join("\n")}\n`;
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function mean(values) {
  const finite = values.filter((value) => Number.isFinite(value));
  if (finite.length === 0) return null;
  return finite.reduce((sum, value) => sum + value, 0) / finite.length;
}

function rate(numerator, denominator) {
  return denominator === 0 ? null : numerator / denominator;
}

function formatNumber(value) {
  return value == null ? "n/a" : value.toFixed(3);
}

function formatRate(value) {
  return value == null ? "n/a" : `${(value * 100).toFixed(1)}%`;
}

module.exports = {
  analyzeResponses,
  cohenKappa,
  latestResponses,
};
