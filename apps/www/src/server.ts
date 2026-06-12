import defaultServerEntry, {
  createServerEntry,
  type ServerEntry,
} from "@tanstack/react-start/server-entry";

/**
 * Custom server entry: upgrade plain-http hits to https before SSR. The
 * API's CORS allowlist only contains the https origin, so a page served
 * over http strands every authed fetch — and browsers default to http for
 * hosts typed without a scheme.
 */

const HSTS = "max-age=31536000; includeSubDomains";

const serverEntry: ServerEntry = createServerEntry({
  async fetch(request, opts) {
    const url = new URL(request.url);
    const isLocal =
      url.hostname === "localhost" ||
      url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".localhost");

    if (url.protocol === "http:" && !isLocal) {
      url.protocol = "https:";
      return Response.redirect(url.toString(), 301);
    }

    const response = await defaultServerEntry.fetch(request, opts);
    if (!isLocal && !response.headers.has("strict-transport-security")) {
      const headers = new Headers(response.headers);
      headers.set("strict-transport-security", HSTS);
      return new Response(response.body, {
        headers,
        status: response.status,
        statusText: response.statusText,
      });
    }

    return response;
  },
});

export default serverEntry;
