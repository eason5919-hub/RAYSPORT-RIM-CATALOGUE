let products = [];
let cart = {};
let currentCategory = "14";
let customerPhone = "";
let customerName = "";

const imageCacheVersion = Date.now();

/*
  Cache category cards so switching category does not recreate photos again.
*/
let categoryCardCache = {};
let cardBySku = {};

/*
  Store latest products.json text.
  If products.json is same, app does nothing.
  If products.json changed, app updates automatically.
*/
let latestProductsJsonText = "";

async function loadProducts(){
  const res = await fetch('products.json?refresh=' + Date.now(), {
    cache: 'no-store'
  });

  latestProductsJsonText = await res.text();
  products = JSON.parse(latestProductsJsonText);

  preloadProductImages();
  showCategory(currentCategory);
}

/*
  Auto check products.json every 60 seconds.
  This does NOT create GitHub commits.
  Customer stays logged in.
  Cart stays.
*/
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

    /*
      Clear product card cache because products.json changed.
      Then rebuild current category.
    */
    categoryCardCache = {};
    cardBySku = {};

    /*
      Remove cart items that no longer exist in products.json.
      Existing valid cart items stay.
    */
    Object.keys(cart).forEach(sku => {
      const stillExists = products.some(p => p.sku === sku);

      if(!stillExists){
        delete cart[sku];
      }
    });

    preloadProductImages();
    renderCart();
    showCategory(currentCategory);

    console.log("products.json updated automatically");

  }catch(err){
    console.log("Auto refresh failed:", err);
  }
}

function preloadProductImages(){
  products.forEach(p => {
    if(p.frontOriginal || p.frontImage){
      const img = new Image();
      img.src = getDriveImageUrl(p, 'front');
    }

    if(p.sideOriginal || p.sideImage){
      const img = new Image();
      img.src = getDriveImageUrl(p, 'side');
    }
  });
}

function showPrice(price){
  if(price === '' || price === null || price === undefined) return '';
  return price;
}

function getDriveImageUrl(product, type){
  let url = "";

  if(type === "front"){
    url = product.frontOriginal || product.frontImage || "";
  }else{
    url = product.sideOriginal || product.sideImage || "";
  }

  if(!url) return "";

  let fileId = "";

  if(url.includes("/d/")){
    fileId = url.split("/d/")[1].split("/")[0];
  }else if(url.includes("id=")){
    fileId = url.split("id=")[1].split("&")[0];
  }

  if(fileId){
    return "https://drive.google.com/thumbnail?id=" +
      fileId +
      "&sz=w1000&cache=" +
      imageCacheVersion;
  }

  const separator = url.includes("?") ? "&" : "?";
  return url + separator + "cache=" + imageCacheVersion;
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
  currentCategory = category;
  document.getElementById('search').value = '';

  document.querySelectorAll('.categoryMenu button').forEach(btn => {
    btn.classList.remove('active');

    if(btn.textContent.trim() === category){
      btn.classList.add('active');
    }
  });

  showCachedCategory(category);
}

function showCachedCategory(category){
  const grid = document.getElementById('productGrid');

  while(grid.firstChild){
    grid.removeChild(grid.firstChild);
  }

  if(!categoryCardCache[category]){
    const categoryProducts = products.filter(p => p.category === category);

    categoryCardCache[category] = categoryProducts.map(p => {
      const card = createProductCard(p);
      cardBySku[p.sku] = card;
      return card;
    });
  }

  const q = document.getElementById('search').value.toLowerCase();

  categoryCardCache[category].forEach(card => {
    const sku = card.dataset.sku;
    const p = products.find(x => x.sku === sku);

    if(!p) return;

    const searchable = (
      (p.description || '') + ' ' +
      (p.price || '') + ' ' +
      (p.status || '') + ' ' +
      (p.extraInfo || '') + ' ' +
      (p.remark || '')
    ).toLowerCase();

    if(searchable.includes(q)){
      grid.appendChild(card);
    }
  });
}

function getCurrentFilteredProducts(){
  const q = document.getElementById('search').value.toLowerCase();
  const currentList = products.filter(p => p.category === currentCategory);

  return currentList.filter(p =>
    (
      (p.description || '') + ' ' +
      (p.price || '') + ' ' +
      (p.status || '') + ' ' +
      (p.extraInfo || '') + ' ' +
      (p.remark || '')
    ).toLowerCase().includes(q)
  );
}

