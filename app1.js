import { readFile, writeFile, mkdir } from "fs/promises";
import { createServer } from "http";
import crypto from "crypto";
import path from "path";

const PORT = 3002;
const DATA_FILE = path.join("data", "link.json");
const PUBLIC_DIR = "public";

await mkdir(path.dirname(DATA_FILE), { recursive: true });
await mkdir(PUBLIC_DIR, { recursive: true });

const serveFile = async (res, filepath, contentType) => {
  try {
    const data = await readFile(filepath);
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  } catch (error) {
    res.writeHead(404, { "Content-Type": "text/plain" });
    res.end("404 page not found");
  }
};

const loadLinks = async () => {
  try {
    const data = await readFile(DATA_FILE, "utf-8");
    return JSON.parse(data);
  } catch (error) {
    if (error.code === "ENOENT") {
      await writeFile(DATA_FILE, JSON.stringify({}));
      return {};
    }
    console.error("Error loading links:", error);
    return {};
  }
};

const saveLinks = async (links) => {
  await writeFile(DATA_FILE, JSON.stringify(links, null, 2));
};

const isValidUrl = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

const server = createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);

  const urlPath = req.url.split("?")[0];

  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST");

  if (req.method === "GET") {
    if (urlPath === "/") {
      return serveFile(res, path.join(PUBLIC_DIR, "index.html"), "text/html");
    }

    if (urlPath === "/style.css") {
      return serveFile(res, path.join(PUBLIC_DIR, "style.css"), "text/css");
    }

    if (urlPath === "/links") {
      const links = await loadLinks();
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify(links));
    }

    // Handle short URL redirects
    if (urlPath.length > 1) {
      const links = await loadLinks();
      const code = urlPath.slice(1);
      const originalUrl = links[code];

      if (originalUrl) {
        res.writeHead(302, { Location: originalUrl });
        return res.end();
      }
    }

    res.writeHead(404, { "Content-Type": "text/plain" });
    return res.end("Not found");
  }

  if (req.method === "POST" && urlPath === "/shorten") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { url, shortCode } = JSON.parse(body);
        
        if (!url) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("URL is required");
        }

        if (!isValidUrl(url)) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("Invalid URL format");
        }

        const links = await loadLinks();
        const finalShortCode = shortCode || crypto.randomBytes(4).toString("hex");

        if (shortCode && !/^[a-zA-Z0-9_-]+$/.test(shortCode)) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("Short code can only contain letters, numbers, hyphens and underscores");
        }

        if (links[finalShortCode]) {
          res.writeHead(400, { "Content-Type": "text/plain" });
          return res.end("Short code already exists");
        }

        links[finalShortCode] = url;
        await saveLinks(links);

        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ 
          success: true, 
          shortCode: finalShortCode,
          shortUrl: `http://localhost:${PORT}/${finalShortCode}`
        }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "text/plain" });
        res.end("Invalid request data");
      }
    });
    return;
  }

  res.writeHead(404, { "Content-Type": "text/plain" });
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`✅ Server running at: http://localhost:${PORT}`);
});