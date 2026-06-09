// ═══════════════════════════════════════════
// MENU DATA
// ═══════════════════════════════════════════
const MENU = {
  burgers: {
    label: 'Бургери', icon: '🍔',
    items: [
      {id:'b1', name:'Бургер с телешко месо', price:4.20},
      {id:'b2', name:'Master телешко', price:5.80},
      {id:'b3', name:'Чийзбургер', price:3.50},
      {id:'b4', name:'Двоен чийзбургер', price:4.20},
      {id:'b5', name:'Вегетариански бургер', price:3.50},
      {id:'b6', name:'Чийзбургер + картофки', price:4.80},
      {id:'b7', name:'Двоен чийзбургер + картофки', price:5.50},
    ]
  },
  duners: {
    label: 'Дюнери', icon: '🥙',
    items: [
      {id:'d0a', name:'Малък пилешки дюнер', price:3.20},
      {id:'d0b', name:'Среден пилешки дюнер', price:3.70},
      {id:'d0c', name:'Голям пилешки дюнер', price:4.20},
      {id:'d1',  name:'Бургер дюнер месо', price:4.00},
      {id:'d2',  name:'Дюнер XL', price:5.30},
      {id:'d3',  name:'Дюнер порция пилешко', price:5.50},
      {id:'d4',  name:'Двойка дюнер', price:4.00},
      {id:'d5',  name:'Среден телешки дюнер', price:5.00},
      {id:'d6',  name:'Голям телешки дюнер', price:5.50},
      {id:'d7',  name:'Телешка порция', price:7.00},
      {id:'d8',  name:'Телешки Box', price:5.00},
    ]
  },
  fries: {
    label: 'Картофки', icon: '🍟',
    items: [
      {id:'f1', name:'Пържени картофи порция', price:2.20},
    ]
  },
  sides: {
    label: 'Гарнитури', icon: '🥗',
    items: [
      {id:'s2', name:'Гарнитура', price:1.30},
    ]
  },
  others: {
    label: 'Други', icon: '🌭',
    items: [
      {id:'o1', name:'Пилешки крилца', price:5.50},
      {id:'o2', name:'Хот дог', price:2.60},
      {id:'o3', name:'Лодка с луканка', price:4.20},
      {id:'o4', name:'Лодка с кренвирш', price:3.70},
      {id:'o5', name:'Лодка с дюнер месо', price:4.20},
    ]
  },
  extras: {
    label: 'Добавки', icon: '➕',
    items: [
      {id:'e1', name:'Дюнер месо', price:3.10},
      {id:'e2', name:'Яйце', price:0.60},
      {id:'e3', name:'Чедър', price:0.60},
      {id:'e4', name:'Хлебче', price:1.10},
      {id:'e5', name:'Сос', price:1.10},
    ]
  }
};

// ═══════════════════════════════════════════
// TELEGRAM (остава като backup известие)
// ═══════════════════════════════════════════
const TG_TOKEN = '8470601059:AAFfrR4gp06NfveDBBD43y9G3-dD6n2jyNE';
const TG_CHAT  = '5354336846';

async function sendTelegram(order) {
  try {
    const itemsList = order.items.map(i=>`  • ${i.name} x${i.qty} — €${(i.price*i.qty).toFixed(2)}`).join('\n');
    const deliveryLabel = order.delivery_type === 'pickup' ? '🚶 Ще мине да вземе' : '🛵 Доставка до адрес';
    const msg = [
      `🔔 *НОВА ПОРЪЧКА #${order.order_number}*`,
      '',
      `👤 *Клиент:* ${order.name}`,
      `📞 *Телефон:* ${order.phone}`,
      `📦 *Тип:* ${deliveryLabel}`,
      order.address ? `📍 *Адрес:* ${order.address}` : '',
      `⏰ *Час:* ${order.pickup_time}`,
      '',
      `🍽 *Поръчка:*`,
      itemsList,
      '',
      `💰 *Общо: €${order.total}*`,
      order.note ? `\n💬 *Бележка:* ${order.note}` : ''
    ].filter(Boolean).join('\n');

    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ chat_id: TG_CHAT, text: msg, parse_mode: 'Markdown' })
    });
  } catch(e) { console.warn('Telegram error:', e); }
}

// ═══════════════════════════════════════════
// CART STATE
// ═══════════════════════════════════════════
let cart = [];
let deliveryType = 'pickup';

function addToCart(id, name, price) {
  const existing = cart.find(i => i.id === id);
  if (existing) existing.qty++;
  else cart.push({ id, name, price, qty: 1 });
  updateCartUI();
  showToast('✅ ' + name);
}

function changeQty(id, delta) {
  const item = cart.find(i => i.id === id);
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) cart = cart.filter(i => i.id !== id);
  updateCartUI();
}

function cartTotal() {
  return cart.reduce((s, i) => s + i.price * i.qty, 0);
}

