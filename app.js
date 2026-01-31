const $ = (id) => document.getElementById(id);

const state = { items: [] };

/* =========================
   AUTO INVOICE NO (GLOBAL)
   Mulai 303 -> 304 -> 305 ...
   ========================= */
const INVOICE_START = 303;
const INVOICE_COUNTER_KEY = "inv_counter";

function nextInvoiceNumber(){
  const raw = localStorage.getItem(INVOICE_COUNTER_KEY);

  // kalau belum ada, set agar invoice pertama = INVOICE_START
  let current = raw ? Number(raw) : (INVOICE_START - 1);

  if (!Number.isFinite(current) || current < 0) current = INVOICE_START - 1;

  const next = current + 1;
  localStorage.setItem(INVOICE_COUNTER_KEY, String(next));
  return String(next);
}

function ensureInvoiceNoAuto(){
  const el = $("invoiceNo");
  if (!el) return;
  if (!el.value || el.value.trim() === ""){
    el.value = nextInvoiceNumber();
  }
}
/* ========================= */

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

function typeLabel(v){
  if (v === "penjualan") return "Penjualan";
  if (v === "service") return "Service";
  return "Gabungan";
}

function formatDate(iso){
  const [y,m,d] = String(iso||"").split("-").map(Number);
  if (!y || !m || !d) return iso || "-";
  return `${String(d).padStart(2,"0")}-${String(m).padStart(2,"0")}-${y}`;
}

function escapeHtml(s){
  return String(s ?? "")
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

/* ---------- Settings (Logo/Nama/Stamp) ---------- */
function loadSettings(){
  const raw = localStorage.getItem("invoice_settings");
  if (!raw) return { name:null, tagline:null, logoDataUrl:null, stampDataUrl:null };
  try { return JSON.parse(raw); }
  catch { return { name:null, tagline:null, logoDataUrl:null, stampDataUrl:null }; }
}

function saveSettings(s){
  localStorage.setItem("invoice_settings", JSON.stringify(s));
}

function syncPaperBrand(){
  $("paperName").textContent = $("companyName").textContent || "";
  $("paperTagline").textContent = $("companyTagline").textContent || "";
  $("paperLogo").src = $("companyLogo").src;

  const s = loadSettings();
  $("signLogo").src = s.stampDataUrl || $("companyLogo").src;

  const signName = $("pSignName");
  if (signName) signName.textContent = "";
}

function initSettingsUI(){
  const s = loadSettings();

  if (s.name) $("companyName").textContent = s.name;
  if (s.tagline) $("companyTagline").textContent = s.tagline;
  if (s.logoDataUrl) $("companyLogo").src = s.logoDataUrl;

  syncPaperBrand();

  $("setName").value = $("companyName").textContent || "";
  $("setTagline").value = $("companyTagline").textContent || "";
}

function openModal(){ $("modal").classList.remove("hidden"); }
function closeModal(){ $("modal").classList.add("hidden"); }

function applySettings(){
  const s = loadSettings();

  s.name = ($("setName").value || "").trim() || "NAMA TOKO";
  s.tagline = ($("setTagline").value || "").trim() || "Alamat / No. HP / Email";

  $("companyName").textContent = s.name;
  $("companyTagline").textContent = s.tagline;

  const logoFile = $("setLogo").files?.[0];
  const stampFile = $("setStamp").files?.[0];

  const readFileAsDataUrl = (file) => new Promise((resolve) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => resolve(null);
    r.readAsDataURL(file);
  });

  (async () => {
    if (logoFile){
      const data = await readFileAsDataUrl(logoFile);
      if (data) s.logoDataUrl = data;
      if (data) $("companyLogo").src = data;
    }

    if (stampFile){
      const data = await readFileAsDataUrl(stampFile);
      if (data) s.stampDataUrl = data;
    }

    saveSettings(s);
    syncPaperBrand();
    closeModal();
  })();
}

