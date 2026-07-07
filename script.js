let products = [];
let cart = {};
let currentCategory = "ALL";
let currentPcdFilter = "";
let customerPhone = "";
let customerName = "";
let branchNames = [];
let branchSettingOpen = false;
let activeBranchSku = "";
let quickBranchSku = "";

let imageCacheVersion = "1094";

let categoryCardCache = {};
let cardBySku = {};

let latestProductsJsonText = "";

const BRANCH_NAMES_STORAGE_KEY = "branchNames";
const RAYSPORT_TYRE_BANNER_SRC = "images/raysport-tyre-banner.png";

const sheetCategories = [
  "ALL",
  "RAYSPORT TYRE",
  "14",
  "15X6.5",
  "15X7.0",
  "16X",
  "17X",
  "18X",
  "19X",
  "20X",
  "4X4",
  "NEW ARRIVAL",
  "FORGED"
];

const allIncludeCategories = [
  "RAYSPORT TYRE",
  "14",
  "15X6.5",
  "15X7.0",
  "16X",
  "17X",
  "18X",
  "19X",
  "20X",
  "4X4",
  "FORGED"
];

const pcdCategories = [
  "4X100",
  "4X108",
  "4X114.3",
  "8X100/110",
  "8X100/114.3",
  "5X100",
  "5X108",
  "5X112",
  "5X113.1",
  "5X114.3",
  "5X120",
  "6X114.3",
  "6X139.7",
  "10X100/114.3",
  "12X135/139.7"
];

function scrollPageToTop(){
  window.scrollTo({
    top: 0,
    left: 0,
    behavior: "smooth"
  });
}

function scrollFilterBarsToLeft(){
  const pcdMenu = document.querySelector(".pcdMenu");
  const categoryMenu = document.querySelector(".categoryMenu");

  if(pcdMenu){
    pcdMenu.scrollTo({
      left: 0,
      behavior: "smooth"
    });
  }

  if(categoryMenu){
    categoryMenu.scrollTo({
      left: 0,
      behavior: "smooth"
    });
  }
}

async function loadProducts(){
  const res = await fetch("products.json?refresh=" + Date.now(), {
    cache: "no-store"
  });

  latestProductsJsonText = await res.text();
  products = JSON.parse(latestProductsJsonText);

  showCategory("ALL");
  populateFitmentProductOptions();
}

async function autoRefreshProducts(){
  try{
    const res = await fetch("products.json?refresh=" + Date.now(), {
      cache: "no-store"
    });

    const newText = await res.text();

    if(newText === latestProductsJsonText){
      return;
    }

    latestProductsJsonText = newText;
    products = JSON.parse(newText);

    categoryCardCache = {};
    cardBySku = {};

    Object.keys(cart).forEach(sku => {
      const stillExists = products.some(p => p.sku === sku);

      if(!stillExists){
        delete cart[sku];
      }
    });

    renderCart();
    showCachedCategory();

    console.log("products.json updated automatically");

  }catch(err){
    console.log("Auto refresh failed:", err);
  }
}

