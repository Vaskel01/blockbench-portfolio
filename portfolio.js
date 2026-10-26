/* ============================================================
   EDIT HERE: your details, packs and portfolio pieces
   ============================================================ */
const SITE = {
  name: "Vaskel",                                 // display name buyers greet you by
  instagram: "vaskel01",                          // Instagram handle, no @
  discord: "vaskelll",                            // Discord username buyers should DM
  discordId: "",                                  // optional: numeric Discord user ID, adds an "Open profile" button
  sketchfab: "https://sketchfab.com/Vaskel",
  fiverr: "https://www.fiverr.com/s/bkkKE1k",     // commissions
  edition: "Java Edition",
  currency: "USD",
  symbol: "$"
};

// Badge color per category
const CAT = { "Weapons":"var(--red)", "Tools":"var(--blue)", "Props":"#d9861c", "Pets":"var(--purple)", "Items & props":"#2a9d80" };

// price: a number like 15, or null to show "Ask for price".
// buy:   a checkout link (Gumroad, Payhip, Ko-fi...) adds a "Buy now" button. "" = buy through Discord.
// sketchfab: the model id from its Sketchfab URL (sketchfab.com/3d-models/name-<id>) shows a 3D viewer; "" = render image.
const PACKS = [
  { id:"wushu", name:"Wushu Weapons Pack", cat:"Weapons", price:15, buy:"", sketchfab:"0e00750ad446432ea0aafea903889c86",
    img:"renders/wushu.webp", thumb:"renders/wushu-thumb.webp", bg:"#657862",
    alt:"Twelve Chinese martial arts weapons: straight swords and curved sabers on top, tridents, spears and a bamboo staff below",
    blurb:"Twelve weapons from Chinese martial arts: straight jian swords, curved dao sabers, tridents, a red-tassel spear and a bamboo staff.",
    includes:["Jian swords","Dao sabers","Tridents","Red-tassel spear","Bamboo staff","12 weapons"] },
  { id:"pumpkins", name:"Vaskel's Pumpkins", cat:"Props", price:9.99, buy:"", sketchfab:"7fc15ce3c3ae4961a5727ad6ce855365",
    img:"renders/pumpkins.webp", thumb:"renders/pumpkins-thumb.webp", bg:"#f88620",
    alt:"Carved pumpkins in green, white and orange, in small, medium and large sizes",
    blurb:"Carved jack o'lanterns for autumn and Halloween builds, in three sizes and three colors.",
    includes:["Small, medium & large","Orange, green & white","Carved faces"] },
  { id:"staffs-2", name:"Vaskel's Magic Staffs Pack II", cat:"Weapons", price:15, buy:"", sketchfab:"443285e481d1423c8ea5cb5b860db4e7",
    img:"renders/staffs.webp", thumb:"renders/staffs-thumb.webp", bg:"#747c9d",
    alt:"Rows of magic staffs in many colors: lantern, crystal, ring and winged gem designs",
    blurb:"A big set of magic staffs for mage classes and loot tables. Every design comes in three colorways.",
    includes:["Lantern staffs","Crystal staffs","Ring staffs","Winged gem staffs","3 colorways each"] },
  { id:"adventurer", name:"Adventurer's Essentials Kit", cat:"Items & props", price:15, buy:"", sketchfab:"26f7403fef05419e8cbdc9d19df791d2",
    img:"renders/workshop.webp", thumb:"renders/workshop-thumb.webp", bg:"#fffa97",
    alt:"Wooden desk covered in scrolls and potion jars, with a battle axe, a greatsword and gem blocks around it",
    blurb:"Gear for an adventurer's table: scrolls and maps, potion jars, banners and gem blocks, plus a battle axe and a greatsword.",
    includes:["Wooden table","Scrolls & maps","Potion jars","Banners","Gem blocks","Battle axe","Greatsword"] },
  { id:"phase-tools", name:"Phase Tools Bundle", cat:"Tools", price:15, buy:"", sketchfab:"bff733e2fbf54d3f8d4c12a15d0e282f",
    img:"renders/gear.webp", thumb:"renders/gear-thumb.webp", bg:"#c9fff7",
    alt:"Bow, shovel, axe, sword, hoe, pickaxe and shield with crystal heads, in purple, cyan and lime",
    blurb:"A matching set of crystal-tipped tools and weapons in three colorways. Good for a custom tier or a seasonal reward.",
    includes:["Sword","Pickaxe","Axe","Shovel","Hoe","Bow","Shield","Purple, cyan & lime"] },
  { id:"staffs-1", name:"Vaskel's Magic Staffs Pack", cat:"Weapons", price:15, buy:"", sketchfab:"bc742a5a4ae14ad5b6933d49fb1f7b7e",
    img:"renders/staffs1.webp", thumb:"renders/staffs1-thumb.webp", bg:"#fdb8ff",
    alt:"Eight magic staffs with glowing crystal heads in different colors",
    blurb:"The original staffs pack: eight magic staffs, each with its own crystal head and color scheme.",
    includes:["8 staffs","Glowing crystal heads"] }
];

