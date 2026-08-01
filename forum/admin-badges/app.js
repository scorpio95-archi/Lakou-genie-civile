import { supabase } from '/shared/supabase-client.js';

const BADGE_TYPES = [
  { value: 'expert_verifie', label: '✓ Expert vérifié' },
  { value: 'enseignant_certifie', label: '✓ Enseignant certifié' },
  { value: 'contributeur_remarquable', label: '★ Contributeur remarquable' },
];

let currentUser = null;
let selectedUser = null;
let selectedUserBadges = [];

// ===================== RÉFÉRENCES DOM =====================
const accessLoading = document.getElementById('access-loading');
const accessDenied = document.getElementById('access-denied');
const badgesContent = document.getElementById('badges-content');

const userSearch = document.getElementById('user-search');
const userResults = document.getElementById('user-results');

const assignSection = document.getElementById('assign-section');
const selectedUserName = document.getElementById('selected-user-name');
const badgeOptions = document.getElementById('badge-options');
const assignError = document.getElementById('assign-error');
const assignSuccess = document.getElementById('assign-success');

// ===================== INIT — vérification du rôle admin =====================
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    accessLoading.hidden = true;
    accessDenied.hidden = false;
    return;
  }
  currentUser = session.user;

  const { data: profile } = await supabase.from('civil_profiles').select('role').eq('id', currentUser.id).single();
  if (profile?.role !== 'admin') {
    accessLoading.hidden = true;
    accessDenied.hidden = false;
    return;
  }

  accessLoading.hidden = true;
  badgesContent.hidden = false;
}

// ===================== RECHERCHE UTILISATEUR =====================
let searchTimeout;
userSearch.addEventListener('input', () => {
  clearTimeout(searchTimeout);
  const query = userSearch.value.trim();
  if (query.length < 2) {
    userResults.innerHTML = '';
    return;
  }
  searchTimeout = setTimeout(() => searchUsers(query), 400);
});

async function searchUsers(query) {
  const { data, error } = await supabase
    .from('civil_profiles')
    .select('id, full_name, avatar_url, role')
    .ilike('full_name', `%${query}%`)
    .limit(10);

  if (error || !data) return;

  userResults.innerHTML = '';
  data.forEach(user => {
    const row = document.createElement('div');
    row.className = 'user-result-row';
    row.innerHTML = `
      <img src="${user.avatar_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=' + user.id}" alt="">
      <span>${escapeHtml(user.full_name || 'Sans nom')}</span>
      <span class="role-tag">${escapeHtml(user.role || '—')}</span>
    `;
    row.addEventListener('click', () => selectUser(user));
    userResults.appendChild(row);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ===================== SÉLECTION + AFFICHAGE DES BADGES =====================
async function selectUser(user) {
  selectedUser = user;
  selectedUserName.textContent = user.full_name || 'Sans nom';
  assignError.hidden = true;
  assignSuccess.hidden = true;

  const { data } = await supabase.from('civil_badges').select('badge_type').eq('user_id', user.id);
  selectedUserBadges = (data || []).map(b => b.badge_type);

  renderBadgeOptions();
  assignSection.hidden = false;
}

function renderBadgeOptions() {
  badgeOptions.innerHTML = '';
  BADGE_TYPES.forEach(badge => {
    const isAssigned = selectedUserBadges.includes(badge.value);
    const row = document.createElement('div');
    row.className = 'badge-option-row';
    row.innerHTML = `
      <span class="badge-name">${badge.label}</span>
      <button data-type="${badge.value}" class="${isAssigned ? 'assigned' : ''}">
        ${isAssigned ? 'Retirer' : 'Attribuer'}
      </button>
    `;
    row.querySelector('button').addEventListener('click', () => toggleBadge(badge.value, isAssigned));
    badgeOptions.appendChild(row);
  });
}

async function toggleBadge(badgeType, isCurrentlyAssigned) {
  assignError.hidden = true;
  assignSuccess.hidden = true;

  let error;
  if (isCurrentlyAssigned) {
    ({ error } = await supabase
      .from('civil_badges')
      .delete()
      .eq('user_id', selectedUser.id)
      .eq('badge_type', badgeType));
  } else {
    ({ error } = await supabase
      .from('civil_badges')
      .insert({ user_id: selectedUser.id, badge_type: badgeType, attribue_par: currentUser.id }));
  }

  if (error) {
    assignError.textContent = 'Erreur : ' + error.message;
    assignError.hidden = false;
    return;
  }

  assignSuccess.hidden = false;
  const { data } = await supabase.from('civil_badges').select('badge_type').eq('user_id', selectedUser.id);
  selectedUserBadges = (data || []).map(b => b.badge_type);
  renderBadgeOptions();
}

// ===================== LANCEMENT =====================
init();