function isSoldOut(product){
  return (product.status || '').toLowerCase().includes('sold out');
}

function renderOrderControls(product){
  const soldOut = isSoldOut(product);
  const cartQty = cart[product.sku] || 0;

  if(soldOut){
    return `<button disabled>Sold Out</button>`;
  }

  if(cartQty > 0){
    return `
      <div class="qtyControls">
        <button onclick="changeQty('${product.sku}', -1)">-</button>

        <input
          class="qtyInput"
          type="number"
          min="1"
          value="${cartQty}"
          onchange="setQtyAndUpdate('${product.sku}', this.value)"
          oninput="setQtyOnly('${product.sku}', this.value)"
        >

        <button onclick="changeQty('${product.sku}', 1)">+</button>
      </div>
    `;
  }

  return `
    <button onclick="changeQty('${product.sku}', 1)">
      Add to Cart
    </button>
  `;
}

function createProductCard(p){
  const card = document.createElement('div');
  card.className = 'card';
  card.dataset.sku = p.sku;

  if(p.rowColor){
    card.style.backgroundColor = p.rowColor;
  }

  card.innerHTML = `
    <div class="photo" onclick="openPhotoViewer('${p.sku}')">
      ${(p.frontOriginal || p.frontImage)
        ? `<img src="${getDriveImageUrl(p, 'front')}" alt="" loading="eager">`
        : 'No photo yet'}
    </div>

    <div class="info">
      <div class="desc">${p.description || ''}</div>

      <div class="meta">
        <span class="price">${showPrice(p.price)}</span>

        <span class="stockBox">
          <span class="stock">${p.status || ''}</span>

          ${p.extraInfo
            ? `<span class="extraInfo" style="color:${p.extraInfoColor || 'red'}">${p.extraInfo}</span>`
            : ''}
        </span>
      </div>

      ${p.remark ? `<div class="remark">${p.remark}</div>` : ''}

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
    const p = products.find(x => x.sku === sku);

    if(!p) return;

    const row = document.createElement('div');
    row.className = 'cartRow';

    row.innerHTML = `
      <b>${p.description || ''}</b><br>
      <small>Order Qty:</small>

      <div class="qtyControls">
        <button onclick="changeQty('${sku}', -1)">-</button>

        <input
          class="qtyInput"
          type="number"
          min="1"
          value="${qty}"
          onchange="setQtyAndUpdate('${sku}', this.value)"
          oninput="setQtyOnly('${sku}', this.value)"
        >

        <button onclick="changeQty('${sku}', 1)">+</button>
        <button class="remove" onclick="removeItem('${sku}')">Remove</button>
      </div>
    `;

    box.appendChild(row);
  });
}

document.getElementById('search').addEventListener('input', () => {
  showCachedCategory(currentCategory);
});

document.getElementById('cartButton').onclick = () => {
  document.getElementById('cartPanel').classList.remove('hidden');
};

document.getElementById('closeCart').onclick = () => {
  document.getElementById('cartPanel').classList.add('hidden');
};

document.getElementById('sendWhatsapp').onclick = () => {
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
    document.getElementById('loginScreen').classList.remove('hidden');
    return;
  }

  let msg =
    `New Rim Order%0A%0A` +
    `Customer Name: ${encodeURIComponent(customerName)}%0A` +
    `Sales Person WhatsApp: ${encodeURIComponent(customerPhone)}%0A`;

  Object.entries(cart).forEach(([sku, qty], i) => {
    const p = products.find(x => x.sku === sku);

    if(!p) return;

    msg +=
      `%0A${i+1}. ${encodeURIComponent(p.description || '')}` +
      `%0AOrder Qty: ${qty}`;
  });

  window.open(`https://wa.me/${customerPhone}?text=${msg}`, '_blank');

  const oldCartSkus = Object.keys(cart);

  cart = {};

  renderCart();

  oldCartSkus.forEach(sku => {
    updateProductOrderArea(sku);
  });

  document.getElementById('cartPanel').classList.add('hidden');

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

  document.getElementById("viewerImage").src = getDriveImageUrl(photo.product, photo.type);
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

checkLogin();
loadProducts();

/*
  Auto refresh every 60 seconds.
  Customer stays logged in.
  Cart stays.
  No GitHub commits created.
*/
setInterval(autoRefreshProducts, 60000);