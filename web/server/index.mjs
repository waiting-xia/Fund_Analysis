import "./load-env.mjs";
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { handleApi, startReportScheduler } from "./fund-service.mjs";
import { closeMcpConnections } from "./mcp-client.mjs";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dist = join(root, "dist");
const mimeTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".png": "image/png", ".svg": "image/svg+xml", ".json": "application/json; charset=utf-8", ".map": "application/json; charset=utf-8" };

async function toWebRequest(request) {
  const origin = `http://${request.headers.host || "127.0.0.1"}`;
  const init = { method: request.method, headers: request.headers };
  if (request.method !== "GET" && request.method !== "HEAD") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    init.body = Buffer.concat(chunks);
  }
  return new Request(new URL(request.url || "/", origin), init);
}

async function sendWebResponse(response, outgoing) {
  outgoing.statusCode = response.status;
  response.headers.forEach((value, key) => outgoing.setHeader(key, value));
  outgoing.end(Buffer.from(await response.arrayBuffer()));
}

function serveFile(path, response) {
  response.statusCode = 200;
  response.setHeader("content-type", mimeTypes[extname(path)] || "application/octet-stream");
  response.setHeader("cache-control", extname(path) === ".html" ? "no-cache" : "public, max-age=31536000, immutable");
  createReadStream(path).pipe(response);
}

export function createAppServer() {
  return createServer(async (incoming, outgoing) => {
    try {
      const webRequest = await toWebRequest(incoming);
      const apiResponse = await handleApi(webRequest, process.env);
      if (apiResponse) return await sendWebResponse(apiResponse, outgoing);

      const pathname = decodeURIComponent(new URL(webRequest.url).pathname);
      const requested = resolve(dist, `.${pathname}`);
      if (!requested.startsWith(`${dist}${sep}`) && requested !== dist) {
        outgoing.statusCode = 403; return outgoing.end("Forbidden");
      }
      if (existsSync(requested) && statSync(requested).isFile()) return serveFile(requested, outgoing);
      const index = join(dist, "index.html");
      if (existsSync(index) && (incoming.headers.accept || "").includes("text/html")) return serveFile(index, outgoing);
      outgoing.statusCode = 404; outgoing.end("Not found");
    } catch (error) {
      console.error(error); outgoing.statusCode = 500; outgoing.end("Internal server error");
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 8787);
  const reportScheduler = startReportScheduler(process.env);
  const server = createAppServer().listen(port, "0.0.0.0", () => console.log(`Guanlan Fund AI: http://localhost:${port}`));
  const shutdown = async () => {
    reportScheduler.stop();
    server.close();
    await closeMcpConnections();
  };
  process.once("SIGINT", shutdown);
  process.once("SIGTERM", shutdown);
}
