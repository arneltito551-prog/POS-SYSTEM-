(() => {
  // helpers
  const $ = (s, r=document) => r.querySelector(s);
  const $all = (s, r=document) => Array.from((r||document).querySelectorAll(s));
  const fmt = v => Number(v||0).toFixed(2);

  // Toast utility
  const toastContainer = $("#toastContainer");
  function toast(title, message="", type="info", timeout=3500) {
    try {
      const t = document.createElement("div");
      t.className = `toast ${type}`;
      t.innerHTML = `<div style="flex:1"><div class="title">${title}</div><div class="body">${message}</div></div>
                     <div style="margin-left:8px;opacity:0.6;cursor:pointer" aria-hidden="true">✖</div>`;
      const closeBtn = t.querySelector('div[aria-hidden="true"]');
      closeBtn && closeBtn.addEventListener("click", () => { t.remove(); });
      toastContainer.appendChild(t);
      setTimeout(()=>{ t.style.transition = "opacity 300ms, transform 300ms"; t.style.opacity = "0"; t.style.transform = "translateY(6px)"; setTimeout(()=>t.remove(), 320); }, timeout);
    } catch(e){ console.warn("toast failed", e); }
  }

  // storage keys
  const K_ITEMS = "sari_items_v2";
  const K_SALES = "sari_sales_v1";
  const K_CUSTOMERS = "sari_customers_v1";

  const readItems = () => JSON.parse(localStorage.getItem(K_ITEMS) || "[]");
  const writeItems = (a) => localStorage.setItem(K_ITEMS, JSON.stringify(a));
  const readSales = () => JSON.parse(localStorage.getItem(K_SALES) || "[]");
  const writeSales = (s) => localStorage.setItem(K_SALES, JSON.stringify(s));
  const readCustomers = () => JSON.parse(localStorage.getItem(K_CUSTOMERS) || "[]");
  const writeCustomers = (c) => localStorage.setItem(K_CUSTOMERS, JSON.stringify(c));

  // screens
  const home = $("#home");
  const screens = {
    add: $("#add"),
    sell: $("#sell"),
    inventory: $("#inventory"),
    sales: $("#sales"),
    customers: $("#customers")
  };

  // top actions
  const btnExportAll = $("#btnExportAll");
  const btnClearAll = $("#btnClearAll");
  const btnPrintInv = $("#btnPrintInv");

  // Add refs (image)
  const videoAdd = $("#videoAdd");
  const qrAddDiv = $("#qr-reader-add");
  const startAdd = $("#startAdd");
  const stopAdd = $("#stopAdd");
  const toggleFlashAdd = $("#toggleFlashAdd");
  const statusAdd = $("#statusAdd");
  const add_barcode = $("#add_barcode");
  const add_name = $("#add_name");
  const add_price = $("#add_price");
  const add_qty = $("#add_qty");
  const add_image = $("#add_image");
  const imgPreviewWrap = $("#imgPreviewWrap");
  const imgPreview = $("#imgPreview");
  const saveAdd = $("#saveAdd");
  const clearAdd = $("#clearAdd");
  const msgAdd = $("#msgAdd");

  // Sell refs
  const videoSell = $("#videoSell");
  const qrSellDiv = $("#qr-reader-sell");
  const startSell = $("#startSell");
  const stopSell = $("#stopSell");
  const toggleFlashSell = $("#toggleFlashSell");
  const statusSell = $("#statusSell");
  const sell_barcode = $("#sell_barcode");
  const sell_qty = $("#sell_qty");
  const findSell = $("#findSell");
  const confirmSell = $("#confirmSell");
  const sellInfo = $("#sellInfo");
  const msgSell = $("#msgSell");
  const paymentType = $("#paymentType");
  const creditDetails = $("#creditDetails");
  const customerSelect = $("#customerSelect");
  const customerName = $("#customerName");
  const createCustomerInline = $("#createCustomerInline");

  // Sell cart/payment refs
  const sellCartDiv = $("#sellCart");
  const cashPaidEl = $("#cashPaid");
  const changeDisplay = $("#changeDisplay");
  const finalizeSell = $("#finalizeSell");
  const clearCartBtn = $("#clearCart");

  // Inventory refs
  const inventoryGrid = $("#inventoryGrid");
  const searchInv = $("#searchInv");
  const emptyInv = $("#emptyInv");
  const printInvBtn = $("#printInvBtn");
  const btnScanUpdate = $("#btnScanUpdate");
  const invScannerCard = $("#invScannerCard");
  const videoInv = $("#videoInv");
  const qrInvDiv = $("#qr-reader-inv");
  const stopInv = $("#stopInv");
  const statusInv = $("#statusInv");
  const invResult = $("#invResult");

  // Sales refs
  const salesList = $("#salesList");
  const salesCount = $("#salesCount");
  const salesTotal = $("#salesTotal");
  const exportSalesBtn = $("#exportSales");
  const clearSalesBtn = $("#clearSales");

  // Customers refs
  const customersList = $("#customersList");
  const emptyCustomers = $("#emptyCustomers");
  const cust_search = $("#cust_search");
  const addCustomerBtn = $("#addCustomerBtn");

  // scanner state
  let html5QrcodeScannerAdd = null;
  let html5QrcodeScannerSell = null;
  let html5QrcodeScannerInv = null;
  let barcodeDetector = null;
  let usingBarcodeDetector = false;
  let scanning = false;
  let nativeStream = null;
  let scanContext = null; // 'add' or 'sell' or 'update'/'inv'
  let stagedImageDataUrl = "";

  // torch state (per-stream)
  let torchOn = false;

  // SELL cart
  let sellCart = []; // {barcode, name, unitPrice, qty}

  // ---------- Image helpers (now crops to 1x1) ----------
  function imageFileToDataUrl(file, maxWidth=900, quality=0.75) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => {
        const img = new Image();
        img.onload = () => {
          // crop to square center then resize
          const side = Math.min(img.width, img.height);
          const sx = Math.floor((img.width - side) / 2);
          const sy = Math.floor((img.height - side) / 2);
          const targetSide = maxWidth; // final output width x height
          const canvas = document.createElement('canvas');
          canvas.width = targetSide;
          canvas.height = targetSide;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, sx, sy, side, side, 0, 0, targetSide, targetSide);
          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = (e) => reject(e);
        img.src = fr.result;
      };
      fr.onerror = e => reject(e);
      fr.readAsDataURL(file);
    });
  }

  // ---------- beep ----------
  function beepOnce(freq = 900, durationMs = 100) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = "sine"; o.frequency.value = freq;
      g.gain.value = 0.0001; o.connect(g); g.connect(ctx.destination);
      const now = ctx.currentTime;
      g.gain.linearRampToValueAtTime(0.25, now + 0.01);
      o.start(now);
      g.gain.linearRampToValueAtTime(0.0001, now + durationMs/1000);
      o.stop(now + durationMs/1000 + 0.02);
      setTimeout(()=>{ try{ ctx.close(); }catch(e){} }, durationMs + 150);
    } catch (e) {}
  }

  // ---------- BarcodeDetector (init) ----------
  async function tryInitBarcodeDetector() {
    if (!("BarcodeDetector" in window)) return false;
    try {
      const formats = await BarcodeDetector.getSupportedFormats();
      barcodeDetector = new BarcodeDetector({ formats: formats.length ? formats : ["code_128","ean_13","ean_8","upc_e","upc_a","code_39"] });
      usingBarcodeDetector = true;
      return true;
    } catch (e) { usingBarcodeDetector = false; barcodeDetector = null; return false; }
  }

  async function ensureCamera() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return false;
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: true });
      s.getTracks().forEach(t => t.stop());
      return true;
    } catch (e) {
      return false;
    }
  }

  // ---------- manage torch ----------
  async function setTorch(stream, on) {
    if (!stream) return false;
    try {
      const [track] = stream.getVideoTracks();
      if (!track) return false;
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (!capabilities.torch) return false;
      await track.applyConstraints({ advanced: [{ torch: !!on }] });
      torchOn = !!on;
      return true;
    } catch (e) {
      // some browsers reject applyConstraints
      return false;
    }
  }

  // ---------- open scanner ----------
  async function openScanner(ctx) {
    if (scanning) {
      // if scanner already running but different context, switch context
      scanContext = ctx;
      return;
    }
    scanContext = ctx;
    scanning = true;
    const videoEl = (ctx === "add") ? videoAdd : (ctx === "sell") ? videoSell : videoInv;
    const qrDiv = (ctx === "add") ? qrAddDiv : (ctx === "sell") ? qrSellDiv : qrInvDiv;
    const statusEl = (ctx === "add") ? statusAdd : (ctx === "sell") ? statusSell : statusInv;
    const toggleBtn = (ctx === "add") ? toggleFlashAdd : (ctx === "sell") ? toggleFlashSell : null;

    statusEl.textContent = "Requesting camera...";
    const ok = await ensureCamera();
    if (!ok) {
      statusEl.textContent = "Camera unavailable or permission denied.";
      toast("Camera", "Camera unavailable or permission denied.", "danger");
      scanning = false;
      return;
    }

    const bd = await tryInitBarcodeDetector().catch(()=>false);
    try {
      // Try to get a native stream first (to allow torch control). Use facingMode env.
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      nativeStream = s;
      // attach stream to video element for preview
      if (videoEl) {
        videoEl.srcObject = s;
        videoEl.style.display = "block";
      }
      if (qrDiv) qrDiv.style.display = "none";
      statusEl.textContent = "Scanning...";
      // attempt to enable torch automatically (best-effort)
      const torchOk = await setTorch(s, true).catch(()=>false);
      if (toggleBtn) toggleBtn && (toggleBtn.textContent = torchOn ? "💡 Flash On" : "💡 Flash");
      if (bd && usingBarcodeDetector && barcodeDetector) {
        // use BarcodeDetector + native stream
        requestAnimationFrame(() => nativeLoop(videoEl, statusEl));
        toast("Scanner", "Camera opened. Flash attempted.", "info", 1800);
      } else {
        // if no BarcodeDetector, use html5-qrcode for continuous scanning.
        if (videoEl) { videoEl.style.display = "none"; }
        if (qrDiv) qrDiv.style.display = "block";
        startHtml5Qrcode(ctx, qrDiv, statusEl);
        toast("Scanner", "Camera opened (fallback). Flash attempted.", "info", 1800);
      }
    } catch (e) {
      // fallback to html5-qrcode start if getUserMedia fails for direct stream
      try {
        if (videoEl) videoEl.style.display = "none";
        if (qrDiv) qrDiv.style.display = "block";
        startHtml5Qrcode(ctx, qrDiv, statusEl);
      } catch (err) {
        statusEl.textContent = "Scanner start failed.";
        toast("Scanner", "Scanner start failed.", "danger");
        scanning = false;
      }
    }
  }

  async function nativeLoop(videoEl, statusEl) {
    if (!usingBarcodeDetector || !barcodeDetector || !scanning) return;
    if (!videoEl || videoEl.readyState < 2) {
      if (scanning) requestAnimationFrame(() => nativeLoop(videoEl, statusEl));
      return;
    }
    try {
      const canvas = document.createElement("canvas");
      canvas.width = videoEl.videoWidth;
      canvas.height = videoEl.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(videoEl, 0, 0, canvas.width, canvas.height);
      const bitmap = await createImageBitmap(canvas);
      const codes = await barcodeDetector.detect(bitmap);
      if (codes && codes.length) {
        const code = codes[0].rawValue || codes[0].rawData || "";
        if (code) {
          statusEl.textContent = "Scanned: " + code;
          try { beepOnce(); } catch(_) {}
          handleScanResult(code, scanContext);
          // small delay to avoid duplicate rapid scans
          await new Promise(r => setTimeout(r, 600));
        }
      }
    } catch (e) {}
    if (scanning) requestAnimationFrame(() => nativeLoop(videoEl, statusEl));
  }

  function startHtml5Qrcode(ctx, qrDiv, statusEl) {
    const id = ctx === "add" ? "qr-reader-add" : (ctx === "sell" ? "qr-reader-sell" : "qr-reader-inv");
    const html5Scanner = new Html5Qrcode(id);
    const qrbox = Math.min(320, Math.floor(window.innerWidth * 0.8));
    html5Scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: qrbox } },
      async (decodedText) => {
        statusEl.textContent = "Scanned: " + decodedText;
        try { beepOnce(); } catch(_) {}
        handleScanResult(decodedText, ctx);
        // html5-qrcode continues scanning automatically
      },
      (err) => { statusEl.textContent = "Scanning..."; }
    ).then(() => {
      scanning = true;
      if (ctx === "add") html5QrcodeScannerAdd = html5Scanner;
      else if (ctx === "sell") html5QrcodeScannerSell = html5Scanner;
      else html5QrcodeScannerInv = html5Scanner;
    }).catch(err => {
      statusEl.textContent = "Scanner failed";
      scanning = false;
      toast("Scanner", "Scanner initialization failed.", "danger");
    });
  }

  async function stopScanner() {
    try { if (html5QrcodeScannerAdd) { await html5QrcodeScannerAdd.stop(); html5QrcodeScannerAdd.clear(); html5QrcodeScannerAdd = null; } } catch(e){}
    try { if (html5QrcodeScannerSell) { await html5QrcodeScannerSell.stop(); html5QrcodeScannerSell.clear(); html5QrcodeScannerSell = null; } } catch(e){}
    try { if (html5QrcodeScannerInv) { await html5QrcodeScannerInv.stop(); html5QrcodeScannerInv.clear(); html5QrcodeScannerInv = null; } } catch(e){}
    try { if (videoAdd && videoAdd.srcObject) { const s = videoAdd.srcObject; if (s.getTracks) s.getTracks().forEach(t => t.stop()); videoAdd.srcObject = null; videoAdd.style.display = "none"; } } catch(e){}
    try { if (videoSell && videoSell.srcObject) { const s = videoSell.srcObject; if (s.getTracks) s.getTracks().forEach(t => t.stop()); videoSell.srcObject = null; videoSell.style.display = "none"; } } catch(e){}
    try { if (videoInv && videoInv.srcObject) { const s = videoInv.srcObject; if (s.getTracks) s.getTracks().forEach(t => t.stop()); videoInv.srcObject = null; videoInv.style.display = "none"; } } catch(e){}
    torchOn = false;
    nativeStream = null;
    scanning = false;
    scanContext = null;
    if (statusAdd) statusAdd.textContent = "Stopped.";
    if (statusSell) statusSell.textContent = "Stopped.";
    if (statusInv) statusInv.textContent = "Stopped.";
    if (invScannerCard) invScannerCard.classList.add("hidden");
  }

  // handle scan result: covers add, sell, update
  function handleScanResult(code, ctx) {
    if (!code) return;
    if (ctx === "add") {
      add_barcode.value = code;
      msgAdd.textContent = `Scanned: ${code}`;
      toast("Scanned", `${code} (Add)`, "info", 1800);
    } else if (ctx === "sell") {
      sell_barcode.value = code;
      msgSell.textContent = `Scanned: ${code}`;
      // add to cart (continuous)
      addScannedItemToCart(code, 1);
    } else if (ctx === "update" || ctx === "inv") {
      const items = readItems();
      const it = items.find(i => i.barcode === code);
      if (!it) {
        invResult.classList.remove("hidden");
        invResult.innerHTML = `<div style="font-weight:600">Item not found for ${code}</div>`;
        toast("Inventory", `Item not found: ${code}`, "danger");
        return;
      }
      // display item details card in invResult (instead of prompt)
      invResult.classList.remove("hidden");
      invResult.innerHTML = `
        <div style="display:flex;gap:12px;align-items:center">
          <div style="flex:1">
            <div style="font-weight:700">${it.name}</div>
            <div class="muted small">Barcode: ${it.barcode}</div>
            <div class="muted small">Price: ₱ ${fmt(it.price)} • Stock: ${it.stock}</div>
          </div>
          <div style="display:flex;flex-direction:column;gap:8px;min-width:180px;">
            <button id="invAddStock" class="btn">Add Stock</button>
            <button id="invEditItem" class="btn small">Edit Item</button>
          </div>
        </div>
      `;
      // attach handlers
      $("#invAddStock").addEventListener("click", () => {
        const v = parseInt(prompt(`Add stock to ${it.name} (current ${it.stock}):`, "1"), 10);
        if (!isNaN(v) && v > 0) {
          it.stock = (it.stock || 0) + v;
          const list = readItems().map(x => x.id === it.id ? it : x);
          writeItems(list);
          renderProducts();
          invResult.innerHTML = `<div class="muted small">Stock updated. New qty: ${it.stock}</div>`;
          toast("Inventory", `Stock updated: ${it.stock}`, "success");
        } else {
          toast("Inventory", "Invalid qty", "danger");
        }
      });
      $("#invEditItem").addEventListener("click", () => {
        editItem(it.id);
      });
    }
  }

  // ---------- navigation ----------
  $all('[data-action="open"]').forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.target;
      home.classList.add("hidden");
      Object.values(screens).forEach(s => s.classList.add("hidden"));
      screens[target].classList.remove("hidden");
      // auto-open scanner for add/sell
      if (target === "add") { if (statusAdd) statusAdd.textContent = "Idle"; openScanner("add"); startAdd.disabled = true; stopAdd.disabled = false; }
      else if (target === "sell") { if (statusSell) statusSell.textContent = "Idle"; openScanner("sell"); startSell.disabled = true; stopSell.disabled = false; populateCustomerSelect(); }
      else { stopScanner(); startAdd.disabled=false; stopAdd.disabled=true; startSell.disabled=false; stopSell.disabled=true; }
      renderProducts();
      renderSales();
      renderCustomers();
      renderCartUI();
    });
  });

  $all('[data-action="back"]').forEach(b => b.addEventListener("click", () => {
    stopScanner();
    Object.values(screens).forEach(s => s.classList.add("hidden"));
    home.classList.remove("hidden");
  }));

  // ---------- Image input handling (1x1 crop) ----------
  add_image.addEventListener("change", async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) {
      stagedImageDataUrl = "";
      imgPreviewWrap.classList.add("hidden");
      imgPreview.src = "";
      return;
    }
    try {
      const dataUrl = await imageFileToDataUrl(f, 900, 0.75);
      stagedImageDataUrl = dataUrl;
      imgPreview.src = dataUrl;
      imgPreviewWrap.classList.remove("hidden");
      toast("Image", "Image prepared (1x1 crop).", "info", 1600);
    } catch (err) {
      console.error("Image load error", err);
      stagedImageDataUrl = "";
      imgPreviewWrap.classList.add("hidden");
      imgPreview.src = "";
      toast("Image", "Failed to process image", "danger");
    }
  });

  // ---------- Add logic (with image) ----------
  saveAdd.addEventListener("click", async () => {
    const barcode = String(add_barcode.value || "").trim();
    const name = String(add_name.value || "").trim();
    const price = parseFloat(add_price.value);
    const qty = parseInt(add_qty.value || "0", 10);
    if (!barcode) return showMsg(msgAdd, "Barcode required", false);
    if (!name) return showMsg(msgAdd, "Name required", false);
    if (isNaN(price) || price < 0) return showMsg(msgAdd, "Valid price required", false);
    if (isNaN(qty) || qty < 0) return showMsg(msgAdd, "Valid qty required", false);
    const items = readItems();
    if (items.some(i => i.barcode === barcode)) return showMsg(msgAdd, "Barcode exists. Edit instead.", false);
    const img = stagedImageDataUrl || "";
    const item = { id: Date.now() + Math.floor(Math.random()*999), barcode, name, price: Number(price), stock: qty, createdAt: Date.now(), image: img };
    items.push(item);
    writeItems(items);
    showMsg(msgAdd, "Saved.", true);
    toast("Item", `${name} saved.`, "success");
    // clear form
    add_barcode.value = ""; add_name.value = ""; add_price.value = ""; add_qty.value = "0";
    stagedImageDataUrl = "";
    imgPreview.src = ""; imgPreviewWrap.classList.add("hidden");
    add_image.value = "";
    renderProducts();
  });

  clearAdd.addEventListener("click", () => {
    add_barcode.value=""; add_name.value=""; add_price.value=""; add_qty.value="0";
    stagedImageDataUrl = ""; imgPreview.src = ""; imgPreviewWrap.classList.add("hidden"); add_image.value = "";
    msgAdd.textContent="";
    toast("Form", "Add item form cleared.", "info");
  });

  function showMsg(el, txt, ok=true) { if (!el) return; el.textContent = txt; el.style.color = ok ? "var(--muted)" : "var(--danger)"; }

  // ---------- Sell logic (legacy find) ----------
  findSell.addEventListener("click", () => {
    const code = String(sell_barcode.value || "").trim();
    if (!code) return showMsg(msgSell, "Enter barcode", false);
    const items = readItems();
    const found = items.find(i => i.barcode === code);
    if (!found) return showMsg(msgSell, "Item not found", false);
    sellInfo.textContent = `${found.name} • ₱ ${fmt(found.price)} • Stock: ${found.stock}`;
    showMsg(msgSell, "", true);
    toast("Item", `${found.name} • ₱ ${fmt(found.price)} • Stock: ${found.stock}`, "info");
  });

  // Confirm Sell button will add to cart manually if used
  confirmSell.addEventListener("click", () => {
    const code = String(sell_barcode.value || "").trim();
    const qty = parseInt(sell_qty.value || "0", 10);
    if (!code) return showMsg(msgSell, "Enter barcode", false);
    if (isNaN(qty) || qty <= 0) return showMsg(msgSell, "Enter valid qty", false);
    addScannedItemToCart(code, qty);
  });

  // ---------- Add scanned item into cart (continuous) ----------
  function addScannedItemToCart(barcode, qty=1) {
    const items = readItems();
    const found = items.find(i => i.barcode === barcode);
    if (!found) {
      showMsg(msgSell, "Item not found", false);
      toast("Sell", `Item not found: ${barcode}`, "danger");
      return;
    }
    if (found.stock < qty) {
      showMsg(msgSell, `Not enough stock. Available: ${found.stock}`, false);
      toast("Sell", `Not enough stock for ${found.name}`, "danger");
      return;
    }
    // find in cart
    const existing = sellCart.find(c => c.barcode === barcode);
    if (existing) {
      existing.qty += qty;
    } else {
      sellCart.push({ barcode: found.barcode, name: found.name, unitPrice: found.price, qty });
    }
    showMsg(msgSell, `Added ${qty} x ${found.name}`, true);
    toast("Cart", `Added ${qty} x ${found.name}`, "success", 1600);
    renderCartUI();
    updateChangeDisplay();
  }

  // render cart UI
  function renderCartUI() {
    if (!sellCart.length) {
      sellCartDiv.textContent = "(No items yet)";
      salesTotal.textContent = "0.00";
      return;
    }
    sellCartDiv.innerHTML = "";
    const ul = document.createElement("div");
    sellCart.forEach((c, idx) => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.justifyContent = "space-between";
      row.style.alignItems = "center";
      row.style.padding = "6px 0";
      const qtyVal = (typeof c.qty === "number" && c.qty > 0) ? c.qty : "";
      const lineTotal = (Number(c.unitPrice) * Number(c.qty || 0));
      row.innerHTML = `<div style="font-weight:600">${c.name} <span style="color:var(--muted);font-weight:400">(${c.barcode})</span></div>
        <div style="display:flex;gap:8px;align-items:center">
          <div class="muted small">₱ ${fmt(c.unitPrice)} x </div>
          <input data-idx="${idx}" class="cart-qty" type="number" min="1" step="1" value="${qtyVal}" placeholder="" style="width:80px;padding:6px;border-radius:6px;border:1px solid #e6e9ef">
          <div class="muted small">= ₱ <span class="line-total">${fmt(lineTotal)}</span></div>
          <button class="btn small danger" data-rem="${idx}" title="Remove">✖</button>
        </div>`;
      ul.appendChild(row);
    });
    sellCartDiv.appendChild(ul);

    // delegate buttons - editable input allows blank
    $all('input.cart-qty', sellCartDiv).forEach(inp => {
      inp.addEventListener("input", (e) => {
        const i = Number(inp.dataset.idx);
        let raw = inp.value;
        // allow blank
        if (raw === "" || raw === null) {
          sellCart[i].qty = 0; // temporary zero until a valid number is typed
          const lineTotalEl = inp.parentElement.querySelector('.line-total');
          if (lineTotalEl) lineTotalEl.textContent = fmt(0);
          updateChangeDisplay();
          renderCartSummaryAmountOnly();
          return;
        }
        let v = parseInt(raw || "0", 10);
        if (isNaN(v) || v < 1) {
          // if invalid (like -1), revert input visually but keep logic as zero
          // keep the current displayed value as-is but do not accept negative
          inp.value = sellCart[i].qty > 0 ? sellCart[i].qty : "";
          return;
        }
        // check stock availability (consider current cart vs stock)
        const item = readItems().find(it => it.barcode === sellCart[i].barcode);
        if (item && v > item.stock) {
          toast("Stock", `Not enough stock. Available: ${item.stock}`, "danger");
          inp.value = sellCart[i].qty > 0 ? sellCart[i].qty : "";
          return;
        }
        sellCart[i].qty = v;
        const lineTotalEl = inp.parentElement.querySelector('.line-total');
        if (lineTotalEl) lineTotalEl.textContent = fmt(sellCart[i].unitPrice * sellCart[i].qty);
        updateChangeDisplay();
        renderCartSummaryAmountOnly();
      });
      // on blur: if left blank, keep blank (user asked to allow blank). We won't force to 1.
      inp.addEventListener("blur", () => {
        const i = Number(inp.dataset.idx);
        if ((inp.value || "").trim() === "") {
          // keep it blank and qty=0; UI line-total already updated in input handler
          return;
        }
      });
    });

    $all('[data-rem]', sellCartDiv).forEach(b => b.addEventListener("click", (e) => {
      const i = Number(b.dataset.rem);
      sellCart.splice(i,1);
      renderCartUI();
      updateChangeDisplay();
    }));

    renderCartSummaryAmountOnly();
  }

  function renderCartSummaryAmountOnly() {
    salesTotal.textContent = fmt(cartTotal());
  }

  function cartTotal() {
    return sellCart.reduce((a,b) => a + Number(b.unitPrice) * Number(b.qty || 0), 0);
  }

  // update change display given cashPaid input
  function updateChangeDisplay() {
    const total = Number(cartTotal());
    const paid = Number(parseFloat(cashPaidEl.value || "0") || 0);
    const diff = (paid - total);
    if (isNaN(diff)) return;
    if (diff < 0) {
      changeDisplay.textContent = `Remaining due: ₱ ${fmt(Math.abs(diff))}`;
      changeDisplay.style.color = "var(--danger)";
    } else {
      changeDisplay.textContent = `Change: ₱ ${fmt(diff)}`;
      changeDisplay.style.color = "var(--muted)";
    }
    salesTotal.textContent = fmt(total);
  }

  cashPaidEl && cashPaidEl.addEventListener("input", () => updateChangeDisplay());

  // finalize sale: create sale entries for all cart items, deduct stock, clear cart
  finalizeSell.addEventListener("click", () => {
    if (!sellCart.length) return toast("Sale", "Cart is empty.", "danger");
    const payType = paymentType.value || "cash";
    let paid = Number(parseFloat(cashPaidEl.value || "0") || 0);

    // Validate cart: ensure every cart item has qty >= 1
    for (const c of sellCart) {
      if (!c.qty || Number(c.qty) < 1) {
        return toast("Sale", `Please enter qty for ${c.name} (cannot be blank or zero)`, "danger");
      }
    }

    // if payment type is credit, require customer
    if (payType === "credit") {
      let cname = (customerSelect.value || "").trim();
      const entered = (customerName.value || "").trim();
      if (entered) cname = entered;
      if (!cname) return showMsg(msgSell, "Select or enter customer name for credit sales", false);
      // create/find customer
      const list = readCustomers();
      let c = list.find(x => x.name.toLowerCase() === cname.toLowerCase());
      if (!c) {
        c = { id: Date.now() + Math.floor(Math.random()*999), name: cname, balance: 0, history: [] };
        list.push(c);
      }
      // accumulate debt
      const total = cartTotal();
      c.balance = Number((Number(c.balance || 0) + total).toFixed(2));
      c.history.push({ type: "debt", date: Date.now(), item: "Bulk sale", qty: sellCart.reduce((a,b)=>a+b.qty,0), total });
      writeCustomers(list);
      toast("Credit", `Recorded as credit for ${c.name} — ₱${fmt(total)}`, "success");
    }

    // For cash or mixed: we consider paid amount applies to whole cart
    const sales = readSales();
    const items = readItems();
    const timestamp = Date.now();
    let totalRecorded = 0;
    // verify stock
    for (const c of sellCart) {
      const it = items.find(x => x.barcode === c.barcode);
      if (!it || it.stock < c.qty) return toast("Sale", `Not enough stock for ${c.name}`, "danger");
    }
    sellCart.forEach(c => {
      const total = Number((c.unitPrice * c.qty).toFixed(2));
      const sale = { id: Date.now() + Math.floor(Math.random()*999) + Math.floor(Math.random()*99), barcode: c.barcode, name: c.name, qty: c.qty, unitPrice: c.unitPrice, total, timestamp, payment: payType };
      sales.push(sale);
      totalRecorded += total;
      // deduct stock
      const it = items.find(x => x.barcode === c.barcode);
      if (it) {
        it.stock = Math.max(0, (it.stock || 0) - c.qty);
      }
    });
    writeSales(sales);
    writeItems(items);
    renderProducts();
    renderSales();
    renderCustomers();
    populateCustomerSelect();

    // Show change / remaining
    if (payType === "cash") {
      const diff = paid - totalRecorded;
      if (diff < 0) {
        toast("Sale", `Sale recorded. Remaining due: ₱ ${fmt(Math.abs(diff))}`, "info");
      } else {
        toast("Sale", `Sale recorded. Change: ₱ ${fmt(diff)}`, "success");
      }
    } else {
      toast("Sale", "Sale recorded under credit.", "success");
    }

    // clear cart and inputs
    sellCart = [];
    cashPaidEl.value = "";
    renderCartUI();
    updateChangeDisplay();
  });

  clearCartBtn && clearCartBtn.addEventListener("click", () => {
    if (!confirm("Clear cart?")) return;
    sellCart = [];
    cashPaidEl.value = "";
    renderCartUI();
    updateChangeDisplay();
    toast("Cart", "Cart cleared.", "info");
  });

  // ---------- Customers logic ----------
  function addCustomerDebt(name, total, item, qty) {
    const list = readCustomers();
    let c = list.find(c => c.name.toLowerCase() === name.toLowerCase());
    if (!c) {
      c = { id: Date.now() + Math.floor(Math.random()*999), name, balance: 0, history: [] };
      list.push(c);
    }
    c.balance = Number((Number(c.balance || 0) + Number(total)).toFixed(2));
    c.history.push({ type: "debt", date: Date.now(), item, qty, total });
    writeCustomers(list);
  }

  function applyCustomerPayment(id, amount, note="payment") {
    const list = readCustomers();
    const c = list.find(x => x.id === id);
    if (!c) return;
    amount = Number(amount);
    if (isNaN(amount) || amount <= 0) return;
    c.balance = Number((Number(c.balance || 0) - amount).toFixed(2));
    if (c.balance < 0) c.balance = 0;
    c.history.push({ type: "payment", date: Date.now(), amount, note });
    writeCustomers(list);
    renderCustomers();
    populateCustomerSelect();
    toast("Customer", `Payment applied: ₱${fmt(amount)}`, "success");
  }

  function markCustomerFullyPaid(id) {
    const list = readCustomers();
    const c = list.find(x => x.id === id);
    if (!c) return;
    if (!c.balance || Number(c.balance) === 0) return toast("Customer", "Customer already has zero balance.", "info");
    const amt = Number(c.balance);
    c.balance = 0;
    c.history.push({ type: "payment", date: Date.now(), amount: amt, note: "Full payment" });
    writeCustomers(list);
    renderCustomers();
    populateCustomerSelect();
    toast("Customer", `Marked fully paid: ₱${fmt(amt)}`, "success");
  }

  function deleteCustomer(id) {
    const list = readCustomers();
    const c = list.find(x => x.id === id);
    if (!c) return;
    if (c.balance && Number(c.balance) > 0) {
      return toast("Customer", "Customer still has unpaid balance — cannot delete.", "danger");
    }
    if (!confirm(`Delete customer ${c.name}? This cannot be undone.`)) return;
    const newList = list.filter(x => x.id !== id);
    writeCustomers(newList);
    renderCustomers();
    populateCustomerSelect();
    toast("Customer", `${c.name} deleted.`, "info");
  }

  function renderCustomers(filter="") {
    const all = readCustomers().sort((a,b) => a.name.localeCompare(b.name));
    const q = String(filter||"").trim().toLowerCase();
    const list = all.filter(c => !q || c.name.toLowerCase().includes(q));
    customersList.innerHTML = "";
    if (!list.length) { emptyCustomers.style.display = "block"; return; }
    emptyCustomers.style.display = "none";
    list.forEach(c => {
      const div = document.createElement("div");
      div.className = "customer-row";
      const info = document.createElement("div");
      info.className = "customer-info";
      const title = document.createElement("div");
      title.textContent = c.name;
      const meta = document.createElement("div");
      meta.className = "muted small";
      meta.textContent = `Balance: ₱ ${fmt(c.balance || 0)}`;
      info.appendChild(title);
      info.appendChild(meta);

      const actions = document.createElement("div");
      actions.className = "customer-actions";

      const histBtn = document.createElement("button");
      histBtn.className = "btn small";
      histBtn.textContent = "History";
      histBtn.addEventListener("click", () => {
        const h = (c.history || []).map(h => {
          const d = new Date(h.date).toLocaleString();
          if (h.type === "debt") return `${d} — debt: ${h.qty} x ${h.item} = ₱${fmt(h.total)}`;
          return `${d} — payment: ₱${fmt(h.amount)} ${h.note ? `(${h.note})` : ""}`;
        }).join("\n");
        alert(`${c.name}\n\nBalance: ₱ ${fmt(c.balance || 0)}\n\nHistory:\n${h || "(no history)"}`);
      });

      const payBtn = document.createElement("button");
      payBtn.className = "btn small success";
      payBtn.textContent = "Partial Payment";
      payBtn.addEventListener("click", () => {
        const amt = parseFloat(prompt(`Enter payment amount for ${c.name}:`, "0"));
        if (!isNaN(amt) && amt > 0) applyCustomerPayment(c.id, amt);
      });

      const fullBtn = document.createElement("button");
      fullBtn.className = "btn small";
      fullBtn.textContent = "Mark Fully Paid";
      fullBtn.addEventListener("click", () => {
        if (!confirm(`Mark ${c.name} as fully paid?`)) return;
        markCustomerFullyPaid(c.id);
      });

      const delBtn = document.createElement("button");
      delBtn.className = "btn small danger";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => deleteCustomer(c.id));

      actions.appendChild(histBtn);
      actions.appendChild(payBtn);
      actions.appendChild(fullBtn);
      actions.appendChild(delBtn);

      div.appendChild(info);
      div.appendChild(actions);
      customersList.appendChild(div);
    });
  }

  addCustomerBtn.addEventListener("click", () => {
    const name = prompt("Customer name:");
    if (!name) return;
    const list = readCustomers();
    if (list.some(x => x.name.toLowerCase() === name.toLowerCase())) return toast("Customer", "Customer already exists", "info");
    const c = { id: Date.now() + Math.floor(Math.random()*999), name, balance: 0, history: [] };
    list.push(c);
    writeCustomers(list);
    renderCustomers();
    populateCustomerSelect();
    toast("Customer", `Customer ${name} created.`, "success");
  });

  cust_search.addEventListener("input", (e) => renderCustomers(e.target.value));

  // populate customer select in Sell screen
  function populateCustomerSelect() {
    const list = readCustomers().sort((a,b) => a.name.localeCompare(b.name));
    customerSelect.innerHTML = "<option value=''>-- select customer --</option>";
    list.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.name;
      opt.textContent = `${c.name} — ₱ ${fmt(c.balance || 0)}`;
      customerSelect.appendChild(opt);
    });
  }

  // Add new customer inline from Sell screen
  createCustomerInline.addEventListener("click", () => {
    const name = (customerName.value || "").trim();
    if (!name) return toast("Customer", "Enter customer name to create.", "info");
    const list = readCustomers();
    if (list.some(x => x.name.toLowerCase() === name.toLowerCase())) {
      toast("Customer", "Customer already exists — selecting them now.", "info");
      customerSelect.value = name;
      customerName.value = "";
      return;
    }
    const c = { id: Date.now() + Math.floor(Math.random()*999), name, balance: 0, history: [] };
    list.push(c);
    writeCustomers(list);
    populateCustomerSelect();
    customerSelect.value = name;
    customerName.value = "";
    renderCustomers();
    toast("Customer", `Customer ${name} created and selected.`, "success");
  });

  // show/hide credit details & populate on open
  paymentType.addEventListener("change", () => {
    creditDetails.classList.toggle("hidden", paymentType.value !== "credit");
    if (paymentType.value === "credit") populateCustomerSelect();
  });

  // ---------- Sell: find by enter barcode on input
  sell_barcode.addEventListener("keydown", (e) => { if (e.key === "Enter") findSell.click(); });

  // ---------- Inventory rendering (alphabetical & thumbnails) ----------
  function renderProducts(filter="") {
    const items = readItems().sort((a,b) => (a.name||"").localeCompare(b.name||""));
    const q = String(filter||"").trim().toLowerCase();
    const filtered = items.filter(it => !q || (it.name||"").toLowerCase().includes(q) || (it.barcode||"").includes(q));
    inventoryGrid.innerHTML = "";
    if (!filtered.length) { emptyInv.style.display = "block"; return; }
    emptyInv.style.display = "none";
    filtered.forEach(it => {
      const card = document.createElement("div");
      card.className = "inv-card";
      const thumb = document.createElement("div");
      thumb.className = "inv-thumb";
      if (it.image) {
        const img = document.createElement("img");
        img.src = it.image;
        img.alt = it.name;
        thumb.appendChild(img);
      } else {
        const placeholder = document.createElement("div");
        placeholder.style.padding = "8px";
        placeholder.style.color = "#888";
        placeholder.textContent = it.name ? it.name.charAt(0).toUpperCase() : "-";
        thumb.appendChild(placeholder);
      }
      const name = document.createElement("div");
      name.className = "inv-name";
      name.textContent = it.name;
      const meta = document.createElement("div");
      meta.className = "inv-meta";
      meta.textContent = `₱ ${fmt(it.price)} • ${it.stock} pcs`;
      const actions = document.createElement("div");
      actions.style.marginTop = "6px";
      const editBtn = document.createElement("button");
      editBtn.className = "btn small";
      editBtn.textContent = "Edit";
      editBtn.addEventListener("click", () => editItem(it.id));
      const delBtn = document.createElement("button");
      delBtn.className = "btn small danger";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", () => { if (!confirm("Delete this item?")) return; deleteItem(it.id); toast("Item", `${it.name} deleted.`, "info"); });
      const quickUpdateBtn = document.createElement("button");
      quickUpdateBtn.className = "btn small";
      quickUpdateBtn.textContent = "Update Stock";
      quickUpdateBtn.addEventListener("click", async () => {
        const choice = confirm("Scan barcode to update this item's stock? Press Cancel to enter manually.");
        if (choice) {
          // set context to update and use inv scanner
          scanContext = "inv";
          if (invScannerCard) invScannerCard.classList.remove("hidden");
          await openScanner("inv");
          toast("Inventory", "Scanning for item to update...", "info");
        } else {
          const v = parseInt(prompt(`Add stock to ${it.name} (current ${it.stock}):`, "1"), 10);
          if (!isNaN(v) && v > 0) {
            const items = readItems();
            const x = items.find(i => i.id === it.id);
            x.stock = (x.stock || 0) + v;
            writeItems(items);
            renderProducts();
            toast("Inventory", `Stock updated. New qty: ${x.stock}`, "success");
          } else {
            toast("Inventory", "Invalid qty", "danger");
          }
        }
      });
      actions.appendChild(editBtn);
      actions.appendChild(quickUpdateBtn);
      actions.appendChild(delBtn);
      card.appendChild(thumb);
      card.appendChild(name);
      card.appendChild(meta);
      card.appendChild(actions);
      inventoryGrid.appendChild(card);
    });
  }

  function editItem(id) {
    const item = readItems().find(i => i.id === id);
    if (!item) return;
    Object.values(screens).forEach(s=>s.classList.add("hidden"));
    screens.add.classList.remove("hidden");
    home.classList.add("hidden");
    stopScanner();
    add_barcode.value = item.barcode; add_name.value = item.name; add_price.value = item.price; add_qty.value = item.stock;
    if (item.image) { stagedImageDataUrl = item.image; imgPreview.src = item.image; imgPreviewWrap.classList.remove("hidden"); } else { stagedImageDataUrl = ""; imgPreview.src=""; imgPreviewWrap.classList.add("hidden"); }
    showMsg(msgAdd, "Edit mode — press Save to update.", true);
    const prev = saveAdd.onclick;
    saveAdd.onclick = async () => {
      const barcode = String(add_barcode.value || "").trim();
      const name = String(add_name.value || "").trim();
      const price = Number(add_price.value);
      const qty = parseInt(add_qty.value || "0", 10);
      if (!barcode) return showMsg(msgAdd, "Barcode required", false);
      if (!name) return showMsg(msgAdd, "Name required", false);
      if (isNaN(price) || price < 0) return showMsg(msgAdd, "Valid price required", false);
      if (isNaN(qty) || qty < 0) return showMsg(msgAdd, "Valid qty required", false);
      let items = readItems().filter(x => x.id !== id);
      if (items.some(x => x.barcode === barcode)) return showMsg(msgAdd, "Barcode used by another", false);
      const updated = {...item, barcode, name, price: Number(price), stock: qty, image: stagedImageDataUrl || ""};
      items.push(updated);
      writeItems(items);
      showMsg(msgAdd, "Updated", true);
      saveAdd.onclick = prev;
      toast("Item", `${name} updated`, "success");
      renderProducts();
    };
  }

  function deleteItem(id) {
    const list = readItems().filter(x => x.id !== id);
    writeItems(list);
    renderProducts();
  }

  searchInv.addEventListener("input", (e) => renderProducts(e.target.value));

  // ---------- Sales rendering ----------
  function renderSales() {
    const list = readSales().sort((a,b) => b.timestamp - a.timestamp);
    salesList.innerHTML = "";
    if (!list.length) {
      salesList.innerHTML = "<div class='muted small'>No sales yet.</div>";
      salesCount.textContent = 0;
      salesTotal.textContent = "0.00";
      return;
    }
    list.forEach(s => {
      const d = document.createElement("div");
      d.className = "sale-row";
      d.textContent = `${new Date(s.timestamp).toLocaleString()} — ${s.qty} x ${s.name} = ₱${fmt(s.total)} (${s.payment})`;
      salesList.appendChild(d);
    });
    const total = list.reduce((a,b) => a + Number(b.total), 0);
    salesCount.textContent = list.length;
    salesTotal.textContent = fmt(total);
  }

  // export sales CSV
  exportSalesBtn.addEventListener("click", () => {
    const sales = readSales();
    if (!sales.length) return toast("Export", "No sales to export", "info");
    const csv = ["id,barcode,name,qty,unitPrice,total,timestamp,payment"].concat(sales.map(s => `${s.id},"${s.barcode}","${s.name.replace(/"/g,'""')}",${s.qty},${s.unitPrice},${s.total},${s.timestamp},${s.payment}`)).join("\n");
    download(csv, `sales_${new Date().toISOString().slice(0,10)}.csv`);
    toast("Export", "Sales exported", "success");
  });

  clearSalesBtn.addEventListener("click", () => {
    if (!confirm("Clear all sales?")) return;
    writeSales([]);
    renderSales();
    toast("Sales", "All sales cleared", "info");
  });

  // top export (items)
  btnExportAll.addEventListener("click", () => {
    const items = readItems();
    if (!items.length) return toast("Export", "No items to export", "info");
    const csv = ["id,barcode,name,price,stock,createdAt"].concat(items.map(i => `${i.id},"${i.barcode}","${i.name.replace(/"/g,'""')}",${i.price},${i.stock},${i.createdAt}`)).join("\n");
    download(csv, `items_${new Date().toISOString().slice(0,10)}.csv`);
    toast("Export", "Items exported", "success");
  });

  // top clear all (items + sales + customers)
  btnClearAll.addEventListener("click", () => {
    if (!confirm("Clear ALL data (items, sales & customers)?")) return;
    writeItems([]); writeSales([]); writeCustomers([]);
    renderProducts();
    renderSales();
    renderCustomers();
    toast("Data", "All data cleared", "info");
  });

  // ---------- Printing inventory (table format) ----------
  function escapeHtml(s){ return String(s||"").replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"}[c])); }
  function openPrintInventory() {
    const items = readItems().sort((a,b) => (a.name||"").localeCompare(b.name||""));
    if (!items.length) return toast("Print", "No items to print.", "info");
    const htmlParts = [];
    htmlParts.push(`<!doctype html><html><head><meta charset="utf-8"><title>Inventory</title>`);
    htmlParts.push('<style>');
    htmlParts.push('body{font-family:Arial,Helvetica,sans-serif;padding:10px;color:#111} table.inv-print-table{width:100%;border-collapse:collapse} table.inv-print-table th, table.inv-print-table td{border:1px solid #ddd;padding:8px;text-align:left} th{background:#f7f7f7}');
    htmlParts.push('@media print{ img{max-width:100%;height:auto} } @page { size: auto; margin: 10mm; }');
    htmlParts.push('</style></head><body>');
    htmlParts.push(`<h2>Inventory — ${new Date().toLocaleString()}</h2>`);
    htmlParts.push('<table class="inv-print-table">');
    htmlParts.push('<thead><tr><th>#</th><th>Name</th><th>Barcode</th><th>Price (₱)</th><th>Stock</th></tr></thead><tbody>');
    items.forEach((it, idx) => {
      htmlParts.push('<tr>');
      htmlParts.push(`<td>${idx+1}</td>`);
      htmlParts.push(`<td>${escapeHtml(it.name)}</td>`);
      htmlParts.push(`<td>${escapeHtml(it.barcode)}</td>`);
      htmlParts.push(`<td style="text-align:right">${fmt(it.price)}</td>`);
      htmlParts.push(`<td style="text-align:right">${(it.stock||0)}</td>`);
      htmlParts.push('</tr>');
    });
    htmlParts.push('</tbody></table>');
    htmlParts.push('</body></html>');
    const html = htmlParts.join('');
    const w = window.open('', '_blank');
    w.document.open();
    w.document.write(html);
    w.document.close();
    setTimeout(()=>{ try { w.focus(); w.print(); } catch(e) { console.warn(e); } }, 500);
  }

  btnPrintInv.addEventListener("click", () => openPrintInventory());
  printInvBtn && printInvBtn.addEventListener("click", () => openPrintInventory());

  // ---------- Inventory scan-to-update ----------
  btnScanUpdate.addEventListener("click", async () => {
    const ok = await ensureCamera();
    if (!ok) return toast("Camera", "Camera not available.", "danger");
    scanContext = "inv";
    if (invScannerCard) invScannerCard.classList.remove("hidden");
    openScanner("inv").catch(()=>{});
  });

  // stop inv scanner
  stopInv && stopInv.addEventListener("click", async () => {
    await stopScanner();
  });

  // ---------- torch toggle buttons ----------
  toggleFlashAdd && toggleFlashAdd.addEventListener("click", async () => {
    if (!nativeStream) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        nativeStream = s;
        if (videoAdd) { videoAdd.srcObject = s; videoAdd.style.display = "block"; }
      } catch(e){}
    }
    const ok = await setTorch(nativeStream, !torchOn);
    if (!ok) toast("Flash", "Flash not available on this device.", "info");
    toggleFlashAdd.textContent = torchOn ? "💡 Flash On" : "💡 Flash";
  });

  toggleFlashSell && toggleFlashSell.addEventListener("click", async () => {
    if (!nativeStream) {
      try {
        const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        nativeStream = s;
        if (videoSell) { videoSell.srcObject = s; videoSell.style.display = "block"; }
      } catch(e){}
    }
    const ok = await setTorch(nativeStream, !torchOn);
    if (!ok) toast("Flash", "Flash not available on this device.", "info");
    toggleFlashSell.textContent = torchOn ? "💡 Flash On" : "💡 Flash";
  });

  // ---------- utilities ----------
  function download(text, name) {
    const blob = new Blob([text], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ---------- init ----------
  renderProducts();
  renderSales();
  renderCustomers();
  renderCartUI();

  // disable scanner controls if no camera capability
  (async ()=> {
    const ok = await ensureCamera();
    if (!ok) {
      if (statusAdd) statusAdd.textContent = "Camera not available.";
      if (statusSell) statusSell.textContent = "Camera not available.";
      if (startAdd) startAdd.disabled = true;
      if (stopAdd) stopAdd.disabled = true;
      if (startSell) startSell.disabled = true;
      if (stopSell) stopSell.disabled = true;
    }
  })();

  // Start/Stop controls
  if (startAdd && stopAdd) {
    startAdd.addEventListener("click", async () => { startAdd.disabled = true; stopAdd.disabled = false; await openScanner("add"); });
    stopAdd.addEventListener("click", async () => { await stopScanner(); startAdd.disabled = false; stopAdd.disabled = true; });
  }
  if (startSell && stopSell) {
    startSell.addEventListener("click", async () => { startSell.disabled = true; stopSell.disabled = false; await openScanner("sell"); });
    stopSell.addEventListener("click", async () => { await stopScanner(); startSell.disabled = false; stopSell.disabled = true; });
  }

  // expose a returnToHome for WebView native to call (optional)
  window.returnToHome = function() {
    stopScanner();
    Object.values(screens).forEach(s => s.classList.add("hidden"));
    home.classList.remove("hidden");
  };

  // cleanup
  window.addEventListener("beforeunload", () => { try { stopScanner(); } catch(e){} });

})();