// Portfolio, in order. Use a pack id to reuse that pack's render, or give an image for work that isn't for sale.
const WORK_LIST = [
  { pack:"adventurer" },
  { pack:"wushu" },
  { img:"renders/pets.webp", name:"Companion pets", cat:"Pets", bg:"#64a8e5", sketchfab:"e3bf7e8e37a14b5fbaff6853f5dc1d0a", alt:"Six cute creature models including a penguin, a pink bunny and a flame spirit" },
  { pack:"staffs-2" },
  { pack:"pumpkins" },
  { img:"renders/scifi.webp", name:"Sci-fi cargo set", cat:"Props", bg:"#72b9b1", sketchfab:"c192278b735248cf95cc99d7a79dc7e6", alt:"Sci-fi storage lockers with green screens, cargo cases and tall supply containers, with a player model for scale" },
  { pack:"phase-tools" },
  { pack:"staffs-1" }
];
/* ============================================================ */

const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const packById = id => PACKS.find(p => p.id === id);
const money = n => SITE.symbol + (Number.isInteger(n) ? n : n.toFixed(2));
const hasPrice = p => typeof p.price === 'number';
const badge = c => `<span class="badge px" style="--cat:${CAT[c] || 'var(--red)'}">${esc(c)}</span>`;
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const ARROW = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3h8v8M13 3 3 13" stroke="currentColor" stroke-width="2.4" fill="none"/></svg>';
const WORK = WORK_LIST.map(w => w.pack ? {...packById(w.pack), ...w} : w);
const PACK_SHOTS = PACKS.filter(p => p.img).map(p => ({...p, pack:p.id}));

/* ---------- links + handles ---------- */
const igUrl = `https://www.instagram.com/${encodeURIComponent(SITE.instagram)}/`;
$$('[data-ig]').forEach(a => a.href = igUrl);
$$('[data-sf]').forEach(a => a.href = SITE.sketchfab);
$$('[data-fiverr]').forEach(a => a.href = SITE.fiverr);
$$('[data-ig-handle]').forEach(el => el.textContent = '@' + SITE.instagram);
$$('[data-dc-user]').forEach(el => el.textContent = SITE.discord);
const dcProfile = SITE.discordId ? `https://discord.com/users/${encodeURIComponent(SITE.discordId)}` : '';

/* ---------- toast + copy ---------- */
let toastT;
function toast(msg){
  const t = $('#toast'); t.textContent = msg; t.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
}
function selectEl(el){
  if (!el) return;
  if (el.select) { el.focus(); el.select(); return; }
  const r = document.createRange(); r.selectNodeContents(el);
  const s = getSelection(); s.removeAllRanges(); s.addRange(r);
}
function copy(text, label, fallbackEl){
  try {
    navigator.clipboard.writeText(text).then(
      () => toast(label + ' copied'),
      () => { selectEl(fallbackEl); toast('Selected. Press Ctrl+C or ⌘C to copy'); }
    );
  } catch (e) { selectEl(fallbackEl); toast('Selected. Press Ctrl+C or ⌘C to copy'); }
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy-discord]');
  if (b) copy(SITE.discord, 'Discord username', b.querySelector('[data-dc-user]'));
});

