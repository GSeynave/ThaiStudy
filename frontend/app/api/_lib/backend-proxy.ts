import { getBackendBaseUrl } from "@/lib/config/server";
import { logServerEvent } from "@/lib/ops/server-log";

export async function readJsonBody(
  request: Request,
  errorPayload: object,
  errorStatus = 400,
) {
  try {
    return await request.json();
  } catch {
    logServerEvent("warn", "request.invalid_json_body", {
      method: request.method,
      pathname: new URL(request.url).pathname,
    });
    return Response.json(errorPayload, { status: errorStatus });
  }
}

export async function proxyBackendGet(path: string, errorPayload: object) {
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch {
    logServerEvent("error", "backend_proxy.request_failed", {
      method: "GET",
      path,
      backendBaseUrl: getBackendBaseUrl(),
    });
    return Response.json(errorPayload, { status: 502 });
  }
}

type ProxyHeaders = Record<string, string>;

export async function proxyBackendPost(
  path: string,
  body: unknown,
  errorPayload: object,
  headers?: ProxyHeaders,
) {
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch {
    logServerEvent("error", "backend_proxy.request_failed", {
      method: "POST",
      path,
      backendBaseUrl: getBackendBaseUrl(),
    });
    return Response.json(errorPayload, { status: 502 });
  }
}

export async function proxyBackendAuthedGet(
  path: string,
  headers: ProxyHeaders,
  errorPayload: object,
) {
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      cache: "no-store",
      headers,
    });
    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch {
    logServerEvent("error", "backend_proxy.request_failed", {
      method: "GET",
      path,
      backendBaseUrl: getBackendBaseUrl(),
      authed: true,
    });
    return Response.json(errorPayload, { status: 502 });
  }
}

export async function proxyBackendAuthedJson(
  method: "POST" | "PUT" | "PATCH" | "DELETE",
  path: string,
  headers: ProxyHeaders,
  body: unknown,
  errorPayload: object,
) {
  try {
    const response = await fetch(`${getBackendBaseUrl()}${path}`, {
      method,
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    return Response.json(payload, { status: response.status });
  } catch {
    logServerEvent("error", "backend_proxy.request_failed", {
      method,
      path,
      backendBaseUrl: getBackendBaseUrl(),
      authed: true,
    });
    return Response.json(errorPayload, { status: 502 });
  }
}
