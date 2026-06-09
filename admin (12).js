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
  // Redirect Лука към boss dashboard
  if (currentEmail === BOSS_EMAIL) {
    window.location.href = 'boss.html';
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
let audioCtx = null;

function activateSound() {
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    // Play a short test sound to confirm
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain); gain.connect(audioCtx.destination);
    osc.frequency.value = 880;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    osc.start(audioCtx.currentTime);
    osc.stop(audioCtx.currentTime + 0.2);
    // Hide banner
    const banner = document.getElementById('soundBanner');
    if (banner) {
      banner.style.background = 'rgba(46,213,115,0.1)';
      banner.style.borderBottomColor = 'rgba(46,213,115,0.2)';
      banner.innerHTML = '<span style="font-size:0.82rem;color:#2ed573;">✅ Звукът е активиран — ще чуеш звънец при нова поръчка</span>';
      setTimeout(() => { banner.style.display = 'none'; }, 3000);
    }
  } catch(e) { console.error('Sound error:', e); }
}

function playNotificationSound() {
  try {
    const ctx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') ctx.resume();
    [0, 0.6, 1.2].forEach(startTime => {
      [1046, 1318].forEach((freq, i) => {
        const osc  = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain); gain.connect(ctx.destination);
        osc.frequency.value = freq;
        osc.type = 'sine';
        const t = ctx.currentTime + startTime + i * 0.12;
        gain.gain.setValueAtTime(0, t);
        gain.gain.linearRampToValueAtTime(0.4, t + 0.01);
        gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
        osc.start(t);
        osc.stop(t + 0.4);
      });
    });
  } catch(e) { console.error('Sound play error:', e); }
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
let bossPeriod = 'month';

function setBossPeriod(period, btn) {
  bossPeriod = period;
  document.querySelectorAll('[id^="period-"]').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  loadCashbook();
}

function getPeriodDates() {
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  if (bossPeriod === 'today') {
    return { from: today, to: today };
  } else if (bossPeriod === 'week') {
    const day = now.getDay() || 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() - day + 1);
    const from = monday.toISOString().split('T')[0];
    return { from, to: today };
  } else {
    const month = now.toISOString().slice(0, 7);
    return { from: month + '-01', to: month + '-31' };
  }
}

async function submitShift() {
  const type   = document.getElementById('shiftType').value;
  const amount = parseFloat(document.getElementById('shiftAmount').value);
  const note   = document.getElementById('shiftNote').value.trim();
  const date   = document.getElementById('shiftDate').value;
  if (!date)   { showToastAdmin('⚠️ Избери дата!'); return; }
  if (!amount || amount <= 0) { showToastAdmin('⚠️ Въведи сума!'); return; }

  // Check if already exists for this date + type
  const { data: existing } = await sb.from('shifts')
    .select('id').eq('date', date).eq('shift_type', type).limit(1);

  if (existing && existing.length > 0) {
    document.getElementById('shiftLockMsg').style.display = 'block';
    document.getElementById('shiftSubmitBtn').disabled = true;
    document.getElementById('shiftSubmitBtn').style.background = 'var(--bg3)';
    document.getElementById('shiftSubmitBtn').style.color = 'var(--text3)';
    return;
  }

  const { error } = await sb.from('shifts').insert([{
    shift_type: type,
    amount,
    note: note || null,
    created_by: currentUser,
    date
  }]);

  if (error) { showToastAdmin('❌ Грешка: ' + error.message); return; }
  document.getElementById('shiftAmount').value = '';
  document.getElementById('shiftNote').value = '';
  document.getElementById('shiftLockMsg').style.display = 'none';
  showToastAdmin('✅ Оборот записан!');
  loadCashbook();
}

// Check lock when date or type changes
async function checkShiftLock() {
  const date = document.getElementById('shiftDate').value;
  const type = document.getElementById('shiftType').value;
  if (!date) return;
  const { data: existing } = await sb.from('shifts')
    .select('id').eq('date', date).eq('shift_type', type).limit(1);
  const locked = existing && existing.length > 0;
  document.getElementById('shiftLockMsg').style.display = locked ? 'block' : 'none';
  const btn = document.getElementById('shiftSubmitBtn');
  btn.disabled = locked;
  btn.style.background = locked ? 'var(--bg3)' : '';
  btn.style.color = locked ? 'var(--text3)' : '';
}

