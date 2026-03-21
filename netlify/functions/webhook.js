const Groq = require("groq-sdk");
const { google } = require("googleapis");

// Lazy init — GROQ_API_KEY é opcional (só usado como fallback)
let _groq = null;
function getGroq() {
  if (!_groq) {
    const key = process.env.GROQ_API_KEY || "not-configured";
    _groq = new Groq({ apiKey: key });
  }
  return _groq;
}

const OPENROUTER_KEY = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY || "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";

// Chama OpenRouter via fetch nativo (sem SDK)
async function callOpenRouter(model, messages, tools) {
  const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENROUTER_KEY}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://webhook-mary.netlify.app",
      "X-Title": "Mary - Marido de Aluguel Petropolis",
    },
    body: JSON.stringify({ model, messages, tools, tool_choice: "auto", max_tokens: 600, temperature: 0.85, frequency_penalty: 0.3 }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const e = new Error(JSON.stringify(err));
    e.status = res.status;
    throw e;
  }
  return res.json();
}

// Google Calendar setup via service account
function getCalendarClient() {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });
  return google.calendar({ version: "v3", auth });
}

const CALENDAR_ID = process.env.CALENDAR_ID || "corporativomaridodealuguel@gmail.com";

// Calendar tools for Groq function calling
const TOOLS = [
  {
    type: "function",
    function: {
      name: "check_availability",
      description:
        "Verifica os horários disponíveis na agenda do Maicon para agendamento de visitas. Use quando o cliente perguntar sobre disponibilidade ou quiser marcar um horário.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description:
              "Data para verificar disponibilidade no formato YYYY-MM-DD. Se o cliente disser 'amanhã', calcule a partir de hoje.",
          },
        },
        required: ["date"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_appointment",
      description:
        "Cria um agendamento na agenda do Maicon. Use após confirmar o serviço, nome e endereço do cliente.",
      parameters: {
        type: "object",
        properties: {
          date: {
            type: "string",
            description: "Data do agendamento no formato YYYY-MM-DD",
          },
          time: {
            type: "string",
            description: "Horário de início no formato HH:MM (ex: 09:00)",
          },
          client_name: {
            type: "string",
            description: "Nome do cliente",
          },
          client_address: {
            type: "string",
            description: "Endereço do cliente",
          },
          service: {
            type: "string",
            description: "Descrição do serviço a ser realizado",
          },
          phone: {
            type: "string",
            description: "Telefone/WhatsApp do cliente (opcional)",
          },
        },
        required: ["date", "time", "client_name", "client_address", "service"],
      },
    },
  },
];

// Check free/busy slots for a given date
async function checkAvailability(date) {
  try {
    const calendar = getCalendarClient();
    const startOfDay = new Date(`${date}T00:00:00-03:00`);
    const endOfDay = new Date(`${date}T23:59:59-03:00`);

    const freeBusy = await calendar.freebusy.query({
      requestBody: {
        timeMin: startOfDay.toISOString(),
        timeMax: endOfDay.toISOString(),
        items: [{ id: CALENDAR_ID }],
      },
    });

    const busy = freeBusy.data.calendars[CALENDAR_ID]?.busy || [];

    // Business hours: 8h às 18h
    const workSlots = [
      "08:00", "09:00", "10:00", "11:00",
      "13:00", "14:00", "15:00", "16:00", "17:00",
    ];

    const available = workSlots.filter((slot) => {
      const slotStart = new Date(`${date}T${slot}:00-03:00`);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);
      return !busy.some((b) => {
        const busyStart = new Date(b.start);
        const busyEnd = new Date(b.end);
        return slotStart < busyEnd && slotEnd > busyStart;
      });
    });

    if (available.length === 0) {
      return `Não há horários disponíveis em ${date}. Tente outro dia.`;
    }
    return `Horários disponíveis em ${date}: ${available.join(", ")}`;
  } catch (err) {
    console.error("Erro ao verificar agenda:", err.message);
    return "Não consegui acessar a agenda no momento. Por favor, entre em contato diretamente com o Maicon.";
  }
}