function normalizeText(text){
  return String(text || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function productMatchesPcd(product, pcd){
  if(isTyreProduct(product)) return true;
  if(!pcd) return true;

  const normalizedPcd = normalizeText(pcd);
  const normalizedDesc = normalizeText(product.description || "");

  return normalizedDesc.includes(normalizedPcd);
}

function productMatchesMainCategory(product, category){
  if(category === "ALL"){
    return allIncludeCategories.includes(product.category);
  }

  return product.category === category;
}

function showPrice(price){
  if(price === "" || price === null || price === undefined) return "";
  return price;
}

function getDriveImageSource(product, type){
  if(type === "front"){
    return product.frontOriginal || product.frontImage || "";
  }

  return product.sideOriginal || product.sideImage || "";
}

function getDriveFileId(url){
  if(!url) return "";

  if(url.includes("/d/")){
    return url.split("/d/")[1].split("/")[0];
  }

  if(url.includes("id=")){
    return url.split("id=")[1].split("&")[0];
  }

  return "";
}

function addImageCacheParam(url){
  if(!url) return "";

  const separator = url.includes("?") ? "&" : "?";
  return url + separator + "cache=" + imageCacheVersion;
}

function getDriveImageUrls(product, type, size = 1000){
  const url = getDriveImageSource(product, type);
  if(!url) return [];

  const fileId = getDriveFileId(url);
  const urls = [];

  if(fileId){
    urls.push(
      "https://drive.google.com/thumbnail?id=" +
      fileId +
      "&sz=w" + size + "&cache=" +
      imageCacheVersion
    );
    urls.push("https://lh3.googleusercontent.com/d/" + fileId + "=w" + size);
    urls.push(
      "https://drive.google.com/uc?export=view&id=" +
      fileId +
      "&cache=" +
      imageCacheVersion
    );
  }

  urls.push(addImageCacheParam(url));

  return urls.filter((item, index) => item && urls.indexOf(item) === index);
}

function getDriveImageUrl(product, type){
  const urls = getDriveImageUrls(product, type);
  return urls[0] || "";
}

function getDriveViewerImageUrls(product, type, size = 1600){
  const url = getDriveImageSource(product, type);
  if(!url) return [];

  const fileId = getDriveFileId(url);
  const urls = [];

  if(fileId){
    urls.push("https://lh3.googleusercontent.com/d/" + fileId + "=w" + size);
    urls.push(
      "https://drive.google.com/uc?export=view&id=" +
      fileId +
      "&cache=" +
      imageCacheVersion
    );
    urls.push(
      "https://drive.google.com/thumbnail?id=" +
      fileId +
      "&sz=w" + size + "&cache=" +
      imageCacheVersion
    );
  }

  urls.push(addImageCacheParam(url));

  return urls.filter((item, index) => item && urls.indexOf(item) === index);
}

function getDriveImageTag(product, type, extraAttributes = ""){
  const urls = getDriveImageUrls(product, type, 500);
  if(urls.length === 0) return "";

  const fallbackUrls = urls.slice(1).map(escapeHtml).join("|");
  const attrs = extraAttributes ? " " + extraAttributes : "";

  return `<img src="${escapeHtml(urls[0])}" alt=""${attrs} onerror="handleProductImageError(this)" data-fallback-srcs="${fallbackUrls}">`;
}

function handleProductImageError(img){
  const fallbackUrls = (img.dataset.fallbackSrcs || "").split("|").filter(Boolean);
  const nextUrl = fallbackUrls.shift();

  if(nextUrl){
    img.dataset.fallbackSrcs = fallbackUrls.join("|");
    img.src = nextUrl;
    return;
  }

  img.onerror = null;
  img.classList.add("imageFailed");
}

function isValidWhatsappNumber(phone){
  phone = phone.replace(/\D/g, "");
  return /^60\d{8,10}$/.test(phone);
}

function getSetWord(qty){
  return Number(qty) === 1 ? "SET" : "SETS";
}

function isTyreProduct(product){
  return normalizeText(product && product.category) === normalizeText("RAYSPORT TYRE");
}

function getProductQtyWord(product, qty){
  return isTyreProduct(product) ? "PCS" : getSetWord(qty);
}

function getOrderQtyLabel(product){
  return isTyreProduct(product) ? "Order Qty (PCS):" : "Order Qty (Set):";
}

function getProductBySku(sku){
  return products.find(product => product.sku === sku) || null;
}

function getOrderMaxQty(product){
  const status = String(product && product.status ? product.status : "").trim().toLowerCase();

  if(status === "last set"){
    return 1;
  }

  if(status === "limited"){
    return 24;
  }

  return Infinity;
}

function getOrderLimitNotice(product, maxQty){
  const status = String(product && product.status ? product.status : "This item").trim();
  const qtyWord = getProductQtyWord(product, maxQty).toLowerCase();

  return `${status} can order maximum ${maxQty} ${qtyWord}.`;
}

let orderLimitNoticeTimer = null;

function showOrderLimitNotification(message){
  if(!message) return;

  let notice = document.getElementById("orderLimitNotice");

  if(!notice){
    notice = document.createElement("div");
    notice.id = "orderLimitNotice";
    notice.className = "orderLimitNotice";
    notice.setAttribute("role", "status");
    notice.setAttribute("aria-live", "polite");
    document.body.appendChild(notice);
  }

  notice.textContent = message;
  notice.classList.add("show");

  clearTimeout(orderLimitNoticeTimer);
  orderLimitNoticeTimer = setTimeout(() => {
    notice.classList.remove("show");
  }, 2600);
}

function clampOrderQtyForSku(sku, qty, notify = true){
  const numericQty = parseInt(qty, 10);

  if(isNaN(numericQty) || numericQty <= 0){
    return { qty:numericQty, clamped:false };
  }

  const product = getProductBySku(sku);
  const maxQty = getOrderMaxQty(product);

  if(Number.isFinite(maxQty) && numericQty > maxQty){
    if(notify){
      showOrderLimitNotification(getOrderLimitNotice(product, maxQty));
    }

    return { qty:maxQty, clamped:true };
  }

  return { qty:numericQty, clamped:false };
}

function getOrderLimitInputAttributes(product){
  const maxQty = getOrderMaxQty(product);
  return Number.isFinite(maxQty) ? ` max="${maxQty}"` : "";
}

function normalizeBranchNameSlots(names, minimumSlots = 10){
  const source = Array.isArray(names) ? names : [];
  const slotCount = Math.max(minimumSlots, source.length);
  const slots = [];

  for(let i = 0; i < slotCount; i++){
    slots.push(String(source[i] || "").trim());
  }

  return slots;
}

function trimEmptyExtraBranchSlots(names){
  const slots = normalizeBranchNameSlots(names);
  let lastNamedIndex = -1;

  slots.forEach((name, index) => {
    if(name){
      lastNamedIndex = index;
    }
  });

  const slotCount = Math.max(10, lastNamedIndex + 1);
  return slots.slice(0, slotCount);
}

function getActiveBranchNames(){
  return branchNames.filter(Boolean);
}

function loadBranchNames(){
  try{
    const saved = JSON.parse(localStorage.getItem(BRANCH_NAMES_STORAGE_KEY) || "[]");
    branchNames = Array.isArray(saved)
      ? normalizeBranchNameSlots(saved)
      : normalizeBranchNameSlots([]);
  }catch(err){
    branchNames = normalizeBranchNameSlots([]);
  }
}

function saveBranchNames(){
  branchNames = normalizeBranchNameSlots(branchNames);
  localStorage.setItem(BRANCH_NAMES_STORAGE_KEY, JSON.stringify(branchNames));
}

function escapeHtml(value){
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeCartItem(sku){
  const item = cart[sku];

  if(!item){
    return null;
  }

  if(typeof item === "number"){
    cart[sku] = {
      qty: item,
      branches: {}
    };
    return cart[sku];
  }

  if(typeof item === "object"){
    item.qty = parseInt(item.qty, 10) || 0;

    if(!item.branches || typeof item.branches !== "object"){
      item.branches = {};
    }

    return item;
  }

  return null;
}

function getCartItem(sku){
  return normalizeCartItem(sku);
}

function getCartQty(sku){
  const item = getCartItem(sku);
  return item ? item.qty : 0;
}

function getCartBranches(sku){
  const item = getCartItem(sku);
  return item ? item.branches : {};
}

function setCartQty(sku, qty){
  const limitedQty = clampOrderQtyForSku(sku, qty);
  qty = limitedQty.qty;

  if(isNaN(qty) || qty <= 0){
    delete cart[sku];

    if(activeBranchSku === sku){
      activeBranchSku = "";
    }

    if(quickBranchSku === sku){
      quickBranchSku = "";
    }

    return;
  }

  const item = getCartItem(sku) || { qty: 0, branches: {} };
  item.qty = qty;
  cart[sku] = item;
}

function getBranchEditorRoot(input){
  return input.closest(".quickBranchDropdown, .branchSplitPanel, .fitmentBranchEditor");
}

function getSkuFromBranchInput(input){
  const productCard = input.closest(".card[data-sku]");
  if(productCard) return productCard.dataset.sku;

  const cartRow = input.closest(".cartRow[data-sku]");
  if(cartRow) return cartRow.dataset.sku;

  const fitmentCard = input.closest(".fitmentProductCard[data-fitment-sku]");
  if(fitmentCard) return fitmentCard.dataset.fitmentSku;

  return "";
}

function enforceBranchQtyInput(input){
  if(!input) return;

  const sku = getSkuFromBranchInput(input);
  const product = getProductBySku(sku);
  const maxQty = getOrderMaxQty(product);
  const qty = parseInt(input.value, 10) || 0;

  if(qty <= 0){
    input.value = "";
    return;
  }

  if(!Number.isFinite(maxQty)){
    input.value = qty;
    return;
  }

  const root = getBranchEditorRoot(input);
  const otherTotal = root
    ? [...root.querySelectorAll("input[data-branch-name], input[data-fitment-branch-name]")]
        .filter(item => item !== input)
        .reduce((sum, item) => sum + (parseInt(item.value, 10) || 0), 0)
    : 0;
  const allowedQty = Math.max(0, maxQty - otherTotal);
  const nextQty = Math.min(qty, allowedQty);

  if(nextQty !== qty){
    showOrderLimitNotification(getOrderLimitNotice(product, maxQty));
  }

  input.value = nextQty > 0 ? nextQty : "";
}

function sanitizeBranchQuantitiesForSku(sku, branches, notify = true){
  const product = getProductBySku(sku);
  const maxQty = getOrderMaxQty(product);
  const cleaned = {};
  let total = 0;
  let clamped = false;
  let remaining = Number.isFinite(maxQty) ? maxQty : Infinity;

  Object.entries(branches || {}).forEach(([name, value]) => {
    const qty = parseInt(value, 10) || 0;
    if(qty <= 0 || remaining <= 0) {
      if(qty > 0) clamped = true;
      return;
    }

    const allowedQty = Math.min(qty, remaining);
    if(allowedQty !== qty){
      clamped = true;
    }

    cleaned[name] = allowedQty;
    total += allowedQty;
    remaining -= allowedQty;
  });

  if(clamped && notify){
    showOrderLimitNotification(getOrderLimitNotice(product, maxQty));
  }

  return { branches:cleaned, total, clamped };
}

function hasBranchSplit(sku){
  return Object.values(getCartBranches(sku)).some(qty => Number(qty) > 0);
}

function getBranchTotal(sku){
  return Object.values(getCartBranches(sku)).reduce((sum, qty) => sum + (Number(qty) || 0), 0);
}

function getBranchPreviewHtml(sku){
  const parts = Object.entries(getCartBranches(sku))
    .filter(([, qty]) => Number(qty) > 0)
    .map(([name, qty]) => `${escapeHtml(name)}: ${qty}`);

  if(parts.length === 0){
    return "";
  }

  return `<div class="branchPreview">${parts.join(" | ")}</div>`;
}

function checkLogin(){
  const savedPhone = localStorage.getItem("customerPhone");
  const savedName = localStorage.getItem("customerName");

  if(
    savedPhone &&
    savedName &&
    isValidWhatsappNumber(savedPhone) &&
    savedName.trim() !== ""
  ){
    customerPhone = savedPhone;
    customerName = savedName;
    document.getElementById("loginScreen").classList.add("hidden");
  }else{
    document.getElementById("loginScreen").classList.remove("hidden");
  }
}

document.getElementById("loginButton").onclick = () => {
  let name = document.getElementById("loginName").value.trim();
  let phone = document.getElementById("loginPhone").value.trim();

  phone = phone.replace(/\D/g, "");

  if(name === ""){
    document.getElementById("loginError").textContent =
      "Please enter customer name";
    return;
  }

  if(!isValidWhatsappNumber(phone)){
    document.getElementById("loginError").textContent =
      "Please enter a valid WhatsApp number. Example: 60123456789";
    return;
  }

  customerName = name;
  customerPhone = phone;

  localStorage.setItem("customerName", name);
  localStorage.setItem("customerPhone", phone);

  cart = {};
  activeBranchSku = "";
  quickBranchSku = "";
  branchSettingOpen = false;
  renderCart();

  currentCategory = "ALL";
  currentPcdFilter = "";
  document.getElementById("search").value = "";

  document.getElementById("loginError").textContent = "";
  document.getElementById("loginScreen").classList.add("hidden");

  updateActiveButtons();
  showCachedCategory();
  scrollPageToTop();
  scrollFilterBarsToLeft();
};

function openLogoutConfirm(){
  document.getElementById("logoutConfirmModal").classList.remove("hidden");
}

function closeLogoutConfirm(){
  document.getElementById("logoutConfirmModal").classList.add("hidden");
}

function performLogout(){
  closeLogoutConfirm();

  localStorage.removeItem("customerName");
  localStorage.removeItem("customerPhone");
  localStorage.removeItem(BRANCH_NAMES_STORAGE_KEY);

  customerName = "";
  customerPhone = "";
  cart = {};
  branchNames = [];
  activeBranchSku = "";
  quickBranchSku = "";
  branchSettingOpen = false;

  renderCart();

  document.getElementById("loginName").value = "";
  document.getElementById("loginPhone").value = "";
  document.getElementById("loginError").textContent = "";
  document.getElementById("cartPanel").classList.add("hidden");
  document.getElementById("loginScreen").classList.remove("hidden");

  Object.keys(cardBySku).forEach(sku => {
    updateProductOrderArea(sku);
  });
}

document.getElementById("logoutButton").onclick = () => {
  openLogoutConfirm();
};

document.getElementById("cancelLogoutButton").onclick = () => {
  closeLogoutConfirm();
};

document.getElementById("confirmLogoutButton").onclick = () => {
  performLogout();
};

function showCategory(category){
  if(sheetCategories.includes(category)){
    currentCategory = category;
  }else if(pcdCategories.includes(category)){
    if(currentPcdFilter === category){
      currentPcdFilter = "";
    }else{
      currentPcdFilter = category;
    }
  }

  updateActiveButtons();
  showCachedCategory();
  scrollPageToTop();
}

function updateActiveButtons(){
  document.querySelectorAll(".categoryMenu button").forEach(btn => {
    btn.classList.remove("active");

    if(btn.textContent.trim() === currentCategory || btn.getAttribute("onclick") === `showCategory('${currentCategory}')`){
      btn.classList.add("active");
    }
  });

  document.querySelectorAll(".pcdMenu button").forEach(btn => {
    btn.classList.remove("active");

    if(btn.textContent.trim() === currentPcdFilter){
      btn.classList.add("active");
    }
  });
}

function showCachedCategory(){
  const grid = document.getElementById("productGrid");

  while(grid.firstChild){
    grid.removeChild(grid.firstChild);
  }

  if(currentCategory === "RAYSPORT TYRE"){
    grid.appendChild(createTyreCategoryBanner());
  }

  if(!categoryCardCache[currentCategory]){
    const categoryProducts = products.filter(p =>
      productMatchesMainCategory(p, currentCategory)
    );

    categoryCardCache[currentCategory] = categoryProducts.map(p => {
      const card = createProductCard(p);

      if(!cardBySku[p.sku]){
        cardBySku[p.sku] = [];
      }

      cardBySku[p.sku].push(card);

      return card;
    });
  }

  const q = document.getElementById("search").value.toLowerCase();

  categoryCardCache[currentCategory].forEach(card => {
    const sku = card.dataset.sku;
    const p = products.find(x => x.sku === sku);

    if(!p) return;

    const searchable = (
      (p.description || "") + " " +
      (p.price || "") + " " +
      (p.status || "") + " " +
      (p.extraInfo || "") + " " +
      (p.remark || "")
    ).toLowerCase();

    const matchSearch = searchable.includes(q);
    const matchPcd = productMatchesPcd(p, currentPcdFilter);

    if(matchSearch && matchPcd){
      grid.appendChild(card);
    }
  });
}

function createTyreCategoryBanner(){
  const banner = document.createElement("div");
  banner.className = "tyreCategoryBanner";

  const img = document.createElement("img");
  img.alt = "RAYSPORT TYRE";
  img.src = RAYSPORT_TYRE_BANNER_SRC;

  banner.appendChild(img);

  return banner;
}

function isSoldOut(product){
  return (product.status || "").toLowerCase().includes("sold out");
}

function rememberControlTouch(event){
  const target = event.currentTarget;
  const point = event.touches && event.touches.length > 0 ? event.touches[0] : null;
  if(!target || !target.dataset || !point) return;

  target.dataset.touchStartX = String(point.clientX);
  target.dataset.touchStartY = String(point.clientY);
}

function acceptImmediatePress(event){
  if(!event) return true;

  const target = event.currentTarget && event.currentTarget.dataset
    ? event.currentTarget
    : (event.target && event.target.dataset ? event.target : null);
  const now = Date.now();

  if(event.type === "click" && target && now - (Number(target.dataset.lastTouchPress) || 0) < 800){
    return false;
  }

  if(event.type === "touchend" && target){
    const point = event.changedTouches && event.changedTouches.length > 0 ? event.changedTouches[0] : null;
    const startX = Number(target.dataset.touchStartX);
    const startY = Number(target.dataset.touchStartY);

    delete target.dataset.touchStartX;
    delete target.dataset.touchStartY;

    if(point && Number.isFinite(startX) && Number.isFinite(startY)){
      const movedX = Math.abs(point.clientX - startX);
      const movedY = Math.abs(point.clientY - startY);
      if(movedX > 12 || movedY > 12) return false;
    }

    target.dataset.lastTouchPress = String(now);
  }

  event.preventDefault();
  event.stopPropagation();
  return true;
}

function updateFocusedQtyWithStepper(target, sku, delta, source = "product"){
  const active = document.activeElement;

  if(!active || !active.classList.contains("qtyInput")) return false;

  const sameControl = target && active.closest(".qtyControls") === target.closest(".qtyControls");
  if(!sameControl) return false;

  const currentQty = parseInt(active.value, 10) || 0;
  if(delta < 0 && currentQty <= 1){
    if(typeof active.blur === "function"){
      active.blur();
    }

    setCartQty(sku, 0);
    renderCart();
    updateProductOrderArea(sku);
    return true;
  }

  const nextQty = Math.max(1, currentQty + delta);
  setQtyOnly(sku, nextQty, false, source, active);

  requestAnimationFrame(() => {
    if(active.isConnected){
      try{
        active.focus({ preventScroll:true });
      } catch(error){
        active.focus();
      }
    }
  });

  return true;
}

function tapChangeQty(event, sku, delta, source = "product"){
  if(!acceptImmediatePress(event)) return;

  const target = event ? event.currentTarget : null;
  if(updateFocusedQtyWithStepper(target, sku, delta, source)){
    return;
  }

  changeQty(sku, delta, source);
}

function tapBranchQty(event, button, delta){
  const control = button ? button.closest(".branchQtyControl") : null;
  const input = control ? control.querySelector("input[data-branch-name]") : null;
  const keepKeyboardOpen = input && document.activeElement === input;

  if(!acceptImmediatePress(event)) return;

  stepBranchQty(button, delta);

  if(keepKeyboardOpen && input.isConnected){
    requestAnimationFrame(() => {
      try{
        input.focus({ preventScroll:true });
      } catch(error){
        input.focus();
      }
    });
  }
}

function tapOpenBranchEditor(event, sku, source){
  if(getActiveBranchNames().length === 0) return;
  if(!acceptImmediatePress(event)) return;
  openBranchQuantityEditor(sku, source);
}

function stepBranchQty(button, delta){
  const control = button.closest(".branchQtyControl");
  if(!control) return;

  const input = control.querySelector("input[data-branch-name]");
  if(!input) return;

  const currentQty = parseInt(input.value, 10) || 0;
  const nextQty = Math.max(0, currentQty + delta);
  input.value = nextQty > 0 ? nextQty : "";
  enforceBranchQtyInput(input);
}

function renderQuickBranchDropdown(product){
  if(quickBranchSku !== product.sku || getActiveBranchNames().length === 0 || (isPhoneLayout() && isCartPanelOpen())){
    return "";
  }

  const branches = getCartBranches(product.sku);
  const buttonLabel = "Update Cart";
  const limitAttrs = getOrderLimitInputAttributes(product);

  const rows = getActiveBranchNames().map(name => `
    <div class="branchQtyRow">
      <label>${escapeHtml(name)}</label>
      <div class="branchQtyControl">
        <button class="branchQtyStepper" type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapBranchQty(event, this, -1)" onclick="tapBranchQty(event, this, -1)">-</button>
        <input
          type="number"
          min="0"
          ${limitAttrs}
          inputmode="numeric"
          value="${branches[name] || ""}"
          data-branch-name="${escapeHtml(name)}"
          placeholder="0"
          oninput="enforceBranchQtyInput(this)"
          onchange="enforceBranchQtyInput(this)"
        >
        <button class="branchQtyStepper" type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapBranchQty(event, this, 1)" onclick="tapBranchQty(event, this, 1)">+</button>
      </div>
    </div>
  `);

  return `
    <div class="quickBranchDropdown">
      <h4>Branch Qty</h4>
      ${rows.join("")}
      <div class="branchEditorActions">
        <button type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapSaveQuickBranchDropdown(event, '${product.sku}')" onclick="tapSaveQuickBranchDropdown(event, '${product.sku}')">${buttonLabel}</button>
        <button type="button" onclick="cancelQuickBranchDropdown('${product.sku}')">Cancel</button>
      </div>
    </div>
  `;
}

function focusQuickBranchDropdown(sku){
  setTimeout(() => {
    const firstBranchQty = document.querySelector(`.card[data-sku="${sku}"] .quickBranchDropdown input[data-branch-name]`);
    if(firstBranchQty){
      firstBranchQty.focus();
      firstBranchQty.select();
    }
  }, 50);
}
function scrollProductCardIntoView(sku){
  setTimeout(() => {
    const cards = cardBySku[sku] || [];
    const visibleCard = cards.find(card => card.isConnected);

    if(visibleCard){
      const header = document.querySelector("header");
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const top = visibleCard.getBoundingClientRect().top + window.pageYOffset - headerHeight - 12;

      window.scrollTo({
        top: Math.max(0, top),
        behavior: "smooth"
      });
    }
  }, 180);
}
function focusCartBranchSplit(sku){
  setTimeout(() => {
    const firstBranchQty = document.querySelector(`.cartRow[data-sku="${sku}"] .branchSplitPanel input[data-branch-name]`);
    if(firstBranchQty){
      firstBranchQty.focus();
      firstBranchQty.select();
    }
  }, 50);
}

function isCartPanelOpen(){
  return !document.getElementById("cartPanel").classList.contains("hidden");
}

function isPhoneLayout(){
  return window.matchMedia("(max-width: 600px)").matches;
}

function openBranchQuantityEditor(sku, source = "product"){
  if(getActiveBranchNames().length === 0 || getCartQty(sku) <= 0){
    return false;
  }

  const openInCart = source === "cart" || (source === "product" && isPhoneLayout() && isCartPanelOpen());

  if(openInCart){
    const previousQuickSku = quickBranchSku;
    activeBranchSku = sku;
    quickBranchSku = "";
    branchSettingOpen = false;

    if(previousQuickSku){
      updateProductOrderArea(previousQuickSku);
    }

    renderCart();
    updateProductOrderArea(sku);
    scrollCartProductIntoView(sku);
    focusCartBranchSplit(sku);
    return true;
  }

  const previousQuickSku = quickBranchSku;
  const hadCartDropdown = Boolean(activeBranchSku);
  activeBranchSku = "";
  quickBranchSku = sku;

  if(hadCartDropdown){
    renderCart();
  }

  if(previousQuickSku && previousQuickSku !== sku){
    updateProductOrderArea(previousQuickSku);
  }

  updateProductOrderArea(sku);
  focusQuickBranchDropdown(sku);
  return true;
}

function addToCartFromProduct(sku){
  if(getActiveBranchNames().length > 0 && getCartQty(sku) === 0){
    const previousQuickSku = quickBranchSku;
    const hadCartDropdown = Boolean(activeBranchSku);
    activeBranchSku = "";
    quickBranchSku = quickBranchSku === sku ? "" : sku;

    if(hadCartDropdown){
      renderCart();
    }

    if(previousQuickSku && previousQuickSku !== sku){
      updateProductOrderArea(previousQuickSku);
    }

    updateProductOrderArea(sku);

    if(quickBranchSku === sku){
      focusQuickBranchDropdown(sku);
    }

    return;
  }

  changeQty(sku, 1, "product");
}

function tapAddToCartFromProduct(event, sku){
  if(!acceptImmediatePress(event)) return;

  const active = document.activeElement;
  if(active && typeof active.blur === "function"){
    active.blur();
  }

  addToCartFromProduct(sku);
}

function tapSaveQuickBranchDropdown(event, sku){
  if(!acceptImmediatePress(event)) return;

  const active = document.activeElement;
  if(active && typeof active.blur === "function"){
    active.blur();
  }

  saveQuickBranchDropdown(sku);
}

function saveQuickBranchDropdown(sku){
  const card = (cardBySku[sku] || []).find(item => item.isConnected && item.querySelector(".quickBranchDropdown"));
  if(!card) return;

  const inputs = card.querySelectorAll(".quickBranchDropdown input[data-branch-name]");
  const branches = {};
  let total = 0;

  inputs.forEach(input => {
    enforceBranchQtyInput(input);
    const name = input.dataset.branchName;
    const qty = parseInt(input.value, 10) || 0;

    if(qty > 0){
      branches[name] = qty;
      total += qty;
    }
  });

  if(total <= 0){
    if(getCartQty(sku) > 0){
      delete cart[sku];
      quickBranchSku = "";
      renderCart();
      updateProductOrderArea(sku);
      scrollProductCardIntoView(sku);
      return;
    }

    alert("Please enter branch quantity.");
    return;
  }

  const limited = sanitizeBranchQuantitiesForSku(sku, branches);

  cart[sku] = {
    qty: limited.total,
    branches: limited.branches
  };

  quickBranchSku = "";
  renderCart();
  updateProductOrderArea(sku);
  scrollProductCardIntoView(sku);
}

function cancelQuickBranchDropdown(sku){
  if(quickBranchSku === sku){
    quickBranchSku = "";
  }

  updateProductOrderArea(sku);
  scrollProductCardIntoView(sku);
}
function renderOrderControls(product){
  const soldOut = isSoldOut(product);
  const cartQty = getCartQty(product.sku);
  const limitAttrs = getOrderLimitInputAttributes(product);

  if(soldOut){
    return `<button disabled>Sold Out</button>`;
  }

  if(quickBranchSku === product.sku && getActiveBranchNames().length > 0){
    return renderQuickBranchDropdown(product);
  }

  if(cartQty > 0){
    return `
      <div class="qtyControls">
        <button type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapChangeQty(event, '${product.sku}', -1, 'product')" onclick="tapChangeQty(event, '${product.sku}', -1, 'product')">-</button>

        <input
          class="qtyInput"
          type="number"
          min="1"
          ${limitAttrs}
          inputmode="numeric"
          value="${cartQty}"
          ontouchstart="rememberControlTouch(event)"
          ontouchend="tapOpenBranchEditor(event, '${product.sku}', 'product')"
          onclick="tapOpenBranchEditor(event, '${product.sku}', 'product')"
          onfocus="if(getActiveBranchNames().length > 0){ openBranchQuantityEditor('${product.sku}', 'product'); }"
          onchange="finishQtyTyping('${product.sku}', this, 'product')"
          onblur="finishQtyTyping('${product.sku}', this, 'product')"
          onkeydown="if(event.key === 'Enter'){ this.blur(); }"
          oninput="setQtyOnly('${product.sku}', this, true, 'product')"
        >

        <button type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapChangeQty(event, '${product.sku}', 1, 'product')" onclick="tapChangeQty(event, '${product.sku}', 1, 'product')">+</button>
      </div>
    `;
  }

  return `
    <button ontouchstart="rememberControlTouch(event)" ontouchend="tapAddToCartFromProduct(event, '${product.sku}')" onclick="tapAddToCartFromProduct(event, '${product.sku}')">
      Add to Cart
    </button>
  `;
}

function createProductCard(p){
  const card = document.createElement("div");
  card.className = "card";
  card.classList.toggle("quickBranchOpen", quickBranchSku === p.sku && getActiveBranchNames().length > 0);
  card.dataset.sku = p.sku;

  if(p.rowColor){
    card.style.backgroundColor = p.rowColor;
  }

  card.innerHTML = `
    <div class="photo" onclick="openPhotoViewer('${p.sku}')">
      ${getDriveImageTag(p, "front", 'loading="lazy" decoding="async"') || "No photo yet"}
    </div>

    <div class="info">
      <div class="desc">${escapeHtml(p.description || "")}</div>

      <div class="meta">
        <span class="price">${escapeHtml(showPrice(p.price))}</span>

        <span class="stockBox">
          <span class="stock">${escapeHtml(p.status || "")}</span>

          ${p.extraInfo
            ? `<span class="extraInfo" style="color:${p.extraInfoColor || "red"}">${escapeHtml(p.extraInfo)}</span>`
            : `<span class="extraInfo emptyExtra">&nbsp;</span>`}
        </span>
      </div>

      <div class="remark">${p.remark ? escapeHtml(p.remark) : "&nbsp;"}</div>

      <div class="orderArea">
        ${renderOrderControls(p)}
      </div>
    </div>
  `;

  return card;
}

function updateProductOrderArea(sku){
  const product = products.find(p => p.sku === sku);
  if(!product) return;

  const cards = cardBySku[sku];
  if(!cards || cards.length === 0) return;

  cards.forEach(card => {
    const orderArea = card.querySelector(".orderArea");
    if(!orderArea) return;

    const quickOpen = quickBranchSku === sku && getActiveBranchNames().length > 0;
    card.classList.toggle("quickBranchOpen", quickOpen);
    orderArea.innerHTML = renderOrderControls(product);
  });
}

function updateAllProductOrderAreas(){
  Object.keys(cardBySku).forEach(sku => {
    updateProductOrderArea(sku);
  });
}

function updateCartCountOnly(){
  const count = Object.keys(cart).reduce((sum, sku) => sum + getCartQty(sku), 0);
  document.getElementById("cartCount").textContent = count;
}

const qtyInputCommitTimers = {};

function queueTypedQtyCardScroll(sku){
  if(getActiveBranchNames().length > 0) return;

  clearTimeout(qtyInputCommitTimers[sku]);
  qtyInputCommitTimers[sku] = setTimeout(() => {
    scrollProductCardIntoView(sku);
    delete qtyInputCommitTimers[sku];
  }, 120);
}

function changeQty(sku, delta, source = "product"){
  if(delta !== 0 && getActiveBranchNames().length > 0 && getCartQty(sku) > 0){
    openBranchQuantityEditor(sku, source);
    return;
  }

  if(quickBranchSku === sku){
    quickBranchSku = "";
  }

  const previousQty = getCartQty(sku);
  setCartQty(sku, previousQty + delta);

  renderCart();
  updateProductOrderArea(sku);
}

function finishQtyTyping(sku, input, source = "product"){
  setQtyAndUpdate(sku, input, true, source);
}

function setQtyOnly(sku, value, shouldScrollAfterTyping = false, source = "product", inputOverride = null){
  if(getActiveBranchNames().length > 0 && getCartQty(sku) > 0){
    openBranchQuantityEditor(sku, source);
    return;
  }

  const input = inputOverride || (value && typeof value === "object" && "value" in value ? value : null);
  value = inputOverride ? value : (input ? input.value : value);

  if(value === ""){
    updateCartCountOnly();
    return;
  }

  let qty = parseInt(value, 10);

  if(isNaN(qty) || qty <= 0){
    updateCartCountOnly();
    return;
  }

  setCartQty(sku, qty);
  const cartQty = getCartQty(sku);
  if(input && cartQty > 0 && String(input.value) !== String(cartQty)){
    input.value = cartQty;
  }
  updateCartCountOnly();
}

function setQtyAndUpdate(sku, value, shouldScrollAfterTyping = false, source = "product"){
  if(getActiveBranchNames().length > 0 && getCartQty(sku) > 0){
    openBranchQuantityEditor(sku, source);
    return;
  }

  const input = value && typeof value === "object" && "value" in value ? value : null;
  value = input ? input.value : value;

  if(value === ""){
    delete cart[sku];
    renderCart();
    updateProductOrderArea(sku);
    if(shouldScrollAfterTyping) queueTypedQtyCardScroll(sku);
    return;
  }

  let qty = parseInt(value, 10);
  setCartQty(sku, qty);
  const cartQty = getCartQty(sku);
  if(input && cartQty > 0 && String(input.value) !== String(cartQty)){
    input.value = cartQty;
  }

  renderCart();
  updateProductOrderArea(sku);
  if(shouldScrollAfterTyping) queueTypedQtyCardScroll(sku);
}

function removeItem(sku){
  delete cart[sku];

  if(activeBranchSku === sku){
    activeBranchSku = "";
  }

  if(quickBranchSku === sku){
    quickBranchSku = "";
  }

  renderCart();
  updateProductOrderArea(sku);
}

function getBranchSettingInputSlots(){
  const inputs = document.querySelectorAll("#branchSettingPanel input[data-branch-index]");
  const inputSlots = normalizeBranchNameSlots(branchNames);

  inputs.forEach(input => {
    const index = parseInt(input.dataset.branchIndex, 10);

    if(!isNaN(index) && index >= 0){
      inputSlots[index] = input.value.trim();
    }
  });

  return normalizeBranchNameSlots(inputSlots);
}

function renderBranchSettingPanel(){
  const panel = document.getElementById("branchSettingPanel");

  if(!branchSettingOpen){
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  panel.classList.remove("hidden");
  branchNames = normalizeBranchNameSlots(branchNames);

  const rows = [];

  for(let i = 0; i < branchNames.length; i++){
    rows.push(`
      <div class="branchInputRow">
        <label>Branch ${i + 1}</label>
        <input
          type="text"
          maxlength="40"
          value="${escapeHtml(branchNames[i] || "")}" 
          placeholder="Branch name"
          data-branch-index="${i}"
        >
      </div>
    `);
  }

  panel.innerHTML = `
    <h3>Branch Setting</h3>
    ${rows.join("")}
    <button id="addMoreBranchButton" type="button" onclick="addMoreBranches()">Add More Branch</button>
    <div class="branchEditorActions">
      <button type="button" onclick="saveBranchSetting()">Save Branch Names</button>
      <button type="button" onclick="closeBranchSetting()">Cancel</button>
    </div>
  `;
}

function openBranchSetting(){
  branchSettingOpen = !branchSettingOpen;
  renderBranchSettingPanel();
}

function closeBranchSetting(){
  branchSettingOpen = false;
  renderBranchSettingPanel();
}
function addMoreBranches(){
  branchNames = getBranchSettingInputSlots();

  for(let i = 0; i < 5; i++){
    branchNames.push("");
  }

  renderBranchSettingPanel();

  setTimeout(() => {
    const nextInput = document.querySelector(`#branchSettingPanel input[data-branch-index="${branchNames.length - 5}"]`);
    if(nextInput){
      nextInput.focus();
    }
  }, 30);
}

function saveBranchSetting(){
  const names = getBranchSettingInputSlots();
  const activeNames = trimEmptyExtraBranchSlots(names).filter(Boolean);
  const duplicateName = activeNames.find((name, index) => activeNames.indexOf(name) !== index);

  if(duplicateName){
    alert(`Branch name "${duplicateName}" is repeated. Please use different branch names.`);
    return;
  }

  branchNames = trimEmptyExtraBranchSlots(names);
  quickBranchSku = "";
  saveBranchNames();

  Object.keys(cart).forEach(sku => {
    const item = getCartItem(sku);
    if(!item) return;

    const usedBranchSplit = Object.values(item.branches).some(qty => Number(qty) > 0);

    Object.keys(item.branches).forEach(name => {
      if(!activeNames.includes(name)){
        delete item.branches[name];
      }
    });

    if(usedBranchSplit){
      const total = Object.values(item.branches).reduce((sum, qty) => sum + (Number(qty) || 0), 0);

      if(total > 0){
        const limited = sanitizeBranchQuantitiesForSku(sku, item.branches, false);
        item.branches = limited.branches;
        item.qty = limited.total;
      }else{
        delete cart[sku];

        if(activeBranchSku === sku){
          activeBranchSku = "";
        }

        if(quickBranchSku === sku){
          quickBranchSku = "";
        }
      }
    }
  });

  branchSettingOpen = false;
  renderCart();
  updateAllProductOrderAreas();
}

function toggleBranchSplit(sku){
  if(getActiveBranchNames().length === 0){
    alert("Please set branch names first.");
    return;
  }

  if(activeBranchSku === sku){
    return;
  }

  const previousQuickSku = quickBranchSku;
  quickBranchSku = "";
  activeBranchSku = sku;

  if(previousQuickSku){
    updateProductOrderArea(previousQuickSku);
  }

  renderCart();
  scrollCartProductIntoView(sku);
}

function scrollCartProductIntoView(sku){
  setTimeout(() => {
    const panel = document.getElementById("cartPanel");
    const row = panel ? panel.querySelector(`.cartRow[data-sku="${sku}"]`) : null;
    if(!panel || !row) return;

    const header = panel.querySelector(".cartHeader");
    const headerHeight = header ? header.getBoundingClientRect().height : 0;
    const panelTop = panel.getBoundingClientRect().top;
    const targetTop = panel.scrollTop + row.getBoundingClientRect().top - panelTop - headerHeight - 12;

    panel.scrollTo({
      top:Math.max(0, targetTop),
      behavior:"smooth"
    });
  }, 50);
}

function renderBranchSplitPanel(sku){
  if(activeBranchSku !== sku || getActiveBranchNames().length === 0){
    return "";
  }

  const branches = getCartBranches(sku);
  const product = getProductBySku(sku);
  const limitAttrs = getOrderLimitInputAttributes(product);
  const rows = getActiveBranchNames().map(name => `
    <div class="branchQtyRow">
      <label>${escapeHtml(name)}</label>
      <div class="branchQtyControl">
        <button class="branchQtyStepper" type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapBranchQty(event, this, -1)" onclick="tapBranchQty(event, this, -1)">-</button>
        <input
          type="number"
          min="0"
          ${limitAttrs}
          inputmode="numeric"
          value="${branches[name] || ""}"
          data-branch-name="${escapeHtml(name)}"
          placeholder="0"
          oninput="enforceBranchQtyInput(this)"
          onchange="enforceBranchQtyInput(this)"
        >
        <button class="branchQtyStepper" type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapBranchQty(event, this, 1)" onclick="tapBranchQty(event, this, 1)">+</button>
      </div>
    </div>
  `);

  return `
    <div class="branchSplitPanel">
      <h4>Branch Split</h4>
      ${rows.join("")}
      <div class="branchSplitTotal">Cart Qty: ${getCartQty(sku)} ${getProductQtyWord(product, getCartQty(sku))}</div>
      <div class="branchEditorActions">
        <button type="button" onclick="saveBranchSplit('${sku}')">Save Branch Split</button>
        <button type="button" onclick="cancelBranchSplit('${sku}')">Cancel</button>
      </div>
    </div>
  `;
}

function saveBranchSplit(sku){
  const row = document.querySelector(`.cartRow[data-sku="${sku}"]`);
  if(!row) return;

  const inputs = row.querySelectorAll(".branchSplitPanel input[data-branch-name]");
  const branches = {};
  let total = 0;

  inputs.forEach(input => {
    enforceBranchQtyInput(input);
    const name = input.dataset.branchName;
    const qty = parseInt(input.value, 10) || 0;

    if(qty > 0){
      branches[name] = qty;
      total += qty;
    }
  });

  if(total <= 0){
    delete cart[sku];
    activeBranchSku = "";
    renderCart();
    updateProductOrderArea(sku);
    return;
  }

  const item = getCartItem(sku);
  if(!item) return;
  const limited = sanitizeBranchQuantitiesForSku(sku, branches);

  item.qty = limited.total;
  item.branches = limited.branches;
  activeBranchSku = "";
  renderCart();
  updateProductOrderArea(sku);
  scrollCartProductIntoView(sku);
}

function cancelBranchSplit(sku){
  if(activeBranchSku === sku){
    activeBranchSku = "";
  }

  renderCart();
  scrollCartProductIntoView(sku);
}

function renderCart(){
  updateCartCountOnly();
  renderBranchSettingPanel();

  const box = document.getElementById("cartItems");
  box.innerHTML = "";

  Object.keys(cart).forEach(sku => {
    const item = getCartItem(sku);
    const p = products.find(x => x.sku === sku);

    if(!item || item.qty <= 0 || !p) return;

    const row = document.createElement("div");
    row.className = "cartRow";
    row.dataset.sku = sku;

    const imgUrl = getDriveImageUrl(p, "front");
    const branchPreview = getBranchPreviewHtml(sku);
    const limitAttrs = getOrderLimitInputAttributes(p);

    row.innerHTML = `
      <div class="cartProductLine">
        <div class="cartProductThumb">
          ${getDriveImageTag(p, "front") || `No photo`}
        </div>

        <div class="cartProductInfo">
          <div class="cartProductDesc">${escapeHtml(p.description || "")}</div>

          <small>${getOrderQtyLabel(p)}</small>

          <div class="qtyControls">
            <button type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapChangeQty(event, '${sku}', -1, 'cart')" onclick="tapChangeQty(event, '${sku}', -1, 'cart')">-</button>

            <input
              class="qtyInput"
              type="number"
              min="1"
              ${limitAttrs}
              inputmode="numeric"
              value="${item.qty}"
              ontouchstart="rememberControlTouch(event)"
              ontouchend="tapOpenBranchEditor(event, '${sku}', 'cart')"
              onclick="tapOpenBranchEditor(event, '${sku}', 'cart')"
              onfocus="if(getActiveBranchNames().length > 0){ openBranchQuantityEditor('${sku}', 'cart'); }"
              onchange="finishQtyTyping('${sku}', this, 'cart')"
              onblur="finishQtyTyping('${sku}', this, 'cart')"
              onkeydown="if(event.key === 'Enter'){ this.blur(); }"
              oninput="setQtyOnly('${sku}', this, true, 'cart')"
            >

            <button type="button" ontouchstart="rememberControlTouch(event)" ontouchend="tapChangeQty(event, '${sku}', 1, 'cart')" onclick="tapChangeQty(event, '${sku}', 1, 'cart')">+</button>
          </div>

          <div class="cartActionRow">
            <button class="branchButton" type="button" onclick="toggleBranchSplit('${sku}')">Branch</button>
            <button class="remove" onclick="removeItem('${sku}')">Remove</button>
          </div>

          ${branchPreview}
          ${renderBranchSplitPanel(sku)}
        </div>
      </div>
    `;

    box.appendChild(row);
  });
}

document.getElementById("search").addEventListener("input", () => {
  showCachedCategory();
});

document.getElementById("clearSearchButton").onclick = () => {
  document.getElementById("search").value = "";
  showCachedCategory();
};

document.getElementById("refreshAppButton").onclick = () => {
  cart = {};
  activeBranchSku = "";
  quickBranchSku = "";
  branchSettingOpen = false;
  currentCategory = "ALL";
  currentPcdFilter = "";
  imageCacheVersion = Date.now();

  categoryCardCache = {};
  cardBySku = {};

  document.getElementById("search").value = "";
  document.getElementById("cartPanel").classList.add("hidden");

  if(typeof resetFitmentState === "function"){
    resetFitmentState();
  }
  renderCart();
  updateActiveButtons();
  showCachedCategory();
  scrollPageToTop();
  scrollFilterBarsToLeft();
};

document.getElementById("cartButton").onclick = () => {
  const productBranchSku = quickBranchSku;

  if(isPhoneLayout() && productBranchSku){
    quickBranchSku = "";
    activeBranchSku = getCartQty(productBranchSku) > 0 ? productBranchSku : "";
    updateProductOrderArea(productBranchSku);
  }

  renderCart();
  document.getElementById("cartPanel").classList.remove("hidden");

  if(isPhoneLayout() && activeBranchSku){
    focusCartBranchSplit(activeBranchSku);
  }
};

document.getElementById("closeCart").onclick = () => {
  activeBranchSku = "";
  renderCart();
  document.getElementById("cartPanel").classList.add("hidden");
};

document.getElementById("branchSettingButton").onclick = () => {
  openBranchSetting();
};

document.getElementById("sendWhatsapp").onclick = () => {
  if(Object.keys(cart).length === 0){
    alert("Cart is empty");
    return;
  }

  if(
    !customerPhone ||
    !customerName ||
    !isValidWhatsappNumber(customerPhone)
  ){
    alert("Please login with customer name and valid sales person WhatsApp number first");
    document.getElementById("loginScreen").classList.remove("hidden");
    return;
  }

  let totalSets = 0;
  let totalPcs = 0;
  const lines = [
    "New Rim Order",
    "",
    `Customer Name: ${customerName}`,
    `Sales Person WhatsApp: ${customerPhone}`
  ];

  const validEntries = Object.keys(cart)
    .map(sku => ({ sku, item: getCartItem(sku), product: products.find(p => p.sku === sku) }))
    .filter(entry => entry.item && entry.item.qty > 0 && entry.product);

  for(let i = 0; i < validEntries.length; i++){
    const { sku, item, product } = validEntries[i];
    const branchUsed = hasBranchSplit(sku);
    const branchTotal = getBranchTotal(sku);

    if(branchUsed && branchTotal !== item.qty){
      alert(`Branch total for ${product.description || sku} is ${branchTotal} ${getProductQtyWord(product, branchTotal)}, but cart qty is ${item.qty} ${getProductQtyWord(product, item.qty)}. Please adjust before sending.`);
      return;
    }

    if(isTyreProduct(product)){
      totalPcs += item.qty;
    }else{
      totalSets += item.qty;
    }

    lines.push("");
    lines.push(`${i + 1}. ${product.description || ""}`);

    if(branchUsed){
      Object.entries(item.branches)
        .filter(([, qty]) => Number(qty) > 0)
        .forEach(([name, qty]) => {
          lines.push(`   ${name}: ${qty} ${getProductQtyWord(product, qty)}`);
        });
    }else{
      lines.push(`   ${getOrderQtyLabel(product)} ${item.qty}`);
    }
  }

  lines.push("");
  const totalParts = [];
  if(totalSets > 0){
    totalParts.push(`${totalSets} ${getSetWord(totalSets)}`);
  }
  if(totalPcs > 0){
    totalParts.push(`${totalPcs} PCS`);
  }
  lines.push(`TOTAL ORDER: ${totalParts.join(" / ")}`);

  window.open(`https://wa.me/${customerPhone}?text=${encodeURIComponent(lines.join("\n"))}`, "_blank");

  const oldCartSkus = Object.keys(cart);

  cart = {};
  activeBranchSku = "";
  quickBranchSku = "";

  renderCart();

  oldCartSkus.forEach(sku => {
    updateProductOrderArea(sku);
  });

  document.getElementById("cartPanel").classList.add("hidden");

  alert("Order sent. Cart cleared.");
};

let currentPhotoIndex = 0;
let currentPhotos = [];

function openPhotoViewer(sku){
  const p = products.find(x => x.sku === sku);

  if(!p) return;

  document.getElementById("viewerProductDetails").textContent = p.description || p.sku;
  const fitmentButton = document.getElementById("viewerFitmentButton");
  fitmentButton.dataset.sku = sku;
  fitmentButton.onclick = () => {
    closePhotoViewer();
    openFitmentModal(sku);
  };

  currentPhotos = [];

  if(p.frontOriginal || p.frontImage){
    currentPhotos.push({
      title: "Front View",
      product: p,
      type: "front"
    });
  }

  if(p.sideOriginal || p.sideImage){
    currentPhotos.push({
      title: "Side View",
      product: p,
      type: "side"
    });
  }

  if(currentPhotos.length === 0){
    alert("No photo available");
    return;
  }

  currentPhotoIndex = 0;
  showCurrentPhoto();

  document.getElementById("photoViewer").classList.remove("hidden");
}

function showCurrentPhoto(){
  const photo = currentPhotos[currentPhotoIndex];

  const viewerImage = document.getElementById("viewerImage");
  const urls = getDriveViewerImageUrls(photo.product, photo.type);

  viewerImage.dataset.fallbackSrcs = urls.slice(1).join("|");
  viewerImage.onerror = function(){
    handleProductImageError(this);
  };
  viewerImage.src = urls[0] || "";

  document.getElementById("viewerTitle").textContent = photo.title;
}

function nextPhoto(){
  currentPhotoIndex++;

  if(currentPhotoIndex >= currentPhotos.length){
    currentPhotoIndex = 0;
  }

  showCurrentPhoto();
}

function prevPhoto(){
  currentPhotoIndex--;

  if(currentPhotoIndex < 0){
    currentPhotoIndex = currentPhotos.length - 1;
  }

  showCurrentPhoto();
}

function closePhotoViewer(){
  document.getElementById("photoViewer").classList.add("hidden");
}

loadBranchNames();
checkLogin();
loadProducts();

setInterval(autoRefreshProducts, 60000);

document.addEventListener("dblclick", function(event){
  event.preventDefault();
}, { passive:false });












