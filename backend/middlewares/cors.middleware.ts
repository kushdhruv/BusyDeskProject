/**
 * CORS Middleware
 * Generates CORS headers and handles preflight OPTIONS requests across domains.
 */

import { NextResponse } from "next/server";

export function corsHeaders(requestOrigin?: string | null): Record<string, string> {
  const configuredOrigin = process.env.CORS_ORIGIN || process.env.FRONTEND_URL;
  const allowedOrigin =
    configuredOrigin ||
    requestOrigin ||
    "http://localhost:3000";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Requested-With, Cookie",
    "Access-Control-Allow-Credentials": "true",
  };
}

export function handleCorsOptions(req: Request) {
  const origin = req.headers.get("origin");
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}
