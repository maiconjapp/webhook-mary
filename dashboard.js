/**
 * Dashboard Admin da Mary — HTML completo em arquivo único.
 * Tema: WhatsApp dark (#111b21) com verde #25d366.
 * Sem dependências de build — só Tailwind CDN + JS inline.
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
  theme: {
    extend: {
      colors: {
        wa: {
          bg: '#111b21',
          surface: '#1f2c34',
          surface2: '#2a3942',
          green: '#25d366',
          greenDark: '#1da851',
          text: '#e9edef',
          muted: '#8696a0',
          border: '#313d45',
          danger: '#ef4444',
          warn: '#f59e0b',
        }
      }
    }
  }
}
</script>
<style>
  body { background: #111b21; color: #e9edef; font-family: 'Segoe UI', sans-serif; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: #1f2c34; }
  ::-webkit-scrollbar-thumb { background: #313d45; border-radius: 3px; }
  .badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 999px; font-size: 12px; font-weight: 600; }
  .chip { cursor: pointer; padding: 4px 14px; border-radius: 999px; font-size: 13px; border: 1px solid #313d45; transition: all .15s; }
  .chip.active { background: #25d366; border-color: #25d366; color: #111b21; }
  .chip:not(.active):hover { border-color: #8696a0; }
  .btn-green { background: #25d366; color: #111b21; font-weight: 700; padding: 8px 20px; border-radius: 8px; border: none; cursor: pointer; transition: background .15s; }
  .btn-green:hover { background: #1da851; }
  .btn-green:disabled { background: #313d45; color: #8696a0; cursor: not-allowed; }
  .btn-outline { background: transparent; color: #e9edef; border: 1px solid #313d45; padding: 7px 16px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: border-color .15s; }
  .btn-outline:hover { border-color: #8696a0; }
  tr:hover td { background: #243039; }
  input[type=checkbox] { accent-color: #25d366; width: 15px; height: 15px; }
  textarea { background: #2a3942; border: 1px solid #313d45; color: #e9edef; border-radius: 8px; padding: 10px; width: 100%; resize: vertical; outline: none; }
  textarea:focus { border-color: #25d366; }
  input[type=text], input[type=search] { background: #2a3942; border: 1px solid #313d45; color: #e9edef; border-radius: 8px; padding: 8px 12px; outline: none; }
  input:focus { border-color: #25d366; }
  .progress-line { padding: 4px 0; font-size: 13px; }
  .progress-line.sent { color: #25d366; }
  .progress-line.failed { color: #ef4444; }
  .progress-line.waiting { color: #f59e0b; }
  .progress-line.sending { color: #8696a0; }
</style>
</head>
<body>

<!-- HEADER -->
<header style="background:#1f2c34;border-bottom:1px solid #313d45" class="px-6 py-4 flex items-center justify-between sticky top-0 z-10">
  <div class="flex items-center gap-3">
    <div style="background:#25d366" class="w-9 h-9 rounded-full flex items-center justify-center text-xl font-bold text-black">M</div>
    <div>
      <div class="font-bold text-lg" style="color:#e9edef">Mary Admin</div>
      <div class="text-xs" style="color:#8696a0">Marido de Aluguel — Petrópolis</div>
    </div>
  </div>
  <div class="flex items-center gap-3">
    <div id="wa-status-badge" class="badge" style="background:#2a3942;color:#8696a0">
      <span id="wa-dot" style="width:8px;height:8px;border-radius:50%;background:#8696a0;display:inline-block"></span>
      <span id="wa-status-text">Verificando...</span>
    </div>
    <button onclick="openQR()" class="btn-outline text-xs" id="qr-btn" style="display:none">📱 Escanear QR</button>
    <button onclick="resetSession()" class="btn-outline text-xs" style="color:#ef4444;border-color:#ef4444">🔄 Reset sessão</button>
  </div>
</header>

<!-- STATS -->
<div class="px-6 py-4 grid grid-cols-3 gap-4" style="max-width:900px">
  <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px" class="p-4 text-center">
    <div class="text-3xl font-bold" style="color:#25d366" id="stat-total">—</div>
    <div class="text-xs mt-1" style="color:#8696a0">Total de clientes</div>
  </div>
  <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px" class="p-4 text-center">
    <div class="text-3xl font-bold" style="color:#e9edef" id="stat-active">—</div>
    <div class="text-xs mt-1" style="color:#8696a0">Ativos últimos 30 dias</div>
  </div>
  <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px" class="p-4 text-center">
    <div class="text-3xl font-bold" style="color:#f59e0b" id="stat-today">—</div>
    <div class="text-xs mt-1" style="color:#8696a0">Follow-ups hoje</div>
  </div>
</div>

<!-- QR MODAL -->
<div id="qr-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:50;align-items:center;justify-content:center">
  <div style="background:#1f2c34;border-radius:16px;padding:32px;text-align:center;max-width:360px">
    <h3 class="text-lg font-bold mb-2">📱 Vincule o WhatsApp</h3>
    <p class="text-sm mb-4" style="color:#8696a0">WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
    <img id="qr-img" src="" style="border:4px solid #25d366;border-radius:10px;background:white;padding:8px;max-width:240px;margin:0 auto" />
    <p class="text-xs mt-3" style="color:#8696a0">QR atualiza a cada 30s</p>
    <button onclick="closeQR()" class="btn-outline mt-4 text-sm">Fechar</button>
  </div>
</div>

<!-- TABS -->
<div class="px-6 mt-2">
  <div class="flex gap-1 mb-4 flex-wrap" style="border-bottom:1px solid #313d45">
    <button onclick="showTab('clients')" id="tab-clients" class="py-2 px-4 text-sm font-semibold border-b-2" style="border-color:#25d366;color:#25d366">👥 Clientes</button>
    <button onclick="showTab('followup')" id="tab-followup" class="py-2 px-4 text-sm font-semibold border-b-2 border-transparent" style="color:#8696a0">📣 Follow-up CRM</button>
    <button onclick="showTab('blocked')" id="tab-blocked" class="py-2 px-4 text-sm font-semibold border-b-2 border-transparent" style="color:#8696a0">🚫 Bloqueados</button>
    <button onclick="showTab('chat')" id="tab-chat" class="py-2 px-4 text-sm font-semibold border-b-2 border-transparent" style="color:#8696a0">🤖 Assistente</button>
  </div>

  <!-- TAB CLIENTES -->
  <div id="panel-clients">
    <div class="flex items-center gap-3 mb-4 flex-wrap">
      <input type="search" id="search" placeholder="🔍 Buscar por nome, bairro, serviço..." style="flex:1;min-width:220px" oninput="renderTable()" />
      <div class="flex gap-2">
        <span class="chip active" onclick="filterDays(0,this)">Todos</span>
        <span class="chip" onclick="filterDays(7,this)">+7 dias</span>
        <span class="chip" onclick="filterDays(14,this)">+14 dias</span>
        <span class="chip" onclick="filterDays(30,this)">+30 dias</span>
      </div>
      <button class="btn-outline text-xs" onclick="loadClients()">↻ Atualizar</button>
    </div>
    <div style="overflow-x:auto;border-radius:10px;border:1px solid #313d45">
      <table style="width:100%;border-collapse:collapse;font-size:13px">
        <thead>
          <tr style="background:#1f2c34;text-align:left">
            <th style="padding:10px 12px;color:#8696a0;font-weight:600;white-space:nowrap"><input type="checkbox" id="select-all" onchange="toggleAll(this)"></th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Telefone</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Nome</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Bairro</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Serviços</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Último contato</th>
            <th style="padding:10px 12px;color:#8696a0;font-weight:600">Follow-up</th>
          </tr>
        </thead>
        <tbody id="clients-tbody">
          <tr><td colspan="7" style="padding:24px;text-align:center;color:#8696a0">Carregando...</td></tr>
        </tbody>
      </table>
    </div>
    <div id="table-footer" class="text-xs mt-2" style="color:#8696a0"></div>
  </div>

  <!-- TAB FOLLOW-UP -->
  <div id="panel-followup" style="display:none;max-width:760px">
    <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px;padding:20px" class="mb-4">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">🎯 Selecionar clientes para follow-up</h3>
        <div class="flex gap-2 items-center">
          <span class="text-xs" style="color:#8696a0">Sem contato há mais de</span>
          <select id="days-select" style="background:#2a3942;border:1px solid #313d45;color:#e9edef;border-radius:6px;padding:4px 8px;font-size:13px">
            <option value="7">7 dias</option>
            <option value="14" selected>14 dias</option>
            <option value="30">30 dias</option>
          </select>
          <button onclick="autoSelect()" class="btn-outline text-xs">Auto-selecionar 5</button>
        </div>
      </div>
      <div id="fu-client-list" style="max-height:220px;overflow-y:auto">
        <p style="color:#8696a0;font-size:13px">Vá para a aba Clientes e marque os contatos, ou use Auto-selecionar.</p>
      </div>
      <div id="selected-info" class="mt-3 text-sm" style="color:#8696a0">Nenhum cliente selecionado</div>
    </div>

    <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px;padding:20px" class="mb-4">
      <h3 class="font-semibold mb-2">✏️ Mensagem de follow-up</h3>
      <p class="text-xs mb-2" style="color:#8696a0">Tokens: <code style="background:#2a3942;padding:1px 6px;border-radius:4px">{nome}</code> e <code style="background:#2a3942;padding:1px 6px;border-radius:4px">{servico_recente}</code></p>
      <textarea id="fu-template" rows="5">${DEFAULT_TEMPLATE.replace(/`/g, '\\`')}</textarea>
      <div class="flex items-center gap-2 mt-2">
        <button onclick="resetTemplate()" class="btn-outline text-xs">↩ Restaurar padrão</button>
        <span class="text-xs" style="color:#8696a0">Preview com primeiro selecionado:</span>
      </div>
      <div id="fu-preview" class="mt-2 text-sm" style="background:#2a3942;border-radius:8px;padding:10px;color:#e9edef;white-space:pre-wrap;display:none"></div>
    </div>

    <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px;padding:20px">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">🚀 Enviar</h3>
        <div class="flex items-center gap-2">
          <div id="batch-count" class="badge" style="background:#2a3942;color:#8696a0">0 selecionados</div>
          <button id="send-btn" onclick="sendFollowUp()" class="btn-green" disabled>Enviar Follow-up</button>
        </div>
      </div>
      <div style="background:#0d1418;border-radius:8px;padding:12px;min-height:80px;font-family:monospace" id="fu-log">
        <span style="color:#8696a0;font-size:12px">Log de envio aparecerá aqui...</span>
      </div>
      <p class="text-xs mt-2" style="color:#8696a0">⏱ Delay de 30–60s entre mensagens para proteção anti-ban. Máximo 5 por lote.</p>
    </div>
  </div>

  <!-- TAB BLOQUEADOS -->
  <div id="panel-blocked" style="display:none;max-width:600px">
    <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px;padding:20px" class="mb-4">
      <h3 class="font-semibold mb-3">➕ Bloquear número</h3>
      <div class="flex gap-2">
        <input type="text" id="block-number" placeholder="5524999999999 (só dígitos)" style="flex:1" />
        <input type="text" id="block-label" placeholder="Motivo (opcional)" style="flex:1" />
        <button onclick="addBlocked()" class="btn-green">Bloquear</button>
      </div>
      <p class="text-xs mt-2" style="color:#8696a0">Mary não vai mais responder esse número. Pode desbloquear a qualquer momento.</p>
    </div>
    <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px;padding:20px">
      <div class="flex items-center justify-between mb-3">
        <h3 class="font-semibold">🚫 Números bloqueados</h3>
        <button onclick="loadBlocked()" class="btn-outline text-xs">↻ Atualizar</button>
      </div>
      <div id="blocked-list">
        <p style="color:#8696a0;font-size:13px">Carregando...</p>
      </div>
    </div>
  </div>

  <!-- TAB ASSISTENTE -->
  <div id="panel-chat" style="display:none;max-width:720px">
    <div style="background:#1f2c34;border:1px solid #313d45;border-radius:12px;overflow:hidden">
      <div style="background:#1f2c34;border-bottom:1px solid #313d45;padding:14px 20px;display:flex;align-items:center;gap:10px">
        <div style="background:#25d366;width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px">🤖</div>
        <div>
          <div class="font-semibold">Assistente Mary</div>
          <div class="text-xs" style="color:#8696a0">Tire dúvidas sobre o sistema, configurações e atendimento</div>
        </div>
      </div>
      <div id="chat-messages" style="height:380px;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="background:#2a3942;border-radius:12px 12px 12px 4px;padding:12px 14px;max-width:85%;font-size:14px;line-height:1.5">
          Oi! Sou o assistente de administração da Mary. 😊<br><br>
          Posso te ajudar com dúvidas sobre:<br>
          • Como configurar a Mary<br>
          • O que o dashboard faz<br>
          • Dicas de follow-up e atendimento<br>
          • Como melhorar as respostas dela<br><br>
          O que você precisa?
        </div>
      </div>
      <div style="border-top:1px solid #313d45;padding:12px 16px;display:flex;gap-10px;gap:8px">
        <input type="text" id="chat-input" placeholder="Digite sua mensagem..." style="flex:1" onkeydown="if(event.key==='Enter'&&!event.shiftKey){event.preventDefault();sendChat()}" />
        <button onclick="sendChat()" class="btn-green" id="chat-send-btn">Enviar</button>
      </div>
    </div>
  </div>

</div>

<div class="h-16"></div>

<script>
// ── Estado ────────────────────────────────────────────────────────────────────
let allClients = [];
let selectedContacts = new Set();
let filterDaysVal = 0;
const BASE = window.location.origin;
const TOKEN = new URLSearchParams(window.location.search).get('token') || '';
const HEADERS = TOKEN ? {'x-dashboard-token': TOKEN} : {};

const DEFAULT_TPL = \`${DEFAULT_TEMPLATE.replace(/\\/g, '\\\\').replace(/`/g, '\\`')}\`;

// ── Tabs ──────────────────────────────────────────────────────────────────────
const TABS = ['clients','followup','blocked','chat'];
function showTab(tab) {
  TABS.forEach(t => {
    const p = document.getElementById('panel-'+t);
    const b = document.getElementById('tab-'+t);
    if (p) p.style.display = t === tab ? '' : 'none';
    if (b) b.style.cssText = t === tab
      ? 'border-color:#25d366;color:#25d366;padding:8px 16px;font-size:14px;font-weight:600;border-bottom:2px solid;background:none;cursor:pointer'
      : 'border-color:transparent;color:#8696a0;padding:8px 16px;font-size:14px;font-weight:600;border-bottom:2px solid;background:none;cursor:pointer';
  });
  if (tab === 'followup') renderFollowUpList();
  if (tab === 'blocked') loadBlocked();
}

// ── Status ────────────────────────────────────────────────────────────────────
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
      badge.style.background = 'rgba(37,211,102,.15)';
      badge.style.color = '#25d366';
      qrBtn.style.display = 'none';
    } else if (d.qr) {
      dot.style.background = '#f59e0b';
      txt.textContent = 'Aguardando QR scan';
      badge.style.background = 'rgba(245,158,11,.15)';
      badge.style.color = '#f59e0b';
      qrBtn.style.display = '';
      document.getElementById('qr-img').src = d.qr;
    } else {
      dot.style.background = '#ef4444';
      txt.textContent = 'Desconectado';
      badge.style.background = 'rgba(239,68,68,.15)';
      badge.style.color = '#ef4444';
      qrBtn.style.display = '';
    }
    if (d.stats) {
      document.getElementById('stat-total').textContent = d.stats.total_clients ?? '—';
      document.getElementById('stat-active').textContent = d.stats.active_last_30d ?? '—';
      document.getElementById('stat-today').textContent = d.stats.followups_sent_today ?? '—';
    }
  } catch(e) { console.warn('Status error:', e.message); }
}

// ── Clientes ──────────────────────────────────────────────────────────────────
async function loadClients() {
  try {
    const r = await fetch(BASE + '/api/clients', {headers: HEADERS});
    allClients = await r.json();
    renderTable();
  } catch(e) {
    document.getElementById('clients-tbody').innerHTML =
      '<tr><td colspan="7" style="padding:24px;text-align:center;color:#ef4444">Erro ao carregar clientes</td></tr>';
  }
}

function filterDays(days, el) {
  filterDaysVal = days;
  document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
  el.classList.add('active');
  renderTable();
}

function renderTable() {
  const q = document.getElementById('search').value.toLowerCase();
  let rows = allClients.filter(c => {
    if (filterDaysVal > 0 && (c.days_since_contact || 0) < filterDaysVal) return false;
    if (!q) return true;
    return [c.nome, c.bairro, c.contact, ...(c.servicos||[])].some(v => v && v.toLowerCase().includes(q));
  });
  const tbody = document.getElementById('clients-tbody');
  if (!rows.length) {
    tbody.innerHTML = '<tr><td colspan="7" style="padding:24px;text-align:center;color:#8696a0">Nenhum cliente encontrado</td></tr>';
    document.getElementById('table-footer').textContent = '';
    return;
  }
  tbody.innerHTML = rows.map(c => {
    const checked = selectedContacts.has(c.contact) ? 'checked' : '';
    const days = c.days_since_contact;
    const daysBadge = days >= 30
      ? '<span class="badge" style="background:rgba(239,68,68,.15);color:#ef4444">'+days+'d</span>'
      : days >= 14
      ? '<span class="badge" style="background:rgba(245,158,11,.15);color:#f59e0b">'+days+'d</span>'
      : '<span class="badge" style="background:rgba(37,211,102,.12);color:#25d366">'+(days??'?')+'d</span>';
    const fuDate = c.follow_up_sent_at
      ? new Date(c.follow_up_sent_at).toLocaleDateString('pt-BR')
      : '<span style="color:#8696a0">—</span>';
    const servicos = (c.servicos||[]).slice(0,2).join(', ') + ((c.servicos||[]).length > 2 ? '...' : '');
    return \`<tr style="border-top:1px solid #313d45;cursor:pointer" onclick="toggleRow('\${c.contact}',this)">
      <td style="padding:10px 12px"><input type="checkbox" \${checked} onclick="event.stopPropagation();toggleContact('\${c.contact}',this)"></td>
      <td style="padding:10px 12px;color:#8696a0;font-family:monospace">\${c.contact}</td>
      <td style="padding:10px 12px;font-weight:600">\${c.nome || '<span style=color:#8696a0>—</span>'}</td>
      <td style="padding:10px 12px;color:#8696a0">\${c.bairro || '—'}</td>
      <td style="padding:10px 12px;color:#8696a0;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">\${servicos || '—'}</td>
      <td style="padding:10px 12px">\${daysBadge}</td>
      <td style="padding:10px 12px;color:#8696a0;font-size:12px">\${fuDate}</td>
    </tr>\`;
  }).join('');
  document.getElementById('table-footer').textContent = \`Mostrando \${rows.length} de \${allClients.length} clientes\`;
  updateSendButton();
}

function toggleRow(contact, tr) {
  const cb = tr.querySelector('input[type=checkbox]');
  cb.checked = !cb.checked;
  toggleContact(contact, cb);
}
function toggleContact(contact, cb) {
  cb.checked ? selectedContacts.add(contact) : selectedContacts.delete(contact);
  updateSendButton();
}
function toggleAll(el) {
  document.querySelectorAll('#clients-tbody input[type=checkbox]').forEach(cb => {
    cb.checked = el.checked;
    const contact = cb.closest('tr').querySelectorAll('td')[1].textContent.trim();
    el.checked ? selectedContacts.add(contact) : selectedContacts.delete(contact);
  });
  updateSendButton();
}

function updateSendButton() {
  const n = selectedContacts.size;
  const btn = document.getElementById('send-btn');
  const cnt = document.getElementById('batch-count');
  if (btn) {
    btn.disabled = n === 0 || n > 5;
    btn.textContent = n > 5 ? 'Máx 5 por lote' : \`Enviar Follow-up (\${n})\`;
  }
  if (cnt) {
    cnt.textContent = \`\${n} selecionado\${n !== 1 ? 's' : ''}\`;
    cnt.style.background = n > 0 && n <= 5 ? 'rgba(37,211,102,.15)' : 'rgba(239,68,68,.15)';
    cnt.style.color = n > 0 && n <= 5 ? '#25d366' : '#ef4444';
  }
  document.getElementById('selected-info').textContent =
    n === 0 ? 'Nenhum cliente selecionado'
    : n > 5 ? \`⚠️ \${n} selecionados — reduza para máx 5\`
    : \`✅ \${n} cliente\${n>1?'s':''} selecionado\${n>1?'s':''}. Pronto para enviar.\`;
  updatePreview();
}

// ── Follow-up ─────────────────────────────────────────────────────────────────
function renderFollowUpList() {
  const days = parseInt(document.getElementById('days-select').value);
  const el = document.getElementById('fu-client-list');
  const qualify = allClients.filter(c => (c.days_since_contact||0) >= days);
  if (!qualify.length) {
    el.innerHTML = '<p style="color:#8696a0;font-size:13px">Nenhum cliente inativo há ' + days + ' dias ou mais.</p>';
    return;
  }
  el.innerHTML = qualify.map(c => {
    const checked = selectedContacts.has(c.contact) ? 'checked' : '';
    return \`<label style="display:flex;align-items:center;gap:10px;padding:8px 4px;cursor:pointer;border-bottom:1px solid #313d45">
      <input type="checkbox" \${checked} onchange="toggleContact('\${c.contact}',this)">
      <span style="flex:1">
        <span class="font-semibold">\${c.nome || c.contact}</span>
        <span style="color:#8696a0;font-size:12px;margin-left:8px">\${c.days_since_contact}d atrás · \${(c.servicos||[]).slice(-1)[0]||'sem serviço'}</span>
      </span>
      \${selectedContacts.has(c.contact) ? '<span class="badge" style="background:rgba(37,211,102,.15);color:#25d366">✓</span>' : ''}
    </label>\`;
  }).join('');
  updateSendButton();
}

function autoSelect() {
  selectedContacts.clear();
  const days = parseInt(document.getElementById('days-select').value);
  allClients
    .filter(c => (c.days_since_contact||0) >= days && (c.days_since_followup === null || c.days_since_followup >= 2))
    .slice(0, 5)
    .forEach(c => selectedContacts.add(c.contact));
  renderFollowUpList();
  renderTable();
  updateSendButton();
}

function updatePreview() {
  const prevEl = document.getElementById('fu-preview');
  if (!prevEl) return;
  const first = allClients.find(c => selectedContacts.has(c.contact));
  if (!first) { prevEl.style.display = 'none'; return; }
  const tpl = document.getElementById('fu-template').value;
  const nome = (first.nome||'').split(' ')[0] || 'cliente';
  const servico = (first.servicos||[]).slice(-1)[0] || 'reparos em casa';
  prevEl.textContent = tpl.replace(/\\{nome\\}/g, nome).replace(/\\{servico_recente\\}/g, servico);
  prevEl.style.display = '';
}

function resetTemplate() {
  document.getElementById('fu-template').value = DEFAULT_TPL;
  updatePreview();
}

async function sendFollowUp() {
  const contacts = [...selectedContacts];
  if (!contacts.length || contacts.length > 5) return;
  const template = document.getElementById('fu-template').value;
  const log = document.getElementById('fu-log');
  const btn = document.getElementById('send-btn');
  log.innerHTML = '';
  btn.disabled = true;

  const addLog = (text, cls) => {
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
      addLog('❌ Erro: ' + (err.error || res.statusText), 'failed');
      btn.disabled = false;
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
            await loadClients();
            await loadStatus();
          } else if (ev.status === 'sent') {
            addLog(\`✅ Enviado para \${ev.nome || ev.contact}\`, 'sent');
          } else if (ev.status === 'failed') {
            addLog(\`❌ Falha para \${ev.nome || ev.contact}: \${ev.error}\`, 'failed');
          } else if (ev.status === 'waiting') {
            addLog(\`⏳ \${ev.msg}\`, 'waiting');
          } else if (ev.status === 'sending') {
            addLog(\`📤 Enviando para \${ev.nome || ev.contact}...\`, 'sending');
          }
        } catch {}
      }
    }
  } catch(e) {
    addLog('❌ Erro de rede: ' + e.message, 'failed');
  }
  btn.disabled = false;
}

// ── Números bloqueados ─────────────────────────────────────────────────────────
async function loadBlocked() {
  const el = document.getElementById('blocked-list');
  try {
    const r = await fetch(BASE + '/api/blocked', {headers: HEADERS});
    const list = await r.json();
    if (!list.length) {
      el.innerHTML = '<p style="color:#8696a0;font-size:13px">Nenhum número bloqueado.</p>';
      return;
    }
    el.innerHTML = list.map(b => \`
      <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 0;border-bottom:1px solid #313d45">
        <div>
          <span style="font-family:monospace;color:#e9edef">\${b.contact}</span>
          \${b.label ? \`<span style="color:#8696a0;font-size:12px;margin-left:8px">· \${b.label}</span>\` : ''}
          <div style="color:#8696a0;font-size:11px">Bloqueado em \${new Date(b.blocked_at).toLocaleDateString('pt-BR')}</div>
        </div>
        <button onclick="removeBlocked('\${b.contact}')" style="background:rgba(239,68,68,.15);color:#ef4444;border:1px solid rgba(239,68,68,.3);border-radius:6px;padding:4px 12px;font-size:12px;cursor:pointer">Desbloquear</button>
      </div>
    \`).join('');
  } catch(e) {
    el.innerHTML = '<p style="color:#ef4444;font-size:13px">Erro ao carregar: ' + e.message + '</p>';
  }
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
    } else { alert('Erro: ' + d.error); }
  } catch(e) { alert('Erro: ' + e.message); }
}

async function removeBlocked(contact) {
  if (!confirm(\`Desbloquear \${contact}?\`)) return;
  try {
    await fetch(BASE + '/api/blocked/' + encodeURIComponent(contact), {method:'DELETE', headers: HEADERS});
    loadBlocked();
  } catch(e) { alert('Erro: ' + e.message); }
}

// ── Chat assistente ────────────────────────────────────────────────────────────
let chatSessionId = \`\${Date.now()}-\${Math.random().toString(36).slice(2)}\`;

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
  document.getElementById('chat-messages').scrollTop = 99999;
}

// ── QR Modal ──────────────────────────────────────────────────────────────────
function openQR() {
  document.getElementById('qr-modal').style.display = 'flex';
}
function closeQR() {
  document.getElementById('qr-modal').style.display = 'none';
}

async function resetSession() {
  if (!confirm('Isso vai deslogar o WhatsApp e exigir novo QR scan. Confirmar?')) return;
  try {
    await fetch(BASE + '/qr/reset', {method:'POST', headers: HEADERS});
    alert('Sessão reiniciada. Acesse /qr em alguns segundos.');
    location.reload();
  } catch(e) { alert('Erro: ' + e.message); }
}

// ── Init ──────────────────────────────────────────────────────────────────────
document.getElementById('fu-template').addEventListener('input', updatePreview);
document.getElementById('days-select').addEventListener('change', renderFollowUpList);

loadStatus();
loadClients();
setInterval(loadStatus, 10000);
setInterval(loadClients, 60000);
</script>
</body>
</html>`;
}

module.exports = { getDashboardHTML };
