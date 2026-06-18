let fitmentDatabase = [];
let fitmentDatabasePromise = null;
let fitmentPageScrollTop = 0;
let fitmentRecommendationRows = [];
let fitmentRecommendationLimit = 6;
let fitmentRecommendationDiameter = "";
let fitmentOrderSku = "";

const FITMENT_SIZE_CATEGORIES = ["14", "15X6.5", "15X7.0", "16X", "17X", "18X", "19X", "20X"];
const FITMENT_SIZE_LABELS = {
  "14":"14",
  "15X6.5":"15X6.5",
  "15X7.0":"15X7 / 7.5 / 8",
  "16X":"16X",
  "17X":"17X",
  "18X":"18X",
  "19X":"19X",
  "20X":"20X"
};

const FITMENT_MANUAL_STORAGE_KEY = "rimFitmentManualSpecs";
const FITMENT_DISCLAIMER = "Fitment and tyre size result is an estimate only. Please confirm with salesperson before purchase.";

function normalizeFitmentKey(value){
  return String(value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function normalizePcd(value){
  const match = String(value || "").toLowerCase().replace(/\s+/g, "").match(/^(\d+)x(\d+(?:\.\d+)?)$/);
  return match ? `${Number(match[1])}x${Number(match[2])}` : "";
}

function normalizeTyreSize(value){
  return String(value || "").toUpperCase().replace(/\s+/g, "");
}

function carDisplayName(car){
  const years = car.yearFrom || car.yearTo
    ? ` (${car.yearFrom || "?"}-${car.yearTo || "present"})`
    : "";
  return `${car.brand} ${car.model} - ${car.generation}${years}`;
}

async function loadFitmentData(){
  if(fitmentDatabase.length > 0) return fitmentDatabase;
  if(fitmentDatabasePromise) return fitmentDatabasePromise;

  fitmentDatabasePromise = fetch("fitment-data.json?refresh=" + Date.now(), { cache:"no-store" })
    .then(response => {
      if(!response.ok) throw new Error("Fitment data request failed");
      return response.json();
    })
    .then(data => {
      if(!Array.isArray(data)) throw new Error("Fitment data is not an array");
      fitmentDatabase = data;
      populateFitmentCarModels();
      return data;
    })
    .catch(error => {
      fitmentDatabasePromise = null;
      throw error;
    });

  return fitmentDatabasePromise;
}

function populateFitmentCarModels(){
  const list = document.getElementById("fitmentCarModels");
  if(!list) return;

  list.innerHTML = "";
  const names = [...new Set(fitmentDatabase.map(car => `${car.brand} ${car.model}`))].sort();
  names.forEach(name => {
    const option = document.createElement("option");
    option.value = name;
    list.appendChild(option);
  });
}

function populateFitmentProductOptions(){
  const select = document.getElementById("fitmentProduct");
  if(!select) return;

  const previousValue = select.value;
  select.innerHTML = '<option value="">Select rim product</option>';

  products.forEach(product => {
    const option = document.createElement("option");
    option.value = product.sku;
    option.textContent = product.description || product.sku;
    select.appendChild(option);
  });

  if(previousValue && products.some(product => product.sku === previousValue)){
    select.value = previousValue;
  }
}

function parseRimSpecs(description){
  const text = String(description || "").toUpperCase();
  const sizeMatch = text.match(/\b(1[3-9]|2[0-4])\s*X\s*(\d(?:\.\d+)?)\b/);
  const etMatch = text.match(/\bET\s*(-?\d+(?:\.\d+)?)\b/);
  const cbMatch = text.match(/\bCB\s*(\d{2,3}(?:\.\d+)?)\b/);
  const pcdMatch = text.match(/\b(4|5|6|8|10|12)\s*X\s*(\d{3}(?:\.\d+)?)(?:\s*\/\s*(\d{3}(?:\.\d+)?))?\b/);
  const pcds = [];

  if(pcdMatch){
    const drilledHoles = Number(pcdMatch[1]);
    const effectiveHoles = pcdMatch[3] && drilledHoles >= 8 ? drilledHoles / 2 : drilledHoles;
    pcds.push(normalizePcd(`${effectiveHoles}x${pcdMatch[2]}`));
    if(pcdMatch[3]) pcds.push(normalizePcd(`${effectiveHoles}x${pcdMatch[3]}`));
  }

  return {
    diameter:sizeMatch ? Number(sizeMatch[1]) : null,
    width:sizeMatch ? Number(sizeMatch[2]) : null,
    pcds,
    pcdText:pcdMatch ? pcdMatch[0].replace(/\s+/g, "") : "",
    et:etMatch ? Number(etMatch[1]) : null,
    cb:cbMatch ? Number(cbMatch[1]) : null
  };
}

function getFitmentMatches(value, enteredYear){
  const raw = String(value || "").trim();
  const queryYearMatch = raw.match(/\b(19|20)\d{2}\b/);
  const year = Number(enteredYear) || (queryYearMatch ? Number(queryYearMatch[0]) : null);
  const query = normalizeFitmentKey(raw.replace(/\b(19|20)\d{2}\b/g, ""));
  const queryWithYear = normalizeFitmentKey(raw);

  if(!query) return [];

  const scored = fitmentDatabase.map((car, index) => {
    const names = [
      `${car.brand} ${car.model}`,
      `${car.brand} ${car.model} ${car.generation}`,
      car.model,
      car.generation,
      ...(car.aliases || [])
    ].map(normalizeFitmentKey).filter(Boolean);

    let score = 0;
    names.forEach(name => {
      if(queryWithYear === name || query === name) score = Math.max(score, 100);
      else if(name.includes(query) || query.includes(name)) score = Math.max(score, 65);
    });

    if(year && score > 0){
      const hasYearRange = Number(car.yearFrom) || Number(car.yearTo);
      const yearMatches = (!car.yearFrom || year >= car.yearFrom) && (!car.yearTo || year <= car.yearTo);
      if(hasYearRange && yearMatches) score += 40;
      else if(hasYearRange && !yearMatches) score -= 80;
    }

    return { car, index, score };
  }).filter(item => item.score > 0).sort((a, b) => b.score - a.score || carDisplayName(a.car).localeCompare(carDisplayName(b.car)));

  if(scored.length === 0) return [];
  const minimumScore = Math.max(40, scored[0].score - 60);
  return scored.filter(item => item.score >= minimumScore);
}

function hideFitmentMatchChooser(){
  document.getElementById("fitmentMatchChooser").classList.add("hidden");
  document.getElementById("fitmentMatchSelect").innerHTML = "";
}

function showFitmentMatchChooser(matches){
  const chooser = document.getElementById("fitmentMatchChooser");
  const select = document.getElementById("fitmentMatchSelect");
  select.innerHTML = '<option value="">Choose the correct car</option>';

  matches.forEach(match => {
    const option = document.createElement("option");
    option.value = String(match.index);
    option.textContent = carDisplayName(match.car);
    select.appendChild(option);
  });

  chooser.classList.remove("hidden");
}

function resolveFitmentCar(){
  const selectedIndex = document.getElementById("fitmentMatchSelect").value;
  if(selectedIndex !== "" && fitmentDatabase[Number(selectedIndex)]){
    return { status:"found", car:fitmentDatabase[Number(selectedIndex)] };
  }

  const matches = getFitmentMatches(
    document.getElementById("fitmentCar").value,
    document.getElementById("fitmentYear").value
  );

  if(matches.length === 0){
    hideFitmentMatchChooser();
    return { status:"not-found", car:null };
  }

  if(matches.length > 1){
    showFitmentMatchChooser(matches);
    return { status:"multiple", car:null };
  }

  hideFitmentMatchChooser();
  return { status:"found", car:matches[0].car };
}

function fitmentRangeResult(value, minimum, maximum, aggressiveMargin){
  if(value === null || !Number.isFinite(minimum) || !Number.isFinite(maximum)){
    return { label:"Cannot detect", level:"unknown" };
  }
  if(value >= minimum && value <= maximum) return { label:"Safe", level:"safe" };
  if(value >= minimum - aggressiveMargin && value <= maximum + aggressiveMargin){
    return { label:"Aggressive / Need confirmation", level:"warn" };
  }
  return { label:"Risky", level:"bad" };
}

function fitmentDiameterResult(value, safeDiameters){
  if(value === null || !Array.isArray(safeDiameters) || safeDiameters.length === 0){
    return { label:"Cannot detect diameter", level:"unknown" };
  }
  if(safeDiameters.includes(value)) return { label:"Suitable", level:"safe" };
  const nearest = Math.min(...safeDiameters.map(size => Math.abs(size - value)));
  return nearest <= 1
    ? { label:"Need confirmation", level:"warn" }
    : { label:"Risky", level:"bad" };
}

function getCarTyreSizes(car, diameter){
  if(diameter === null || !car.tyreSizes) return [];
  return car.tyreSizes[String(diameter)] || car.tyreSizes[diameter] || [];
}

function evaluateFitment(product, car, enteredTyre, note, manualMode = false){
  const specs = parseRimSpecs(product.description || "");
  const warnings = [];
  const missing = [];
  const carPcd = normalizePcd(car.pcd);

  let pcd = { label:"Cannot detect PCD", level:"unknown" };
  if(specs.pcds.length === 0){
    missing.push("PCD");
  }else if(!carPcd){
    pcd = { label:"Car PCD needs confirmation", level:"unknown" };
  }else if(specs.pcds.includes(carPcd)){
    pcd = { label:`Match (${specs.pcdText})`, level:"safe" };
  }else{
    pcd = { label:`Not match (${specs.pcdText} vs ${carPcd})`, level:"bad" };
  }

  let centerBore = { label:"Cannot detect CB, please confirm with salesperson", level:"unknown" };
  const carCb = Number(car.centerBore);
  if(specs.cb === null){
    missing.push("CB");
  }else if(!Number.isFinite(carCb) || carCb <= 0){
    centerBore = { label:"Car CB needs confirmation", level:"unknown" };
  }else if(specs.cb + 0.05 < carCb){
    centerBore = { label:`Rim CB ${specs.cb} is smaller than car CB ${carCb} - not suitable unless machine bore`, level:"bad" };
  }else if(Math.abs(specs.cb - carCb) <= 0.15){
    centerBore = { label:`Match (${specs.cb})`, level:"safe" };
  }else{
    centerBore = { label:`Rim CB ${specs.cb} is bigger - hub ring needed for ${carCb}`, level:"safe" };
    warnings.push("Need hub ring.");
  }

  const offset = fitmentRangeResult(specs.et, Number(car.safeOffsetMin), Number(car.safeOffsetMax), 5);
  const width = fitmentRangeResult(specs.width, Number(car.safeWidthMin), Number(car.safeWidthMax), 0.5);
  const diameter = fitmentDiameterResult(specs.diameter, car.safeRimDiameter || []);

  if(specs.et === null) missing.push("ET");
  if(specs.width === null) missing.push("width");
  if(specs.diameter === null) missing.push("diameter");
  if(offset.level === "warn") warnings.push("Offset is aggressive; check fender clearance.");
  if(offset.level === "bad") warnings.push("Offset is risky; check brake and fender clearance.");
  if(width.level === "warn") warnings.push("Rim width is aggressive; check fender clearance.");
  if(width.level === "bad") warnings.push("Rim width is risky.");
  if(diameter.level === "warn") warnings.push("Rim diameter needs clearance confirmation.");
  if(diameter.level === "bad") warnings.push("Rim diameter is outside the safe range.");
  if(/lowered|sport\s*spring/i.test(note)) warnings.push("May rub if lowered.");
  if(/big\s*brake/i.test(note)) warnings.push("Check brake clearance.");
  if(car.needsConfirmation) warnings.push("Fitment data for this car may be incomplete. Please confirm with salesperson.");
  if(manualMode) warnings.push("This result is based on the specs entered by customer. Please confirm with salesperson before purchase.");

  const recommendations = getCarTyreSizes(car, specs.diameter).map(normalizeTyreSize);
  const bestTyre = recommendations.length > 1 ? recommendations[1] : (recommendations[0] || "");
  let tyre = { label:enteredTyre ? "Cannot check" : "Not entered", level:"unknown" };

  if(enteredTyre){
    const normalizedTyre = normalizeTyreSize(enteredTyre);
    if(recommendations.includes(normalizedTyre)){
      tyre = { label:"Recommended", level:"safe" };
    }else if(recommendations.length > 0 && normalizedTyre.match(/R(\d{2})$/) && specs.diameter === Number(normalizedTyre.match(/R(\d{2})$/)[1])){
      tyre = { label:"Usable but check clearance", level:"warn" };
      warnings.push("Customer tyre size needs clearance confirmation.");
    }else if(recommendations.length > 0){
      tyre = { label:"Not recommended", level:"bad" };
    }
  }

  if(recommendations.length === 0){
    warnings.push("No tyre size recommendation found for this rim diameter. Please confirm with salesperson.");
  }
  if(missing.length > 0){
    warnings.push("Some rim specs cannot be detected from this product description. Please confirm with salesperson.");
  }

  const levels = [pcd.level, centerBore.level, offset.level, width.level, diameter.level];
  const hardFailure = levels.includes("bad");
  const needsConfirmation = levels.includes("unknown") || levels.includes("warn") || tyre.level === "warn" || tyre.level === "bad" || car.needsConfirmation;
  const overall = hardFailure ? "Not suitable" : (needsConfirmation ? "Need salesperson confirmation" : "Likely suitable");
  const overallClass = hardFailure ? "bad" : (needsConfirmation ? "warn" : "good");

  warnings.push("Final confirmation by salesperson required.");

  return {
    product,
    car,
    specs,
    pcd,
    centerBore,
    offset,
    width,
    diameter,
    tyre,
    recommendations,
    bestTyre,
    warnings:[...new Set(warnings)],
    overall,
    overallClass,
    manualMode
  };
}

function renderFitmentMessage(message, showManual = false){
  const result = document.getElementById("fitmentResult");
  result.innerHTML = `
    <div class="fitmentOverall warn">Need salesperson confirmation</div>
    <div class="fitmentNotice">${escapeHtml(message)}</div>
    <p class="fitmentDisclaimer">${escapeHtml(FITMENT_DISCLAIMER)}</p>
  `;
  result.classList.remove("hidden");
  document.getElementById("showManualFitmentButton").classList.toggle("hidden", !showManual);
}

function renderFitmentEvaluation(evaluation){
  const result = document.getElementById("fitmentResult");
  const car = evaluation.car;
  const carName = evaluation.manualMode ? "Customer Manual Specs" : carDisplayName(car);
  const tyreList = evaluation.recommendations.length > 0
    ? `<ul>${evaluation.recommendations.map(size => `<li>${escapeHtml(size)}</li>`).join("")}</ul>`
    : "<p>No tyre size recommendation found for this rim diameter. Please confirm with salesperson.</p>";
  const confirmationNotice = car.needsConfirmation
    ? '<div class="fitmentNotice">Fitment data for this car may be incomplete. Please confirm with salesperson.</div>'
    : "";

  result.innerHTML = `
    <div class="fitmentOverall ${evaluation.overallClass}">${evaluation.manualMode ? "Manual fitment check result" : "Estimated result"}: ${escapeHtml(evaluation.overall)}</div>
    ${confirmationNotice}
    <div class="fitmentCheckRow"><strong>Rim</strong><span>${escapeHtml(evaluation.product.description || evaluation.product.sku)}</span></div>
    <div class="fitmentCheckRow"><strong>Car</strong><span>${escapeHtml(carName)}</span></div>
    <div class="fitmentCheckRow"><strong>PCD</strong><span>${escapeHtml(evaluation.pcd.label)}</span></div>
    <div class="fitmentCheckRow"><strong>Center Bore</strong><span>${escapeHtml(evaluation.centerBore.label)}</span></div>
    <div class="fitmentCheckRow"><strong>Offset</strong><span>${escapeHtml(evaluation.offset.label)}${evaluation.specs.et !== null ? ` (ET${evaluation.specs.et})` : ""}</span></div>
    <div class="fitmentCheckRow"><strong>Rim Width</strong><span>${escapeHtml(evaluation.width.label)}${evaluation.specs.width !== null ? ` (${evaluation.specs.width} inch)` : ""}</span></div>
    <div class="fitmentCheckRow"><strong>Rim Diameter</strong><span>${escapeHtml(evaluation.diameter.label)}${evaluation.specs.diameter !== null ? ` (${evaluation.specs.diameter} inch)` : ""}</span></div>
    <div class="fitmentCheckRow"><strong>Tyre Entered</strong><span>${escapeHtml(evaluation.tyre.label)}</span></div>
    <div class="fitmentSection">
      <h4>Recommended Tyre Sizes</h4>
      ${tyreList}
      ${evaluation.bestTyre ? `<p><strong>Best common size:</strong> ${escapeHtml(evaluation.bestTyre)}</p>` : ""}
    </div>
    <div class="fitmentSection">
      <h4>Warning Notes</h4>
      <ul>${evaluation.warnings.map(item => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
    </div>
    <p class="fitmentDisclaimer">${escapeHtml(FITMENT_DISCLAIMER)}</p>
  `;
  result.classList.remove("hidden");
  document.getElementById("showManualFitmentButton").classList.add("hidden");
}

async function runFitmentCheck(){
  const product = products.find(item => item.sku === document.getElementById("fitmentProduct").value);
  if(!product){
    renderFitmentMessage("Please select a rim product.");
    return;
  }

  try{
    await loadFitmentData();
  }catch(error){
    renderFitmentMessage("Fitment database cannot be loaded. Please try again later or confirm with salesperson.", true);
    return;
  }

  const resolved = resolveFitmentCar();
  if(resolved.status === "not-found"){
    renderFitmentMessage("Car model not found in fitment database. You can enter car fitment specs manually or confirm with salesperson.", true);
    return;
  }
  if(resolved.status === "multiple"){
    renderFitmentMessage("Multiple car generations match. Please choose the correct generation/year above, then check again.");
    return;
  }

  const evaluation = evaluateFitment(
    product,
    resolved.car,
    document.getElementById("fitmentTyre").value,
    document.getElementById("fitmentNote").value
  );
  renderFitmentEvaluation(evaluation);
}

function readManualFitmentForm(){
  const diameters = document.getElementById("manualDiameters").value
    .split(",")
    .map(value => Number(value.trim()))
    .filter(Number.isFinite);
  const tyreSizes = document.getElementById("manualTyreSizes").value
    .split(",")
    .map(normalizeTyreSize)
    .filter(Boolean);
  const tyreMap = {};
  diameters.forEach(size => { tyreMap[String(size)] = tyreSizes.filter(tyre => tyre.endsWith(`R${size}`)); });

  return {
    brand:"Manual",
    model:"Customer Specs",
    generation:"Customer entered",
    yearFrom:null,
    yearTo:null,
    aliases:[],
    pcd:normalizePcd(document.getElementById("manualPcd").value),
    centerBore:Number(document.getElementById("manualCenterBore").value) || null,
    safeRimDiameter:diameters,
    safeWidthMin:Number(document.getElementById("manualWidthMin").value) || null,
    safeWidthMax:Number(document.getElementById("manualWidthMax").value) || null,
    safeOffsetMin:Number(document.getElementById("manualOffsetMin").value) || null,
    safeOffsetMax:Number(document.getElementById("manualOffsetMax").value) || null,
    tyreSizes:tyreMap,
    manualTyreSizes:tyreSizes,
    notes:document.getElementById("manualNotes").value.trim(),
    needsConfirmation:true
  };
}

function saveManualFitmentSpecs(specs){
  localStorage.setItem(FITMENT_MANUAL_STORAGE_KEY, JSON.stringify(specs));
}

function fillManualFitmentForm(specs){
  if(!specs) return;
  document.getElementById("manualPcd").value = specs.pcd || "";
  document.getElementById("manualCenterBore").value = specs.centerBore || "";
  document.getElementById("manualDiameters").value = (specs.safeRimDiameter || []).join(", ");
  document.getElementById("manualWidthMin").value = specs.safeWidthMin || "";
  document.getElementById("manualWidthMax").value = specs.safeWidthMax || "";
  document.getElementById("manualOffsetMin").value = specs.safeOffsetMin || "";
  document.getElementById("manualOffsetMax").value = specs.safeOffsetMax || "";
  document.getElementById("manualTyreSizes").value = (specs.manualTyreSizes || Object.values(specs.tyreSizes || {}).flat()).join(", ");
  document.getElementById("manualNotes").value = specs.notes || "";
}

function loadManualFitmentSpecs(){
  try{
    const saved = JSON.parse(localStorage.getItem(FITMENT_MANUAL_STORAGE_KEY) || "null");
    fillManualFitmentForm(saved);
  }catch(error){
    localStorage.removeItem(FITMENT_MANUAL_STORAGE_KEY);
  }
}

function showManualFitmentForm(){
  document.getElementById("manualFitmentForm").classList.remove("hidden");
  document.getElementById("showManualFitmentButton").classList.add("hidden");
  loadManualFitmentSpecs();
  document.getElementById("manualPcd").focus();
}

function clearManualFitmentSpecs(){
  localStorage.removeItem(FITMENT_MANUAL_STORAGE_KEY);
  document.querySelectorAll("#manualFitmentForm input, #manualFitmentForm textarea").forEach(field => { field.value = ""; });
  renderFitmentMessage("Saved manual specs cleared.", true);
}

function runManualFitmentCheck(){
  const product = products.find(item => item.sku === document.getElementById("fitmentProduct").value);
  if(!product){
    renderFitmentMessage("Please select a rim product.", true);
    return;
  }

  const manualCar = readManualFitmentForm();
  if(!manualCar.pcd){
    renderFitmentMessage("Please enter a valid car PCD, for example 4x100 or 5x114.3.", true);
    return;
  }

  saveManualFitmentSpecs(manualCar);
  const note = [document.getElementById("fitmentNote").value, manualCar.notes].filter(Boolean).join("; ");
  renderFitmentEvaluation(evaluateFitment(product, manualCar, document.getElementById("fitmentTyre").value, note, true));
}

function recommendationForProduct(product, car){
  const specs = parseRimSpecs(product.description || "");
  const carPcd = normalizePcd(car.pcd);
  if(!carPcd || !specs.pcds.includes(carPcd)) return null;
  if(specs.cb === null || !Number.isFinite(Number(car.centerBore)) || specs.cb + 0.05 < Number(car.centerBore)) return null;

  const diameter = fitmentDiameterResult(specs.diameter, car.safeRimDiameter || []);
  const width = fitmentRangeResult(specs.width, Number(car.safeWidthMin), Number(car.safeWidthMax), 0.5);
  const offset = fitmentRangeResult(specs.et, Number(car.safeOffsetMin), Number(car.safeOffsetMax), 5);
  if([diameter.level, width.level, offset.level].some(level => level === "bad" || level === "unknown")) return null;

  const aggressive = [diameter.level, width.level, offset.level].includes("warn");
  const score = (diameter.level === "safe" ? 4 : 2) + (width.level === "safe" ? 4 : 2) + (offset.level === "safe" ? 4 : 2) + (specs.cb === Number(car.centerBore) ? 2 : 1);
  return { product, specs, aggressive, score };
}

function getFitmentSizeCategory(item){
  if(FITMENT_SIZE_CATEGORIES.includes(item.product.category)) return item.product.category;

  const diameter = Number(item.specs.diameter);
  const width = Number(item.specs.width);
  if(diameter === 14) return "14";
  if(diameter === 15) return width <= 6.5 ? "15X6.5" : "15X7.0";
  if(diameter >= 16 && diameter <= 20) return `${diameter}X`;
  return "";
}

function dedupeFitmentRecommendations(rows){
  const uniqueRows = new Map();

  rows.forEach(item => {
    const key = String(item.product.description || item.product.sku)
      .trim()
      .replace(/\s+/g, " ")
      .toUpperCase();
    const existing = uniqueRows.get(key);
    const itemIsSizeCategory = FITMENT_SIZE_CATEGORIES.includes(item.product.category);
    const existingIsSizeCategory = existing && FITMENT_SIZE_CATEGORIES.includes(existing.product.category);

    if(!existing || (itemIsSizeCategory && !existingIsSizeCategory)){
      uniqueRows.set(key, item);
    }
  });

  return [...uniqueRows.values()];
}

function scrollFitmentProductIntoView(sku, focusBranchInput = false){
  setTimeout(() => {
    const card = document.querySelector(`.fitmentProductCard[data-fitment-sku="${sku}"]`);
    if(!card) return;

    card.scrollIntoView({ behavior:"smooth", block:"center" });

    if(focusBranchInput){
      const input = card.querySelector("input[data-fitment-branch-name]");
      if(input){
        input.focus();
        input.select();
      }
    }
  }, 50);
}

function renderFitmentOrderControls(product){
  const sku = escapeHtml(product.sku);
  const cartQty = getCartQty(product.sku);

  if(fitmentOrderSku === product.sku && getActiveBranchNames().length > 0){
    const branches = getCartBranches(product.sku);
    const rows = getActiveBranchNames().map(name => `
      <div class="fitmentBranchQtyRow">
        <label>${escapeHtml(name)}</label>
        <div class="fitmentQtyControls">
          <button type="button" data-fitment-branch-step="-1">-</button>
          <input type="number" min="0" inputmode="numeric" value="${branches[name] || ""}" data-fitment-branch-name="${escapeHtml(name)}" placeholder="0">
          <button type="button" data-fitment-branch-step="1">+</button>
        </div>
      </div>
    `).join("");

    return `
      <div class="fitmentBranchEditor">
        <h6>Branch Qty</h6>
        ${rows}
        <div class="fitmentBranchActions">
          <button type="button" data-fitment-save-order="${sku}">Update Cart</button>
          <button type="button" data-fitment-cancel-order="${sku}">Cancel</button>
        </div>
      </div>
    `;
  }

  if(cartQty > 0){
    if(getActiveBranchNames().length > 0){
      return `<button type="button" data-fitment-start-order="${sku}">Update Cart</button>`;
    }

    return `
      <div class="fitmentQtyControls">
        <button type="button" data-fitment-qty-step="-1" data-fitment-sku="${sku}">-</button>
        <input type="number" min="1" inputmode="numeric" value="${cartQty}" data-fitment-qty-input="${sku}">
        <button type="button" data-fitment-qty-step="1" data-fitment-sku="${sku}">+</button>
      </div>
    `;
  }

  return `<button type="button" data-fitment-start-order="${sku}">Add to Cart</button>`;
}

function renderFitmentRecommendations(){
  const result = document.getElementById("fitmentResult");
  const availableCategories = FITMENT_SIZE_CATEGORIES.filter(category =>
    fitmentRecommendationRows.some(item => getFitmentSizeCategory(item) === category)
  );
  const filteredRows = fitmentRecommendationDiameter
    ? fitmentRecommendationRows.filter(item => getFitmentSizeCategory(item) === fitmentRecommendationDiameter)
    : fitmentRecommendationRows;
  const visible = filteredRows.slice(0, fitmentRecommendationLimit);

  if(fitmentRecommendationRows.length === 0){
    result.innerHTML = `
      <div class="fitmentOverall warn">Recommended Rim Products From Catalogue</div>
      <div class="fitmentNotice">No suitable rim product found in current catalogue. Please confirm with salesperson.</div>
      <p class="fitmentDisclaimer">${escapeHtml(FITMENT_DISCLAIMER)}</p>
    `;
    result.classList.remove("hidden");
    return;
  }

  const cards = visible.map(item => {
    const specs = item.specs;
    const photo = getDriveImageTag(item.product, "front", 'loading="lazy" decoding="async"') || '<span>No photo</span>';
    const reason = item.aggressive
      ? "Possible fit, but aggressive. Please confirm with salesperson."
      : "Recommended because PCD matches, width is safe, and ET is within range.";
    return `
      <article class="fitmentProductCard" data-fitment-sku="${escapeHtml(item.product.sku)}">
        <div class="fitmentProductMain">
          <div class="fitmentProductPhoto">${photo}</div>
          <div class="fitmentProductBody">
            <h5>${escapeHtml(item.product.description || item.product.sku)}</h5>
            <div class="fitmentProductSpecs">
              <span class="fitmentBadge good">${escapeHtml(specs.pcdText)}</span>
              <span class="fitmentBadge ${item.aggressive ? "warn" : "good"}">${specs.diameter || "?"}X${specs.width || "?"}</span>
              <span class="fitmentBadge ${item.aggressive ? "warn" : "good"}">ET${specs.et ?? "?"}</span>
              <span class="fitmentBadge good">CB${specs.cb ?? "?"}</span>
            </div>
            <p class="fitmentProductReason">${escapeHtml(reason)}</p>
            ${item.aggressive ? '<p class="fitmentProductWarning">Aggressive fitment. Check clearance.</p>' : ""}
          </div>
        </div>
        <div class="fitmentProductActions${fitmentOrderSku === item.product.sku ? " fitmentOrderOpen" : ""}">
          <button type="button" data-fitment-open="${escapeHtml(item.product.sku)}">Open Product</button>
          <div class="fitmentProductOrder">${renderFitmentOrderControls(item.product)}</div>
        </div>
      </article>
    `;
  }).join("");

  const filterOptions = availableCategories
    .map(category => `<option value="${category}"${fitmentRecommendationDiameter === category ? " selected" : ""}>${FITMENT_SIZE_LABELS[category]}</option>`)
    .join("");
  const emptyFilterMessage = visible.length === 0
    ? '<div class="fitmentNotice">No suitable rim product found for this inch. Try another inch or All Inch.</div>'
    : "";

  result.innerHTML = `
    <div class="fitmentOverall good">Recommended Rim Products From Catalogue</div>
    <label class="fitmentInchFilter">Filter Inch
      <select data-fitment-inch-filter>
        <option value="">ALL</option>
        ${filterOptions}
      </select>
    </label>
    <p>Showing ${visible.length} of ${filteredRows.length} likely suitable catalogue products.</p>
    ${emptyFilterMessage}
    <div class="fitmentRecommendations">${cards}</div>
    ${filteredRows.length > fitmentRecommendationLimit ? '<button class="fitmentShowMoreButton" type="button" data-fitment-show-more>Show More</button>' : ""}
    <p class="fitmentDisclaimer">${escapeHtml(FITMENT_DISCLAIMER)}</p>
  `;
  result.classList.remove("hidden");
}

async function findSuitableRims(){
  try{
    await loadFitmentData();
  }catch(error){
    renderFitmentMessage("Fitment database cannot be loaded. Please try again later or confirm with salesperson.", true);
    return;
  }

  let car = null;
  let manualMode = false;
  const resolved = resolveFitmentCar();

  if(resolved.status === "found"){
    car = resolved.car;
  }else if(!document.getElementById("manualFitmentForm").classList.contains("hidden")){
    car = readManualFitmentForm();
    manualMode = true;
  }else if(resolved.status === "multiple"){
    renderFitmentMessage("Multiple car generations match. Please choose the correct generation/year above, then search again.");
    return;
  }else{
    renderFitmentMessage("Car model not found in fitment database. You can enter car fitment specs manually or confirm with salesperson.", true);
    return;
  }

  if(!normalizePcd(car.pcd)){
    renderFitmentMessage(manualMode
      ? "Please enter valid manual fitment specs before searching the catalogue."
      : "Fitment data for this car is incomplete. Enter manual specs or confirm with salesperson.", true);
    return;
  }

  if(manualMode) saveManualFitmentSpecs(car);
  fitmentRecommendationRows = dedupeFitmentRecommendations(products
    .filter(product => !isSoldOut(product))
    .map(product => recommendationForProduct(product, car))
    .filter(Boolean))
    .sort((a, b) =>
      (a.specs.diameter ?? Infinity) - (b.specs.diameter ?? Infinity) ||
      (a.specs.width ?? Infinity) - (b.specs.width ?? Infinity) ||
      b.score - a.score ||
      String(a.product.description).localeCompare(String(b.product.description))
    );
  fitmentRecommendationLimit = 6;
  fitmentRecommendationDiameter = "";
  fitmentOrderSku = "";
  renderFitmentRecommendations();
}

function revealFitmentProduct(sku, openViewer){
  currentCategory = "ALL";
  currentPcdFilter = "";
  document.getElementById("search").value = "";
  updateActiveButtons();
  showCachedCategory();
  scrollProductCardIntoView(sku);
  if(openViewer) setTimeout(() => openPhotoViewer(sku), 220);
}

async function openFitmentModal(selectedSku = ""){
  populateFitmentProductOptions();
  if(selectedSku && products.some(product => product.sku === selectedSku)){
    document.getElementById("fitmentProduct").value = selectedSku;
  }

  fitmentPageScrollTop = window.pageYOffset;
  document.body.style.top = `-${fitmentPageScrollTop}px`;
  document.body.classList.add("fitmentModalOpen");
  document.getElementById("fitmentModal").classList.remove("hidden");
  document.getElementById("fitmentResult").classList.add("hidden");
  document.getElementById("showManualFitmentButton").classList.add("hidden");
  document.getElementById("manualFitmentForm").classList.add("hidden");
  hideFitmentMatchChooser();

  try{
    await loadFitmentData();
  }catch(error){
    renderFitmentMessage("Fitment database cannot be loaded. Please try again later or confirm with salesperson.", true);
  }

  document.getElementById("fitmentCar").focus();
}

function closeFitmentModal(){
  document.getElementById("fitmentModal").classList.add("hidden");
  document.body.classList.remove("fitmentModalOpen");
  document.body.style.top = "";
  window.scrollTo(0, fitmentPageScrollTop);
}

function resetFitmentState(){
  ["fitmentCar", "fitmentYear", "fitmentTyre", "fitmentNote"].forEach(id => {
    document.getElementById(id).value = "";
  });
  document.getElementById("fitmentProduct").value = "";
  document.querySelectorAll("#manualFitmentForm input, #manualFitmentForm textarea").forEach(field => {
    field.value = "";
  });
  document.getElementById("manualFitmentForm").classList.add("hidden");
  document.getElementById("showManualFitmentButton").classList.add("hidden");
  document.getElementById("fitmentResult").innerHTML = "";
  document.getElementById("fitmentResult").classList.add("hidden");
  hideFitmentMatchChooser();
  fitmentRecommendationRows = [];
  fitmentRecommendationLimit = 6;
  fitmentRecommendationDiameter = "";
  fitmentOrderSku = "";
}

document.getElementById("aiFitmentButton").onclick = () => openFitmentModal();
document.getElementById("closeFitmentButton").onclick = closeFitmentModal;
document.getElementById("cancelFitmentButton").onclick = closeFitmentModal;
document.getElementById("runFitmentButton").onclick = runFitmentCheck;
document.getElementById("findFitmentProductsButton").onclick = findSuitableRims;
document.getElementById("showManualFitmentButton").onclick = showManualFitmentForm;
document.getElementById("runManualFitmentButton").onclick = runManualFitmentCheck;
document.getElementById("clearManualFitmentButton").onclick = clearManualFitmentSpecs;
document.getElementById("fitmentCar").addEventListener("input", hideFitmentMatchChooser);
document.getElementById("fitmentYear").addEventListener("input", hideFitmentMatchChooser);
document.getElementById("fitmentResult").addEventListener("change", event => {
  if(event.target.matches("[data-fitment-inch-filter]")){
    fitmentRecommendationDiameter = event.target.value;
    fitmentRecommendationLimit = 6;
    renderFitmentRecommendations();
    return;
  }

  if(event.target.matches("[data-fitment-qty-input]")){
    const sku = event.target.dataset.fitmentQtyInput;
    setCartQty(sku, event.target.value);
    renderCart();
    updateProductOrderArea(sku);
    renderFitmentRecommendations();
    scrollFitmentProductIntoView(sku);
  }
});
document.getElementById("fitmentModal").addEventListener("click", event => {
  if(event.target.id === "fitmentModal") closeFitmentModal();

  const openButton = event.target.closest("[data-fitment-open]");
  if(openButton){
    const sku = openButton.dataset.fitmentOpen;
    closeFitmentModal();
    revealFitmentProduct(sku, true);
    return;
  }

  const startOrderButton = event.target.closest("[data-fitment-start-order]");
  if(startOrderButton){
    const sku = startOrderButton.dataset.fitmentStartOrder;
    if(getActiveBranchNames().length > 0){
      fitmentOrderSku = sku;
      renderFitmentRecommendations();
      scrollFitmentProductIntoView(sku, true);
    }else{
      setCartQty(sku, 1);
      renderCart();
      updateProductOrderArea(sku);
      renderFitmentRecommendations();
      scrollFitmentProductIntoView(sku);
    }
    return;
  }

  const qtyStepButton = event.target.closest("[data-fitment-qty-step]");
  if(qtyStepButton){
    const sku = qtyStepButton.dataset.fitmentSku;
    const delta = Number(qtyStepButton.dataset.fitmentQtyStep) || 0;
    if(getActiveBranchNames().length > 0){
      fitmentOrderSku = sku;
      renderFitmentRecommendations();
      scrollFitmentProductIntoView(sku, true);
    }else{
      setCartQty(sku, getCartQty(sku) + delta);
      renderCart();
      updateProductOrderArea(sku);
      renderFitmentRecommendations();
      scrollFitmentProductIntoView(sku);
    }
    return;
  }

  const branchStepButton = event.target.closest("[data-fitment-branch-step]");
  if(branchStepButton){
    const input = branchStepButton.parentElement.querySelector("input[data-fitment-branch-name]");
    const nextQty = Math.max(0, (parseInt(input.value, 10) || 0) + (Number(branchStepButton.dataset.fitmentBranchStep) || 0));
    input.value = nextQty > 0 ? nextQty : "";
    return;
  }

  const saveOrderButton = event.target.closest("[data-fitment-save-order]");
  if(saveOrderButton){
    const sku = saveOrderButton.dataset.fitmentSaveOrder;
    const card = saveOrderButton.closest(".fitmentProductCard");
    const branches = {};
    let total = 0;
    card.querySelectorAll("input[data-fitment-branch-name]").forEach(input => {
      const qty = parseInt(input.value, 10) || 0;
      if(qty > 0){
        branches[input.dataset.fitmentBranchName] = qty;
        total += qty;
      }
    });

    if(total <= 0){
      alert("Please enter branch quantity.");
      return;
    }

    cart[sku] = { qty:total, branches };
    fitmentOrderSku = "";
    renderCart();
    updateProductOrderArea(sku);
    renderFitmentRecommendations();
    scrollFitmentProductIntoView(sku);
    return;
  }

  const cancelOrderButton = event.target.closest("[data-fitment-cancel-order]");
  if(cancelOrderButton){
    const sku = cancelOrderButton.dataset.fitmentCancelOrder;
    fitmentOrderSku = "";
    renderFitmentRecommendations();
    scrollFitmentProductIntoView(sku);
    return;
  }

  if(event.target.closest("[data-fitment-show-more]")){
    fitmentRecommendationLimit += 6;
    renderFitmentRecommendations();
  }
});

document.addEventListener("keydown", event => {
  if(event.key === "Escape" && !document.getElementById("fitmentModal").classList.contains("hidden")){
    closeFitmentModal();
  }
});

loadFitmentData().catch(() => {});