function updateCartUI() {
  const total = cartTotal();
  const count = cart.reduce((s, i) => s + i.qty, 0);
  document.getElementById('cartTotal').textContent = total.toFixed(2);
  const cc = document.getElementById('cartCount');
  cc.textContent = count;
  cc.classList.add('bump');
  setTimeout(() => cc.classList.remove('bump'), 300);

  const container = document.getElementById('cartItems');
  if (cart.length === 0) {
    container.innerHTML = '<div class="cart-empty">🛒 Количката е празна</div>';
    return;
  }
  container.innerHTML = cart.map(item => `
    <div class="cart-item">
      <div class="ci-name">${item.name}</div>
      <div class="ci-controls">
        <button class="ci-btn" onclick="changeQty('${item.id}',-1)">−</button>
        <span class="ci-qty">${item.qty}</span>
        <button class="ci-btn" onclick="changeQty('${item.id}',1)">+</button>
      </div>
      <div class="ci-price">€${(item.price * item.qty).toFixed(2)}</div>
    </div>
  `).join('');
}

// ═══════════════════════════════════════════
// CART DRAWER
// ═══════════════════════════════════════════
function openCart() {
  if (cart.length === 0) { showToast('Количката е празна!'); return; }
  document.getElementById('cartOverlay').classList.add('open');
  document.getElementById('cartDrawer').classList.add('open');
}
function closeCart() {
  document.getElementById('cartOverlay').classList.remove('open');
  document.getElementById('cartDrawer').classList.remove('open');
}

// ═══════════════════════════════════════════
// ORDER FORM
// ═══════════════════════════════════════════
function buildTimeOptions() {
  const sel = document.getElementById('orderTime');
  sel.innerHTML = '';
  const now = new Date();
  now.setMinutes(now.getMinutes() + 15);
  now.setMinutes(Math.ceil(now.getMinutes() / 5) * 5, 0, 0);
  for (let i = 0; i < 24; i++) {
    const t = new Date(now.getTime() + i * 5 * 60000);
    const h = t.getHours().toString().padStart(2, '0');
    const m = t.getMinutes().toString().padStart(2, '0');
    const opt = document.createElement('option');
    opt.value = `${h}:${m}`;
    opt.textContent = `${h}:${m}` + (i === 0 ? ' (най-рано)' : '');
    sel.appendChild(opt);
  }
}

function openOrder() {
  // Working hours check
  const now = new Date();
  const mins = now.getHours() * 60 + now.getMinutes();
  if (mins < 10 * 60 || mins >= 23 * 60) {
    document.getElementById('closedOverlay').classList.add('open');
    return;
  }
  if (cart.length === 0) return;
  buildTimeOptions();
  const total = cartTotal();
  document.getElementById('orderSummary').innerHTML = `
    <div class="os-title">Вашата поръчка:</div>
    ${cart.map(i => `<div class="os-item"><span>${i.name} x${i.qty}</span><span>€${(i.price * i.qty).toFixed(2)}</span></div>`).join('')}
    <div class="os-total"><span>Общо</span><span>€<span style="color:var(--orange)">${total.toFixed(2)}</span></span></div>
  `;
  // Reset delivery UI
  deliveryType = 'pickup';
  document.getElementById('dt-pickup').classList.add('active');
  document.getElementById('dt-delivery').classList.remove('active');
  document.getElementById('pickupNote').classList.add('show');
  document.getElementById('deliveryWarning').classList.remove('show');
  document.getElementById('addressField').classList.remove('show');
  closeCart();
  document.getElementById('orderOverlay').classList.add('open');
}

function closeOrder() {
  document.getElementById('orderOverlay').classList.remove('open');
}

function setDeliveryType(type) {
  deliveryType = type;
  document.getElementById('dt-pickup').classList.toggle('active', type === 'pickup');
  document.getElementById('dt-delivery').classList.toggle('active', type === 'delivery');
  document.getElementById('pickupNote').classList.toggle('show', type === 'pickup');
  document.getElementById('addressField').classList.toggle('show', type === 'delivery');
  document.getElementById('deliveryWarning').classList.toggle('show', type === 'delivery' && cartTotal() < 25);
}

