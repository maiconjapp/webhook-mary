/**
 * Assistente admin da Mary — chat conectado à Claude via OpenRouter.
 * Responde perguntas sobre a Mary, explica configurações e orienta mudanças.
 * Nível A: responde e explica — não executa ações no servidor.
 */

const OPENROUTER_KEY = process.env.OPENROUTER_KEY || process.env.OPENROUTER_API_KEY;

const SYSTEM_PROMPT = `Você é o assistente de administração da Mary, a IA atendente do Marido de Aluguel Petrópolis.

Você está integrado ao dashboard de administração do sistema. Seu papel é:
- Explicar como o sistema funciona
- Orientar o administrador (Maicon/Pietro) sobre como configurar a Mary
- Responder dúvidas sobre clientes, follow-ups e configurações
- Sugerir melhorias no atendimento
- Explicar o que cada parte do dashboard faz

SOBRE O SISTEMA:
- Mary é uma IA que atende clientes no WhatsApp automaticamente
- Usa OpenRouter (MiMo-v2-Pro) como modelo principal, Groq (Llama) como fallback
- Agenda serviços no Google Calendar do Maicon
- Tem memória persistente de clientes no PostgreSQL
- Roda em Railway (servidor 24/7)
- O código está no GitHub: maiconjapp/webhook-mary

SERVIÇOS QUE A EMPRESA FAZ:
- Limpeza de sofás, colchões e estofados
- Elétrica residencial
- Hidráulica / encanamento / desentupimento
- Pequenos reparos em geral

NÃO FAZ: pintura, ar condicionado, pedreiro

CONFIGURAÇÕES DISPONÍVEIS NO DASHBOARD:
- Números bloqueados: impede Mary de responder certos números
- Follow-up CRM: envia mensagens para clientes inativos (máx 5 por lote, anti-ban)
- Visualização de memória dos clientes

Responda sempre em português, de forma direta e prática. Se o administrador pedir algo que envolva mudança de código, explique exatamente o que precisa ser feito e diga que pode pedir para Claude Code (no chat principal) executar a mudança.`;

// Histórico da sessão por instância de conversa
const sessions = new Map();

async function chatWithAssistant(sessionId, userMessage) {
  if (!OPENROUTER_KEY) {
    return "❌ OPENROUTER_KEY não configurada no servidor.";
  }

  if (!sessions.has(sessionId)) {
    sessions.set(sessionId, []);
  }
  const history = sessions.get(sessionId);

  history.push({ role: "user", content: userMessage });

  // Mantém últimas 20 mensagens para não explodir o contexto
  const trimmed = history.slice(-20);

  try {
    const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENROUTER_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://webhook-mary-production.up.railway.app",
        "X-Title": "Mary Admin Dashboard",
      },
      body: JSON.stringify({
        model: "anthropic/claude-3-haiku",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...trimmed],
        max_tokens: 800,
        temperature: 0.7,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error?.message || `HTTP ${res.status}`);
    }

    const data = await res.json();
    const reply = data.choices?.[0]?.message?.content || "Sem resposta.";

    history.push({ role: "assistant", content: reply });

    // Limpa sessões antigas (> 2h)
    if (sessions.size > 100) {
      const cutoff = Date.now() - 2 * 60 * 60 * 1000;
      for (const [id] of sessions) {
        if (parseInt(id.split("-")[0]) < cutoff) sessions.delete(id);
      }
    }

    return reply;
  } catch (e) {
    console.warn("[Assistant] Erro:", e.message);
    return `❌ Erro ao contatar o assistente: ${e.message}`;
  }
}

module.exports = { chatWithAssistant };
