const API = 'http://localhost:3000';

const adminMsg = document.getElementById('adminMsg');
const restName = document.getElementById('restName');
const restAddr = document.getElementById('restAddr');
const addRestaurantBtn = document.getElementById('addRestaurantBtn');
const restaurantsBody = document.getElementById('restaurantsBody');
const usersBody = document.getElementById('usersBody');
const partnersBody = document.getElementById('partnersBody');
const ordersBody = document.getElementById('ordersBody');

function setAdminMsg(t, type='success'){ adminMsg.textContent=t; adminMsg.className = `message ${type}`; }

async function getJSON(url, options){
  const res = await fetch(url, options);
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : {};
}

async function loadRestaurants(){
  const list = await getJSON(`${API}/restaurants`);
  restaurantsBody.innerHTML = list.map(r => `
    <tr>
      <td>${r.restaurant_id}</td>
      <td><input data-id="${r.restaurant_id}" class="rname" value="${r.name}"/></td>
      <td><input data-id="${r.restaurant_id}" class="raddr" value="${r.address}"/></td>
      <td><input data-id="${r.restaurant_id}" class="rpass" type="text" value="${r.password || ''}"/></td>
      <td>
        <button data-id="${r.restaurant_id}" class="saveBtn">Save</button>
        <button data-id="${r.restaurant_id}" class="deleteBtn">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function loadUsers(){
  const list = await getJSON(`${API}/users`);
  usersBody.innerHTML = list.map(u => `<tr><td>${u.user_id}</td><td>${u.name}</td><td>${u.email}</td><td>${u.phone||''}</td><td>${u.address||''}</td><td>${u.password||''}</td></tr>`).join('');
}

async function loadPartners(){
  const list = await getJSON(`${API}/partners`);
  partnersBody.innerHTML = list.map(p => `<tr><td>${p.partner_id}</td><td>${p.name}</td><td>${p.phone||''}</td><td>${p.password||''}</td></tr>`).join('');
}

async function loadOrders(){
  const list = await getJSON(`${API}/orders`);
  ordersBody.innerHTML = list.map(o => `
    <tr>
      <td>${o.order_id}</td><td>${o.user_name}</td><td>${o.restaurant_name}</td>
      <td>${o.item_name}</td><td>${o.quantity}</td><td>₹${o.total_price}</td>
      <td>${o.status}</td><td>${o.partner_name}</td><td>${new Date(o.order_date).toLocaleString()}</td>
    </tr>
  `).join('');
}

addRestaurantBtn.addEventListener('click', async () => {
  try{
    const name = restName.value.trim();
    const address = restAddr.value.trim();
    if(!name || !address) return setAdminMsg('Enter name and address', 'error');
    await getJSON(`${API}/restaurants`, {
      method: 'POST', headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ name, address })
    });
    restName.value=''; restAddr.value='';
    setAdminMsg('Restaurant added', 'success');
    await loadRestaurants();
  }catch(e){ setAdminMsg('Failed to add restaurant', 'error'); }
});

restaurantsBody.addEventListener('click', async (e) => {
  const id = e.target.getAttribute('data-id');
  if (!id) return;
  if (e.target.classList.contains('deleteBtn')){
    try {
      await getJSON(`${API}/restaurants/${id}`, { method: 'DELETE' });
      setAdminMsg('Restaurant deleted', 'success');
      await loadRestaurants();
    } catch (_) { setAdminMsg('Delete failed', 'error'); }
  }
  if (e.target.classList.contains('saveBtn')){
    try {
      const name = document.querySelector(`input.rname[data-id="${id}"]`).value.trim();
      const address = document.querySelector(`input.raddr[data-id="${id}"]`).value.trim();
      const password = document.querySelector(`input.rpass[data-id="${id}"]`).value.trim();
      await getJSON(`${API}/restaurants/${id}`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, address, password: password || undefined })
      });
      setAdminMsg('Restaurant saved', 'success');
      await loadRestaurants();
    } catch (_) { setAdminMsg('Save failed', 'error'); }
  }
});

(async function init(){
  try{
    await Promise.all([loadRestaurants(), loadUsers(), loadPartners(), loadOrders()]);
  }catch(e){ setAdminMsg('Failed to load data. Is backend running?', 'error'); }
})();