// ═══════════════════════════════════════════
// SUBMIT ORDER → SUPABASE
// ═══════════════════════════════════════════
async function submitOrder() {
  const name    = document.getElementById('orderName').value.trim();
  const phone   = document.getElementById('orderPhone').value.trim();
  const time    = document.getElementById('orderTime').value;
  const note    = document.getElementById('orderNote').value.trim();
  const address = document.getElementById('orderAddress').value.trim();

  if (!name || !phone) { showToast('⚠️ Попълни ime и телефон!'); return; }
  if (deliveryType === 'delivery' && cartTotal() < 25) { showToast('⚠️ Минимум €25 за доставка!'); return; }
  if (deliveryType === 'delivery' && !address) { showToast('⚠️ Въведи адрес за доставка!'); return; }

  const btn = document.getElementById('submitBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="loading-spinner"></span>Изпращане...';

  const total = cartTotal();

  // Generate order number with timestamp
  const orderNumber = '#' + Date.now().toString().slice(-4);

  const orderPayload = {
    order_number: orderNumber,
    name,
    phone,
    address: address || null,
    delivery_type: deliveryType,
    pickup_time: time,
    items: cart,
    total: parseFloat(total.toFixed(2)),
    status: 'new',
    note: note || null
  };

  let insertError = null;
  try {
    const result = await sb.from('orders').insert([orderPayload]);
    insertError = result.error;
  } catch(e) {
    insertError = e;
  }

  if (insertError) {
    console.error('Supabase error:', insertError);
    // Notify admin via Telegram on failure
    try {
      const errMsg = insertError.message || insertError.code || 'Unknown error';
      const failMsg = [
        '⚠️ *НЕУСПЕШНА ПОРЪЧКА*',
        '',
        `👤 Клиент: ${name}`,
        `📞 Телефон: ${phone}`,
        `💰 Сума: €${total.toFixed(2)}`,
        `❌ Грешка: ${errMsg}`,
        `🕐 Час: ${new Date().toLocaleTimeString('bg-BG')}`
      ].join('\n');
      await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({ chat_id: TG_CHAT, text: failMsg, parse_mode: 'Markdown' })
      });
    } catch(e) {}
    showToast('❌ Грешка при поръчката. Опитай пак.');
    btn.disabled = false;
    btn.textContent = '✅ Изпрати поръчката';
    return;
  }

  // Send Telegram notification as backup
  await sendTelegram(orderPayload);

  // Success
  document.getElementById('successOrderNum').textContent = orderNumber;
  closeOrder();
  cart = [];
  updateCartUI();
  ['orderName','orderPhone','orderNote','orderAddress'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  btn.disabled = false;
  btn.textContent = '✅ Изпрати поръчката';
  document.getElementById('successOverlay').classList.add('open');
}

function closeSuccess() {
  document.getElementById('successOverlay').classList.remove('open');
}

// ═══════════════════════════════════════════
// MENU RENDER
// ═══════════════════════════════════════════
function buildMenu() {
  const tabs    = document.getElementById('catTabs');
  const content = document.getElementById('menuContent');
  tabs.innerHTML = '';
  content.innerHTML = '';

  Object.entries(MENU).forEach(([key, cat], i) => {
    const tab = document.createElement('button');
    tab.className = 'cat-tab' + (i === 0 ? ' active' : '');
    tab.textContent = cat.icon + ' ' + cat.label;
    tab.onclick = () => scrollToCategory(key);
    tab.id = 'tab-' + key;
    tabs.appendChild(tab);

    const section = document.createElement('div');
    section.id = 'cat-' + key;
    section.innerHTML = `<div class="cat-heading">${cat.icon} ${cat.label}</div>`;
    const list = document.createElement('div');
    list.className = 'menu-list';
    cat.items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'menu-item';
      el.innerHTML = `
        <div class="mi-info">
          <div class="mi-name">${item.name}</div>
          <div class="mi-price">€${item.price.toFixed(2)}</div>
        </div>
        <button class="mi-add" onclick="addToCart('${item.id}','${item.name}',${item.price})">+</button>
      `;
      list.appendChild(el);
    });
    section.appendChild(list);
    content.appendChild(section);
  });

  // Scroll spy
  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        const key = e.target.id.replace('cat-', '');
        document.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
        const activeTab = document.getElementById('tab-' + key);
        if (activeTab) {
          activeTab.classList.add('active');
          activeTab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
      }
    });
  }, { threshold: 0.3 });
  document.querySelectorAll('[id^="cat-"]').forEach(s => observer.observe(s));
}

function scrollToCategory(key) {
  document.getElementById('cat-' + key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ═══════════════════════════════════════════
// NAVIGATION
// ═══════════════════════════════════════════
function switchPage(page) {
  document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.bn-item').forEach(b => b.classList.remove('active'));
  document.getElementById('page-' + page)?.classList.add('active');
  document.getElementById('bn-' + page)?.classList.add('active');
  window.scrollTo(0, 0);
}
function goToMenu() { switchPage('menu'); }
function goToCategory(cat) { switchPage('menu'); setTimeout(() => scrollToCategory(cat), 100); }

// ═══════════════════════════════════════════
// TOAST
// ═══════════════════════════════════════════
let toastTimer;
function showToast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
}

// ═══════════════════════════════════════════
// INIT
// ═══════════════════════════════════════════
buildMenu();
updateCartUI();

// Hero badge
(function () {
  const mins = new Date().getHours() * 60 + new Date().getMinutes();
  const isOpen = mins >= 10 * 60 && mins < 23 * 60;
  const badge = document.getElementById('heroBadge');
  const dot   = document.getElementById('badgeDot');
  const txt   = document.getElementById('badgeText');
  if (!badge) return;
  if (isOpen) {
    badge.style.cssText = 'background:rgba(46,213,115,0.12);border:1px solid rgba(46,213,115,0.3)';
    txt.textContent = 'Отворено · 10:00–23:00';
    txt.style.color = '#2ed573';
    dot.style.background = '#2ed573';
  } else {
    badge.style.cssText = 'background:rgba(232,65,24,0.12);border:1px solid rgba(232,65,24,0.3)';
    txt.textContent = 'Затворено · Отваряме в 10:00';
    txt.style.color = 'var(--red)';
    dot.style.animation = 'none';
    dot.style.opacity = '0.6';
  }
})();