function addExpenseRow() {
  const row = document.createElement('div');
  row.className = 'expense-row';
  row.style.cssText = 'display:grid;grid-template-columns:1fr 2fr auto;gap:8px;margin-bottom:8px';
  row.innerHTML = `
    <input type="number" class="form-input expense-amount" placeholder="€" step="0.01" min="0">
    <input type="text" class="form-input expense-desc" placeholder="За какво">
    <button onclick="removeExpenseRow(this)" style="background:rgba(232,65,24,0.2);border:none;border-radius:8px;width:36px;color:var(--red);font-size:1.1rem;cursor:pointer">✕</button>
  `;
  document.getElementById('expenseRows').appendChild(row);
}

function removeExpenseRow(btn) {
  const rows = document.querySelectorAll('.expense-row');
  if (rows.length > 1) btn.closest('.expense-row').remove();
}

async function submitExpenses() {
  const date = document.getElementById('expenseDate').value;
  if (!date) { showToastAdmin('⚠️ Избери дата!'); return; }

  const rows = document.querySelectorAll('.expense-row');
  const entries = [];
  for (const row of rows) {
    const amount = parseFloat(row.querySelector('.expense-amount').value);
    const desc   = row.querySelector('.expense-desc').value.trim();
    if (!amount || amount <= 0 || !desc) continue;
    entries.push({ amount, description: desc, created_by: currentUser, date, category: 'Други' });
  }

  if (entries.length === 0) { showToastAdmin('⚠️ Попълни поне един разход!'); return; }

  const { error } = await sb.from('expenses').insert(entries);
  if (error) { showToastAdmin('❌ Грешка: ' + error.message); return; }

  // Clear rows
  document.getElementById('expenseRows').innerHTML = `
    <div class="expense-row" style="display:grid;grid-template-columns:1fr 2fr auto;gap:8px;margin-bottom:8px">
      <input type="number" class="form-input expense-amount" placeholder="€" step="0.01" min="0">
      <input type="text" class="form-input expense-desc" placeholder="За какво">
      <button onclick="removeExpenseRow(this)" style="background:rgba(232,65,24,0.2);border:none;border-radius:8px;width:36px;color:var(--red);font-size:1.1rem;cursor:pointer">✕</button>
    </div>`;
  showToastAdmin('✅ ' + entries.length + ' разход(а) записани!');
  loadCashbook();
}

