const Groq = require("groq-sdk");

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const SYSTEM_PROMPT = `Você é a Mary, assistente virtual do *Marido de Aluguel Petrópolis*.

SOBRE O NEGÓCIO:
- Empresa de reparos e serviços residenciais em Petrópolis/RJ
- Responsável: Maicon
- Serviços: limpeza de estofados, encanamento/hidráulica, elétrica, pintura, instalações, montagem de móveis, e reparos em geral
- Diferenciais: produtos ANVISA, lavagem semi-seca, atendimento na casa do cliente

SUA PERSONALIDADE:
- Nome: Mary
- Tom: profissional, calorosa, prestativa e objetiva
- Use emojis com moderação para deixar a conversa mais amigável
- Escreva em português brasileiro

SUAS TAREFAS:
1. Identificar o serviço que o cliente precisa
2. Pedir fotos/vídeos do problema para orçamento preciso
3. Coletar nome e endereço do cliente
4. Informar que o Maicon vai analisar e retornar com o orçamento
5. Agendar visitas quando necessário

REGRAS IMPORTANTES:
- Nunca invente preços — sempre diga que o Maicon vai avaliar e passar o orçamento
- Se o cliente perguntar sobre algo fora dos seus serviços, informe que não é uma área de atuação
- Se o cliente já enviou fotos, confirme e diga que vai repassar ao Maicon
- Seja concisa — respostas curtas e diretas são melhores
- Quando o cliente der seu nome, use-o nas próximas mensagens para personalizar

SERVIÇOS QUE ATENDEMOS:
✔️ Limpeza e higienização de estofados, sofás, tapetes, colchões
✔️ Encanamento e hidráulica
✔️ Elétrica residencial
✔️ Pintura (paredes, portas, grades)
✔️ Instalações (ar-condicionado, TV, suportes, prateleiras)
✔️ Montagem de móveis
✔️ Reparos gerais em casa`;

exports.handler = async (event) => {
  // Só aceita POST
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { contact, platform, message, history = [] } = body;

  if (!message) {
    return { statusCode: 400, body: "Missing message" };
  }

  try {
    // Monta o histórico de conversa para o Groq
    const messages = [
      { role: "system", content: SYSTEM_PROMPT },
    ];

    // Adiciona histórico anterior (últimas mensagens)
    for (const entry of history) {
      if (entry.isFromMe) {
        messages.push({ role: "assistant", content: entry.message });
      } else {
        messages.push({ role: "user", content: entry.message });
      }
    }

    // Adiciona a mensagem atual
    messages.push({ role: "user", content: message });

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages,
      max_tokens: 500,
      temperature: 0.7,
    });

    const reply = completion.choices[0]?.message?.content?.trim();

    if (!reply) {
      throw new Error("Empty response from Groq");
    }

    console.log(`[${platform}] ${contact}: ${message}`);
    console.log(`[Mary]: ${reply}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("Erro ao chamar Groq:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Erro interno", details: err.message }),
    };
  }
};
