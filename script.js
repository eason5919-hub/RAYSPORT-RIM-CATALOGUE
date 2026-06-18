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

let imageCacheVersion = Date.now();

let categoryCardCache = {};
let cardBySku = {};

let latestProductsJsonText = "";

const BRANCH_NAMES_STORAGE_KEY = "branchNames";
const REFRESH_SCROLL_KEY = "raysportRefreshScrollTop";

if("scrollRestoration" in history){
  history.scrollRestoration = "manual";
}

const sheetCategories = [
  "ALL",
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
    behavior: "auto"
  });
}

function scrollFilterBarsToLeft(){
  const pcdMenu = document.querySelector(".pcdMenu");
  const categoryMenu = document.querySelector(".categoryMenu");

  if(pcdMenu){
    pcdMenu.scrollTo({
      left: 0,
      behavior: "auto"
    });
  }

  if(categoryMenu){
    categoryMenu.scrollTo({
      left: 0,
      behavior: "auto"
    });
  }
}

async function loadProducts(){
  const res = await fetch("products.json?refresh=" + Date.now(), {
    cache: "no-store"
  });

  latestProductsJsonText = await res.text();
  products = JSON.parse(latestProductsJsonText);

  preloadProductImages();
  showCategory("ALL");
  restoreRefreshScrollPosition();
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

    preloadProductImages();
    renderCart();
    showCachedCategory();

    console.log("products.json updated automatically");

  }catch(err){
    console.log("Auto refresh failed:", err);
  }
}

function preloadProductImages(){
  products.forEach(p => {
    if(p.frontOriginal || p.frontImage){
      const img = new Image();
      img.src = getDriveImageUrl(p, "front");
    }

    if(p.sideOriginal || p.sideImage){
      const img = new Image();
      img.src = getDriveImageUrl(p, "side");
    }
  });
}

function normalizeText(text){
  return String(text || "")
    .toUpperCase()
    .replace(/\s+/g, "")
    .trim();
}

