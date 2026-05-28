let products = [];
let cart = {};
let currentCategory = "14";
let customerPhone = "";
let customerName = "";

async function loadProducts(){
  const res = await fetch('products.json?v=' + new Date().getTime());
  products = await res.json();
  showCategory(currentCategory);
}

function showPrice(price){
  if(price === '' || price === null || price === undefined) return '';
  return price;
}

/*
  PHOTO RULE:
  frontOriginal = Excel export front photo link
  sideOriginal = Excel export side photo link
*/
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
      new Date().getTime();
  }

  const separator = url.includes("?") ? "&" : "?";
  return url + separator + "cache=" + new Date().getTime();
}

function isValidWhatsappNumber(phone){
  phone = phone.replace(/\D/g, '');

  // Malaysia WhatsApp format, example: 60123456789
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
  renderProducts(getCurrentFilteredProducts());

  document.getElementById('loginName').value = "";
  document.getElementById('loginPhone').value = "";
  document.getElementById('loginError').textContent = "";
  document.getElementById('cartPanel').classList.add('hidden');
  document.getElementById('loginScreen').classList.remove('hidden');
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

  const filtered = products.filter(p => p.category === category);
  renderProducts(filtered);
}

function getCurrentFilteredProducts(){
  const q = document.getElementById('search').value.toLowerCase();

  const currentList = products.filter(p => p.category === currentCategory);

  return currentList.filter(p =>
    (
      (p.description || '') + ' ' +
      (p.price || '') + ' ' +
      (p.status || '') + ' ' +
      (p.remark || '')
    ).toLowerCase().includes(q)
  );
}

function renderProducts(list){
  const grid = document.getElementById('productGrid');
  grid.innerHTML = '';

  list.forEach(p => {
    const soldOut = (p.status || '').toLowerCase().includes('sold out');
    const cartQty = cart[p.sku] || 0;

    const card = document.createElement('div');
    card.className = 'card';

    let orderButton = '';

    if(soldOut){
      orderButton = `<button disabled>Sold Out</button>`;
    }else if(cartQty > 0){
      orderButton = `
        <div class="qtyControls">
          <button onclick="changeQty('${p.sku}', -1)">-</button>
          <span>${cartQty}</span>
          <button onclick="changeQty('${p.sku}', 1)">+</button>
        </div>
      `;
    }else{
      orderButton = `
        <button onclick="changeQty('${p.sku}', 1)">
          Add to Cart
        </button>
      `;
    }

    card.innerHTML = `
      <div class="photo" onclick="openPhotoViewer('${p.sku}')">
        ${(p.frontOriginal || p.frontImage)
          ? `<img src="${getDriveImageUrl(p, 'front')}" alt="">`
          : 'No photo yet'}
      </div>

      <div class="info">
        <div class="desc">${p.description || ''}</div>

        <div class="meta">
          <span class="price">${showPrice(p.price)}</span>
          <span class="stock">${p.status || ''}</span>
        </div>

        ${p.remark ? `<div class="remark">${p.remark}</div>` : ''}

        ${orderButton}
      </div>
    `;

    grid.appendChild(card);
  });
}

function changeQty(sku, delta){
  cart[sku] = (cart[sku] || 0) + delta;

  if(cart[sku] <= 0){
    delete cart[sku];
  }

  renderCart();
  renderProducts(getCurrentFilteredProducts());
}

function removeItem(sku){
  delete cart[sku];
  renderCart();
  renderProducts(getCurrentFilteredProducts());
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
      <small>Order Qty: ${qty}</small><br>

      <div class="qtyControls">
        <button onclick="changeQty('${sku}', -1)">-</button>
        <span>${qty}</span>
        <button onclick="changeQty('${sku}', 1)">+</button>
        <button class="remove" onclick="removeItem('${sku}')">Remove</button>
      </div>
    `;

    box.appendChild(row);
  });
}

document.getElementById('search').addEventListener('input', () => {
  renderProducts(getCurrentFilteredProducts());
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

  /* CLEAR CART ONLY AFTER SEND — LOGIN STAYS */
  cart = {};

  renderCart();
  renderProducts(getCurrentFilteredProducts());

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
