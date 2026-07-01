#!/usr/bin/env node
"use strict";

const path = require("path");
const { DEFAULT_STUDY_DIR } = require("./lib/human_audit/constants");
const { createHumanAuditServer } = require("./lib/human_audit/server");

const repoRoot = path.resolve(__dirname, "..", "..");

if (require.main === module) {
  run();
}

function run() {
  const options = parseArgs(process.argv.slice(2));
  const studyDir = path.resolve(repoRoot, options.studyDir);
  const server = createHumanAuditServer({ studyDir, basePath: options.basePath });
  server.listen(options.port, options.host, () => {
    const address = server.address();
    console.log(`Human audit study server listening at http://${options.host}:${address.port}${options.basePath || "/"}`);
    console.log(`Study dir: ${studyDir}`);
  });
}

function parseArgs(args) {
  const options = {
    studyDir: process.env.HUMAN_AUDIT_STUDY_DIR || DEFAULT_STUDY_DIR,
    host: process.env.HOST || "127.0.0.1",
    port: Number(process.env.PORT || 8787),
    basePath: process.env.HUMAN_AUDIT_BASE_PATH || "",
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--study-dir") options.studyDir = args[++index];
    else if (arg === "--host") options.host = args[++index];
    else if (arg === "--port") options.port = Number(args[++index]);
    else if (arg === "--base-path") options.basePath = args[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

module.exports = { parseArgs };
