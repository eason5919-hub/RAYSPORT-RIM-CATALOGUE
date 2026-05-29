let products = [];
let cart = {};
let currentCategory = "ALL";
let currentYearFilter = "";
let currentSizeFilter = "";
let customerPhone = "";
let customerName = "";

let categoryCardCache = {};
let cardBySku = {};

let latestProductsJsonText = "";

const brandCategories = [
  "ALL",
  "APLUS",
  "ROCKBLADE",
  "HILO",
  "ARDENT",
  "RAUFFAN",
  "CROSSMAXX",
  "NEOLIN",
  "ROTALLA"
];

async function loadProducts(){
  const res = await fetch('products.json?refresh=' + Date.now(), {
    cache: 'no-store'
  });

  latestProductsJsonText = await res.text();
  products = JSON.parse(latestProductsJsonText);

  assignInternalSkus();
  showCategory(currentCategory);
}

async function autoRefreshProducts(){
  try{
    const res = await fetch('products.json?refresh=' + Date.now(), {
      cache: 'no-store'
    });

    const newText = await res.text();

    if(newText === latestProductsJsonText){
      return;
    }

    latestProductsJsonText = newText;
    products = JSON.parse(newText);

    assignInternalSkus();

    categoryCardCache = {};
    cardBySku = {};

    Object.keys(cart).forEach(sku => {
      const stillExists = products.some(p => getProductSku(p) === sku && shouldShowProduct(p));

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

function assignInternalSkus(){
  products.forEach((p, index) => {
    const existingSku = cleanValue(
      p.__sku ||
      p.sku ||
      p.SKU
    );

    if(existingSku){
      p.__sku = existingSku;
      return;
    }

    const brand = getProductBrand(p);
    const description = getProductDescription(p);
    const photo = getProductPhotoText(p);
    const price = getProductPrice(p);
    const status = getProductStatus(p);

    p.__sku = `${index}-${brand}-${description}-${photo}-${price}-${status}`;
  });
}

function cleanValue(value){
  if(value === null || value === undefined) return "";
  return String(value).trim();
}

function getProductSku(product){
  return cleanValue(product.__sku);
}

function getProductBrand(product){
  return cleanValue(
    product["Brand"] ||
    product["BRAND"] ||
    product["brand"]
  ).toUpperCase();
}

function getProductDescription(product){
  return cleanValue(
    product["Product Descriptions"] ||
    product["PRODUCT DESCRIPTIONS"] ||
    product["Product Description"] ||
    product["product descriptions"] ||
    product["description"]
  );
}

function getProductPhotoText(product){
  return cleanValue(
    product["PHOTO"] ||
    product["Photo"] ||
    product["photo"]
  );
}

function getProductPhotoUrl(product){
  let url = cleanValue(
    product["PHOTO_URL"] ||
    product["Photo URL"] ||
    product["photoUrl"] ||
    product["photo_url"]
  );

  if(!url) return "";

  if(url.includes("/d/")){
    const fileId = url.split("/d/")[1].split("/")[0];
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1200&cache=" + Date.now();
  }

  if(url.includes("id=")){
    const fileId = url.split("id=")[1].split("&")[0];
    return "https://drive.google.com/thumbnail?id=" + fileId + "&sz=w1200&cache=" + Date.now();
  }

  return url;
}

function getProductPrice(product){
  return cleanValue(
    product["PRICE"] ||
    product["Price"] ||
    product["price"]
  );
}

function getProductStatus(product){
  return cleanValue(
    product["STATUS"] ||
    product["Status"] ||
    product["status"]
  );
}

function getProductRowColor(product){
  return cleanValue(
    product["rowColor"] ||
    product["ROW_COLOR"] ||
    product["Row Color"]
  );
}

function getStatusBgColor(product){
  return cleanValue(
    product["statusBgColor"] ||
    product["STATUS_BG_COLOR"] ||
    product["Status Bg Color"]
  );
}

function getStatusFontColor(product){
  return cleanValue(
    product["statusFontColor"] ||
    product["STATUS_FONT_COLOR"] ||
    product["Status Font Color"]
  );
}

function getProductSizeFilter(product){
  const desc = getProductDescription(product).toUpperCase();

  let match = desc.match(/R\s?(\d{2})/);

  if(match){
    return "R" + match[1];
  }

  match = desc.match(/(\d{2})R/);

  if(match){
    return "R" + match[1];
  }

  return "";
}

function getProductYear(product){
  const allText = `
    ${getProductDescription(product)}
    ${getProductStatus(product)}
  `.toUpperCase();

  const match = allText.match(/Y\s?(23|24|25|26)/);

  if(match){
    return "Y" + match[1];
  }

  return "";
}

function shouldShowProduct(product){
  const brand = getProductBrand(product);
  const description = getProductDescription(product);
  const photo = getProductPhotoText(product);
  const photoUrl = getProductPhotoUrl(product);
  const price = getProductPrice(product);
  const status = getProductStatus(product);

  const statusText = status.toLowerCase();

  if(!brand && !description && !photo && !photoUrl && !price && !status){
    return false;
  }

  if(statusText.includes("sold out")){
    return false;
  }

  if(statusText.includes("not available")){
    return false;
  }

  if(statusText.includes("no stock")){
    return false;
  }

  if(statusText.includes("out of stock")){
    return false;
  }

  if(statusText.includes("#n/a")){
    return false;
  }

  return true;
}

function isValidWhatsappNumber(phone){
  phone = phone.replace(/\D/g, '');
  return /^60\d{8,10}$/.test(phone);
}

function checkLogin(){
  const savedPhone = sessionStorage.getItem("customerPhone");
  const savedName = sessionStorage.getItem("customerName");

  if(
    savedPhone &&
    savedName &&
    isValidWhatsappNumber(savedPhone) &&
    savedName.trim() !== ""
  ){
    customerPhone = savedPhone;
    customerName = savedName;
    document.getElementById('loginScreen').classList.add('hidden');
  }else{
    document.getElementById('loginScreen').classList.remove('hidden');
  }
}

document.getElementById('loginButton').onclick = () => {
  let name = document.getElementById('loginName').value.trim();
  let phone = document.getElementById('loginPhone').value.trim();

  phone = phone.replace(/\D/g, '');

  if(name === ""){
    document.getElementById('loginError').textContent =
      "Please enter customer name";
    return;
  }

  if(!isValidWhatsappNumber(phone)){
    document.getElementById('loginError').textContent =
      "Please enter a valid WhatsApp number. Example: 60123456789";
    return;
  }

  customerName = name;
  customerPhone = phone;

  sessionStorage.setItem("customerName", name);
  sessionStorage.setItem("customerPhone", phone);

  cart = {};
  renderCart();

  document.getElementById('loginError').textContent = "";
  document.getElementById('loginScreen').classList.add('hidden');
};

document.getElementById('logoutButton').onclick = () => {
  sessionStorage.removeItem("customerName");
  sessionStorage.removeItem("customerPhone");

  customerName = "";
  customerPhone = "";
  cart = {};

  renderCart();

  document.getElementById('loginName').value = "";
  document.getElementById('loginPhone').value = "";
  document.getElementById('loginError').textContent = "";
  document.getElementById('cartPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');

  Object.keys(cardBySku).forEach(sku => {
    updateProductOrderArea(sku);
  });
};

function showCategory(category){
  if(brandCategories.includes(category)){
    currentCategory = category;
  }

  document.getElementById('search').value = '';

  updateActiveButtons();
  showCachedCategory();
}

function showYearDropdown(event){
  if(event){
    event.stopPropagation();
  }

  const dropdown = document.getElementById('yearDropdown');
  const yearButton = document.getElementById('yearButton');

  if(!dropdown || !yearButton) return;

  const rect = yearButton.getBoundingClientRect();

  dropdown.style.left = rect.left + "px";
  dropdown.style.top = (rect.bottom + 6) + "px";

  dropdown.classList.toggle('hidden');
}

function showYear(year){
  if(currentYearFilter === year){
    currentYearFilter = "";
  }else{
    currentYearFilter = year;
  }

  const dropdown = document.getElementById('yearDropdown');

  if(dropdown){
    dropdown.classList.add('hidden');
  }

  document.getElementById('search').value = '';

  updateActiveButtons();
  showCachedCategory();
}

function clearYear(){
  currentYearFilter = "";

  const dropdown = document.getElementById('yearDropdown');

  if(dropdown){
    dropdown.classList.add('hidden');
  }

  updateActiveButtons();
  showCachedCategory();
}

function showSize(size){
  if(currentSizeFilter === size){
    currentSizeFilter = "";
  }else{
    currentSizeFilter = size;
  }

  document.getElementById('search').value = '';

  updateActiveButtons();
  showCachedCategory();
}

function productMatchesBrand(product){
  if(currentCategory === "ALL"){
    return true;
  }

  const brand = getProductBrand(product);
  const desc = getProductDescription(product).toUpperCase();

  return brand === currentCategory || desc.includes(currentCategory);
}

function productMatchesYear(product){
  if(!currentYearFilter){
    return true;
  }

  const year = getProductYear(product);
  const desc = getProductDescription(product).toUpperCase();

  return year === currentYearFilter || desc.includes(currentYearFilter);
}

function productMatchesSize(product){
  if(!currentSizeFilter){
    return true;
  }

  const size = getProductSizeFilter(product);
  const desc = getProductDescription(product).toUpperCase();

  return size === currentSizeFilter || desc.includes(currentSizeFilter);
}

function updateActiveButtons(){
  document.querySelectorAll('.categoryMenu button').forEach(btn => {
    btn.classList.remove('active');

    if(btn.textContent.trim().toUpperCase() === currentCategory){
      btn.classList.add('active');
    }
  });

  document.querySelectorAll('.pcdMenu button').forEach(btn => {
    btn.classList.remove('active');

    if(btn.textContent.trim().toUpperCase() === currentSizeFilter){
      btn.classList.add('active');
    }
  });

  document.querySelectorAll('.yearDropdown button').forEach(btn => {
    btn.classList.remove('active');

    if(btn.textContent.trim().toUpperCase() === currentYearFilter){
      btn.classList.add('active');
    }
  });

  const yearButton = document.getElementById('yearButton');

  if(yearButton){
    if(currentYearFilter){
      yearButton.classList.add('active');
      yearButton.textContent = currentYearFilter;
    }else{
      yearButton.classList.remove('active');
      yearButton.textContent = "YEAR";
    }
  }
}

function showCachedCategory(){
  const grid = document.getElementById('productGrid');

  while(grid.firstChild){
    grid.removeChild(grid.firstChild);
  }

  if(!categoryCardCache["ALL_PRODUCTS"]){
    const visibleProducts = products.filter(p => shouldShowProduct(p));

    categoryCardCache["ALL_PRODUCTS"] = visibleProducts.map(p => {
      const sku = getProductSku(p);

      const card = createProductCard(p);
      cardBySku[sku] = card;
      return card;
    });
  }

  const q = document.getElementById('search').value.toLowerCase();

  categoryCardCache["ALL_PRODUCTS"].forEach(card => {
    const sku = card.dataset.sku;
    const p = products.find(x => getProductSku(x) === sku);

    if(!p) return;
    if(!shouldShowProduct(p)) return;

    const searchable = `
      ${getProductBrand(p)}
      ${getProductDescription(p)}
      ${getProductPhotoText(p)}
      ${getProductPrice(p)}
      ${getProductStatus(p)}
    `.toLowerCase();

    const matchSearch = searchable.includes(q);
    const matchBrand = productMatchesBrand(p);
    const matchYear = productMatchesYear(p);
    const matchSize = productMatchesSize(p);

    if(matchSearch && matchBrand && matchYear && matchSize){
      grid.appendChild(card);
    }
  });
}

function isSoldOut(product){
  return !shouldShowProduct(product);
}

function renderOrderControls(product){
  const soldOut = isSoldOut(product);
  const sku = getProductSku(product);
  const cartQty = cart[sku] || 0;

  if(soldOut){
    return `<button disabled onclick="event.stopPropagation()">Sold Out</button>`;
  }

  if(cartQty > 0){
    return `
      <div class="qtyControls" onclick="event.stopPropagation()">
        <button onclick="changeQty('${escapeJsString(sku)}', -1)">-</button>

        <input
          class="qtyInput"
          type="number"
          min="1"
          value="${cartQty}"
          onchange="setQtyAndUpdate('${escapeJsString(sku)}', this.value)"
          oninput="setQtyOnly('${escapeJsString(sku)}', this.value)"
        >

        <button onclick="changeQty('${escapeJsString(sku)}', 1)">+</button>
      </div>
    `;
  }

  return `
    <button onclick="event.stopPropagation(); changeQty('${escapeJsString(sku)}', 1)">
      Add to Cart
    </button>
  `;
}

function createProductCard(p){
  const card = document.createElement('div');
  card.className = 'card';

  const sku = getProductSku(p);
  card.dataset.sku = sku;
  card.onclick = () => openPhotoViewer(sku);

  const rowColor = getProductRowColor(p);

  if(rowColor){
    card.style.backgroundColor = rowColor;
  }

  const brand = getProductBrand(p);
  const description = getProductDescription(p);
  const price = getProductPrice(p);
  const status = getProductStatus(p);
  const statusBgColor = getStatusBgColor(p);
  const statusFontColor = getStatusFontColor(p);

  let statusStyle = "";

  if(statusBgColor){
    statusStyle += `background-color:${statusBgColor};`;
  }

  if(statusFontColor){
    statusStyle += `color:${statusFontColor};`;
  }

  card.innerHTML = `
    <div class="info">
      <div class="desc">
        ${brand ? `<b class="brandName">${escapeHtml(brand)}</b>` : ''}
        ${escapeHtml(description)}
      </div>

      <div class="discountBox" onclick="event.stopPropagation()">
        <label>DISCOUNT</label>
        <input
          class="discountInput"
          type="text"
          placeholder="0%"
          oninput="calculateNett('${escapeJsString(sku)}', this.value)"
        >
      </div>

      <div class="nettBox" onclick="event.stopPropagation()">
        <label>NETT</label>
        <input
          class="nettInput"
          type="text"
          value=""
          readonly
        >
      </div>

      <div class="price">${escapeHtml(price)}</div>

      <div class="stockBox">
        <span class="stock" style="${statusStyle}">${escapeHtml(status)}</span>
      </div>

      <div class="orderArea">
        ${renderOrderControls(p)}
      </div>
    </div>
  `;

  return card;
}

function getNumberFromPrice(value){
  const cleaned = String(value || "")
    .replace(/,/g, "")
    .replace(/[^\d.]/g, "");

  const num = parseFloat(cleaned);

  if(isNaN(num)){
    return 0;
  }

  return num;
}

function getDiscountPercent(value){
  const cleaned = String(value || "")
    .replace("%", "")
    .replace(/[^\d.]/g, "");

  const num = parseFloat(cleaned);

  if(isNaN(num)){
    return 0;
  }

  return num;
}

function calculateNett(sku, discountValue){
  const product = products.find(p => getProductSku(p) === sku);
  const card = cardBySku[sku];

  if(!product || !card){
    return;
  }

  const nettInput = card.querySelector(".nettInput");

  if(!nettInput){
    return;
  }

  const discountText = String(discountValue || "").trim();

  // If discount box is empty, NETT stays empty
  if(discountText === ""){
    nettInput.value = "";
    return;
  }

  const price = getNumberFromPrice(getProductPrice(product));
  const discountPercent = getDiscountPercent(discountText);

  let nett = price - (price * discountPercent / 100);

  if(nett < 0){
    nett = 0;
  }

  nettInput.value = nett.toFixed(2);
}

function updateProductOrderArea(sku){
  const product = products.find(p => getProductSku(p) === sku);
  if(!product) return;

  const card = cardBySku[sku];
  if(!card) return;

  const orderArea = card.querySelector('.orderArea');
  if(!orderArea) return;

  orderArea.innerHTML = renderOrderControls(product);
}

function changeQty(sku, delta){
  cart[sku] = (cart[sku] || 0) + delta;

  if(cart[sku] <= 0){
    delete cart[sku];
  }

  renderCart();
  updateProductOrderArea(sku);
}

function setQtyOnly(sku, value){
  let qty = parseInt(value, 10);

  if(isNaN(qty) || qty <= 0){
    delete cart[sku];
  }else{
    cart[sku] = qty;
  }

  renderCart();
}

function setQtyAndUpdate(sku, value){
  setQtyOnly(sku, value);
  updateProductOrderArea(sku);
}

function removeItem(sku){
  delete cart[sku];
  renderCart();
  updateProductOrderArea(sku);
}

function renderCart(){
  const count = Object.values(cart).reduce((a,b) => a + b, 0);
  document.getElementById('cartCount').textContent = count;

  const box = document.getElementById('cartItems');
  box.innerHTML = '';

  Object.entries(cart).forEach(([sku, qty]) => {
    const p = products.find(x => getProductSku(x) === sku);

    if(!p) return;
    if(!shouldShowProduct(p)) return;

    const brand = getProductBrand(p);
    const description = getProductDescription(p);

    const row = document.createElement('div');
    row.className = 'cartRow';

    row.innerHTML = `
      <b>${escapeHtml(brand)} ${escapeHtml(description)}</b>
      <small>Order Qty:</small>

      <div class="qtyControls">
        <button onclick="changeQty('${escapeJsString(sku)}', -1)">-</button>

        <input
          class="qtyInput"
          type="number"
          min="1"
          value="${qty}"
          onchange="setQtyAndUpdate('${escapeJsString(sku)}', this.value)"
          oninput="setQtyOnly('${escapeJsString(sku)}', this.value)"
        >

        <button onclick="changeQty('${escapeJsString(sku)}', 1)">+</button>
        <button class="remove" onclick="removeItem('${escapeJsString(sku)}')">Remove</button>
      </div>
    `;

    box.appendChild(row);
  });
}

document.getElementById('cartButton').onclick = () => {
  document.getElementById('cartPanel').classList.remove('hidden');
};

document.getElementById('closeCart').onclick = () => {
  document.getElementById('cartPanel').classList.add('hidden');
};

document.getElementById('search').addEventListener('input', () => {
  showCachedCategory();
});

/* SEND WHATSAPP + RESET CART */

document.getElementById('sendWhatsapp').onclick = () => {
  if(!customerPhone || !isValidWhatsappNumber(customerPhone)){
    alert("Please login with a valid WhatsApp number first.");
    return;
  }

  if(Object.keys(cart).length === 0){
    alert("Cart is empty.");
    return;
  }

  let message = `TYRE ONE Order%0A`;
  message += `Customer: ${encodeURIComponent(customerName)}%0A%0A`;

  Object.entries(cart).forEach(([sku, qty]) => {
    const p = products.find(x => getProductSku(x) === sku);

    if(!p) return;
    if(!shouldShowProduct(p)) return;

    const brand = getProductBrand(p);
    const description = getProductDescription(p);

    message += `Brand: ${encodeURIComponent(brand)}%0A`;
    message += `Description: ${encodeURIComponent(description)}%0A`;
    message += `Order Qty: ${qty}%0A`;
    message += `%0A`;
  });

  const url = `https://wa.me/${customerPhone}?text=${message}`;

  window.open(url, '_blank');

  cart = {};
  renderCart();

  Object.keys(cardBySku).forEach(sku => {
    updateProductOrderArea(sku);
  });

  document.getElementById('cartPanel').classList.add('hidden');
};

function openPhotoViewer(sku){
  const product = products.find(p => getProductSku(p) === sku);

  if(!product) return;

  const photoUrl = getProductPhotoUrl(product);

  if(!photoUrl){
    return;
  }

  document.getElementById('viewerTitle').textContent =
    getProductBrand(product) + " " + getProductDescription(product);

  document.getElementById('viewerImage').src = photoUrl;

  document.getElementById('photoViewer').classList.remove('hidden');
}

function closePhotoViewer(){
  document.getElementById('photoViewer').classList.add('hidden');
  document.getElementById('viewerImage').src = "";
}

function prevPhoto(){
  return;
}

function nextPhoto(){
  return;
}

function escapeHtml(text){
  return String(text || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeJsString(text){
  return String(text || "")
    .replaceAll("\\", "\\\\")
    .replaceAll("'", "\\'")
    .replaceAll('"', '\\"');
}

document.addEventListener('click', function(e){
  const yearButton = document.getElementById('yearButton');
  const yearDropdown = document.getElementById('yearDropdown');

  if(!yearButton || !yearDropdown) return;

  if(
    !yearButton.contains(e.target) &&
    !yearDropdown.contains(e.target)
  ){
    yearDropdown.classList.add('hidden');
  }
});

window.addEventListener('scroll', function(){
  const dropdown = document.getElementById('yearDropdown');

  if(dropdown){
    dropdown.classList.add('hidden');
  }
});

window.addEventListener('resize', function(){
  const dropdown = document.getElementById('yearDropdown');

  if(dropdown){
    dropdown.classList.add('hidden');
  }
});

checkLogin();
loadProducts();

setInterval(autoRefreshProducts, 60000);