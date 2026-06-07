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

// Mapping на имена към Supabase emails
const USER_MAP = {
  'анелия': 'anelia@dunermaster.bg',
  'нейка':  'neyka@dunermaster.bg',
  'лука':   'luka@dunermaster.bg',
};

// Лука е шеф — вижда отчети
const BOSS_EMAIL = 'luka@dunermaster.bg';
let currentUser = '';
let currentEmail = '';

async function login() {
  const input = document.getElementById('adminEmail').value.trim().toLowerCase();
  const pass  = document.getElementById('adminPass').value;
  const btn   = document.getElementById('loginBtn');
  const err   = document.getElementById('loginError');

  if (!input || !pass) { err.textContent = 'Попълни потребителско ime и парола.'; err.style.display='block'; return; }

  const email = USER_MAP[input];
  if (!email) {
    err.textContent = 'Грешно потребителско ime.';
    err.style.display = 'block';
    return;
  }

  btn.disabled = true;
  btn.textContent = 'Влизане...';
  err.style.display = 'none';

  const { error } = await sb.auth.signInWithPassword({ email, password: pass });

  if (error) {
    err.textContent = 'Грешна парола.';
    err.style.display = 'block';
    btn.disabled = false;
    btn.textContent = 'Влез';
    return;
  }

  // Save current user
  const { data: { user } } = await sb.auth.getUser();
  if (user) {
    currentEmail = user.email;
    currentUser = Object.keys(USER_MAP).find(k => USER_MAP[k] === user.email) || '';
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
  // Show boss tab only for Luka
  const bossTabBtn = document.getElementById('bossTabBtn');
  if (bossTabBtn) bossTabBtn.style.display = currentEmail === BOSS_EMAIL ? 'inline-block' : 'none';
  loadOrders();
  subscribeToOrders();
  loadCashbook();
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

// ═══════════════════════════════════════════
// CASHBOOK
// ═══════════════════════════════════════════

async function submitShift() {
  const type   = document.getElementById('shiftType').value;
  const amount = parseFloat(document.getElementById('shiftAmount').value);
  const note   = document.getElementById('shiftNote').value.trim();
  if (!amount || amount <= 0) { showToastAdmin('⚠️ Въведи сума!'); return; }

  const typeLabel = {morning:'Първа смяна', evening:'Втора смяна', fullday:'Цял ден'};
  const { error } = await sb.from('shifts').insert([{
    shift_type: type,
    amount,
    note: note || null,
    created_by: currentUser,
    date: new Date().toISOString().split('T')[0]
  }]);

  if (error) { showToastAdmin('❌ Грешка: ' + error.message); return; }
  document.getElementById('shiftAmount').value = '';
  document.getElementById('shiftNote').value = '';
  showToastAdmin('✅ Оборот записан!');
  loadCashbook();
}

async function submitExpense() {
  const amount = parseFloat(document.getElementById('expenseAmount').value);
  const desc   = document.getElementById('expenseDesc').value.trim();
  if (!amount || amount <= 0) { showToastAdmin('⚠️ Въведи сума!'); return; }
  if (!desc) { showToastAdmin('⚠️ Въведи описание!'); return; }

  const { error } = await sb.from('expenses').insert([{
    amount,
    description: desc,
    created_by: currentUser,
    date: new Date().toISOString().split('T')[0]
  }]);

  if (error) { showToastAdmin('❌ Грешка: ' + error.message); return; }
  document.getElementById('expenseAmount').value = '';
  document.getElementById('expenseDesc').value = '';
  showToastAdmin('✅ Разход записан!');
  loadCashbook();
}

async function loadCashbook() {
  const now   = new Date();
  const month = now.toISOString().slice(0, 7); // YYYY-MM
  const from  = month + '-01';
  const to    = month + '-31';

  const [{ data: shifts }, { data: expenses }] = await Promise.all([
    sb.from('shifts').select('*').gte('date', from).lte('date', to).order('created_at', { ascending: false }),
    sb.from('expenses').select('*').gte('date', from).lte('date', to).order('created_at', { ascending: false })
  ]);

  const totalRevenue = (shifts || []).reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalExpenses = (expenses || []).reduce((s, r) => s + parseFloat(r.amount), 0);
  const net = totalRevenue - totalExpenses;

  // Update summary cards
  const elRev = document.getElementById('totalRevenue');
  const elExp = document.getElementById('totalExpenses');
  const elNet = document.getElementById('netTotal');
  if (elRev) elRev.textContent = '€' + totalRevenue.toFixed(2);
  if (elExp) elExp.textContent = '€' + totalExpenses.toFixed(2);
  if (elNet) { elNet.textContent = '€' + net.toFixed(2); elNet.style.color = net >= 0 ? '#2ed573' : '#e84118'; }
  // Sync boss tab cards
  const elRev2 = document.getElementById('totalRevenue2');
  const elExp2 = document.getElementById('totalExpenses2');
  const elNet2 = document.getElementById('netTotal2');
  if (elRev2) elRev2.textContent = '€' + totalRevenue.toFixed(2);
  if (elExp2) elExp2.textContent = '€' + totalExpenses.toFixed(2);
  if (elNet2) { elNet2.textContent = '€' + net.toFixed(2); elNet2.style.color = net >= 0 ? '#2ed573' : '#e84118'; }

  // Render shifts list
  const shiftsList = document.getElementById('shiftsList');
  if (shiftsList) {
    const typeLabel = { morning:'🌅 Първа смяна', evening:'🌆 Втора смяна', fullday:'☀️ Цял ден' };
    shiftsList.innerHTML = (shifts || []).length === 0
      ? '<div class="no-orders">Няма записи</div>'
      : (shifts || []).map(s => `
        <div class="cashbook-row">
          <div>
            <div class="cr-type">${typeLabel[s.shift_type] || s.shift_type}</div>
            <div class="cr-meta">${s.date} · ${s.created_by}${s.note ? ' · ' + s.note : ''}</div>
          </div>
          <div class="cr-amount green">+€${parseFloat(s.amount).toFixed(2)}</div>
        </div>`).join('');
  }

  // Render expenses list (boss only)
  const expList = document.getElementById('expensesList');
  if (expList) {
    expList.innerHTML = (expenses || []).length === 0
      ? '<div class="no-orders">Няма разходи</div>'
      : (expenses || []).map(e => `
        <div class="cashbook-row">
          <div>
            <div class="cr-type">💸 ${e.description}</div>
            <div class="cr-meta">${e.date} · ${e.created_by}</div>
          </div>
          <div class="cr-amount red">-€${parseFloat(e.amount).toFixed(2)}</div>
        </div>`).join('');
  }
}

// ── LOGIN ENTER KEY ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') login();
});

// ── INIT ──
checkAuth();
