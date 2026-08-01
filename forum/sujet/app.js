import { supabase } from '/shared/supabase-client.js';

const BADGE_LABELS = {
  expert_verifie: '✓ Expert vérifié',
  enseignant_certifie: '✓ Enseignant certifié',
  contributeur_remarquable: '★ Contributeur remarquable',
};

const sujetId = new URLSearchParams(window.location.search).get('id');

let currentUser = null;
let currentRole = null;
let currentSujet = null;
let badgesByUser = {};

// ===================== RÉFÉRENCES DOM =====================
const loadingMsg = document.getElementById('loading-msg');
const notFoundMsg = document.getElementById('not-found-msg');
const sujetDetail = document.getElementById('sujet-detail');
const catTag = document.getElementById('sujet-cat-tag');
const resoluTag = document.getElementById('sujet-resolu-tag');
const titreEl = document.getElementById('sujet-titre');
const metaRow = document.getElementById('sujet-meta-row');
const contenuEl = document.getElementById('sujet-contenu');
const staffActions = document.getElementById('staff-actions');
const toggleResoluBtn = document.getElementById('toggle-resolu-btn');

const reponsesSection = document.getElementById('reponses-section');
const reponsesCount = document.getElementById('reponses-count');
const reponsesList = document.getElementById('reponses-list');
const reponseForm = document.getElementById('reponse-form');
const reponseLoginHint = document.getElementById('reponse-login-hint');
const reponseError = document.getElementById('reponse-error');
const reponseSubmitBtn = document.getElementById('reponse-submit-btn');

// ===================== INIT =====================
async function init() {
  if (!sujetId) {
    loadingMsg.hidden = true;
    notFoundMsg.hidden = false;
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    const { data: profile } = await supabase.from('civil_profiles').select('role').eq('id', currentUser.id).single();
    currentRole = profile?.role;
  }

  await loadSujet();
  await loadReponses();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderMetaRow(profile, authorId, date) {
  const avatarUrl = profile?.avatar_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=' + authorId;
  const badges = (badgesByUser[authorId] || [])
    .map(type => `<span class="badge-pill badge-${type}">${BADGE_LABELS[type] || type}</span>`)
    .join('');
  return `
    <img class="author-avatar" src="${avatarUrl}" alt="">
    <span>${escapeHtml(profile?.full_name || 'Utilisateur')}</span>
    <span>· ${date}</span>
    ${badges}
  `;
}

// ===================== SUJET =====================
async function loadSujet() {
  const { data: sujet, error } = await supabase
    .from('civil_forum_sujets')
    .select(`
      id, titre, contenu, auteur_id, categorie_id, date_creation, resolu,
      civil_profiles ( full_name, avatar_url ),
      civil_forum_categories ( nom )
    `)
    .eq('id', sujetId)
    .single();

  loadingMsg.hidden = true;

  if (error || !sujet) {
    notFoundMsg.hidden = false;
    return;
  }

  currentSujet = sujet;
  await loadBadgesFor([sujet.auteur_id]);

  catTag.textContent = sujet.civil_forum_categories?.nom || '—';
  resoluTag.hidden = !sujet.resolu;
  titreEl.textContent = sujet.titre;
  const date = new Date(sujet.date_creation).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  metaRow.innerHTML = renderMetaRow(sujet.civil_profiles, sujet.auteur_id, date);
  contenuEl.textContent = sujet.contenu;

  // Bascule "résolu" réservée enseignant/admin
  if (currentRole === 'enseignant' || currentRole === 'admin') {
    staffActions.hidden = false;
    toggleResoluBtn.textContent = sujet.resolu ? 'Marquer non résolu' : 'Marquer résolu';
  }

  sujetDetail.hidden = false;
  reponsesSection.hidden = false;

  if (currentUser && currentRole !== 'visitor') {
    reponseForm.hidden = false;
    reponseLoginHint.hidden = true;
  }
}

toggleResoluBtn.addEventListener('click', async () => {
  const newValue = !currentSujet.resolu;
  toggleResoluBtn.disabled = true;

  const { error } = await supabase.from('civil_forum_sujets').update({ resolu: newValue }).eq('id', sujetId);

  toggleResoluBtn.disabled = false;
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }

  currentSujet.resolu = newValue;
  resoluTag.hidden = !newValue;
  toggleResoluBtn.textContent = newValue ? 'Marquer non résolu' : 'Marquer résolu';
});

// ===================== RÉPONSES =====================
async function loadReponses() {
  const { data, error } = await supabase
    .from('civil_forum_reponses')
    .select(`
      id, contenu, auteur_id, date_creation,
      civil_profiles ( full_name, avatar_url )
    `)
    .eq('sujet_id', sujetId)
    .order('date_creation', { ascending: true });

  if (error || !data) return;

  await loadBadgesFor(data.map(r => r.auteur_id));
  renderReponses(data);
}

async function loadBadgesFor(userIds) {
  const uniqueIds = [...new Set(userIds)].filter(id => !badgesByUser[id]);
  if (uniqueIds.length === 0) return;

  const { data } = await supabase.from('civil_badges').select('user_id, badge_type').in('user_id', uniqueIds);
  (data || []).forEach(b => {
    if (!badgesByUser[b.user_id]) badgesByUser[b.user_id] = [];
    badgesByUser[b.user_id].push(b.badge_type);
  });
}

function renderReponses(reponses) {
  reponsesCount.textContent = reponses.length;
  reponsesList.innerHTML = '';

  reponses.forEach(r => {
    const date = new Date(r.date_creation).toLocaleDateString('fr-FR', { year: 'numeric', month: 'short', day: 'numeric' });
    const card = document.createElement('div');
    card.className = 'reponse-card';
    card.innerHTML = `
      <div class="sujet-meta-row">${renderMetaRow(r.civil_profiles, r.auteur_id, date)}</div>
      <div class="reponse-contenu">${escapeHtml(r.contenu)}</div>
    `;
    reponsesList.appendChild(card);
  });
}

reponseForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  reponseError.hidden = true;
  reponseSubmitBtn.disabled = true;
  reponseSubmitBtn.textContent = 'Envoi...';

  const contenu = document.getElementById('reponse-contenu').value.trim();

  const { error } = await supabase.from('civil_forum_reponses').insert({
    sujet_id: sujetId,
    auteur_id: currentUser.id,
    contenu,
  });

  reponseSubmitBtn.disabled = false;
  reponseSubmitBtn.textContent = 'Répondre';

  if (error) {
    reponseError.textContent = 'Erreur : ' + error.message;
    reponseError.hidden = false;
    return;
  }

  reponseForm.reset();
  await loadReponses();
});

// ===================== LANCEMENT =====================
init();
