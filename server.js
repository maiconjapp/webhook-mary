const http = require("http");
const { handler } = require("./netlify/functions/webhook");

const PORT = process.env.PORT || 3000;

const server = http.createServer(async (req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook") {
    res.writeHead(req.method === "GET" ? 200 : 405, { "Content-Type": "text/plain" });
    res.end(req.method === "GET" ? "Mary webhook online 🤖" : "Method Not Allowed");
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