/* ---------- portfolio: each piece in its Sketchfab viewer (or its render when it has none) ---------- */
// Viewers show Sketchfab's own poster and play button and only start their 3D view when clicked.
const sfEmbed = id => `https://sketchfab.com/models/${encodeURIComponent(id)}/embed?ui_theme=dark&dnt=1&ui_hint=0&ui_watermark_link=0`;
$('#gallery').innerHTML = WORK.map((w, i) => w.sketchfab
  ? `<figure class="work-3d px" style="--tile-bg:${esc(w.bg)}">
       <div class="work-frame"><iframe src="${sfEmbed(w.sketchfab)}" title="${esc(w.name)}, 3D model on Sketchfab" loading="lazy" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen></iframe></div>
       <figcaption><span class="nametag">${esc(w.name)}</span>${badge(w.cat)}<button class="btn btn-sm px" type="button" data-i="${i}">Render</button></figcaption>
     </figure>`
  : `<button class="tile px" type="button" data-i="${i}" style="--tile-bg:${esc(w.bg)}" aria-label="${esc(w.name)}, view full size">
     <img src="${esc(w.img)}" alt="${esc(w.alt || '')}" loading="lazy">
     <span class="tile-cap"><span class="nametag">${esc(w.name)}</span>${badge(w.cat)}</span>
   </button>`).join('');
$('#gallery').addEventListener('click', e => { const t = e.target.closest('[data-i]'); if (t) openLightbox(WORK, +t.dataset.i); });

/* ---------- store: a horizontal shelf of packs, each with its Sketchfab viewer ---------- */
$('#packs').innerHTML = PACKS.map(p => {
  const shown = p.includes.slice(0, 5), more = p.includes.length - shown.length;
  const actions = p.buy
    ? `<a class="btn btn-sm btn-primary px" href="${esc(p.buy)}" target="_blank" rel="noopener">Buy now ${ARROW}</a>
       <button class="btn btn-sm px" type="button" data-dm="${esc(p.id)}">DM me</button>`
    : `<button class="btn btn-sm btn-primary px" type="button" data-dm="${esc(p.id)}">DM to buy</button>
       <button class="btn btn-sm px" type="button" data-view="${esc(p.id)}">Render</button>`;
  const price = hasPrice(p)
    ? `<span class="price">${money(p.price)}<small>${esc(SITE.currency)}</small></span>`
    : `<span class="price ask">Ask for price</span>`;
  const media = p.sketchfab
    ? `<div class="card-3d" style="--tile-bg:${esc(p.bg)}"><iframe src="${sfEmbed(p.sketchfab)}" title="${esc(p.name)}, 3D model on Sketchfab" loading="lazy" allow="autoplay; fullscreen; xr-spatial-tracking" allowfullscreen></iframe></div>`
    : `<button class="card-img" type="button" data-view="${esc(p.id)}" style="--tile-bg:${esc(p.bg)}" aria-label="View the ${esc(p.name)} render full size">
      <img src="${esc(p.img)}" alt="${esc(p.alt)}" loading="lazy">
    </button>`;
  return `<article class="card px" id="pack-${esc(p.id)}">
    ${media}
    <div class="card-body">
      <div class="card-meta">${badge(p.cat)}<span class="label">${esc(SITE.edition)}</span></div>
      <h3>${esc(p.name)}</h3>
      <p>${esc(p.blurb)}</p>
      ${shown.length ? `<ul class="inc" aria-label="In this pack">${shown.map(x => `<li class="px">${esc(x)}</li>`).join('')}${more > 0 ? `<li class="px">+${more} more</li>` : ''}</ul>` : ''}
      <div class="card-buy">${price}<div class="card-actions">${actions}</div></div>
    </div>
  </article>`;
}).join('');
$('#packs').addEventListener('click', e => {
  const v = e.target.closest('[data-view]');
  if (v) openLightbox(PACK_SHOTS, PACK_SHOTS.findIndex(p => p.id === v.dataset.view));
});
// Arrow buttons page the shelf by one card; they disable at either end.
const shelf = $('#packs'), shelfPrev = $('[data-shelf="-1"]'), shelfNext = $('[data-shelf="1"]');
const shelfStep = () => (shelf.firstElementChild?.offsetWidth || shelf.clientWidth) + 18;
const shelfEnds = () => {
  shelfPrev.disabled = shelf.scrollLeft <= 2;
  shelfNext.disabled = shelf.scrollLeft + shelf.clientWidth >= shelf.scrollWidth - 2;
};
$$('[data-shelf]').forEach(b => b.addEventListener('click', () =>
  shelf.scrollBy({left: shelfStep() * +b.dataset.shelf, behavior: reduce ? 'auto' : 'smooth'})));
