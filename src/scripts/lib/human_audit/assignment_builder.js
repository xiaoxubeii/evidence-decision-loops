"use strict";

const { shuffleStable } = require("./random");

function buildAllRatersBalancedAssignments({
  stimuli,
  raterIds,
  seed,
  ratersPerFormatPerCase,
}) {
  if (!Array.isArray(raterIds) || raterIds.length < 2) {
    throw new Error("At least two raters are required for a balanced audit study");
  }
  const ratersPerFormat =
    ratersPerFormatPerCase == null ? raterIds.length / 2 : Number(ratersPerFormatPerCase);
  if (!Number.isInteger(ratersPerFormat) || ratersPerFormat <= 0 || ratersPerFormat >= raterIds.length) {
    throw new Error("ratersPerFormatPerCase must be an integer between 1 and raterCount - 1");
  }

  const stimuliByCase = groupBy(stimuli, (stimulus) => stimulus.caseId);
  const sortedCaseIds = shuffleStable(Object.keys(stimuliByCase).sort(), `${seed}:balanced-case-order`);
  const reactGroups = buildBalancedReactGroups({
    caseCount: sortedCaseIds.length,
    raterCount: raterIds.length,
    groupSize: ratersPerFormat,
    seed,
  });
  const assignments = [];

  for (let caseIndex = 0; caseIndex < sortedCaseIds.length; caseIndex += 1) {
    const caseId = sortedCaseIds[caseIndex];
    const caseStimuli = stimuliByCase[caseId] || [];
    const reactStimulus = caseStimuli.find((stimulus) => stimulus.hiddenMethod === "react");
    const edlStimulus = caseStimuli.find((stimulus) => stimulus.hiddenMethod === "edl");
    if (!reactStimulus || !edlStimulus) throw new Error(`Expected react and edl stimuli for case ${caseId}`);
    const reactRaterIndexes = reactGroups[caseIndex];
    for (let raterIndex = 0; raterIndex < raterIds.length; raterIndex += 1) {
      addAssignment(assignments, raterIds[raterIndex], reactRaterIndexes.has(raterIndex) ? reactStimulus : edlStimulus);
    }
  }

  return orderAssignments(assignments, raterIds, seed);
}

function buildBalancedReactGroups({ caseCount, raterCount, groupSize, seed }) {
  if (caseCount % 2 === 0 && groupSize * 2 === raterCount) {
    return buildComplementPairGroups({ caseCount, raterCount, groupSize, seed });
  }
  return buildGreedyReactGroups({ caseCount, raterCount, groupSize, seed });
}

function buildComplementPairGroups({ caseCount, raterCount, groupSize, seed }) {
  const allMasks = combinations(raterCount, groupSize).map(indexesToMask);
  const fullMask = (1 << raterCount) - 1;
  const pairs = [];
  const seen = new Set();
  for (const mask of allMasks) {
    if (seen.has(mask)) continue;
    const complement = fullMask ^ mask;
    seen.add(mask);
    seen.add(complement);
    pairs.push([mask, complement].sort((a, b) => a - b));
  }
  const pairCount = caseCount / 2;
  if (pairs.length < pairCount) {
    throw new Error(`Insufficient complementary rater groups for ${caseCount} cases`);
  }
  const selectedPairs = shuffleStable(pairs, `${seed}:balanced-complement-pairs`).slice(0, pairCount);
  const masks = shuffleStable(selectedPairs.flat(), `${seed}:balanced-complement-order`);
  return masks.map(maskToIndexesSet);
}

function buildGreedyReactGroups({ caseCount, raterCount, groupSize, seed }) {
  const targetPerRater = (caseCount * groupSize) / raterCount;
  const groups = shuffleStable(combinations(raterCount, groupSize), `${seed}:balanced-greedy-groups`);
  const counts = Array(raterCount).fill(0);
  const selected = [];
  for (let caseIndex = 0; caseIndex < caseCount; caseIndex += 1) {
    let best = null;
    let bestScore = Infinity;
    for (const group of groups) {
      const projected = counts.slice();
      for (const index of group) projected[index] += 1;
      const score = projected.reduce((sum, count) => sum + Math.pow(count - targetPerRater, 2), 0);
      if (score < bestScore) {
        best = group;
        bestScore = score;
      }
    }
    for (const index of best) counts[index] += 1;
    selected.push(new Set(best));
  }
  return selected;
}

function combinations(count, choose) {
  const result = [];
  function visit(start, picked) {
    if (picked.length === choose) {
      result.push(picked.slice());
      return;
    }
    for (let index = start; index < count; index += 1) {
      picked.push(index);
      visit(index + 1, picked);
      picked.pop();
    }
  }
  visit(0, []);
  return result;
}

function indexesToMask(indexes) {
  return indexes.reduce((mask, index) => mask | (1 << index), 0);
}

function maskToIndexesSet(mask) {
  const indexes = new Set();
  let index = 0;
  while ((1 << index) <= mask) {
    if (mask & (1 << index)) indexes.add(index);
    index += 1;
  }
  return indexes;
}

function addAssignment(assignments, raterId, stimulus) {
  assignments.push({
    assignmentId: `asg_${raterId}_${stimulus.stimulusId}`,
    raterId,
    stimulusId: stimulus.stimulusId,
    caseId: stimulus.caseId,
    phase: stimulus.phase || "main",
    order: 0,
  });
}

function orderAssignments(assignments, raterIds, seed) {
  const ordered = [];
  for (const raterId of raterIds) {
    const shuffled = shuffleStable(
      assignments.filter((assignment) => assignment.raterId === raterId),
      `${seed}:${raterId}:order`
    );
    shuffled.forEach((assignment, index) => {
      ordered.push({
        ...assignment,
        assignmentId: `asg_${raterId}_${String(index + 1).padStart(4, "0")}`,
        order: index + 1,
      });
    });
  }
  return ordered;
}

function groupBy(items, keyFn) {
  return items.reduce((groups, item) => {
    const key = keyFn(item);
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

module.exports = { buildAllRatersBalancedAssignments };
