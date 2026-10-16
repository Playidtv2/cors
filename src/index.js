const DEFAULT_ALLOWED_HOSTS = ["https://dooballland.com"];

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers }
  });
}

function parseList(value, fallback = []) {
  return (value || fallback.join(","))
    .split(",").map(x => x.trim()).filter(Boolean);
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const allowedOrigins = parseList(env.ALLOWED_ORIGINS, ["*"]);
  const allowed = allowedOrigins.includes("*") ||
    (origin && allowedOrigins.includes(origin));

  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes("*")
      ? "*" : (allowed ? origin : "null"),
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
    "X-Content-Type-Options": "nosniff"
  };
}

export default {
  async fetch(request, env) {
    const incoming = new URL(request.url);
    const cors = corsHeaders(request, env);

    if (incoming.pathname === "/") {
      return new Response(
        "Cloudflare CORS Proxy is running. Visit /health or /api/proxy?url=...",
        { headers: { "Content-Type": "text/plain; charset=utf-8" } }
      );
    }

    if (incoming.pathname === "/health") {
      return json({ ok: true, service: "cloudflare-cors-proxy" }, 200, cors);
    }

    if (incoming.pathname !== "/api/proxy") {
      return json({ error: "Not Found" }, 404, cors);
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (!["GET", "HEAD"].includes(request.method)) {
      return json({ error: "Method Not Allowed" }, 405, cors);
    }

    const target = incoming.searchParams.get("url");
    if (!target) {
      return json({ error: "Missing required query parameter: url" }, 400, cors);
    }

    let remote;
    try {
      remote = new URL(target);
    } catch {
      return json({ error: "Invalid target URL" }, 400, cors);
    }

    const allowedHosts = parseList(
      env.ALLOWED_HOSTS,
      DEFAULT_ALLOWED_HOSTS
    ).map(x => x.toLowerCase());

    if (
      remote.protocol !== "https:" ||
      remote.username || remote.password ||
      !allowedHosts.includes(remote.hostname.toLowerCase())
    ) {
      return json({
        error: "Target host is not allowed",
        hint: "Set ALLOWED_HOSTS to an API hostname you own or are authorized to access."
      }, 403, cors);
    }

    // Optional upstream Referer for an API you own or are authorized to access.
    // Set UPSTREAM_REFERER in Worker Variables; do not use it to bypass another
    // site's access controls or hotlink restrictions.
    const upstreamHeaders = new Headers({
      "Accept": request.headers.get("Accept") || "application/json"
    });

    if (env.UPSTREAM_REFERER) {
      try {
        const ref = new URL(env.UPSTREAM_REFERER);
        if (ref.protocol === "https:") {
          upstreamHeaders.set("Referer", ref.toString());
        }
      } catch {
        // Ignore invalid configuration instead of forwarding an unsafe value.
      }
    }

    try {
      const upstream = await fetch(remote.toString(), {
        method: request.method,
        headers: upstreamHeaders,
        redirect: "manual"
      });

      const outHeaders = new Headers(cors);
      const contentType = upstream.headers.get("Content-Type");
      if (contentType) outHeaders.set("Content-Type", contentType);
      const cacheControl = upstream.headers.get("Cache-Control");
      if (cacheControl) outHeaders.set("Cache-Control", cacheControl);

      return new Response(request.method === "HEAD" ? null : upstream.body, {
        status: upstream.status,
        headers: outHeaders
      });
    } catch {
      return json({ error: "Upstream request failed" }, 502, cors);
    }
  }
};