async function loadCashbook() {
  // Always use month for cashbook tab (shifts list)
  const now   = new Date();
  const month = now.toISOString().slice(0, 7);
  const mFrom = month + '-01';
  const mTo   = month + '-31';

  const [{ data: allShifts }, { data: allExpenses }] = await Promise.all([
    sb.from('shifts').select('*').gte('date', mFrom).lte('date', mTo).order('date', { ascending: false }),
    sb.from('expenses').select('*').gte('date', mFrom).lte('date', mTo).order('date', { ascending: false })
  ]);

  // ── Cashbook tab: shifts history ──
  const shiftsList = document.getElementById('shiftsList');
  const typeLabel = { morning:'🌅 Първа смяна', evening:'🌆 Втора смяна', fullday:'☀️ Цял ден' };
  if (shiftsList) {
    shiftsList.innerHTML = (allShifts || []).length === 0
      ? '<div class="no-orders">Няма записи</div>'
      : (allShifts || []).map(s => `
        <div class="cashbook-row">
          <div>
            <div class="cr-type">${typeLabel[s.shift_type] || s.shift_type}</div>
            <div class="cr-meta">${formatDate(s.date)} · ${s.created_by}${s.note ? ' · ' + s.note : ''}</div>
          </div>
          <div class="cr-amount green">+€${parseFloat(s.amount).toFixed(2)}</div>
        </div>`).join('');
  }

  // ── Boss tab ──
  if (currentEmail !== BOSS_EMAIL) return;

  const { from, to } = getPeriodDates();
  const shifts   = (allShifts   || []).filter(s => s.date >= from && s.date <= to);
  const expenses = (allExpenses || []).filter(e => e.date >= from && e.date <= to);

  const totalRevenue  = shifts.reduce((s, r) => s + parseFloat(r.amount), 0);
  const totalExpenses = expenses.reduce((s, r) => s + parseFloat(r.amount), 0);
  const net = totalRevenue - totalExpenses;

  // Summary cards
  const setEl = (id, val, color) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = '€' + val.toFixed(2);
    if (color) el.style.color = color;
  };
  setEl('bossRevenue', totalRevenue, '#2ed573');
  setEl('bossExpenses', totalExpenses, 'var(--red)');
  const netEl = document.getElementById('bossNet');
  if (netEl) { netEl.textContent = '€' + net.toFixed(2); netEl.style.color = net >= 0 ? '#2ed573' : '#e84118'; }

  // ── Daily breakdown ──
  const days = {};
  shifts.forEach(s => {
    if (!days[s.date]) days[s.date] = { revenue: 0, expenses: 0, shifts: [], expenses_list: [] };
    days[s.date].revenue += parseFloat(s.amount);
    days[s.date].shifts.push(s);
  });
  expenses.forEach(e => {
    if (!days[e.date]) days[e.date] = { revenue: 0, expenses: 0, shifts: [], expenses_list: [] };
    days[e.date].expenses += parseFloat(e.amount);
    days[e.date].expenses_list.push(e);
  });

  const sortedDays = Object.keys(days).sort((a,b) => b.localeCompare(a));
  const dailyList = document.getElementById('bossDailyList');
  if (dailyList) {
    dailyList.innerHTML = sortedDays.length === 0
      ? '<div class="no-orders">Няма данни</div>'
      : sortedDays.map(date => {
          const d = days[date];
          const profit = d.revenue - d.expenses;
          const color = profit >= 0 ? '#2ed573' : '#e84118';
          return `<div class="day-card">
            <div class="day-card-header">
              <div class="day-date">📆 ${formatDate(date)}</div>
              <div class="day-profit" style="color:${color}">€${profit.toFixed(2)}</div>
            </div>
            <div class="day-detail">
              <span style="color:#2ed573">↑ Оборот: €${d.revenue.toFixed(2)}</span>
              <span style="color:var(--red)">↓ Разходи: €${d.expenses.toFixed(2)}</span>
              ${d.shifts.map(s => `<span>${typeLabel[s.shift_type]}: €${parseFloat(s.amount).toFixed(2)} (${s.created_by})</span>`).join('')}
            </div>
          </div>`;
        }).join('');
  }

  // ── Shifts detail ──
  const bossShifts = document.getElementById('bossShiftsList');
  if (bossShifts) {
    bossShifts.innerHTML = shifts.length === 0
      ? '<div class="no-orders">Няма записи</div>'
      : shifts.map(s => `
        <div class="cashbook-row">
          <div>
            <div class="cr-type">${typeLabel[s.shift_type]} · <span style="color:var(--orange)">${s.created_by}</span></div>
            <div class="cr-meta">${formatDate(s.date)}${s.note ? ' · 💬 ' + s.note : ''}</div>
          </div>
          <div class="cr-amount green">+€${parseFloat(s.amount).toFixed(2)}</div>
        </div>`).join('');
  }

  // ── Expenses detail ──
  const bossExp = document.getElementById('bossExpensesList');
  if (bossExp) {
    bossExp.innerHTML = expenses.length === 0
      ? '<div class="no-orders">Няма разходи</div>'
      : expenses.map(e => `
        <div class="cashbook-row">
          <div>
            <div class="cr-type">💸 ${e.description}</div>
            <div class="cr-meta">${formatDate(e.date)} · <span style="color:var(--orange)">${e.created_by}</span></div>
          </div>
          <div class="cr-amount red">-€${parseFloat(e.amount).toFixed(2)}</div>
        </div>`).join('');
  }
}

function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('bg-BG', { day:'numeric', month:'long', year:'numeric' });
}

// ── LOGIN ENTER KEY ──
document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('loginScreen').style.display !== 'none') login();
});

// ── INIT ──
checkAuth();