// Create a calendar event
async function createAppointment({ date, time, client_name, client_address, service, phone }) {
  try {
    const calendar = getCalendarClient();
    const startDateTime = new Date(`${date}T${time}:00-03:00`);
    const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000);

    const description = [
      `Serviço: ${service}`,
      `Endereço: ${client_address}`,
      phone ? `WhatsApp: ${phone}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    await calendar.events.insert({
      calendarId: CALENDAR_ID,
      requestBody: {
        summary: `Visita - ${client_name} (${service})`,
        description,
        location: client_address,
        start: { dateTime: startDateTime.toISOString(), timeZone: "America/Sao_Paulo" },
        end: { dateTime: endDateTime.toISOString(), timeZone: "America/Sao_Paulo" },
      },
    });

    return `Agendamento confirmado! Visita de ${client_name} em ${date} às ${time} para ${service} no endereço ${client_address}. O Maicon foi notificado.`;
  } catch (err) {
    console.error("Erro ao criar agendamento:", err.message);
    return "Não consegui criar o agendamento no momento. Por favor, entre em contato diretamente com o Maicon.";
  }
}

const SYSTEM_PROMPT = `Você é a Mary, secretária do *Marido de Aluguel Petrópolis*. Você é uma pessoa real trabalhando como atendente — nunca revele que é uma IA ou assistente virtual, mesmo que perguntem diretamente. Se perguntarem, diga que é a secretária da empresa.

## QUEM VOCÊ É
- Seu nome é Mary
- Trabalha há anos atendendo clientes do Marido de Aluguel Petrópolis
- Conhece bem todos os serviços da empresa e o jeito de trabalhar do Maicon
- É simpática, atenciosa, usa linguagem natural e descontraída — como uma pessoa real no WhatsApp

## COMO VOCÊ ESCREVE (muito importante)
- Escreva como uma pessoa de verdade no WhatsApp: mensagens curtas, naturais, às vezes com letra minúscula no início, sem formalidade excessiva
- Varie o jeito de falar — não repita sempre as mesmas frases
- Use expressões do dia a dia: "Oi!", "Claro!", "Pode mandar sim", "Boa!", "Que ótimo!", "Deixa eu ver aqui...", "Já falo com o Maicon"
- Emojis com moderação e naturalidade — não em toda frase, só quando fizer sentido
- NUNCA use listas com marcadores (-, *, •) nas respostas — fale em texto corrido como uma pessoa faria no WhatsApp
- Quebre o texto em parágrafos curtos quando precisar de mais de uma informação
- Às vezes faça uma pergunta de cada vez, como numa conversa natural
- Demonstre empatia quando o cliente tiver um problema: "Ai que chato né!", "Entendo perfeitamente"

## MEMÓRIA
- Você lembra de tudo que foi falado na conversa
- Nunca peça algo que o cliente já informou
- Use o nome do cliente naturalmente ao longo da conversa

## FLUXO NATURAL DE ATENDIMENTO
1. Se o cliente não se apresentou, pergunte o nome de forma descontraída
2. Entenda o que ele precisa — pergunte mais se necessário
3. Para orçamento: peça fotos ou vídeos do problema
4. Fale que vai repassar ao Maicon e que ele retorna em breve
5. Se quiser agendar: use as ferramentas de agenda e confirme o horário de forma natural
6. Quando relevante, compartilhe o Instagram: instagram.com/maridodealuguelpetropolisrj

## INFORMAÇÕES DA EMPRESA
- Pagamento via Pix — CNPJ: 25.349.070/0001-80
- Orçamentos sempre por WhatsApp com fotos/vídeos (nunca sugira visita para orçamento)
- Dúvidas sobre serviços específicos: "Deixa eu confirmar com o Maicon e já te falo"

## LIMPEZA DE ESTOFADOS (nosso carro-chefe)
Quando o cliente perguntar sobre limpeza de sofá, tapete ou colchão, explique de forma natural:
- Usamos produtos certificados pela ANVISA (antiácaros, antibacteriano, antifúngico)
- Lavagem semi-seca com extração industrial — seca em 12 a 24h
- Feito na casa do cliente, sem precisar levar nada a lugar nenhum
- Elimina odores, manchas e ácaros

## SERVIÇOS QUE FAZEMOS
Limpeza de estofados, sofás, tapetes e colchões — Encanamento e hidráulica — Desentupimento de ralo, pia e vaso sanitário — Elétrica residencial — Instalações (TV, suporte, prateleiras, box de banheiro) — Montagem de móveis — Reparos gerais em casa

## SERVIÇOS QUE NÃO FAZEMOS
Pedreiro, alvenaria, pintura e ar-condicionado. Se pedirem esses, seja simpática: "Esse aí a gente não faz não, mas se precisar de outra coisa pode chamar!"

## REGRAS INEGOCIÁVEIS
- NUNCA invente preços
- NUNCA sugira visita para orçamento
- NUNCA revele que é IA
- Se perguntarem se é robô: "Não, sou a Mary, secretária do Maicon 😄"`;


exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method Not Allowed" };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const { contact, platform, message, history = [], mediaType = "text", imageBase64 } = body;

  if (!message && !imageBase64) {
    return { statusCode: 400, body: "Missing message" };
  }

  try {
    const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" });
    const todayISO = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const systemWithDate = SYSTEM_PROMPT + `\n\n## DATA ATUAL\nHoje é ${today} (${todayISO}). Use isso para calcular "amanhã", "semana que vem", etc.`;
    const messages = [{ role: "system", content: systemWithDate }];

    // Processa mídia recebida
    let userMessageContent = message || "";

    if (mediaType === "audio") {
      userMessageContent = "[O cliente enviou um áudio]";
    } else if (mediaType === "video") {
      userMessageContent = "[O cliente enviou um vídeo]";
    } else if (mediaType === "sticker") {
      userMessageContent = "[O cliente enviou uma figurinha/sticker]";
    } else if (mediaType === "document") {
      userMessageContent = "[O cliente enviou um documento/arquivo]";
    } else if (mediaType === "image") {
      if (imageBase64) {
        // Analisa imagem com modelo de visão via OpenRouter
        try {
          const visionRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${OPENROUTER_KEY}`,
              "Content-Type": "application/json",
              "HTTP-Referer": "https://webhook-mary.netlify.app",
              "X-Title": "Mary - Marido de Aluguel Petropolis",
            },
            body: JSON.stringify({
              model: "meta-llama/llama-3.2-11b-vision-instruct",
              messages: [{
                role: "user",
                content: [
                  { type: "text", text: "Você é um assistente de uma empresa de reparos residenciais. Descreva objetivamente o que vê nesta imagem, focando em: qual ambiente é, qual o problema aparente, qual serviço pode ser necessário. Seja direto e breve (máximo 2 frases)." },
                  { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } }
                ]
              }],
              max_tokens: 150,
            }),
          });
          if (visionRes.ok) {
            const visionData = await visionRes.json();
            const desc = visionData.choices?.[0]?.message?.content?.trim();
            if (desc) {
              userMessageContent = `[O cliente enviou uma foto. Descrição automática: ${desc}]`;
              console.log("Imagem analisada:", desc);
            } else {
              userMessageContent = "[O cliente enviou uma foto do problema]";
            }
          } else {
            userMessageContent = "[O cliente enviou uma foto do problema]";
          }
        } catch (e) {
          console.warn("Erro ao analisar imagem:", e.message);
          userMessageContent = "[O cliente enviou uma foto do problema]";
        }
      } else {
        userMessageContent = "[O cliente enviou uma foto do problema — sem acesso à imagem no momento]";
      }
    }

    // Suporta dois formatos de histórico:
    // Android envia: {role, content, timestamp} — role pode ser "user", "assistant" ou "human"
    // Formato legado: {isFromMe, message}
    // Ordena por timestamp para garantir ordem cronológica
    const sortedHistory = [...history].sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0));
    for (const entry of sortedHistory) {
      const content = (entry.content ?? entry.message ?? "").trim();
      if (!content) continue;
      // "human" = Maicon respondeu manualmente → trata como assistant para a IA
      const rawRole = entry.role ?? (entry.isFromMe ? "assistant" : "user");
      const role = rawRole === "human" ? "assistant" : rawRole;
      if (role === "assistant" || role === "user") {
        messages.push({ role, content });
      }
    }

    messages.push({ role: "user", content: userMessageContent });

    function isRateLimit(e) {
      return (
        e.status === 429 || e.status === 402 || e.status === 401 ||
        (e.message && (e.message.includes("429") || e.message.includes("402") ||
          e.message.includes("401") || e.message.includes("rate limit") ||
          e.message.includes("credits") || e.message.includes("insufficient") ||
          e.message.includes("User not found") || e.message.includes("Unauthorized")))
      );
    }

    // Chama Groq via SDK
    async function callGroqModel(model, msgs) {
      return getGroq().chat.completions.create({
        model, messages: msgs, tools: TOOLS, tool_choice: "auto",
        max_tokens: 600, temperature: 0.85, frequency_penalty: 0.3,
      });
    }

    // Agentic loop — até 5 rounds de tool calls
    let reply = null;
    let useOpenRouter = true; // começa com OpenRouter

    for (let i = 0; i < 5; i++) {
      let completion = null;

      if (useOpenRouter) {
        try {
          completion = await callOpenRouter("xiaomi/mimo-v2-pro", messages, TOOLS);
          console.log("Usando: OpenRouter/MiMo-v2-Pro");
        } catch (e) {
          if (isRateLimit(e)) {
            console.warn(`OpenRouter sem créditos (${e.status}), usando Groq...`);
            useOpenRouter = false;
          } else throw e;
        }
      }

      if (!useOpenRouter) {
        // Fallback Groq: tenta llama-3.1-8b-instant
        for (const m of ["llama-3.1-8b-instant", "gemma2-9b-it"]) {
          try {
            completion = await callGroqModel(m, messages);
            console.log(`Usando: Groq/${m}`);
            break;
          } catch (e) {
            if (isRateLimit(e)) { console.warn(`Groq/${m} rate limit, próximo...`); continue; }
            throw e;
          }
        }
      }

      if (!completion) throw new Error("Todos os providers indisponíveis. Tente em alguns minutos.");

      const choice = completion.choices[0];

      if (choice.finish_reason === "tool_calls") {
        const assistantMsg = choice.message;
        messages.push(assistantMsg);

        for (const toolCall of assistantMsg.tool_calls) {
          const args = JSON.parse(toolCall.function.arguments);
          let toolResult;

          if (toolCall.function.name === "check_availability") {
            toolResult = await checkAvailability(args.date);
          } else if (toolCall.function.name === "create_appointment") {
            toolResult = await createAppointment(args);
          } else {
            toolResult = "Ferramenta desconhecida.";
          }

          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: toolResult,
          });
        }
        // Continue loop to get final response
      } else {
        reply = choice.message?.content?.trim();
        break;
      }
    }

    if (!reply) {
      throw new Error("Empty response from Groq");
    }

    // Remove sintaxe de ferramenta e código que o modelo às vezes inclui no texto
    reply = reply
      .replace(/<function[^>]*>[\s\S]*?<\/function>/gi, "")   // <function=...>...</function>
      .replace(/<function[^>]*\/>/gi, "")                       // <function ... />
      .replace(/<function[^>]*>/gi, "")                         // <function ...> solto
      .replace(/<tool_call>[\s\S]*?<\/tool_call>/gi, "")
      .replace(/\[TOOL_CALL\][\s\S]*?\[\/TOOL_CALL\]/gi, "")
      .replace(/```[\s\S]*?```/g, "")
      .replace(/`[^`]*`/g, "")
      .replace(/\{[\s\S]*?\}/g, (m) => {
        try { JSON.parse(m); return ""; } catch { return m; }
      })
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    if (!reply) {
      throw new Error("Reply vazia após limpeza");
    }

    console.log(`[${platform}] ${contact}: ${message}`);
    console.log(`[Mary]: ${reply}`);

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reply }),
    };
  } catch (err) {
    console.error("Erro:", err.message);
    return {
      statusCode: 500,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ error: "Erro interno", details: err.message }),
    };
  }
};
