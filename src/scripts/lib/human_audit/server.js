"use strict";

const http = require("http");
const { URL } = require("url");
const { normalizeBasePath, pathInsideBasePath } = require("./base_path");
const { createStudyStore } = require("./store");
const { renderAppHtml } = require("./public_app");

function createHumanAuditServer({ studyDir, basePath = "" }) {
  const store = createStudyStore(studyDir);
  const appBasePath = normalizeBasePath(basePath);
  return http.createServer(async (request, response) => {
    try {
      const url = new URL(request.url, "http://localhost");
      if (appBasePath && url.pathname === appBasePath) {
        return redirect(response, `${appBasePath}/${url.search}`);
      }
      const pathname = pathInsideBasePath(url.pathname, appBasePath);
      if (pathname == null) return sendJson(response, 404, { error: "Not found" });
      if (request.method === "GET" && pathname === "/health") return sendJson(response, 200, { ok: true });
      if (request.method === "GET" && pathname === "/") return sendHtml(response, renderAppHtml({ basePath: appBasePath }));
      if (request.method === "GET" && pathname === "/api/session") {
        const raterId = url.searchParams.get("rater");
        const token = url.searchParams.get("token");
        if (!store.authenticateRater(raterId, token)) return sendJson(response, 403, { error: "Forbidden" });
        const state = store.getRaterState(raterId, url.searchParams.get("assignment"));
        return sendJson(response, 200, { raterId, study: store.getStudySummary(), assignments: state.assignments, current: state.current, next: state.current });
      }
      if (request.method === "POST" && pathname === "/api/response") {
        const body = await readJsonBody(request);
        if (!store.authenticateRater(body.raterId, body.token)) return sendJson(response, 403, { error: "Forbidden" });
        const submitted = store.submitResponse(body);
        return sendJson(response, 200, { ok: true, responseId: submitted.responseId });
      }
      if (request.method === "GET" && pathname === "/api/admin/progress") {
        const token = url.searchParams.get("token");
        if (!store.authenticateAdmin(token)) return sendJson(response, 403, { error: "Forbidden" });
        return sendJson(response, 200, store.getProgress());
      }
      if (request.method === "GET" && pathname === "/api/admin/responses") {
        const token = url.searchParams.get("token");
        if (!store.authenticateAdmin(token)) return sendJson(response, 403, { error: "Forbidden" });
        return sendJson(response, 200, { responses: store.exportResponses() });
      }
      return sendJson(response, 404, { error: "Not found" });
    } catch (error) {
      return sendJson(response, 500, { error: error.message });
    }
  });
}

function redirect(response, location) {
  response.writeHead(308, { location, "cache-control": "no-store" });
  response.end();
}

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(`${JSON.stringify(value)}\n`);
}

function sendHtml(response, html) {
  response.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  response.end(html);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new Error("Request body too large"));
        request.destroy();
      }
    });
    request.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (error) {
        reject(new Error("Invalid JSON body"));
      }
    });
    request.on("error", reject);
  });
}

module.exports = { createHumanAuditServer };
