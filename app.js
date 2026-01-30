const $ = (id) => document.getElementById(id);

const state = {
  items: [],
};

function rupiah(n){
  const v = Number(n || 0);
  return "Rp " + v.toLocaleString("id-ID");
}

function todayISO(){
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth()+1).padStart(2,"0");
  const dd = String(d.getDate()).padStart(2,"0");
  return `${yyyy}-${mm}-${dd}`;
}

function genInvoiceNo(){
  // INV-YYYYMMDD-XXXX
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const day = String(d.getDate()).padStart(2,"0");
  const rand = Math.floor(1000 + Math.random()*9000);
  return `INV-${y}${m}${day}-${rand}`;
}

function addRow(item = {qty:1, name:"", price:0}){
  state.items.push(item);
  renderItems();
  calc();
}

function removeRow(idx){
  state.items.splice(idx,1);
  renderItems();
  calc();
}

function renderItems(){
  const body = $("itemsBody");
  body.innerHTML = "";

  state.items.forEach((it, idx) => {
    const tr = document.createElement("tr");

    tr.innerHTML = `
      <td><input type="number" min="0" value="${it.qty}" data-k="qty" data-i="${idx}"/></td>
      <td><input type="text" value="${escapeHtml(it.name)}" data-k="name" data-i="${idx}" placeholder="Nama barang / jasa"/></td>
      <td><input type="number" min="0" value="${it.price}" data-k="price" data-i="${idx}"/></td>
      <td><b>${rupiah((it.qty||0) * (it.price||0))}</b></td>
      <td class="no-print"><button class="btn small" data-act="del" data-i="${idx}">Hapus</button></td>
    `;

    body.appendChild(tr);
  });
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function bindItemsEvents(){
  $("itemsBody").addEventListener("input", (e) => {
    const el = e.target;
    const idx = Number(el.dataset.i);
    const key = el.dataset.k;
    if (Number.isNaN(idx) || !key) return;

    if (key === "name") state.items[idx][key] = el.value;
    else state.items[idx][key] = Number(el.value);

    renderItems();
    calc();
  });

  $("itemsBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.act === "del"){
      removeRow(Number(btn.dataset.i));
    }
  });
}

function calc(){
  const subtotal = state.items.reduce((sum, it) => sum + (Number(it.qty||0) * Number(it.price||0)), 0);
  const disc = Number($("discount").value || 0);
  const tax = Number($("tax").value || 0);
  const total = Math.max(0, subtotal - disc + tax);

  $("sumSubtotal").textContent = rupiah(subtotal);
  $("sumTotal").textContent = rupiah(total);

  // update preview header & customer
  $("pType").textContent = typeLabel($("invoiceType").value);
  $("pDate").textContent = $("invoiceDate").value ? formatDate($("invoiceDate").value) : "-";
  $("pNo").textContent = $("invoiceNo").value || "-";

  $("pCustName").textContent = $("customerName").value || "-";
  $("pCustPhone").textContent = $("customerPhone").value || "-";
  $("pCustAddress").textContent = $("customerAddress").value || "-";

  // signature uses company name
  $("pSignName").textContent = $("companyName").textContent || "—";

  // service section visibility
  const t = $("invoiceType").value;
  $("serviceSection").style.display = (t === "service" || t === "gabungan") ? "block" : "none";
}

function typeLabel(v){
  if (v === "penjualan") return "Penjualan";
  if (v === "service") return "Service";
  return "Gabungan";
}