shelf.addEventListener('scroll', shelfEnds, {passive:true});
addEventListener('resize', shelfEnds);
shelfEnds();
document.addEventListener('click', e => {
  const d = e.target.closest('[data-dm]'); if (d) openDM(packById(d.dataset.dm));
  if (e.target.closest('[data-dm-custom]')) openDM(null);
});
function goToPack(id){
  document.getElementById('pack-' + id)?.scrollIntoView({behavior: reduce ? 'auto' : 'smooth', block:'start', inline:'start'});
}

/* ---------- modal ---------- */
const modal = $('#modal'), panel = $('#panel');
let lastFocus = null, lbList = [], lbIdx = 0, mode = '';
function openModal(kind){
  if (modal.hidden) lastFocus = document.activeElement;
  mode = kind; panel.className = 'panel px ' + kind;
  modal.hidden = false; document.documentElement.classList.add('locked');
  const f = panel.querySelector('.x'); if (f) f.focus({preventScroll:true});
}
function closeModal(){
  modal.hidden = true; mode = ''; panel.innerHTML = '';
  document.documentElement.classList.remove('locked');
  if (lastFocus && lastFocus.focus) lastFocus.focus({preventScroll:true});
}
modal.addEventListener('click', e => { if (e.target.closest('[data-close]')) closeModal(); });
document.addEventListener('keydown', e => {
  if (modal.hidden) return;
  if (e.key === 'Escape') { e.preventDefault(); closeModal(); return; }
  if (mode === 'lb' && (e.key === 'ArrowRight' || e.key === 'ArrowLeft') && !e.target.closest('textarea')) {
    e.preventDefault(); renderLightbox(lbIdx + (e.key === 'ArrowRight' ? 1 : -1));
  }
  if (e.key === 'Tab') {
    const f = $$('button,a[href],textarea,[tabindex]:not([tabindex="-1"])', panel).filter(el => !el.hidden && el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});

function openLightbox(list, i){ lbList = list; renderLightbox(i); openModal('lb'); }
function renderLightbox(i){
  lbIdx = (i + lbList.length) % lbList.length;
  const w = lbList[lbIdx], p = packById(w.pack);
  const meta = esc(p ? [SITE.edition, hasPrice(p) ? money(p.price) + ' ' + SITE.currency : 'In the store'].join(' · ') : 'Portfolio piece');
  panel.innerHTML = `
    <button class="x px" type="button" data-close aria-label="Close">✕</button>
    <div class="lb-stage" style="--tile-bg:${esc(w.bg)}"><img src="${esc(w.img)}" alt="${esc(w.alt || '')}"></div>
    <div class="lb-bar">
      <div><div class="lb-title"><p class="lb-name" id="modalTitle">${esc(w.name)}</p>${badge(w.cat)}</div><p class="lb-meta">${meta}</p></div>
      <div class="lb-nav">
        ${lbList.length > 1 ? `<button class="btn btn-sm px" type="button" data-prev aria-label="Previous">←</button>
        <span class="lb-count">${lbIdx + 1} / ${lbList.length}</span>
        <button class="btn btn-sm px" type="button" data-next aria-label="Next">→</button>` : ''}
        ${p ? `<button class="btn btn-sm btn-primary px" type="button" data-goto="${esc(p.id)}">View pack</button>` : ''}
      </div>
    </div>`;
  panel.querySelector('[data-prev]')?.addEventListener('click', () => renderLightbox(lbIdx - 1));
  panel.querySelector('[data-next]')?.addEventListener('click', () => renderLightbox(lbIdx + 1));
  panel.querySelector('[data-goto]')?.addEventListener('click', e => { const id = e.currentTarget.dataset.goto; closeModal(); goToPack(id); });
  if (!modal.hidden) panel.querySelector('.x')?.focus({preventScroll:true});
}

function openDM(p){
  const msg = p
    ? (hasPrice(p)
        ? `Hi ${SITE.name}! I'd like to buy ${p.name} (${money(p.price)} ${SITE.currency}).`
        : `Hi ${SITE.name}! I'd like to buy ${p.name}. How much is it?`)
    : `Hi ${SITE.name}! I'm interested in a custom model. Here's what I have in mind: `;
  panel.innerHTML = `
    <button class="x px" type="button" data-close aria-label="Close">✕</button>
    <p class="label" style="color:var(--grass)">${p ? 'Buy on Discord' : 'Message me on Discord'}</p>
    <h3 id="modalTitle">${p ? `${esc(p.name)}${hasPrice(p) ? ' · ' + money(p.price) : ''}` : 'Tell me what you need'}</h3>
    <p>${p
      ? "Send me a DM on Discord with the message below and I'll reply with payment details. You can pay with PayPal, or GCash if you're in the Philippines. I'll send the files once it's paid."
      : "Send me a DM on Discord. Describe the model, where it'll be used, and attach a reference image or two if you have them. For a full commission you can also order through Fiverr."}</p>
    <div class="field">
      <span class="label">My Discord username</span>
      <div class="field-row"><code class="px" id="dmUser">${esc(SITE.discord)}</code><button class="btn btn-sm px" type="button" id="cpUser">Copy</button></div>
    </div>
    <div class="field">
      <label class="label" for="dmMsg">Message to send</label>
      <textarea class="px" id="dmMsg" rows="3" ${p ? 'readonly' : ''}>${esc(msg)}</textarea>
    </div>
    <div class="dm-actions">
      <button class="btn btn-primary px" type="button" id="cpMsg">Copy message</button>
      ${dcProfile ? `<a class="btn px" href="${esc(dcProfile)}" target="_blank" rel="noopener">Open my profile ${ARROW}</a>` : ''}
      ${!p && SITE.fiverr ? `<a class="btn px" href="${esc(SITE.fiverr)}" target="_blank" rel="noopener">Order on Fiverr ${ARROW}</a>` : ''}
    </div>
    ${p && p.buy ? `<p class="note">Prefer to pay by card? <a href="${esc(p.buy)}" target="_blank" rel="noopener">Use the checkout link</a> and get the files instantly.</p>` : ''}`;
  $('#cpUser', panel).addEventListener('click', () => copy(SITE.discord, 'Discord username', $('#dmUser', panel)));
  $('#cpMsg', panel).addEventListener('click', () => copy($('#dmMsg', panel).value, 'Message', $('#dmMsg', panel)));
  openModal('dm');
}



/* ---------- deep links like #pack-wushu ---------- */
if (/^#pack-[\w-]+$/.test(location.hash)) {
  requestAnimationFrame(() => document.getElementById(location.hash.slice(1))?.scrollIntoView({block:'start'}));
}
