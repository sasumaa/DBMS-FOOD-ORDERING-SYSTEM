const APIB = 'http://localhost:3000';

let pToken = localStorage.getItem('pToken') || '';

const ordersBody = document.getElementById('ordersBody');
const msg = document.getElementById('msg');
// login handled on partner-login.html

function setMsg(t, type='success'){ msg.textContent=t; msg.className=`message ${type}`; }

async function getJSON(url, options){
  const headers = Object.assign({}, options && options.headers ? options.headers : {}, pToken ? { 'Authorization': `Bearer ${pToken}` } : {});
  const res = await fetch(url, Object.assign({}, options, { headers }));
  if (!res.ok) throw new Error(await res.text());
  const ct = res.headers.get('content-type') || '';
  return ct.includes('application/json') ? res.json() : {};
}

async function loadOrders(){
  const orders = await getJSON(`${APIB}/partner/me/orders`);
  ordersBody.innerHTML = orders.map(o => `
    <tr>
      <td>${o.order_id}</td><td>${o.user_name}</td><td>${o.restaurant_name}</td>
      <td>${o.item_name}</td><td>${o.quantity}</td><td>₹${o.total_price}</td>
      <td><span class="badge ${o.status.toLowerCase()}">${o.status}</span></td><td>${new Date(o.order_date).toLocaleString()}</td>
      <td>
        <select data-id="${o.order_id}" class="statusSel">
          <option ${o.status==='Placed'?'selected':''}>Placed</option>
          <option ${o.status==='Dispatched'?'selected':''}>Dispatched</option>
          <option ${o.status==='Delivered'?'selected':''}>Delivered</option>
          <option ${o.status==='Cancelled'?'selected':''}>Cancelled</option>
        </select>
        <button data-id="${o.order_id}" class="saveStatusBtn">Save</button>
      </td>
    </tr>
  `).join('');
}

ordersBody.addEventListener('click', async (e) => {
  const id = e.target.getAttribute('data-id');
  if (!id) return;
  if (e.target.classList.contains('saveStatusBtn')){
    try{
      const status = document.querySelector(`select.statusSel[data-id="${id}"]`).value;
      await getJSON(`${APIB}/orders/${id}/status`, {
        method:'PUT', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ status })
      });
      setMsg('Status updated','success');
      await loadOrders();
    }catch(_){ setMsg('Failed to update','error'); }
  }
});

(async function init(){
  try{ await loadOrders(); }catch(e){ setMsg('Failed to load data. Is backend running?','error'); }
  const partnerLogout = document.getElementById('partnerLogout');
  if (partnerLogout) {
    partnerLogout.addEventListener('click', () => { localStorage.removeItem('pToken'); window.location.href = 'partner-login.html'; });
  }
  const nameEl = document.getElementById('partnerName');
  if (nameEl && pToken){ try{ const base=pToken.split('.')[1]; const p=JSON.parse(atob(base)); if(p&&p.name){ nameEl.textContent=`• ${p.name}`; } }catch(_){} }
})();