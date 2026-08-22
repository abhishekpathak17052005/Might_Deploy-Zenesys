const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const preferredPort = Number(process.env.PORT) || 5173;

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".svg": "image/svg+xml; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function send(res, status, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store",
  });
  res.end(body);
}

const server = http.createServer((req, res) => {
  const requestedPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
  const filePath = requestedPath === "/" ? "/index.html" : requestedPath;
  const absolutePath = path.normalize(path.join(root, filePath));

  if (!absolutePath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  fs.readFile(absolutePath, (error, data) => {
    if (error) {
      send(res, 404, "Not found");
      return;
    }

    send(res, 200, data, contentTypes[path.extname(absolutePath)] || "application/octet-stream");
  });
});

function listen(port) {
  server.once("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(`Port ${port} is busy, trying ${port + 1}...`);
      listen(port + 1);
      return;
    }

    throw error;
  });

  server.listen(port, () => {
    console.log(`ProcureIQ running at http://localhost:${port}`);
  });
}

listen(preferredPort);
