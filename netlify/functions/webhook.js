const Groq = require("groq-sdk");
const { google } = require("googleapis");
const { getMemoryContext, updateMemory } = require("../../memory");

// Deduplicação — evita resposta dupla quando Android app E Baileys processam a mesma msg
const _dedup = new Map();
function isDuplicate(contact, message) {
  const key = `${contact}:${String(message).slice(0, 80)}`;
  const now = Date.now();
  if (_dedup.has(key) && now - _dedup.get(key) < 25000) return true;
  _dedup.set(key, now);
  // Limpa entradas antigas
  if (_dedup.size > 500) {
    const cutoff = now - 60000;
    for (const [k, v] of _dedup) if (v < cutoff) _dedup.delete(k);
  }
  return false;
}

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
        "SOMENTE use quando o cliente JA recebeu e aprovou o orcamento E pediu explicitamente agendar uma data. NUNCA use no inicio da conversa, nunca use apenas porque o cliente pediu um servico ou orcamento.",
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
        "SOMENTE use quando: (1) cliente ja recebeu o orcamento por WhatsApp e aprovou, E (2) cliente pediu data e horario especifico para execucao. NUNCA antes do orcamento aprovado. NUNCA use so porque o cliente pediu limpeza ou reparo.",
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

const SYSTEM_PROMPT = `Você é a Mary, Secretária Virtual da empresa Marido de Aluguel Petrópolis. O dono é o Maicon. Você tem 20 anos de experiência em atendimento online.

PERSONALIDADE
Eficiente, calorosa, paciente, persuasiva mas não agressiva. Tom amigável e profissional.
Linguagem clara e concisa como WhatsApp. Parágrafos curtos, 1 a 2 linhas. Sem listas com traço ou bullet.
Emojis moderados. Faça só UMA pergunta por mensagem. Não repita expressões da mensagem anterior.

=== REGRA ABSOLUTA NÚMERO 1 — NUNCA VIOLE ===
ORÇAMENTOS SEMPRE POR FOTO OU VÍDEO VIA WHATSAPP.
NUNCA sugira, mencione ou confirme visita presencial ou visita técnica para orçamento.
NUNCA diga nada parecido com: 'posso ir amanhã', 'temos disponibilidade às 15h', 'o técnico vai até você para orçar', 'que horário funciona para a visita', 'agendei para amanhã', 'está confirmado para sexta', 'nossos horários disponíveis são'.
Se a IA sentir vontade de oferecer horários ou agendar visita — PARE e peça foto em vez disso.

=== REGRA ABSOLUTA NÚMERO 2 — NUNCA VIOLE ===
NUNCA invente ou estime preço.
NUNCA diga: 'R$ 120', 'em torno de R$ 80', 'custa entre X e Y', 'o valor é aproximadamente'.
Para preço: 'Para um valor preciso, o Maicon precisa ver uma foto ou vídeo do problema.'

=== REGRA ABSOLUTA NÚMERO 3 — NUNCA VIOLE ===
PEDREIRO e PINTURA: recuse diretamente, sem negociar, sem verificar com técnico, sem tentar alternativa.
DIGA APENAS: 'Infelizmente não realizamos serviços de pedreiro ou pintura.'
NUNCA diga que vai verificar com o técnico para pedreiro ou pintura — esses dois são definitivamente excluídos.

=== REGRA ABSOLUTA NÚMERO 4 — NUNCA VIOLE ===
NUNCA forneça endereço físico da empresa. Atendimento é 100% remoto via WhatsApp.

=== REGRA ABSOLUTA NÚMERO 5 — NUNCA VIOLE ===
NUNCA use o nome que está na memória para chamar o cliente. Use SOMENTE o nome que o cliente informou NESTA conversa.
Se o cliente não informou o nome ainda nesta conversa, pergunte — não assuma nome de conversa anterior.

=== FLUXO OBRIGATORIO DE ATENDIMENTO ===

PASSO 1 — PRIMEIRA MENSAGEM SEMPRE:
Peça o nome, SEMPRE, em toda primeira mensagem — mesmo se houver memória de atendimento anterior.
'Olá! Sou a Mary, sua assistente da Marido de Aluguel Petrópolis. Para começarmos, poderia me informar seu nome?'
Se não fornecer nome: 'Para te atender melhor, poderia me dizer seu nome?'

PASSO 2 — Com o nome:
'Muito prazer, [Nome]! Em qual serviço posso te ajudar hoje?'

PASSO 3 — Identificar o serviço e coletar detalhes. Pergunte um item de cada vez.

PASSO 4 — OBRIGATÓRIO antes de qualquer valor, data ou horário: pedir foto ou vídeo.
'Para o Maicon te dar um orçamento preciso, consegue me mandar uma foto ou vídeo do problema?'

PASSO 5 — Ao receber foto ou vídeo:
'Ótimo! O Maicon está analisando suas informações. Já volto com o orçamento!'

PASSO 6 — Pagamento (só se o cliente perguntar):
'Você pode pagar via Pix — chave CNPJ 25349070000180.'

=== SERVIÇOS ===

Fazemos: limpeza de sofá, tapete e colchão — encanamento e hidráulica — desentupimento — elétrica — instalações (TV, suporte, box, prateleira, ventilador) — montagem de móveis — reparos gerais.

NÃO fazemos: pintura, pedreiro, alvenaria. Para qualquer outro serviço não listado, diga que vai verificar com o setor técnico.

=== SCRIPT OBRIGATÓRIO PARA LIMPEZA DE ESTOFADOS ===
Quando o cliente pedir limpeza de sofá, tapete ou colchão, use este texto:
'Somos especializados nisso! O serviço é feito na sua casa, com produtos certificados pela ANVISA — antiácaros, antibacteriano e antifúngico. Lavagem semi-seca com extração industrial, seca em 12 a 24h e elimina manchas e odores. Para um orçamento preciso, consegue me mandar uma foto ou vídeo?'

=== FOTOS E VÍDEOS ===
Quando o cliente envia foto: você receberá descrição automática da imagem. Use-a para comentar o problema de forma personalizada. Nunca dê preço baseado só na foto — passe para o Maicon analisar.
Se o cliente disser que não tem foto agora: diga "Sem problema! Quando puder é só enviar." e continue a conversa — não fique pedindo foto repetidamente.

=== PORTFÓLIO ===
Quando fizer sentido: 'Você pode ver nosso trabalho aqui: https://www.instagram.com/maridodealuguelpetropolisrj'

=== OBJEÇÕES ===
Preço alto: reforce qualidade e custo-benefício. Nunca invente valores.
Dúvidas técnicas: 'Deixa eu confirmar com o Maicon e já te retorno.'

=== IDENTIDADE ===
Se perguntarem se é robô ou IA: 'Sou a Mary, secretária do Maicon.' Curto e natural.

REGRA DE INVISIBILIDADE DA MEMÓRIA: NUNCA mencione "registros anteriores", "última vez que conversamos", "de acordo com nossos registros" — use informações anteriores de forma natural sem revelar a fonte.

PRIORIDADE: Se o cliente perguntar sobre qualquer serviço (pedreiro, pintura, elétrica etc), responda SEMPRE essa pergunta antes de continuar qualquer outro assunto. Nunca ignore pergunta sobre serviço.`;


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

  const { contact, platform, message, history = [], mediaType = "text", imageBase64, imageMimeType = "image/jpeg" } = body;

  if (!message && !imageBase64) {
    return { statusCode: 400, body: "Missing message" };
  }

  // Deduplicação: se a mesma msg do mesmo contato chegou nos últimos 25s, ignora
  if (isDuplicate(contact, message)) {
    console.log(`[Dedup] Ignorando msg duplicada de "${contact}"`);
    return { statusCode: 200, headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reply: "" }) };
  }

  try {
    const today = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", year: "numeric", month: "2-digit", day: "2-digit" });
    const todayISO = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });

    // Carrega memória do cliente
    const memoryContext = await getMemoryContext(contact);
    const memorySection = memoryContext
      ? `\n\n## MEMÓRIA DESTE CLIENTE\nVocê já atendeu este cliente antes. Use essas informações naturalmente — não liste tudo de uma vez, apenas use quando relevante. Nunca pergunte algo que já está na memória.\n${memoryContext}`
      : "";

    const systemWithDate = SYSTEM_PROMPT + memorySection + `\n\n## DATA ATUAL\nHoje é ${today} (${todayISO}). Use isso para calcular "amanhã", "semana que vem", etc.`;
    const messages = [{ role: "system", content: systemWithDate }];

    if (memoryContext) console.log(`[Memory] Contexto carregado para "${contact}"`);
    else console.log(`[Memory] Cliente novo: "${contact}"`);

    // Processa mídia recebida
    let userMessageContent = message || "";

    // Detecta respostas de negação de foto para evitar loop fantasma
    // Normaliza texto removendo acentos para tornar o regex robusto
    const _msgNormRaw = (message || '');
    const _msgNorm = _msgNormRaw.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    console.log('[Debug] mediaType=' + mediaType + ' msg=' + JSON.stringify(_msgNormRaw.substring(0,50)) + ' norm=' + JSON.stringify(_msgNorm.substring(0,50)));
    // Detecta decline tanto em texto puro quanto em imagem sem dados (body com texto real)
    const isPhotoDecline = (mediaType === 'text' || (mediaType === 'image' && !imageBase64)) && (
      // Negação explícita seguida de foto/imagem: 'não tenho foto', 'sem foto', 'não mandei imagem'
      /(nao|sem).{0,15}(foto|imagem)/.test(_msgNorm) ||
      // Negação de ação de envio: 'não consigo mandar', 'não vou enviar', 'não mandei'
      /nao (consigo|vou|tenho como).{0,15}(mandar|enviar|tirar)/.test(_msgNorm) ||
      // Impossibilidade direta sem foto
      /nao (mandei|enviei).{0,10}(foto|imagem|nada|nenhuma)/.test(_msgNorm)
    );
    if (isPhotoDecline) {
      userMessageContent = `[MENSAGEM DE TEXTO — cliente NÃO enviou imagem. Ele não tem foto agora. Responda: "Tudo bem! Quando tiver uma foto é só me enviar. Tem mais alguma dúvida que posso te ajudar?" — curto e natural.]`;
      console.log(`[Webhook] 📵 Cliente declinou foto: "${(message||"").substring(0,50)}"`);
    } else if (mediaType === "audio") {
      userMessageContent = "[O cliente enviou um áudio. Você não consegue ouvir áudios diretamente. Peça gentilmente para o cliente digitar o que precisa, de forma natural e sem explicar que é limitação técnica.]";
    } else if (mediaType === "video") {
      userMessageContent = "[O cliente enviou um vídeo. Você não consegue ver vídeos. Peça para o cliente descrever o problema ou enviar uma foto, de forma natural.]";
    } else if (mediaType === "sticker") {
      userMessageContent = "[O cliente enviou uma figurinha. Reaja de forma simpática e continue o atendimento.]";
    } else if (mediaType === "document") {
      userMessageContent = "[O cliente enviou um documento. Pergunte o que ele precisa de forma natural.]";
    } else if (mediaType === "image") {
      if (imageBase64) {
        // Analisa imagem com modelo de visão via OpenRouter
        // Tenta gemini-flash-1.5 (visão grátis) → fallback para descrição genérica
        const visionModels = [
          "google/gemini-flash-1.5",
          "google/gemini-flash-1.5-8b",
          "meta-llama/llama-3.2-11b-vision-instruct:free",
        ];
        let visionDone = false;
        for (const vModel of visionModels) {
          try {
            console.log(`[Vision] Tentando modelo: ${vModel} (img ${Math.round(imageBase64.length * 0.75 / 1024)}KB)`);
            const visionRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${OPENROUTER_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": "https://webhook-mary.netlify.app",
                "X-Title": "Mary - Marido de Aluguel Petropolis",
              },
              body: JSON.stringify({
                model: vModel,
                messages: [{
                  role: "user",
                  content: [
                    { type: "text", text: "Você é um assistente de uma empresa de reparos residenciais. Descreva objetivamente o que vê nesta imagem, focando em: qual ambiente é, qual o problema aparente, qual serviço pode ser necessário. Seja direto e breve (máximo 2 frases)." },
                    { type: "image_url", image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } }
                  ]
                }],
                max_tokens: 200,
              }),
            });
            if (visionRes.ok) {
              const visionData = await visionRes.json();
              const desc = visionData.choices?.[0]?.message?.content?.trim();
              if (desc) {
                userMessageContent = `[O cliente enviou uma foto. Descrição: ${desc}]`;
                console.log(`[Vision] ✅ ${vModel}: "${desc.substring(0, 100)}"`);
                visionDone = true;
                break;
              }
            } else {
              const errBody = await visionRes.text();
              console.warn(`[Vision] ❌ ${vModel}: HTTP ${visionRes.status} — ${errBody.substring(0, 150)}`);
            }
          } catch (e) {
            console.warn(`[Vision] ❌ ${vModel}: ${e.message}`);
          }
        }
        if (!visionDone) {
          userMessageContent = "[O cliente enviou uma foto do problema. Agradeça o envio e diga que vai passar pro Maicon analisar.]";
          console.warn("[Vision] ⚠️ Todos os modelos falharam — usando fallback genérico");
        }
      } else if (message && message.trim().length > 2) {
        // Imagem sem dados MAS com texto real no body (ex: "Antes de mandar foto, me fala o valor")
        // Trata como texto puro — deixa o modelo responder normalmente ao conteúdo da mensagem
        userMessageContent = message;
        console.log("[Webhook] Imagem sem dados com texto — tratando como texto puro");
      } else {
        // Imagem realmente vazia (sem body nem dados)
        userMessageContent = "[O cliente enviou uma foto. Agradeça o envio e diga que vai passar pro Maicon analisar.]";
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
        // Tenta Claude 3 Haiku primeiro — rápido, barato, segue instruções muito bem
        for (const m of ["anthropic/claude-3-5-haiku", "anthropic/claude-3-haiku", "anthropic/claude-3-haiku-20240307"]) {
          try {
            // Sem TOOLS para evitar agendamentos automáticos
            completion = await callOpenRouter(m, messages, undefined);
            console.log(`Usando: OpenRouter/${m}`);
            break;
          } catch (e) {
            if (isRateLimit(e)) {
              console.warn(`OpenRouter/${m} sem créditos (${e.status}), próximo...`);
              continue;
            } else throw e;
          }
        }
        if (!completion) {
          console.warn("OpenRouter esgotado, usando Groq...");
          useOpenRouter = false;
        }
      }

      if (!useOpenRouter) {
        // Fallback Groq: tenta llama-3.1-8b-instant
        for (const m of ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant"]) {
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
            console.log(`[Tool] check_availability: date=${args.date}`);
            toolResult = await checkAvailability(args.date);
          } else if (toolCall.function.name === "create_appointment") {
            console.log(`[Tool] create_appointment: ${JSON.stringify(args)}`);
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

    // ── AGENTE REVISOR (seletivo) ──────────────────────────────────────────────
    // Só ativa quando a resposta contém palavras de risco — evita atraso desnecessário
    const RISK_WORDS = [
      "r$", "reais", "custa", "valor", "preço", "orçamento",
      "rua", "avenida", "av.", "número", "bairro", "endereço",
      "agendado", "confirmado", "marcado", "visita", "agendamos", "marquei", "combinado",
      "sexta", "segunda", "terça", "quarta", "quinta", "sábado", "domingo",
      "manhã", "tarde", "às ", "horas", "h da",
      "pintamos", "pintura", "ar condicionado", "pedreiro", "alvenaria",
      "assistente", "inteligência artificial", "ia ", "robô", "bot",
    ];
    const replyLower = reply.toLowerCase();
    const needsReview = RISK_WORDS.some(w => replyLower.includes(w));

    if (needsReview) {
      try {
        // Revisor minimalista — só bloqueia erros fatais, não reescreve
        const reviewPrompt = `Você é um validador de respostas de atendimento. Verifique se a resposta abaixo comete algum erro GRAVE:

1. Inventou preço ou valor em reais
2. Confirmou endereço que o cliente não informou nesta conversa
3. Disse que faz pintura, pedreiro, alvenaria ou ar-condicionado
4. Revelou ser IA, robô ou assistente virtual
5. Tem lista com marcadores (-, •, *)
6. Disse "já agendamos", "já marquei", "já confirmei", "visita marcada" ou similar SEM o cliente ter pedido agendamento nesta conversa
7. Inventou data, horário ou dia da semana para um atendimento

Se encontrar erro grave: corrija SOMENTE a parte errada, mantenha o resto igual.
Se não houver erro: copie EXATAMENTE a resposta, sem alterar nada.
Retorne SOMENTE o texto corrigido ou original. Sem comentários.

Resposta a validar:
${reply}`;

        const reviewRes = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${OPENROUTER_KEY}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://webhook-mary.netlify.app",
            "X-Title": "Mary Revisor",
          },
          body: JSON.stringify({
            model: "anthropic/claude-3-haiku",
            messages: [{ role: "user", content: reviewPrompt }],
            max_tokens: 300,
            temperature: 0.1,
          }),
        });

        if (reviewRes.ok) {
          const reviewData = await reviewRes.json();
          const reviewed = reviewData.choices?.[0]?.message?.content?.trim();
          // Só aceita a revisão se for razoavelmente similar em tamanho (evita revisor reescrevendo tudo)
          if (reviewed && reviewed.length > 10 && reviewed.length < reply.length * 2) {
            if (reviewed !== reply) {
              console.log(`[Revisor] Correção: "${reply.substring(0,50)}" → "${reviewed.substring(0,50)}"`);
            }
            reply = reviewed;
          }
        } else {
          console.warn(`[Revisor] Falhou (${reviewRes.status}) — usando resposta original`);
        }
      } catch (e) {
        console.warn(`[Revisor] Erro: ${e.message} — usando resposta original`);
      }
    }
    // ── FIM DO REVISOR ─────────────────────────────────────────────────────────

    console.log(`[${platform}] ${contact}: ${message}`);
    console.log(`[Mary]: ${reply}`);

    // ── EXTRAÇÃO DE MEMÓRIA ────────────────────────────────────────────────────
    // Extrai dados do cliente da conversa e salva na memória
    console.log(`[Memory] Iniciando extração para "${contact}"...`);
    (async () => {
      try {
        const conversationSample = messages
          .filter(m => m.role === "user" || m.role === "assistant")
          .slice(-8)
          .map(m => `${m.role === "user" ? "Cliente" : "Mary"}: ${typeof m.content === "string" ? m.content : ""}`)
          .join("\n");

        const extractPrompt = `Analise esta conversa de WhatsApp de uma empresa de reparos residenciais e extraia informações sobre o cliente em JSON.

Retorne APENAS um JSON válido com os campos que conseguir identificar com certeza na conversa. Se não tiver certeza, não inclua o campo. Nunca invente dados.

Campos possíveis:
- "nome": primeiro nome do cliente (só se ele se apresentou)
- "endereco": endereço completo (só se ele informou explicitamente)
- "bairro": bairro (só se mencionado)
- "tipo_imovel": "casa" ou "apartamento" (só se ficou claro)
- "servicos_solicitados": array com os serviços pedidos nesta conversa
- "preferencia_horario": "manhã", "tarde", "noite" (só se demonstrou preferência clara)
- "observacoes": qualquer detalhe útil para atendimentos futuros (ex: "tem pet", "portão difícil", "prefere Maicon")

Conversa:
${conversationSample}

Retorne só o JSON, sem texto antes ou depois.`;

        // Usa Groq (rápido e confiável) para extração de memória
        const groqExtract = await getGroq().chat.completions.create({
          model: "llama-3.1-8b-instant",
          messages: [{ role: "user", content: extractPrompt }],
          max_tokens: 300,
          temperature: 0.1,
        });

        const raw = groqExtract.choices?.[0]?.message?.content?.trim();
        console.log(`[Memory] Resposta extração: ${raw?.substring(0, 100)}`);
        if (raw) {
          const jsonMatch = raw.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            const extracted = JSON.parse(jsonMatch[0]);
            // Remove campos vazios ou arrays vazios
            Object.keys(extracted).forEach(k => {
              if (!extracted[k] || (Array.isArray(extracted[k]) && extracted[k].length === 0)) {
                delete extracted[k];
              }
            });
            if (Object.keys(extracted).length > 0) {
              updateMemory(contact, extracted);
              console.log(`[Memory] ✅ Salvo para "${contact}":`, JSON.stringify(extracted));
            } else {
              console.log(`[Memory] Nenhum dado novo para "${contact}"`);
            }
          }
        }
      } catch (e) {
        console.warn("[Memory] Erro na extração:", e.message);
      }
    })(); // chama imediatamente (fire-and-forget)
    // ── FIM DA EXTRAÇÃO ──────────────────────────────────────────────────────

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
