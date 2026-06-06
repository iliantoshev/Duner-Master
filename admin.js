// ═══════════════════════════════════════════
// ADMIN PANEL LOGIC
// ═══════════════════════════════════════════

let currentFilter = 'all';

// ── AUTH ──
async function checkAuth() {
  try {
    const { data, error } = await sb.auth.getSession();
    if (error || !data.session) {
      showLoginScreen();
    } else {
      showDashboard();
    }
  } catch(e) {
    console.error('Auth error:', e);
    showLoginScreen();
  }
}

async function login() {
  const email = document.getElementById('adminEmail').value.trim();
  const pass  = document.getElementById('adminPass').value;
  const btn   = document.getElementById('loginBtn');
  const err   = document.getElementById('loginError');

  if (!email || !pass) { err.textContent = 'Попълни email и парола.'; err.style.display='block'; return; }

  btn.disabled = true;
  btn.textContent = 'Влизане...';
  err.style.display = 'none';

  const { error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    err.textContent = 'Грешен email или парола.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Влез';
    return;
  }

  showDashboard();
}

async function logout() {
  await sb.auth.signOut();
  showLoginScreen();
}

function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('dashboard').style.display = 'none';
}

function showDashboard() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  loadOrders();
  subscribeToOrders();
}

// ── ORDERS ──
async function loadOrders() {
  try {
    let query = sb.from('orders').select('*').order('created_at', { ascending: false });
    if (currentFilter !== 'all') query = query.eq('status', currentFilter);
    const { data, error } = await query;
    if (error) { console.error('Load error:', error); renderOrders([]); return; }
    renderOrders(data || []);
  } catch(e) {
    console.error('Load exception:', e);
    renderOrders([]);
  }
}

function renderOrders(orders) {
  const newCount = orders.filter(o => o.status === 'new').length;
  document.getElementById('newOrdersBadge').textContent = newCount + ' нови';

  const container = document.getElementById('ordersList');
  if (orders.length === 0) {
    container.innerHTML = '<div class="no-orders">📭 Няма поръчки</div>';
    return;
  }

  const statusLabel = { new:'Нова', prep:'Приготвя се', ready:'Готова', done:'Завършена' };
  const statusClass = { new:'status-new', prep:'status-prep', ready:'status-ready', done:'status-done' };

  container.innerHTML = orders.map(o => {
    const items = Array.isArray(o.items) ? o.items : JSON.parse(o.items || '[]');
    const createdAt = new Date(o.created_at).toLocaleTimeString('bg-BG', { hour:'2-digit', minute:'2-digit' });
    const deliveryLabel = o.delivery_type === 'delivery'
      ? `🛵 Доставка${o.address ? ' → ' + o.address : ''}`
      : '🚶 Вземане от обекта';

    return `
    <div class="order-card" id="order-${o.id}">
      <div class="oc-header">
        <span class="oc-num">${o.order_number}</span>
        <span class="oc-status ${statusClass[o.status]}">${statusLabel[o.status]}</span>
        <span style="font-size:0.75rem;color:var(--text2);margin-left:auto">${createdAt}</span>
      </div>
      <div class="oc-name">${o.name}</div>
      <div class="oc-phone">📞 ${o.phone}</div>
      <div class="oc-delivery" style="font-size:0.82rem;color:var(--text2);margin-bottom:6px">${deliveryLabel}</div>
      <div class="oc-items">${items.map(i => i.name + ' x' + i.qty).join(' · ')}</div>
      ${o.note ? `<div style="font-size:0.8rem;color:var(--orange);margin:6px 0">💬 ${o.note}</div>` : ''}
      <div class="oc-footer">
        <div class="oc-total">Общо: €<span>${o.total}</span></div>
        <div class="oc-time">⏰ ${o.pickup_time}</div>
      </div>
      <div class="status-btns">
        ${o.status === 'new' ? `<button class="status-btn sb-ready" onclick="setStatus('${o.id}','done')">✅ Завършена</button>` : ''}
        ${o.status === 'new' ? `<button class="status-btn sb-done"  onclick="setStatus('${o.id}','done')">✕ Откажи</button>` : ''}
      </div>
    </div>`;
  }).join('');
}

async function setStatus(id, status) {
  await sb.from('orders').update({ status }).eq('id', id);
  loadOrders();
}

function filterOrders(status, btn) {
  currentFilter = status;
  document.querySelectorAll('.af-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadOrders();
}

// ── REALTIME ──
function subscribeToOrders() {
  sb.channel('orders-channel')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
      playNotificationSound();
      showToastAdmin('🔔 Нова поръчка ' + payload.new.order_number);
      loadOrders();
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, () => {
      loadOrders();
    })
    .subscribe();
}

// ── SOUND ──
function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [523, 659, 784].forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.3, ctx.currentTime + i * 0.15);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
      osc.start(ctx.currentTime + i * 0.15);
      osc.stop(ctx.currentTime + i * 0.15 + 0.3);
    });
  } catch(e) {}
}

let adminToastTimer;
function showToastAdmin(msg) {
  const t = document.getElementById('adminToast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(adminToastTimer);
  adminToastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── LOGIN ENTER KEY ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') login();
});

// ── INIT ──
checkAuth();