function productMatchesPcd(product, pcd){
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

function getDriveImageUrls(product, type){
  const url = getDriveImageSource(product, type);
  if(!url) return [];

  const fileId = getDriveFileId(url);
  const urls = [];

  if(fileId){
    urls.push(
      "https://drive.google.com/thumbnail?id=" +
      fileId +
      "&sz=w1000&cache=" +
      imageCacheVersion
    );
    urls.push("https://lh3.googleusercontent.com/d/" + fileId + "=w1000");
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

function getDriveImageTag(product, type, extraAttributes = ""){
  const urls = getDriveImageUrls(product, type);
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
  qty = parseInt(qty, 10);

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

function isSoldOut(product){
  return (product.status || "").toLowerCase().includes("sold out");
}

function acceptImmediatePress(event){
  if(!event) return true;

  const target = event.currentTarget;
  const now = Date.now();

  if(event.type === "mousedown" && target && now - (Number(target.dataset.lastTouchPress) || 0) < 800){
    return false;
  }

  if(event.type === "touchstart" && target){
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
  const nextQty = Math.max(1, currentQty + delta);
  active.value = nextQty;
  setQtyOnly(sku, nextQty, false, source);

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
  input.dispatchEvent(new Event("input", { bubbles:true }));
}

function renderQuickBranchDropdown(product){
  if(quickBranchSku !== product.sku || getActiveBranchNames().length === 0 || (isPhoneLayout() && isCartPanelOpen())){
    return "";
  }

  const branches = getCartBranches(product.sku);
  const buttonLabel = getCartQty(product.sku) > 0 ? "Update Cart" : "Add to Cart";

  const rows = getActiveBranchNames().map(name => `
    <div class="branchQtyRow">
      <label>${escapeHtml(name)}</label>
      <div class="branchQtyControl">
        <button class="branchQtyStepper" type="button" ontouchstart="tapBranchQty(event, this, -1)" onmousedown="tapBranchQty(event, this, -1)">-</button>
        <input
          type="number"
          min="0"
          inputmode="numeric"
          value="${branches[name] || ""}"
          data-branch-name="${escapeHtml(name)}"
          placeholder="0"
        >
        <button class="branchQtyStepper" type="button" ontouchstart="tapBranchQty(event, this, 1)" onmousedown="tapBranchQty(event, this, 1)">+</button>
      </div>
    </div>
  `);

  return `
    <div class="quickBranchDropdown">
      <h4>Branch Qty</h4>
      ${rows.join("")}
      <div class="branchEditorActions">
        <button type="button" ontouchstart="tapSaveQuickBranchDropdown(event, '${product.sku}')" onmousedown="tapSaveQuickBranchDropdown(event, '${product.sku}')">${buttonLabel}</button>
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
function fastSmoothScrollTo(top, duration = 180){
  const startTop = window.pageYOffset;
  const distance = top - startTop;

  if(Math.abs(distance) < 1) return;

  const startedAt = performance.now();
  const animate = now => {
    const progress = Math.min(1, (now - startedAt) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    window.scrollTo(0, startTop + (distance * eased));

    if(progress < 1){
      requestAnimationFrame(animate);
    }
  };

  requestAnimationFrame(animate);
}

function scrollProductCardIntoView(sku){
  setTimeout(() => {
    const cards = cardBySku[sku] || [];
    const visibleCard = cards.find(card => card.isConnected);

    if(visibleCard){
      const header = document.querySelector("header");
      const headerHeight = header ? header.getBoundingClientRect().height : 0;
      const top = visibleCard.getBoundingClientRect().top + window.pageYOffset - headerHeight - 12;

      fastSmoothScrollTo(Math.max(0, top));
    }
  }, 20);
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
  const card = (cardBySku[sku] || []).find(item => item.querySelector(".quickBranchDropdown"));
  if(!card) return;

  const inputs = card.querySelectorAll(".quickBranchDropdown input[data-branch-name]");
  const branches = {};
  let total = 0;

  inputs.forEach(input => {
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

  cart[sku] = {
    qty: total,
    branches
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

  if(soldOut){
    return `<button disabled>Sold Out</button>`;
  }

  if(quickBranchSku === product.sku && getActiveBranchNames().length > 0){
    return renderQuickBranchDropdown(product);
  }

  if(cartQty > 0){
    return `
      <div class="qtyControls">
        <button type="button" ontouchstart="tapChangeQty(event, '${product.sku}', -1, 'product')" onmousedown="tapChangeQty(event, '${product.sku}', -1, 'product')">-</button>

        <input
          class="qtyInput"
          type="number"
          min="1"
          inputmode="numeric"
          value="${cartQty}"
          ontouchstart="tapOpenBranchEditor(event, '${product.sku}', 'product')"
          onmousedown="tapOpenBranchEditor(event, '${product.sku}', 'product')"
          onfocus="if(getActiveBranchNames().length > 0){ openBranchQuantityEditor('${product.sku}', 'product'); }"
          onchange="finishQtyTyping('${product.sku}', this, 'product')"
          onblur="finishQtyTyping('${product.sku}', this, 'product')"
          onkeydown="if(event.key === 'Enter'){ this.blur(); }"
          oninput="setQtyOnly('${product.sku}', this.value, true, 'product')"
        >

        <button type="button" ontouchstart="tapChangeQty(event, '${product.sku}', 1, 'product')" onmousedown="tapChangeQty(event, '${product.sku}', 1, 'product')">+</button>
      </div>
    `;
  }

  return `
    <button ontouchstart="tapAddToCartFromProduct(event, '${product.sku}')" onmousedown="tapAddToCartFromProduct(event, '${product.sku}')">
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
      ${getDriveImageTag(p, "front", 'loading="eager"') || "No photo yet"}
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
  setQtyAndUpdate(sku, input.value, true, source);
}

function setQtyOnly(sku, value, shouldScrollAfterTyping = false, source = "product"){
  if(getActiveBranchNames().length > 0 && getCartQty(sku) > 0){
    openBranchQuantityEditor(sku, source);
    return;
  }

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
  updateCartCountOnly();
}

function setQtyAndUpdate(sku, value, shouldScrollAfterTyping = false, source = "product"){
  if(getActiveBranchNames().length > 0 && getCartQty(sku) > 0){
    openBranchQuantityEditor(sku, source);
    return;
  }

  if(value === ""){
    delete cart[sku];
    renderCart();
    updateProductOrderArea(sku);
    if(shouldScrollAfterTyping) queueTypedQtyCardScroll(sku);
    return;
  }

  let qty = parseInt(value, 10);
  setCartQty(sku, qty);

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
        item.qty = total;
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

  const previousQuickSku = quickBranchSku;
  quickBranchSku = "";
  activeBranchSku = activeBranchSku === sku ? "" : sku;

  if(previousQuickSku){
    updateProductOrderArea(previousQuickSku);
  }

  renderCart();
}

function renderBranchSplitPanel(sku){
  if(activeBranchSku !== sku || getActiveBranchNames().length === 0){
    return "";
  }

  const branches = getCartBranches(sku);
  const rows = getActiveBranchNames().map(name => `
    <div class="branchQtyRow">
      <label>${escapeHtml(name)}</label>
      <div class="branchQtyControl">
        <button class="branchQtyStepper" type="button" ontouchstart="tapBranchQty(event, this, -1)" onmousedown="tapBranchQty(event, this, -1)">-</button>
        <input
          type="number"
          min="0"
          inputmode="numeric"
          value="${branches[name] || ""}"
          data-branch-name="${escapeHtml(name)}"
          placeholder="0"
        >
        <button class="branchQtyStepper" type="button" ontouchstart="tapBranchQty(event, this, 1)" onmousedown="tapBranchQty(event, this, 1)">+</button>
      </div>
    </div>
  `);

  return `
    <div class="branchSplitPanel">
      <h4>Branch Split</h4>
      ${rows.join("")}
      <div class="branchSplitTotal">Cart Qty: ${getCartQty(sku)} ${getSetWord(getCartQty(sku))}</div>
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

  item.qty = total;
  item.branches = branches;
  activeBranchSku = "";
  renderCart();
  updateProductOrderArea(sku);
}

function cancelBranchSplit(sku){
  if(activeBranchSku === sku){
    activeBranchSku = "";
  }

  renderCart();
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

    row.innerHTML = `
      <div class="cartProductLine">
        <div class="cartProductThumb">
          ${getDriveImageTag(p, "front") || `No photo`}
        </div>

        <div class="cartProductInfo">
          <div class="cartProductDesc">${escapeHtml(p.description || "")}</div>

          <small>Order Qty (Set):</small>

          <div class="qtyControls">
            <button type="button" ontouchstart="tapChangeQty(event, '${sku}', -1, 'cart')" onmousedown="tapChangeQty(event, '${sku}', -1, 'cart')">-</button>

            <input
              class="qtyInput"
              type="number"
              min="1"
              inputmode="numeric"
              value="${item.qty}"
              ontouchstart="tapOpenBranchEditor(event, '${sku}', 'cart')"
              onmousedown="tapOpenBranchEditor(event, '${sku}', 'cart')"
              onfocus="if(getActiveBranchNames().length > 0){ openBranchQuantityEditor('${sku}', 'cart'); }"
              onchange="finishQtyTyping('${sku}', this, 'cart')"
              onblur="finishQtyTyping('${sku}', this, 'cart')"
              onkeydown="if(event.key === 'Enter'){ this.blur(); }"
              oninput="setQtyOnly('${sku}', this.value, true, 'cart')"
            >

            <button type="button" ontouchstart="tapChangeQty(event, '${sku}', 1, 'cart')" onmousedown="tapChangeQty(event, '${sku}', 1, 'cart')">+</button>
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

function restoreRefreshScrollPosition(){
  const savedTop = parseInt(sessionStorage.getItem(REFRESH_SCROLL_KEY), 10);
  if(!Number.isFinite(savedTop)) return;

  sessionStorage.removeItem(REFRESH_SCROLL_KEY);
  const maxTop = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo(0, Math.min(savedTop, maxTop));

  requestAnimationFrame(() => {
    requestAnimationFrame(() => fastSmoothScrollTo(0, 180));
  });
}

function tapRefreshApp(event){
  if(!acceptImmediatePress(event)) return;

  const active = document.activeElement;
  if(active && typeof active.blur === "function"){
    active.blur();
  }

  sessionStorage.setItem(REFRESH_SCROLL_KEY, String(window.pageYOffset));
  const freshUrl = window.location.pathname + "?v=1077&refresh=" + Date.now();
  window.location.replace(freshUrl);
}

const refreshAppButton = document.getElementById("refreshAppButton");
refreshAppButton.ontouchstart = tapRefreshApp;
refreshAppButton.onmousedown = tapRefreshApp;

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
      alert(`Branch total for ${product.description || sku} is ${branchTotal} ${getSetWord(branchTotal)}, but cart qty is ${item.qty} ${getSetWord(item.qty)}. Please adjust before sending.`);
      return;
    }

    totalSets += item.qty;

    lines.push("");
    lines.push(`${i + 1}. ${product.description || ""}`);

    if(branchUsed){
      Object.entries(item.branches)
        .filter(([, qty]) => Number(qty) > 0)
        .forEach(([name, qty]) => {
          lines.push(`   ${name}: ${qty} ${getSetWord(qty)}`);
        });
    }else{
      lines.push(`   Order Qty (Set): ${item.qty}`);
    }
  }

  lines.push("");
  lines.push(`TOTAL ORDER: ${totalSets} ${getSetWord(totalSets)}`);

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
  const urls = getDriveImageUrls(photo.product, photo.type);

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












