/**
 * Cloudflare Pages Function: secure NextDNS API proxy.
 * Required secret: NEXTDNS_API_KEY
 */
const ALLOWED_PREFIXES = [
  "profiles",
];

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const path = url.searchParams.get("path") || "";
  if (!path || path.includes("..") || !ALLOWED_PREFIXES.some(p => path === p || path.startsWith(p + "/"))) {
    return json({error:"Invalid API path"},400);
  }

  const key = context.env.NEXTDNS_API_KEY;
  if (!key) return json({error:"NEXTDNS_API_KEY secret is not configured"},500);

  const target = "https://api.nextdns.io/" + path.replace(/^\/+/, "");
  const qs = new URLSearchParams(url.search);
  qs.delete("path");
  const query = qs.toString();
  const targetUrl = target + (query ? "?" + query : "");

  const headers = new Headers();
  headers.set("X-Api-Key", key);
  headers.set("Accept", "application/json");
  if (context.request.method !== "GET") headers.set("Content-Type","application/json");

  let body;
  if (context.request.method !== "GET" && context.request.method !== "HEAD") {
    body = await context.request.text();
  }

  const upstream = await fetch(targetUrl, {
    method: context.request.method,
    headers,
    body,
  });

  const outHeaders = new Headers();
  const ct = upstream.headers.get("content-type") || "application/json";
  outHeaders.set("Content-Type", ct);
  outHeaders.set("Cache-Control","no-store");
  outHeaders.set("Access-Control-Allow-Origin","same-origin");

  return new Response(upstream.body, {status:upstream.status,headers:outHeaders});
}

function json(data,status=200){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"Content-Type":"application/json","Cache-Control":"no-store"}
  });
}
