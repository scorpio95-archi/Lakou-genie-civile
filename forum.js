import { supabase } from '/shared/supabase-client.js';

const BADGE_LABELS = {
  expert_verifie: '✓ Expert vérifié',
  enseignant_certifie: '✓ Enseignant certifié',
  contributeur_remarquable: '★ Contributeur remarquable',
};

let currentUser = null;
let currentRole = null;
let categories = [];
let activeCategory = '';
let allSujets = [];
let badgesByUser = {};

// ===================== RÉFÉRENCES DOM =====================
const newSujetBtn = document.getElementById('new-sujet-btn');
const loginHint = document.getElementById('login-hint');
const categoriesStrip = document.querySelector('.categories-strip');
const categoriesLoading = document.getElementById('categories-loading');
const sujetsFeed = document.getElementById('sujets-feed');
const loadingMsg = document.getElementById('loading-msg');
const emptyMsg = document.getElementById('empty-msg');

const modal = document.getElementById('sujet-modal');
const modalClose = document.getElementById('sujet-modal-close');
const form = document.getElementById('sujet-form');
const categorieSelect = document.getElementById('sujet-categorie');
const errorEl = document.getElementById('sujet-error');
const submitBtn = document.getElementById('sujet-submit-btn');

// ===================== INIT =====================
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    const { data: profile } = await supabase.from('civil_profiles').select('role').eq('id', currentUser.id).single();
    currentRole = profile?.role;
    // Corrigé : civil_profiles.role ne contient jamais 'visitor' (enum réel :
    // etudiant/enseignant/admin) — tout profil authentifié voit le bouton.
    if (currentRole) {
      newSujetBtn.hidden = false;
      loginHint.hidden = true;
    }
  }

  await loadCategories();
  await loadSujets();
}

// ===================== CATÉGORIES =====================
async function loadCategories() {
  const { data, error } = await supabase.from('civil_forum_categories').select('id, nom').order('nom');
  categoriesLoading.remove();

  if (error || !data) return;
  categories = data;

  data.forEach(cat => {
    const chip = document.createElement('button');
    chip.className = 'category-chip';
    chip.dataset.cat = cat.id;
    chip.textContent = cat.nom;
    chip.addEventListener('click', () => setActiveCategory(cat.id));
    categoriesStrip.appendChild(chip);

    const opt = document.createElement('option');
    opt.value = cat.id;
    opt.textContent = cat.nom;
    categorieSelect.appendChild(opt);
  });

  document.querySelector('.category-chip[data-cat=""]').addEventListener('click', () => setActiveCategory(''));
}

function setActiveCategory(catId) {
  activeCategory = catId;
  document.querySelectorAll('.category-chip').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.cat === catId);
  });
  renderFeed();
}

// ===================== DÉFIS (civil_forum_sujets) =====================
async function loadSujets() {
  const { data, error } = await supabase
    .from('civil_forum_sujets')
    .select(`
      id, titre, contenu, auteur_id, categorie_id, date_creation, resolu, reponse_acceptee_id,
      civil_profiles ( full_name, avatar_url )
    `)
    .order('date_creation', { ascending: false });

  loadingMsg.hidden = true;

  if (error) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Erreur de chargement.';
    console.error(error);
    return;
  }

  allSujets = data || [];
  await loadBadgesFor(allSujets.map(s => s.auteur_id));
  renderFeed();
}

async function loadBadgesFor(userIds) {
  const uniqueIds = [...new Set(userIds)];
  if (uniqueIds.length === 0) return;

  const { data } = await supabase.from('civil_badges').select('user_id, badge_type').in('user_id', uniqueIds);
  badgesByUser = {};
  (data || []).forEach(b => {
    if (!badgesByUser[b.user_id]) badgesByUser[b.user_id] = [];
    badgesByUser[b.user_id].push(b.badge_type);
  });
}

function renderFeed() {
  sujetsFeed.querySelectorAll('.sujet-card').forEach(el => el.remove());

  const filtered = activeCategory
    ? allSujets.filter(s => s.categorie_id === activeCategory)
    : allSujets;

  if (filtered.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  filtered.forEach(sujet => {
    const cat = categories.find(c => c.id === sujet.categorie_id);
    const avatarUrl = sujet.civil_profiles?.avatar_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=' + sujet.auteur_id;
    const date = new Date(sujet.date_creation).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
    const badges = (badgesByUser[sujet.auteur_id] || [])
      .map(type => `<span class="badge-pill badge-${type}">${BADGE_LABELS[type] || type}</span>`)
      .join('');

    const card = document.createElement('a');
    card.className = 'sujet-card';
    card.href = `/sujet.html?id=${sujet.id}`;
    card.innerHTML = `
      <div class="sujet-top-row">
        ${cat ? `<span class="sujet-cat-tag">${escapeHtml(cat.nom)}</span>` : ''}
        ${sujet.reponse_acceptee_id ? `<span class="sujet-resolu-tag">✓ Résolu</span>` : ''}
      </div>
      <h3>${escapeHtml(sujet.titre)}</h3>
      <div class="sujet-meta-row">
        <img class="author-avatar" src="${avatarUrl}" alt="">
        <span>${escapeHtml(sujet.civil_profiles?.full_name || 'Utilisateur')}</span>
        <span>· ${date}</span>
        ${badges}
      </div>
    `;
    sujetsFeed.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ===================== MODALE : NOUVEAU DÉFI =====================
newSujetBtn.addEventListener('click', () => {
  form.reset();
  errorEl.hidden = true;
  modal.hidden = false;
});
modalClose.addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publication...';

  const payload = {
    auteur_id: currentUser.id,
    categorie_id: categorieSelect.value,
    titre: document.getElementById('sujet-titre').value.trim(),
    contenu: document.getElementById('sujet-contenu').value.trim(),
  };

  const { data, error } = await supabase.from('civil_forum_sujets').insert(payload).select('id').single();

  submitBtn.disabled = false;
  submitBtn.textContent = 'Publier le défi';

  if (error) {
    errorEl.textContent = 'Erreur : ' + error.message;
    errorEl.hidden = false;
    return;
  }

  window.location.href = `/sujet.html?id=${data.id}`;
});

// ===================== LANCEMENT =====================
init();