/* ---------- Items Table (NO rerender on typing) ---------- */
function renderItems(){
  const body = $("itemsBody");
  body.innerHTML = "";

  state.items.forEach((it, idx) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td><input type="number" min="0" value="${it.qty}" data-k="qty" data-i="${idx}"/></td>
      <td><input type="text" value="${escapeHtml(it.name)}" data-k="name" data-i="${idx}" placeholder="Nama barang / jasa"/></td>
      <td><input type="number" min="0" value="${it.price}" data-k="price" data-i="${idx}"/></td>
      <td><b data-subtotal="${idx}">${rupiah((it.qty||0) * (it.price||0))}</b></td>
      <td class="no-print"><button class="btn small" data-act="del" data-i="${idx}">Hapus</button></td>
    `;
    body.appendChild(tr);
  });
}

function addRow(item = { qty: 1, name: "", price: 0 }){
  state.items.push(item);
  renderItems();
  calc();
}

function removeRow(idx){
  state.items.splice(idx, 1);
  if (state.items.length === 0) state.items = [{ qty:1, name:"", price:0 }];
  renderItems();
  calc();
}

function bindItemsEvents(){
  $("itemsBody").addEventListener("input", (e) => {
    const el = e.target;
    const idx = Number(el.dataset.i);
    const key = el.dataset.k;
    if (Number.isNaN(idx) || !key) return;

    if (key === "name") state.items[idx][key] = el.value;
    else state.items[idx][key] = Number(el.value);

    const it = state.items[idx];
    const sub = (Number(it.qty||0) * Number(it.price||0));
    const subEl = document.querySelector(`[data-subtotal="${idx}"]`);
    if (subEl) subEl.textContent = rupiah(sub);

    calc();
  });

  $("itemsBody").addEventListener("click", (e) => {
    const btn = e.target.closest("button");
    if (!btn) return;
    if (btn.dataset.act === "del") removeRow(Number(btn.dataset.i));
  });
}

/* ---------- Calc & Preview ---------- */
function calc(){
  const subtotal = state.items.reduce((sum, it) => sum + (Number(it.qty||0) * Number(it.price||0)), 0);
  const disc = Number($("discount").value || 0);
  const total = Math.max(0, subtotal - disc);

  $("sumSubtotal").textContent = rupiah(subtotal);
  $("sumTotal").textContent = rupiah(total);

  $("pType").textContent = typeLabel($("invoiceType").value);
  $("pDate").textContent = $("invoiceDate").value ? formatDate($("invoiceDate").value) : "-";
  $("pNo").textContent = $("invoiceNo").value || "-";

  $("pCustName").textContent = $("customerName").value || "-";
  $("pCustPhone").textContent = $("customerPhone").value || "-";
  $("pCustAddress").textContent = $("customerAddress").value || "-";

  const t = $("invoiceType").value;
  $("serviceSection").style.display = (t === "service" || t === "gabungan") ? "block" : "none";

  syncPaperBrand();
}

/* ---------- Save/Load (Local) ---------- */
function saveLocal(){
  const data = {
    invoiceType: $("invoiceType").value,
    invoiceDate: $("invoiceDate").value,
    invoiceNo: $("invoiceNo").value,
    customerName: $("customerName").value,
    customerPhone: $("customerPhone").value,
    customerAddress: $("customerAddress").value,
    items: state.items,
    discount: $("discount").value,
    terms: $("terms").value,
    svcDevice: $("svcDevice").value,
    svcSN: $("svcSN").value,
    svcWork: $("svcWork").value,
    svcNote: $("svcNote").value,
  };
  localStorage.setItem("invoice_data", JSON.stringify(data));
  alert("Tersimpan ✅");
}

function loadLocal(){
  const raw = localStorage.getItem("invoice_data");
  if (!raw) return;
  try{
    const d = JSON.parse(raw);
    $("invoiceType").value = d.invoiceType || "penjualan";
    $("invoiceDate").value = d.invoiceDate || todayISO();
    $("invoiceNo").value = d.invoiceNo || ""; // kosong -> auto isi

    $("customerName").value = d.customerName || "";
    $("customerPhone").value = d.customerPhone || "";
    $("customerAddress").value = d.customerAddress || "";

    state.items = Array.isArray(d.items) ? d.items : [{qty:1, name:"", price:0}];
    if (state.items.length === 0) state.items = [{qty:1, name:"", price:0}];

    $("discount").value = d.discount || 0;
    $("terms").value = d.terms || "";

    $("svcDevice").value = d.svcDevice || "";
    $("svcSN").value = d.svcSN || "";
    $("svcWork").value = d.svcWork || "";
    $("svcNote").value = d.svcNote || "";
  } catch {}
}

function resetAll(){
  localStorage.removeItem("invoice_data");
  state.items = [{ qty:1, name:"", price:0 }];

  $("invoiceType").value = "penjualan";
  $("invoiceDate").value = todayISO();
  $("invoiceNo").value = nextInvoiceNumber(); // <== AUTO GLOBAL

  $("customerName").value = "";
  $("customerPhone").value = "";
  $("customerAddress").value = "";
  $("discount").value = 0;
  $("terms").value = "";

  $("svcDevice").value = "";
  $("svcSN").value = "";
  $("svcWork").value = "";
  $("svcNote").value = "";

  renderItems();
  calc();
}

/* ---------- PDF (wait images) ---------- */
async function waitImagesLoaded(container){
  const imgs = Array.from(container.querySelectorAll("img"));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(res => {
      img.onload = () => res();
      img.onerror = () => res();
    });
  }));
}

async function downloadPDF(){
  const el = $("invoicePaper");
  syncPaperBrand();
  await waitImagesLoaded(el);

  const opt = {
    margin: 8,
    filename: `${$("invoiceNo").value || "invoice"}.pdf`,
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };

  if (window.html2pdf) window.html2pdf().set(opt).from(el).save();
  else alert("PDF library belum termuat. Coba Print dulu.");
}

/* ---------- Bind ---------- */
function bind(){
  if (!$("invoiceDate").value) $("invoiceDate").value = todayISO();

  // AUTO generate nomor kalau kosong
  ensureInvoiceNoAuto();

  if (!state.items.length) state.items = [{ qty:1, name:"", price:0 }];

  renderItems();
  calc();

  [
    "invoiceType","invoiceDate","invoiceNo",
    "customerName","customerPhone","customerAddress",
    "discount","terms","svcDevice","svcSN","svcWork","svcNote"
  ].forEach(id => $(id).addEventListener("input", calc));

  $("btnAddRow").addEventListener("click", () => addRow());
  $("btnSave").addEventListener("click", saveLocal);
  $("btnReset").addEventListener("click", () => { if (confirm("Reset semua data?")) resetAll(); });
  $("btnPrint").addEventListener("click", () => window.print());
  $("btnPDF").addEventListener("click", downloadPDF);

  $("btnSettings").addEventListener("click", () => { initSettingsUI(); openModal(); });
  $("btnCloseModal").addEventListener("click", closeModal);
  $("btnApplySettings").addEventListener("click", applySettings);

  bindItemsEvents();
}

(function main(){
  initSettingsUI();
  loadLocal();

  if (!$("invoiceDate").value) $("invoiceDate").value = todayISO();
  ensureInvoiceNoAuto();

  if (!state.items.length) state.items = [{ qty:1, name:"", price:0 }];
  bind();
})();
