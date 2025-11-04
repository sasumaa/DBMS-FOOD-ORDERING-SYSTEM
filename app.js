const API_BASE = 'http://localhost:3000';

// auth state
let authToken = localStorage.getItem('custToken') || '';

const nameInput = document.getElementById('nameInput');
const emailInput = document.getElementById('emailInput');
const phoneInput = document.getElementById('phoneInput');
const addrInput = document.getElementById('addrInput');
const restaurantSelect = document.getElementById('restaurantSelect');
const itemSelect = document.getElementById('itemSelect');
const quantityInput = document.getElementById('quantityInput');
const placeOrderBtn = document.getElementById('placeOrderBtn');
const messageBox = document.getElementById('message');
const ordersBody = document.getElementById('ordersBody');

function setMessage(text, type = 'success') {
  messageBox.textContent = text;
  messageBox.className = `message ${type}`;
}

function parseJwt(token){
  try{ const base = token.split('.')[1]; return JSON.parse(atob(base)); }catch(_){ return null; }
}

async function fetchJSON(url) {
  const res = await fetch(url, { headers: authToken ? { 'Authorization': `Bearer ${authToken}` } : {} });
  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return await res.json();
}
// login/signup handled on separate page now


async function loadRestaurants() {
  const restaurants = await fetchJSON(`${API_BASE}/restaurants`);
  restaurantSelect.innerHTML = restaurants.map(r => `<option value="${r.restaurant_id}">${r.name}</option>`).join('');
  if (restaurants.length) {
    await loadMenu(restaurants[0].restaurant_id);
  }
}

async function loadMenu(restaurantId) {
  const items = await fetchJSON(`${API_BASE}/menu/${restaurantId}`);
  itemSelect.innerHTML = items.map(i => `<option value="${i.item_id}">${i.item_name} — ₹${i.price} (left: ${i.quantity})</option>`).join('');
}

async function loadMyOrders(){
  const orders = await fetchJSON(`${API_BASE}/my-orders`);
  ordersBody.innerHTML = orders.map(o => `
    <tr>
      <td>${o.order_id}</td>
      <td>${o.restaurant_name}</td>
      <td>${o.item_name}</td>
      <td>${o.quantity}</td>
      <td>₹${o.total_price}</td>
      <td><span class="badge ${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${new Date(o.order_date).toLocaleString()}</td>
    </tr>
  `).join('');
}

restaurantSelect.addEventListener('change', async (e) => {
  await loadMenu(e.target.value);
});

placeOrderBtn.addEventListener('click', async () => {
  try {
    const order = {
      restaurant_id: Number(restaurantSelect.value),
      item_id: Number(itemSelect.value),
      quantity: Number(quantityInput.value || 1)
    };

    const res = await fetch(`${API_BASE}/place-order`, {
      method: 'POST',
      headers: Object.assign({ 'Content-Type': 'application/json' }, authToken ? { 'Authorization': `Bearer ${authToken}` } : {}),
      body: JSON.stringify(order)
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
      const msg = data && data.error ? data.error : 'Failed to place order';
      throw new Error(`Order not placed: ${msg}`);
    }
    const info = data.order_id ? ` (Order ID: ${data.order_id})` : '';
    setMessage(`Order placed successfully${info}`, 'success');
    await loadMenu(order.restaurant_id); // refresh stock levels
    await loadMyOrders();
  } catch (e) {
    setMessage(e.message, 'error');
  }
});

(async function init() {
  try {
    // Hide personal detail fields when logged in (no need to re-enter)
    if (authToken) {
      [nameInput, emailInput, phoneInput, addrInput].forEach(el => { if (el && el.parentElement) el.parentElement.style.display='none'; });
    }
    const custLogout = document.getElementById('custLogout');
    if (custLogout) {
      custLogout.addEventListener('click', () => { localStorage.removeItem('custToken'); window.location.href = 'customer-login.html'; });
    }
    const custNameEl = document.getElementById('custName');
    if (custNameEl && authToken){ const p = parseJwt(authToken); if (p && p.name){ custNameEl.textContent = `• ${p.name}`; }}
    await Promise.all([loadRestaurants()]);
    await loadMyOrders();
  } catch (e) {
    setMessage('Failed to initialize app. Is the backend running?', 'error');
  }
})();