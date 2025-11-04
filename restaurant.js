const API = 'http://localhost:3000';

let rToken = localStorage.getItem('rToken') || '';
const rordersBody = document.getElementById('rordersBody');

function setRMsg(t, type='success'){ rmsg.textContent=t; rmsg.className=`message ${type}`; }

async function getJSON(url, options){
  const headers = Object.assign({}, options && options.headers ? options.headers : {}, rToken ? { 'Authorization': `Bearer ${rToken}` } : {});
  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : {};
}

async function loadOrders(){
  const orders = await getJSON(`${API}/restaurant/me/orders`);
  rordersBody.innerHTML = orders.map(o => `
    <tr>
      <td>${o.order_id}</td><td>${o.user_name}</td><td>${o.item_name}</td>
      <td>${o.quantity}</td><td>₹${o.total_price}</td>
      <td><span class="badge ${o.status.toLowerCase()}">${o.status}</span></td>
      <td>${new Date(o.order_date).toLocaleString()}</td>
      <td>${o.partner_name}</td>
    </tr>
  `).join('');
}

// login handled on restaurant-login.html

(function(){
  const btn = document.getElementById('restLogout');
  if (btn) {
    btn.addEventListener('click', () => { localStorage.removeItem('rToken'); window.location.href = 'restaurant-login.html'; });
  }
  const nameEl = document.getElementById('restName');
  if (nameEl && rToken){ try{ const base=rToken.split('.')[1]; const p=JSON.parse(atob(base)); if(p&&p.name){ nameEl.textContent=`• ${p.name}`; } }catch(_){} }
})();

async function getJSON(url, options){
  const headers = Object.assign({}, options && options.headers ? options.headers : {}, rToken ? { 'Authorization': `Bearer ${rToken}` } : {});
  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : {};
}

async function loadMenu(){
  const items = await getJSON(`${API}/restaurant/me/menu`);
  const body = document.getElementById('menuBody');
  body.innerHTML = items.map(i => `
    <tr>
      <td>${i.item_id}</td>
      <td><input class="mName" data-id="${i.item_id}" value="${i.item_name}"/></td>
      <td><input class="mPrice" data-id="${i.item_id}" type="number" step="0.01" value="${i.price}"/></td>
      <td><input class="mQty" data-id="${i.item_id}" type="number" value="${i.quantity}"/></td>
      <td>
        <button class="mSave" data-id="${i.item_id}">Save</button>
        <button class="mDel" data-id="${i.item_id}">Delete</button>
      </td>
    </tr>
  `).join('');
  const msg = document.getElementById('mmMsg');
  if (!items.length) { msg.textContent = 'No menu items found for your restaurant.'; msg.className = 'message'; }
}

document.getElementById('addItemBtn')?.addEventListener('click', async () => {
  const name = document.getElementById('miName').value.trim();
  const price = Number(document.getElementById('miPrice').value);
  const qty = Number(document.getElementById('miQty').value);
  const msg = document.getElementById('mmMsg');
  try{
    await getJSON(`${API}/restaurant/me/menu`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ item_name: name, price, quantity: qty }) });
    msg.textContent='Item added'; msg.className='message success';
    document.getElementById('miName').value=''; document.getElementById('miPrice').value=''; document.getElementById('miQty').value='';
    await loadMenu();
  }catch(e){ msg.textContent='Failed to add item'; msg.className='message error'; }
});

document.getElementById('menuBody')?.addEventListener('click', async (e) => {
  const id = e.target.getAttribute('data-id'); if (!id) return;
  const msg = document.getElementById('mmMsg');
  if (e.target.classList.contains('mSave')){
    try{
      const name = document.querySelector(`input.mName[data-id="${id}"]`).value.trim();
      const price = Number(document.querySelector(`input.mPrice[data-id="${id}"]`).value);
      const qty = Number(document.querySelector(`input.mQty[data-id="${id}"]`).value);
      await getJSON(`${API}/restaurant/me/menu/${id}`, { method:'PUT', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ item_name: name, price, quantity: qty }) });
      msg.textContent='Item saved'; msg.className='message success';
    }catch(_){ msg.textContent='Save failed'; msg.className='message error'; }
  }
  if (e.target.classList.contains('mDel')){
    try{
      await getJSON(`${API}/restaurant/me/menu/${id}`, { method:'DELETE' });
      msg.textContent='Item deleted'; msg.className='message success';
      await loadMenu();
    }catch(_){ msg.textContent='Delete failed'; msg.className='message error'; }
  }
});

(async function initPage(){
  try {
    await Promise.all([loadMenu(), loadOrders()]);
  } catch (e) {
    const msg = document.getElementById('mmMsg');
    if (msg) {
      msg.textContent = 'Failed to load restaurant data. Is the backend running? Are you logged in correctly?';
      msg.className = 'message error';
    }
    console.error(e);
  }
})();


