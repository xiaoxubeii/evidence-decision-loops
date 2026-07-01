"use strict";

const crypto = require("crypto");

function hashToUint32(value) {
  const digest = crypto.createHash("sha256").update(String(value)).digest();
  return digest.readUInt32BE(0);
}

function createSeededRandom(seed) {
  let state = hashToUint32(seed) || 1;
  return function nextRandom() {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

function shuffleStable(items, seed) {
  const copy = items.slice();
  const random = createSeededRandom(seed);
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    const current = copy[index];
    copy[index] = copy[swapIndex];
    copy[swapIndex] = current;
  }
  return copy;
}

module.exports = {
  createSeededRandom,
  shuffleStable,
};
