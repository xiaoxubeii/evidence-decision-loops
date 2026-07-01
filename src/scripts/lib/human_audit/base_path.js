"use strict";

function normalizeBasePath(value) {
  let basePath = String(value || "").trim();
  if (!basePath || basePath === "/") return "";
  if (!basePath.startsWith("/")) basePath = `/${basePath}`;
  basePath = basePath.replace(/\/+$/g, "");
  if (!/^\/[A-Za-z0-9._~/-]+$/.test(basePath)) {
    throw new Error(`Invalid base path: ${value}`);
  }
  return basePath;
}

function pathInsideBasePath(pathname, basePath) {
  const normalizedBasePath = normalizeBasePath(basePath);
  if (!normalizedBasePath) return pathname;
  if (pathname === normalizedBasePath) return "/";
  if (pathname.startsWith(`${normalizedBasePath}/`)) return pathname.slice(normalizedBasePath.length);
  return null;
}

module.exports = { normalizeBasePath, pathInsideBasePath };
