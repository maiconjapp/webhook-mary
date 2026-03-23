/**
 * Dashboard Admin da Mary — HTML completo em arquivo único.
 * Tema: WhatsApp dark (#111b21) com verde #25d366.
 */

const { DEFAULT_TEMPLATE } = require("./followup");

function getDashboardHTML() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Mary — Dashboard</title>
<script src="https://cdn.tailwindcss.com"></script>
<script>
tailwind.config = {
  theme: { extend: { colors: { wa: {
    bg:'#111b21', surface:'#1f2c34', surface2:'#2a3942',
    green:'#25d366', greenDark:'#1da851', text:'#e9edef',
    muted:'#8696a0', border:'#313d45', danger:'#ef4444', warn:'#f59e0b'
  }}}}
}
</script>
<style>
  *{box-sizing:border-box}
  body{background:#111b21;color:#e9edef;font-family:'Segoe UI',sans-serif;margin:0}
  ::-webkit-scrollbar{width:6px}
  ::-webkit-scrollbar-track{background:#1f2c34}
  ::-webkit-scrollbar-thumb{background:#313d45;border-radius:3px}
  .badge{display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600}
  .chip{cursor:pointer;padding:5px 14px;border-radius:999px;font-size:13px;border:1px solid #313d45;transition:all .15s;background:transparent;color:#8696a0}
  .chip.active{background:#25d366;border-color:#25d366;color:#111b21;font-weight:700}
  .chip:not(.active):hover{border-color:#8696a0;color:#e9edef}
  .btn-green{background:#25d366;color:#111b21;font-weight:700;padding:8px 20px;border-radius:8px;border:none;cursor:pointer;transition:background .15s;font-size:14px}
  .btn-green:hover{background:#1da851}
  .btn-green:disabled{background:#313d45;color:#8696a0;cursor:not-allowed}
  .btn-outline{background:transparent;color:#e9edef;border:1px solid #313d45;padding:7px 16px;border-radius:8px;cursor:pointer;font-size:13px;transition:border-color .15s}
  .btn-outline:hover{border-color:#8696a0}
  .btn-sm{padding:4px 12px;font-size:12px;border-radius:6px}
  tr:hover td{background:#243039}
  input[type=checkbox]{accent-color:#25d366;width:15px;height:15px;cursor:pointer}
  textarea,select{background:#2a3942;border:1px solid #313d45;color:#e9edef;border-radius:8px;padding:10px;width:100%;resize:vertical;outline:none;font-family:inherit}
  textarea:focus,select:focus{border-color:#25d366}
  input[type=text],input[type=search],input[type=number]{background:#2a3942;border:1px solid #313d45;color:#e9edef;border-radius:8px;padding:8px 12px;outline:none;font-family:inherit}
  input:focus{border-color:#25d366}
  .card{background:#1f2c34;border:1px solid #313d45;border-radius:12px}
  .stat-card{cursor:pointer;transition:border-color .15s,transform .1s}
  .stat-card:hover{border-color:#25d366;transform:translateY(-1px)}
  .stat-card.active-filter{border-color:#25d366;background:#1a3326}
  .progress-line{padding:4px 0;font-size:13px}
  .progress-line.sent{color:#25d366}
  .progress-line.failed{color:#ef4444}
  .progress-line.waiting{color:#f59e0b}
  .progress-line.sending{color:#8696a0}
  .bulk-bar{background:#1a3326;border:1px solid #25d366;border-radius:10px;padding:10px 16px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px;animation:slideIn .2s}
  @keyframes slideIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
  .tag-lead{background:rgba(245,158,11,.15);color:#f59e0b;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .tag-cliente{background:rgba(37,211,102,.12);color:#25d366;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600}
  .tag-lixo{background:rgba(134,150,160,.1);color:#8696a0;padding:2px 8px;border-radius:999px;font-size:11px}
  .fu-row{display:flex;align-items:center;gap:10px;padding:9px 6px;border-bottom:1px solid #313d45;cursor:pointer;transition:background .1s;border-radius:6px}
  .fu-row:hover{background:#243039}
  .fu-row input[type=checkbox]{flex-shrink:0}
</style>
</head>
<body>

<!-- HEADER -->
<header style="background:#1f2c34;border-bottom:1px solid #313d45" class="px-6 py-3 flex items-center justify-between sticky top-0 z-10">
  <div class="flex items-center gap-3">
    <div style="background:#25d366;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:18px;color:#111b21">M</div>
    <div>
      <div style="font-weight:700;font-size:16px">Mary Admin</div>
      <div style="font-size:11px;color:#8696a0">Marido de Aluguel · Petrópolis</div>
    </div>
  </div>
  <div class="flex items-center gap-3 flex-wrap justify-end">
    <div id="wa-status-badge" class="badge" style="background:#2a3942;color:#8696a0">
      <span id="wa-dot" style="width:8px;height:8px;border-radius:50%;background:#8696a0;display:inline-block;flex-shrink:0"></span>
      <span id="wa-status-text">Verificando...</span>
    </div>
    <button onclick="openQR()" class="btn-outline btn-sm" id="qr-btn" style="display:none">📱 Escanear QR</button>
    <button onclick="resetSession()" class="btn-outline btn-sm" style="color:#ef4444;border-color:rgba(239,68,68,.4)">🔄 Reset sessão</button>
  </div>
</header>

<!-- STATS (4 cards clicáveis) -->
<div class="px-6 py-4" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:12px;max-width:1200px">
  <div class="card stat-card p-4 text-center" onclick="applyCardFilter('all')" id="card-all">
    <div style="font-size:28px;font-weight:800;color:#25d366" id="stat-total">—</div>
    <div style="font-size:11px;color:#8696a0;margin-top:4px">Total de clientes</div>
    <div style="font-size:11px;color:#8696a0;margin-top:2px" id="stat-leads-count"></div>
  </div>
  <div class="card stat-card p-4 text-center" onclick="applyCardFilter('active')" id="card-active">
    <div style="font-size:28px;font-weight:800;color:#e9edef" id="stat-active">—</div>
    <div style="font-size:11px;color:#8696a0;margin-top:4px">Ativos (30 dias)</div>
    <div style="font-size:11px;color:#8696a0;margin-top:2px" id="stat-active-pct"></div>
  </div>
  <div class="card stat-card p-4 text-center" onclick="applyCardFilter('inactive')" id="card-inactive">
    <div style="font-size:28px;font-weight:800;color:#f59e0b" id="stat-inactive">—</div>
    <div style="font-size:11px;color:#8696a0;margin-top:4px">Sem contato +14d</div>
    <div style="font-size:11px;color:#8696a0;margin-top:2px">Clique para ver</div>
  </div>
  <div class="card stat-card p-4 text-center" onclick="applyCardFilter('followup')" id="card-followup">
    <div style="font-size:28px;font-weight:800;color:#f59e0b" id="stat-today">—</div>
    <div style="font-size:11px;color:#8696a0;margin-top:4px">Follow-ups hoje</div>
    <div style="font-size:11px;color:#8696a0;margin-top:2px">Clique para filtrar</div>
  </div>
</div>

<!-- QR MODAL -->
<div id="qr-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:50;align-items:center;justify-content:center">
  <div class="card" style="padding:32px;text-align:center;max-width:360px;border-radius:16px">
    <h3 style="font-size:18px;font-weight:700;margin-bottom:8px">📱 Vincule o WhatsApp</h3>
    <p style="font-size:13px;color:#8696a0;margin-bottom:16px">WhatsApp → Dispositivos vinculados → Vincular</p>
    <img id="qr-img" src="" style="border:4px solid #25d366;border-radius:10px;background:white;padding:8px;max-width:240px;margin:0 auto;display:block" />
    <p style="font-size:11px;color:#8696a0;margin-top:10px">QR atualiza a cada 30s</p>
    <button onclick="closeQR()" class="btn-outline" style="margin-top:16px">Fechar</button>
  </div>
</div>

<!-- TABS -->
<div class="px-6 mt-1">
  <div style="display:flex;gap:4px;border-bottom:1px solid #313d45;margin-bottom:16px;flex-wrap:wrap">
    <button onclick="showTab('clients')" id="tab-clients" class="tab-btn active-tab">👥 Clientes</button>
    <button onclick="showTab('followup')" id="tab-followup" class="tab-btn">📣 Follow-up CRM</button>
    <button onclick="showTab('blocked')" id="tab-blocked" class="tab-btn">🚫 Bloqueados</button>
    <button onclick="showTab('chat')" id="tab-chat" class="tab-btn">🤖 Assistente</button>
  </div>
  <style>
    .tab-btn{padding:8px 16px;font-size:14px;font-weight:600;border:none;background:none;cursor:pointer;color:#8696a0;border-bottom:2px solid transparent;transition:all .15s}
    .tab-btn.active-tab{color:#25d366;border-bottom-color:#25d366}
    .tab-btn:hover:not(.active-tab){color:#e9edef}
  </style>

  <!-- ═══ TAB CLIENTES ═══ -->
  <div id="panel-clients">
    <!-- Filtros e busca -->
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap">
      <input type="search" id="search" placeholder="🔍 Nome, bairro, serviço, telefone..." style="flex:1;min-width:200px" oninput="renderTable()" />
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="chip active" onclick="setStatusFilter('all',this)">Todos</button>
        <button class="chip" onclick="setStatusFilter('cliente',this)">✅ Clientes</button>
        <button class="chip" onclick="setStatusFilter('lead',this)">🟡 Leads</button>
        <button class="chip" onclick="setStatusFilter('lixo',this)">🗑 Não qualificados</button>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button class="chip" id="chip-all" onclick="setDaysFilter(0,this)">Qualquer data</button>
        <button class="chip" id="chip-7" onclick="setDaysFilter(7,this)">+7d</button>
        <button class="chip" id="chip-14" onclick="setDaysFilter(14,this)">+14d</button>
        <button class="chip" id="chip-30" onclick="setDaysFilter(30,this)">+30d</button>
      </div>
      <button class="btn-outline btn-sm" onclick="loadClients()">↻ Atualizar</button>
    </div>

    <!-- Bulk action bar -->
    <div id="bulk-bar" class="bulk-bar" style="display:none">
      <span style="color:#25d366;font-weight:700" id="bulk-count">0 selecionados</span>
      <button class="btn-green btn-sm" onclick="goFollowUpSelected()">📣 Follow-up selecionados</button>
      <button class="btn-outline btn-sm" onclick="deselectAll()">✕ Limpar seleção</button>
    </div>

    <div style="overflow-x:auto;border-radius:10px;border:1px solid #313d45">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#1f2c34;text-align:left">
            <th style="padding:10px 12px;color:#8696a0;font-weight:600;white-space:nowrap">
              <input type="checkbox" id="select-all" onchange="toggleAll(this)">
            </th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Status</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Nome / Telefone</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Bairro</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Último serviço</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Contato</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Follow-up</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600"></th>
          </tr>
        </thead>
        <tbody id="clients-tbody">
          <tr><td colspan="8" style="padding:24px;text-align:center;color:#8696a0">Carregando...</td></tr>
        </tbody>
      </table>
    </div>
    <div id="table-footer" style="font-size:12px;margin-top:8px;color:#8696a0"></div>
  </div>

  <!-- ═══ TAB FOLLOW-UP CRM (2 colunas) ═══ -->
  <div id="panel-followup" style="display:none">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:1200px">
      <!-- COLUNA ESQUERDA: Seleção de clientes -->
      <div>
        <div class="card p-4 mb-4">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <h3 style="font-weight:600;font-size:15px">🎯 Clientes elegíveis</h3>
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <span style="font-size:12px;color:#8696a0">Sem contato há +</span>
              <select id="days-select" style="width:auto;padding:4px 8px;font-size:13px;border-radius:6px" onchange="renderFollowUpList()">
                <option value="7">7 dias</option>
                <option value="14" selected>14 dias</option>
                <option value="30">30 dias</option>
              </select>
              <button onclick="autoSelect()" class="btn-outline btn-sm">⚡ Auto-selecionar 5</button>
            </div>
          </div>
          <div id="fu-client-list" style="max-height:340px;overflow-y:auto">
            <p style="color:#8696a0;font-size:13px">Carregando lista...</p>
          </div>
        </div>
        <div class="card p-4" style="background:#0d1418">
          <div style="font-size:12px;color:#8696a0;margin-bottom:8px">📋 Log de envio</div>
          <div style="min-height:80px;font-family:monospace" id="fu-log">
            <span style="color:#8696a0;font-size:12px">Aguardando envio...</span>
          </div>
        </div>
      </div>

      <!-- COLUNA DIREITA: Mensagem + Preview + Enviar -->
      <div>
        <div class="card p-4 mb-4">
          <h3 style="font-weight:600;font-size:15px;margin-bottom:8px">✏️ Mensagem de follow-up</h3>
          <p style="font-size:12px;color:#8696a0;margin-bottom:8px">
            Use <code style="background:#2a3942;padding:1px 6px;border-radius:4px">{nome}</code> e
            <code style="background:#2a3942;padding:1px 6px;border-radius:4px">{servico_recente}</code>
          </p>
          <textarea id="fu-template" rows="7">${DEFAULT_TEMPLATE.replace(/`/g, '\\`')}</textarea>
          <button onclick="resetTemplate()" class="btn-outline btn-sm" style="margin-top:8px">↩ Restaurar padrão</button>
        </div>

        <div class="card p-4 mb-4">
          <div style="font-size:13px;font-weight:600;margin-bottom:8px;color:#8696a0">👁 Preview com primeiro selecionado</div>
          <div id="fu-preview" style="background:#005c4b;border-radius:12px 12px 4px 12px;padding:12px 14px;font-size:13px;line-height:1.6;white-space:pre-wrap;color:#e9edef;min-height:48px">
            <span style="color:#8696a0">Selecione um cliente para visualizar</span>
          </div>
        </div>

        <div class="card p-4">
          <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
            <div>
              <div id="selected-info" style="font-size:14px;color:#8696a0">Nenhum selecionado</div>
              <div style="font-size:11px;color:#8696a0;margin-top:2px">⏱ 30–60s entre mensagens · Máx 5 por lote</div>
            </div>
            <div style="display:flex;align-items:center;gap:8px">
              <div id="batch-count" class="badge" style="background:#2a3942;color:#8696a0">0 sel.</div>
              <button id="send-btn" onclick="sendFollowUp()" class="btn-green" disabled>🚀 Enviar Follow-up</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>

  <!-- ═══ TAB BLOQUEADOS ═══ -->
  <div id="panel-blocked" style="display:none;max-width:640px">
    <div class="card p-4 mb-4">
      <h3 style="font-weight:600;margin-bottom:12px">➕ Bloquear número</h3>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <input type="text" id="block-number" placeholder="5524999999999 (só dígitos)" style="flex:1;min-width:180px" />
        <input type="text" id="block-label" placeholder="Motivo (opcional)" style="flex:1;min-width:140px" />
        <button onclick="addBlocked()" class="btn-green">Bloquear</button>
      </div>
      <p style="font-size:12px;color:#8696a0;margin-top:8px">Mary não responderá mais esse número. Pode desbloquear a qualquer momento.</p>
    </div>
    <div class="card p-4">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <h3 style="font-weight:600">🚫 Números bloqueados</h3>
        <button onclick="loadBlocked()" class="btn-outline btn-sm">↻ Atualizar</button>
      </div>
      <div id="blocked-list"><p style="color:#8696a0;font-size:13px">Carregando...</p></div>
    </div>
  </div>

  <!-- ═══ TAB ASSISTENTE ═══ -->
  <div id="panel-chat" style="display:none;max-width:720px">
    <div class="card" style="overflow:hidden">
      <div style="background:#1f2c34;border-bottom:1px solid #313d45;padding:14px 20px;display:flex;align-items:center;gap:10px">
        <div style="background:#25d366;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">🤖</div>
        <div>
          <div style="font-weight:600">Assistente Mary</div>
          <div style="font-size:12px;color:#8696a0">Dúvidas sobre o sistema, configurações e atendimento</div>
        </div>
      </div>
      <div id="chat-messages" style="height:380px;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="background:#2a3942;border-radius:12px 12px 12px 4px;padding:12px 14px;max-width:85%;font-size:14px;line-height:1.5">
          Oi! Sou o assistente de administração da Mary. 😊<br><br>
          Posso te ajudar com:<br>
          • Configurações da Mary<br>
          • Como usar o dashboard<br>
          • Dicas de follow-up e atendimento<br>
          • Melhorar as respostas dela<br><br>
          O que você precisa?
        </div>
      </div>
      <div style="border-top:1px solid #313d45;padding:12px 16px;display:flex;gap:8px">
        <input type="text" id="chat-input" placeholder="Digite sua mensagem..." style="flex:1"
          onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat()}" />
        <button onclick="sendChat()" class="btn-green" id="chat-send-btn">Enviar</button>
      </div>
    </div>
  </div>
</div>

<div style="height:48px"></div>

<script>
// ── Estado global ──────────────────────────────────────────────────────────────
let allClients = [];
let selectedContacts = new Set();
let filterDaysVal = 0;
let statusFilterVal = 'all';
let cardFilterVal = 'all';
const BASE = window.location.origin;
const TOKEN = new URLSearchParams(window.location.search).get('token') || '';
const HEADERS = TOKEN ? {'x-dashboard-token': TOKEN} : {};
const DEFAULT_TPL = \`${DEFAULT_TEMPLATE.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`;

// Nomes que indicam contato não qualificado (sistema, spam, bot)
const JUNK_PATTERNS = [
  /^whatsapp$/i, /acesso recente/i, /backup em andamento/i,
  /procurando novas/i, /mensagens de \\d+ conversa/i,
  /itaú/i, /bradesco/i, /santander/i, /nubank/i, /inter/i, /sicoob/i,
  /renegociação/i, /ifood/i, /uber/i, /99 (táxi|pop|driver)/i,
  /delivery/i, /magazineluiza/i, /americanas/i, /mercadolivre/i,
];

function classifyClient(c) {
  const name = (c.nome || '').trim();
  if (!name || name.length < 2) return 'lixo';
  if (JUNK_PATTERNS.some(p => p.test(name))) return 'lixo';
  // número puro no nome = provavelmente não qualificado
  if (/^\\d{8,}$/.test(name.replace(/\\s/g,''))) return 'lixo';
  if ((c.servicos||[]).length > 0) return 'cliente';
  return 'lead';
}

// ── Tabs ──────────────────────────────────────────────────────────────────────
function showTab(tab) {
  ['clients','followup','blocked','chat'].forEach(t => {
    const p = document.getElementById('panel-'+t);
    const b = document.getElementById('tab-'+t);
    if (p) p.style.display = t === tab ? '' : 'none';
    if (b) b.classList.toggle('active-tab', t === tab);
  });
  if (tab === 'followup') renderFollowUpList();
  if (tab === 'blocked') loadBlocked();
}

// ── Status & Stats ─────────────────────────────────────────────────────────────
async function loadStatus() {
  try {
    const r = await fetch(BASE + '/api/status', {headers: HEADERS});
    const d = await r.json();
    const dot = document.getElementById('wa-dot');
    const txt = document.getElementById('wa-status-text');
    const badge = document.getElementById('wa-status-badge');
    const qrBtn = document.getElementById('qr-btn');
    if (d.connected) {
      dot.style.background = '#25d366';
      txt.textContent = 'WhatsApp conectado';
      badge.style.cssText = 'background:rgba(37,211,102,.15);color:#25d366;display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600';
      qrBtn.style.display = 'none';
    } else if (d.qr) {
      dot.style.background = '#f59e0b';
      txt.textContent = 'Aguardando QR scan';
      badge.style.cssText = 'background:rgba(245,158,11,.15);color:#f59e0b;display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600';
      qrBtn.style.display = '';
      document.getElementById('qr-img').src = d.qr;
    } else {
      dot.style.background = '#ef4444';
      txt.textContent = 'Desconectado';
      badge.style.cssText = 'background:rgba(239,68,68,.15);color:#ef4444;display:inline-flex;align-items:center;gap:4px;padding:2px 10px;border-radius:999px;font-size:12px;font-weight:600';
      qrBtn.style.display = '';
    }
    if (d.stats) updateStatCards(d.stats);
  } catch(e) { console.warn('Status error:', e.message); }
}

function updateStatCards(stats) {
  document.getElementById('stat-total').textContent = stats.total_clients ?? '—';
  document.getElementById('stat-active').textContent = stats.active_last_30d ?? '—';
  document.getElementById('stat-today').textContent = stats.followups_sent_today ?? '—';
  // Calcula inativos +14d
  const inactive = allClients.filter(c => (c.days_since_contact||0) >= 14 && classifyClient(c) !== 'lixo').length;
  document.getElementById('stat-inactive').textContent = inactive || '0';
  // Leads vs clientes
  const leads = allClients.filter(c => classifyClient(c) === 'lead').length;
  const clientes = allClients.filter(c => classifyClient(c) === 'cliente').length;
  if (leads || clientes) {
    document.getElementById('stat-leads-count').textContent = clientes + ' clientes · ' + leads + ' leads';
  }
  const pct = stats.total_clients > 0 ? Math.round((stats.active_last_30d / stats.total_clients) * 100) : 0;
  document.getElementById('stat-active-pct').textContent = pct + '% do total';
}

// ── Filtros dos cards ─────────────────────────────────────────────────────────
function applyCardFilter(type) {
  cardFilterVal = type;
  // Destaque do card ativo
  ['all','active','inactive','followup'].forEach(k => {
    const el = document.getElementById('card-' + (k === 'active' ? 'active' : k === 'inactive' ? 'inactive' : k === 'followup' ? 'followup' : 'all'));
    if (el) el.classList.toggle('active-filter', k === type);
  });
  // Aplica filtro de dias correspondente
  if (type === 'inactive') {
    filterDaysVal = 14;
    document.querySelectorAll('.chip[id^=chip]').forEach(c => c.classList.remove('active'));
    const c14 = document.getElementById('chip-14');
    if (c14) c14.classList.add('active');
  } else if (type === 'active') {
    filterDaysVal = 0;
    statusFilterVal = 'cliente';
  } else {
    filterDaysVal = 0;
  }
  renderTable();
  showTab('clients');
}

// ── Clientes ──────────────────────────────────────────────────────────────────
async function loadClients() {
  try {
    const r = await fetch(BASE + '/api/clients', {headers: HEADERS});
    allClients = await r.json();
    renderTable();
    renderFollowUpList();
    updateStatCards({
      total_clients: allClients.filter(c => classifyClient(c) !== 'lixo').length,
      active_last_30d: allClients.filter(c => classifyClient(c) !== 'lixo' && (c.days_since_contact||99) <= 30).length,
      followups_sent_today: 0,
    });
  } catch(e) {
    document.getElementById('clients-tbody').innerHTML =
      '<tr><td colspan="8" style="padding:24px;text-align:center;color:#ef4444">Erro ao carregar clientes</td></tr>';
  }
}

function setDaysFilter(days, el) {
  filterDaysVal = days;
  document.querySelectorAll('.chip[id^=chip]').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderTable();
}

function setStatusFilter(status, el) {
  statusFilterVal = status;
  document.querySelectorAll('.chip:not([id^=chip])').forEach(c => c.classList.remove('active'));
  if (el) el.classList.add('active');
  renderTable();
}

function renderTable() {
  const q = (document.getElementById('search').value || '').toLowerCase();
  let rows = allClients.filter(c => {
    const cls = classifyClient(c);
    // Filtro de status
    if (statusFilterVal !== 'all' && cls !== statusFilterVal) return false;
    // Filtro de dias
    if (filterDaysVal > 0 && (c.days_since_contact || 0) < filterDaysVal) return false;
    // Filtro de card
    if (cardFilterVal === 'inactive' && (c.days_since_contact||0) < 14) return false;
    if (cardFilterVal === 'followup' && !c.follow_up_sent_at) return false;
    // Busca textual
    if (!q) return true;
    return [c.nome, c.bairro, c.contact, ...(c.servicos||[])].some(v => v && v.toLowerCase().includes(q));
  });

  const tbody = document.getElementById('clients-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="8" style="padding:24px;text-align:center;color:#8696a0">Nenhum cliente encontrado</td></tr>';
    document.getElementById('table-footer').textContent = '';
    return;
  }

  tbody.innerHTML = rows.map(c => {
    const cls = classifyClient(c);
    const checked = selectedContacts.has(c.contact) ? 'checked' : '';
    const days = c.days_since_contact ?? 0;
    const daysColor = days >= 30 ? '#ef4444' : days >= 14 ? '#f59e0b' : '#25d366';
    const daysBg = days >= 30 ? 'rgba(239,68,68,.15)' : days >= 14 ? 'rgba(245,158,11,.15)' : 'rgba(37,211,102,.12)';
    const daysBadge = \`<span class="badge" style="background:\${daysBg};color:\${daysColor}">\${days}d</span>\`;
    const fuDate = c.follow_up_sent_at
      ? \`<span style="color:#25d366;font-size:12px">✓ \${new Date(c.follow_up_sent_at).toLocaleDateString('pt-BR')}</span>\`
      : \`<button onclick="event.stopPropagation();quickFollowUp('\${c.contact}')"
          style="background:rgba(37,211,102,.1);color:#25d366;border:1px solid rgba(37,211,102,.3);border-radius:6px;padding:3px 10px;font-size:11px;cursor:pointer">+ Agendar</button>\`;
    const lastService = (c.servicos||[]).slice(-1)[0] || '—';
    const statusTag = cls === 'cliente'
      ? '<span class="tag-cliente">Cliente</span>'
      : cls === 'lead'
      ? '<span class="tag-lead">Lead</span>'
      : '<span class="tag-lixo">N/A</span>';

    return \`<tr style="border-top:1px solid #313d45;cursor:pointer" onclick="toggleRow('\${c.contact}',this)">
      <td style="padding:10px 12px"><input type="checkbox" \${checked} onclick="event.stopPropagation();toggleContact('\${c.contact}',this)"></td>
      <td style="padding:10px 12px">\${statusTag}</td>
      <td style="padding:10px 12px">
        <div style="font-weight:600">\${c.nome || '<span style=color:#8696a0>—</span>'}</div>
        <div style="font-size:11px;color:#8696a0;font-family:monospace">\${c.contact}</div>
      </td>
      <td style="padding:10px 12px;color:#8696a0">\${c.bairro || '—'}</td>
      <td style="padding:10px 12px;color:#8696a0;max-width:160px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${lastService}</td>
      <td style="padding:10px 12px">\${daysBadge}</td>
      <td style="padding:10px 12px">\${fuDate}</td>
      <td style="padding:10px 12px">
        <a href="https://wa.me/\${c.contact}" target="_blank" onclick="event.stopPropagation()"
           style="color:#25d366;font-size:18px;text-decoration:none" title="Abrir conversa">💬</a>
      </td>
    </tr>\`;
  }).join('');

  document.getElementById('table-footer').textContent =
    \`\${rows.length} de \${allClients.length} clientes\${q ? ' · busca: "' + q + '"' : ''}\`;
  updateBulkBar();
}

function toggleRow(contact, tr) {
  const cb = tr.querySelector('input[type=checkbox]');
  cb.checked = !cb.checked;
  toggleContact(contact, cb);
}
function toggleContact(contact, cb) {
  cb.checked ? selectedContacts.add(contact) : selectedContacts.delete(contact);
  updateBulkBar();
  updateSendButton();
}
function toggleAll(el) {
  document.querySelectorAll('#clients-tbody input[type=checkbox]').forEach(cb => {
    cb.checked = el.checked;
    const tds = cb.closest('tr').querySelectorAll('td');
    const contact = tds[2]?.querySelector('div:last-child')?.textContent?.trim();
    if (contact) el.checked ? selectedContacts.add(contact) : selectedContacts.delete(contact);
  });
  updateBulkBar();
  updateSendButton();
}
function deselectAll() {
  selectedContacts.clear();
  document.querySelectorAll('#clients-tbody input[type=checkbox]').forEach(cb => cb.checked = false);
  const sa = document.getElementById('select-all');
  if (sa) sa.checked = false;
  updateBulkBar();
  updateSendButton();
}
function updateBulkBar() {
  const n = selectedContacts.size;
  const bar = document.getElementById('bulk-bar');
  if (bar) {
    bar.style.display = n > 0 ? 'flex' : 'none';
    document.getElementById('bulk-count').textContent = n + ' selecionado' + (n !== 1 ? 's' : '');
  }
}
function quickFollowUp(contact) {
  selectedContacts.clear();
  selectedContacts.add(contact);
  showTab('followup');
  renderFollowUpList();
  updateSendButton();
}
function goFollowUpSelected() {
  showTab('followup');
  renderFollowUpList();
  updateSendButton();
}
function updateSendButton() {
  const n = selectedContacts.size;
  const btn = document.getElementById('send-btn');
  const cnt = document.getElementById('batch-count');
  const info = document.getElementById('selected-info');
  if (btn) {
    btn.disabled = n === 0 || n > 5;
    btn.textContent = n > 5 ? '⚠️ Máx 5 por lote' : \`🚀 Enviar (\${n})\`;
  }
  if (cnt) {
    cnt.textContent = n + ' sel.';
    cnt.style.background = n > 0 && n <= 5 ? 'rgba(37,211,102,.15)' : 'rgba(239,68,68,.15)';
    cnt.style.color = n > 0 && n <= 5 ? '#25d366' : '#ef4444';
  }
  if (info) {
    info.textContent = n === 0 ? 'Nenhum selecionado'
      : n > 5 ? \`⚠️ \${n} selecionados — reduza para máx 5\`
      : \`✅ \${n} cliente\${n>1?'s':''} pronto\${n>1?'s':''} para enviar\`;
    info.style.color = n > 5 ? '#ef4444' : n > 0 ? '#25d366' : '#8696a0';
  }
  updatePreview();
}

// ── Follow-up CRM ─────────────────────────────────────────────────────────────
function renderFollowUpList() {
  const days = parseInt((document.getElementById('days-select') || {}).value || '14');
  const el = document.getElementById('fu-client-list');
  if (!el) return;
  const qualify = allClients.filter(c => (c.days_since_contact||0) >= days && classifyClient(c) !== 'lixo');
  if (!qualify.length) {
    el.innerHTML = '<p style="color:#8696a0;font-size:13px;padding:8px 0">Nenhum cliente inativo há ' + days + ' dias.</p>';
    return;
  }
  el.innerHTML = qualify.map(c => {
    const checked = selectedContacts.has(c.contact) ? 'checked' : '';
    const cls = classifyClient(c);
    const tag = cls === 'cliente' ? '<span class="tag-cliente">Cliente</span>' : '<span class="tag-lead">Lead</span>';
    const fuInfo = c.follow_up_sent_at
      ? \`<span style="color:#25d366;font-size:11px">✓ Enviado \${new Date(c.follow_up_sent_at).toLocaleDateString('pt-BR')}</span>\`
      : '';
    return \`<div class="fu-row" onclick="toggleFuRow('\${c.contact}',this)">
      <input type="checkbox" \${checked} onclick="event.stopPropagation();toggleContact('\${c.contact}',this)">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
          <span style="font-weight:600">\${c.nome || c.contact}</span>
          \${tag} \${fuInfo}
        </div>
        <div style="font-size:11px;color:#8696a0;margin-top:2px">
          \${c.days_since_contact}d atrás · \${(c.servicos||[]).slice(-1)[0]||'sem serviço registrado'}
          \${c.bairro ? ' · ' + c.bairro : ''}
        </div>
      </div>
      \${selectedContacts.has(c.contact) ? '<span style="color:#25d366;font-size:16px">✓</span>' : ''}
    </div>\`;
  }).join('');
  updateSendButton();
}

function toggleFuRow(contact, el) {
  const cb = el.querySelector('input[type=checkbox]');
  cb.checked = !cb.checked;
  toggleContact(contact, cb);
  renderFollowUpList();
}

function autoSelect() {
  selectedContacts.clear();
  const days = parseInt((document.getElementById('days-select')||{}).value || '14');
  allClients
    .filter(c => (c.days_since_contact||0) >= days && classifyClient(c) !== 'lixo'
      && (c.days_since_followup === null || c.days_since_followup >= 2))
    .slice(0, 5)
    .forEach(c => selectedContacts.add(c.contact));
  renderFollowUpList();
  renderTable();
  updateSendButton();
}

function updatePreview() {
  const prevEl = document.getElementById('fu-preview');
  if (!prevEl) return;
  const tplEl = document.getElementById('fu-template');
  const first = allClients.find(c => selectedContacts.has(c.contact));
  if (!first || !tplEl) {
    prevEl.innerHTML = '<span style="color:#8696a0">Selecione um cliente para visualizar</span>';
    return;
  }
  const tpl = tplEl.value;
  const nome = (first.nome||'').split(' ')[0] || 'cliente';
  const servico = (first.servicos||[]).slice(-1)[0] || 'reparos em casa';
  prevEl.textContent = tpl.replace(/\\{nome\\}/g, nome).replace(/\\{servico_recente\\}/g, servico);
}

function resetTemplate() {
  const el = document.getElementById('fu-template');
  if (el) { el.value = DEFAULT_TPL; updatePreview(); }
}

async function sendFollowUp() {
  const contacts = [...selectedContacts];
  if (!contacts.length || contacts.length > 5) return;
  const tplEl = document.getElementById('fu-template');
  const template = tplEl ? tplEl.value : DEFAULT_TPL;
  const log = document.getElementById('fu-log');
  const btn = document.getElementById('send-btn');
  if (log) log.innerHTML = '';
  if (btn) btn.disabled = true;

  const addLog = (text, cls) => {
    if (!log) return;
    const d = document.createElement('div');
    d.className = 'progress-line ' + (cls||'');
    d.textContent = text;
    log.appendChild(d);
    log.scrollTop = log.scrollHeight;
  };

  addLog('🚀 Iniciando envio...', 'sending');
  const contactData = contacts.map(c => allClients.find(a => a.contact === c)).filter(Boolean);

  try {
    const res = await fetch(BASE + '/api/followup', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', ...HEADERS},
      body: JSON.stringify({ contacts: contactData, template })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({error: 'Erro desconhecido'}));
      addLog('❌ ' + (err.error || res.statusText), 'failed');
      if (btn) btn.disabled = false;
      return;
    }
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value);
      const lines = buf.split('\\n');
      buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const ev = JSON.parse(line);
          if (ev.done) {
            addLog(\`✅ Concluído: \${ev.sent} enviados, \${ev.failed} falhas.\`, ev.failed > 0 ? 'failed' : 'sent');
            await loadClients(); await loadStatus();
          } else if (ev.status === 'sent') addLog(\`✅ Enviado para \${ev.nome||ev.contact}\`, 'sent');
          else if (ev.status === 'failed') addLog(\`❌ Falha: \${ev.nome||ev.contact} — \${ev.error}\`, 'failed');
          else if (ev.status === 'waiting') addLog(\`⏳ \${ev.msg}\`, 'waiting');
          else if (ev.status === 'sending') addLog(\`📤 Enviando para \${ev.nome||ev.contact}...\`, 'sending');
        } catch {}
      }
    }
  } catch(e) {
    addLog('❌ Erro de rede: ' + e.message, 'failed');
  }
  if (btn) btn.disabled = false;
}

// ── Bloqueados ────────────────────────────────────────────────────────────────
async function loadBlocked() {
  const el = document.getElementById('blocked-list');
  try {
    const r = await fetch(BASE + '/api/blocked', {headers: HEADERS});
    const list = await r.json();
    if (!list.length) { el.innerHTML = '<p style="color:#8696a0;font-size:13px">Nenhum número bloqueado.</p>'; return; }
    el.innerHTML = list.map(b => \`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #313d45">
        <div>
          <span style="font-family:monospace">\${b.contact}</span>
          \${b.label ? \`<span style="color:#8696a0;font-size:12px;margin-left:8px">· \${b.label}</span>\` : ''}
          <div style="color:#8696a0;font-size:11px;margin-top:2px">Bloqueado em \${new Date(b.blocked_at).toLocaleDateString('pt-BR')}</div>
        </div>
        <button onclick="removeBlocked('\${b.contact}')"
          style="background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer">
          Desbloquear
        </button>
      </div>
    \`).join('');
  } catch(e) { el.innerHTML = '<p style="color:#ef4444;font-size:13px">Erro: ' + e.message + '</p>'; }
}

async function addBlocked() {
  const num = document.getElementById('block-number').value.trim();
  const label = document.getElementById('block-label').value.trim();
  if (!num) { alert('Digite o número'); return; }
  try {
    const r = await fetch(BASE + '/api/blocked', {
      method: 'POST', headers: {'Content-Type':'application/json',...HEADERS},
      body: JSON.stringify({contact: num, label})
    });
    const d = await r.json();
    if (d.ok) {
      document.getElementById('block-number').value = '';
      document.getElementById('block-label').value = '';
      loadBlocked();
    } else alert('Erro: ' + d.error);
  } catch(e) { alert('Erro: ' + e.message); }
}

async function removeBlocked(contact) {
  if (!confirm('Desbloquear ' + contact + '?')) return;
  try {
    await fetch(BASE + '/api/blocked/' + encodeURIComponent(contact), {method:'DELETE', headers: HEADERS});
    loadBlocked();
  } catch(e) { alert('Erro: ' + e.message); }
}

// ── Chat assistente ────────────────────────────────────────────────────────────
let chatSessionId = Date.now() + '-' + Math.random().toString(36).slice(2);

function addChatMsg(text, role) {
  const msgs = document.getElementById('chat-messages');
  const div = document.createElement('div');
  div.style.cssText = role === 'user'
    ? 'background:#005c4b;border-radius:12px 12px 4px 12px;padding:12px 14px;max-width:85%;align-self:flex-end;font-size:14px;line-height:1.5;white-space:pre-wrap'
    : 'background:#2a3942;border-radius:12px 12px 12px 4px;padding:12px 14px;max-width:85%;font-size:14px;line-height:1.5;white-space:pre-wrap';
  div.textContent = text;
  msgs.appendChild(div);
  msgs.scrollTop = msgs.scrollHeight;
  return div;
}

async function sendChat() {
  const input = document.getElementById('chat-input');
  const btn = document.getElementById('chat-send-btn');
  const msg = input.value.trim();
  if (!msg) return;
  input.value = '';
  btn.disabled = true;
  addChatMsg(msg, 'user');
  const typing = addChatMsg('...', 'assistant');
  try {
    const r = await fetch(BASE + '/api/chat', {
      method: 'POST',
      headers: {'Content-Type':'application/json',...HEADERS},
      body: JSON.stringify({message: msg, sessionId: chatSessionId})
    });
    const d = await r.json();
    if (d.sessionId) chatSessionId = d.sessionId;
    typing.textContent = d.reply || d.error || 'Sem resposta';
  } catch(e) {
    typing.textContent = '❌ Erro: ' + e.message;
    typing.style.color = '#ef4444';
  }
  btn.disabled = false;
  input.focus();
}

// ── QR Modal ──────────────────────────────────────────────────────────────────
function openQR() { document.getElementById('qr-modal').style.display = 'flex'; }
function closeQR() { document.getElementById('qr-modal').style.display = 'none'; }
async function resetSession() {
  if (!confirm('Isso vai deslogar o WhatsApp e exigir novo QR scan. Confirmar?')) return;
  try {
    await fetch(BASE + '/qr/reset', {method:'POST', headers: HEADERS});
    alert('Sessão reiniciada. Aguarde e acesse /qr.');
    location.reload();
  } catch(e) { alert('Erro: ' + e.message); }
}

// ── Init ──────────────────────────────────────────────────────────────────────
const tplEl = document.getElementById('fu-template');
if (tplEl) tplEl.addEventListener('input', updatePreview);

loadStatus();
loadClients();
setInterval(loadStatus, 10000);
setInterval(loadClients, 60000);
</script>
</body>
</html>`;
}

module.exports = { getDashboardHTML };
