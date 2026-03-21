const http = require("http");
const { handler } = require("./netlify/functions/webhook");
const { getAllMemory } = require("./memory");

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  // Rota de status
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("Mary webhook online 🤖");
    return;
  }

  // Rota de admin: ver memória de todos os clientes
  if (req.method === "GET" && req.url === "/memoria") {
    try {
      const result = await getAllMemory();
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify(result, null, 2));
    } catch (err) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(405, { "Content-Type": "text/plain" });
    res.end("Method Not Allowed");
    return;
  }

  let rawBody = "";
  req.on("data", (chunk) => (rawBody += chunk));
  req.on("end", async () => {
    try {
      const event = {
        httpMethod: req.method,
        headers: req.headers,
        body: rawBody,
      };

      const result = await handler(event);

      res.writeHead(result.statusCode, result.headers || { "Content-Type": "application/json" });
      res.end(result.body);
    } catch (err) {
      console.error("Server error:", err);
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Internal server error" }));
    }
  });
});

server.listen(PORT, () => {
  console.log(`Mary webhook server rodando na porta ${PORT}`);
});