function formatDate(iso){
  const [y,m,d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return `${String(d).padStart(2,"0")}-${String(m).padStart(2,"0")}-${y}`;
}

function saveAll(){
  const data = {
    invoiceType: $("invoiceType").value,
    invoiceDate: $("invoiceDate").value,
    invoiceNo: $("invoiceNo").value,
    customerName: $("customerName").value,
    customerPhone: $("customerPhone").value,
    customerAddress: $("customerAddress").value,
    items: state.items,
    discount: $("discount").value,
    tax: $("tax").value,
    terms: $("terms").value,
    svcDevice: $("svcDevice").value,
    svcSN: $("svcSN").value,
    svcWork: $("svcWork").value,
    svcNote: $("svcNote").value,
  };
  localStorage.setItem("invoice_data", JSON.stringify(data));
  alert("Tersimpan ✅");
}

function loadAll(){
  const raw = localStorage.getItem("invoice_data");
  if (!raw) return;
  try{
    const data = JSON.parse(raw);
    $("invoiceType").value = data.invoiceType || "penjualan";
    $("invoiceDate").value = data.invoiceDate || todayISO();
    $("invoiceNo").value = data.invoiceNo || genInvoiceNo();

    $("customerName").value = data.customerName || "";
    $("customerPhone").value = data.customerPhone || "";
    $("customerAddress").value = data.customerAddress || "";

    state.items = Array.isArray(data.items) ? data.items : [];
    if (state.items.length === 0) state.items = [{qty:1, name:"", price:0}];

    $("discount").value = data.discount || 0;
    $("tax").value = data.tax || 0;
    $("terms").value = data.terms || "";

    $("svcDevice").value = data.svcDevice || "";
    $("svcSN").value = data.svcSN || "";
    $("svcWork").value = data.svcWork || "";
    $("svcNote").value = data.svcNote || "";

    renderItems();
    calc();
  }catch(e){
    console.warn("Gagal load", e);
  }
}

function resetAll(){
  localStorage.removeItem("invoice_data");
  state.items = [{qty:1, name:"", price:0}];

  $("invoiceType").value = "penjualan";
  $("invoiceDate").value = todayISO();
  $("invoiceNo").value = genInvoiceNo();

  $("customerName").value = "";
  $("customerPhone").value = "";
  $("customerAddress").value = "";
  $("discount").value = 0;
  $("tax").value = 0;
  $("terms").value = "";

  $("svcDevice").value = "";
  $("svcSN").value = "";
  $("svcWork").value = "";
  $("svcNote").value = "";

  renderItems();
  calc();
}

function openModal(){ $("modal").classList.remove("hidden"); }
function closeModal(){ $("modal").classList.add("hidden"); }

function applySettings(){
  const name = $("setName").value.trim() || "NAMA TOKO";
  const tagline = $("setTagline").value.trim() || "Alamat / No. HP / Email";
  $("companyName").textContent = name;
  $("companyTagline").textContent = tagline;

  const settings = { name, tagline, logoDataUrl: null };

  // logo file -> dataURL
  const file = $("setLogo").files?.[0];
  if (file){
    const reader = new FileReader();
    reader.onload = () => {
      settings.logoDataUrl = reader.result;
      $("companyLogo").src = settings.logoDataUrl;
      localStorage.setItem("invoice_settings", JSON.stringify(settings));
      closeModal();
      calc();
    };
    reader.readAsDataURL(file);
  } else {
    // keep existing logo src
    const current = loadSettings();
    settings.logoDataUrl = current.logoDataUrl || null;
    localStorage.setItem("invoice_settings", JSON.stringify(settings));
    closeModal();
    calc();
  }
}

function loadSettings(){
  const raw = localStorage.getItem("invoice_settings");
  if (!raw) return { name:null, tagline:null, logoDataUrl:null };
  try { return JSON.parse(raw); } catch { return { name:null, tagline:null, logoDataUrl:null }; }
}

function initSettingsUI(){
  const s = loadSettings();
  if (s.name) $("companyName").textContent = s.name;
  if (s.tagline) $("companyTagline").textContent = s.tagline;
  if (s.logoDataUrl) $("companyLogo").src = s.logoDataUrl;

  $("setName").value = $("companyName").textContent || "";
  $("setTagline").value = $("companyTagline").textContent || "";
}

function downloadPDF(){
  const el = $("invoicePaper");
  const opt = {
    margin: 8,
    filename: `${$("invoiceNo").value || "invoice"}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2 },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  if (window.html2pdf){
    window.html2pdf().set(opt).from(el).save();
  } else {
    alert("Library PDF belum termuat. Coba gunakan Print dulu.");
  }
}

function bind(){
  // Initial default
  if (!$("invoiceDate").value) $("invoiceDate").value = todayISO();
  if (!$("invoiceNo").value) $("invoiceNo").value = genInvoiceNo();
  if (state.items.length === 0) state.items = [{qty:1, name:"", price:0}];

  renderItems();
  calc();

  // form input triggers
  ["invoiceType","invoiceDate","invoiceNo","customerName","customerPhone","customerAddress","discount","tax","terms",
   "svcDevice","svcSN","svcWork","svcNote"
  ].forEach(id => $(id).addEventListener("input", calc));

  $("btnAddRow").addEventListener("click", () => addRow());
  $("btnSave").addEventListener("click", saveAll);
  $("btnReset").addEventListener("click", () => { if(confirm("Reset semua data?")) resetAll(); });
  $("btnPrint").addEventListener("click", () => window.print());
  $("btnPDF").addEventListener("click", downloadPDF);

  // modal settings
  $("btnSettings").addEventListener("click", () => { initSettingsUI(); openModal(); });
  $("btnCloseModal").addEventListener("click", closeModal);
  $("btnApplySettings").addEventListener("click", applySettings);

  bindItemsEvents();
}

(function main(){
  initSettingsUI();
  loadAll();
  if (state.items.length === 0) state.items = [{qty:1, name:"", price:0}];
  bind();
})();
