// club-detail.js
import { supabase } from '/shared/client-supabase.js';

const params = new URLSearchParams(window.location.search);
const clubId = params.get('id');

let currentUserId = null;
let isCreator = false;
let isMember = false;
let currentClub = null;

const loadingMsg = document.getElementById('loading-msg');
const notFoundMsg = document.getElementById('not-found-msg');
const detail = document.getElementById('club-detail');

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  return new Date(dateStr).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

async function init() {
  if (!clubId) {
    loadingMsg.hidden = true;
    notFoundMsg.hidden = false;
    return;
  }

  const { data: { session } } = await supabase.auth.getSession();
  currentUserId = session?.user?.id || null;

  const { data: club, error } = await supabase
    .from('civil_groupes')
    .select(`
      id, type, name, annee, description, cover_image_url, created_by,
      civil_groupe_membres ( id, profile_id, membre_nom, role_in_groupe, civil_profiles ( full_name ) )
    `)
    .eq('id', clubId)
    .single();

  loadingMsg.hidden = true;

  if (error || !club) {
    notFoundMsg.hidden = false;
    return;
  }

  currentClub = club;
  isCreator = currentUserId === club.created_by;
  isMember = isCreator || (club.civil_groupe_membres || []).some((m) => m.profile_id === currentUserId);

  render(club);
  if (isCreator) loadDemandes();
}

function render(club) {
  document.getElementById('club-cover').innerHTML = club.cover_image_url
    ? `<img src="${club.cover_image_url}" alt="" style="width:100%;border-radius:8px;margin-bottom:16px;">`
    : '';

  document.getElementById('club-type-tag').textContent = club.type === 'promotion' ? 'PROMOTION' : 'CLUB';
  document.getElementById('club-name').textContent = club.name;

  const meta = [];
  if (club.annee) meta.push(`📅 ${club.annee}`);
  meta.push(`👥 ${(club.civil_groupe_membres || []).length} membre${(club.civil_groupe_membres || []).length > 1 ? 's' : ''}`);
  document.getElementById('club-meta-row').innerHTML = meta.map((m) => `<span>${m}</span>`).join('');

  document.getElementById('club-description').textContent = club.description || '';

  const membresHtml = (club.civil_groupe_membres || []).map((m) => {
    const nom = m.civil_profiles ? m.civil_profiles.full_name : (m.membre_nom || 'Membre');
    return `<span class="category-chip" style="cursor:default;">${escapeHtml(nom)}${m.role_in_groupe ? ` · ${escapeHtml(m.role_in_groupe)}` : ''}</span>`;
  }).join('');
  document.getElementById('membres-list').innerHTML = membresHtml || '<p style="color:var(--steel);font-size:0.85rem;">Pas encore de membres listés.</p>';

  const joinAction = document.getElementById('join-action');
  if (!currentUserId) {
    joinAction.innerHTML = `<a href="/connexion.html" class="btn-primary" style="margin-top:16px;display:inline-block;">Se connecter pour rejoindre</a>`;
  } else if (isMember) {
    joinAction.innerHTML = `<div class="form-success" style="margin-top:16px;">Tu fais partie de ce groupe.</div>`;
  } else {
    joinAction.innerHTML = `<button class="btn-primary" id="join-btn" style="margin-top:16px;">Demander à rejoindre</button><div id="join-status"></div>`;
    document.getElementById('join-btn').addEventListener('click', requestJoin);
  }

  detail.hidden = false;
}

async function requestJoin() {
  const btn = document.getElementById('join-btn');
  const status = document.getElementById('join-status');
  btn.disabled = true;

  const { error } = await supabase.from('civil_groupe_demandes').insert({
    groupe_id: clubId,
    profile_id: currentUserId,
  });

  if (error) {
    status.innerHTML = `<div class="form-error">${error.message}</div>`;
    btn.disabled = false;
  } else {
    status.innerHTML = `<div class="form-success">Demande envoyée. Le créateur du groupe doit encore la valider.</div>`;
    btn.remove();
  }
}

async function loadDemandes() {
  const panel = document.getElementById('demandes-panel');
  const { data, error } = await supabase
    .from('civil_groupe_demandes')
    .select('id, message, profile_id, civil_profiles ( full_name )')
    .eq('groupe_id', clubId)
    .eq('status', 'pending');

  if (error || !data || data.length === 0) return;

  panel.hidden = false;
  document.getElementById('demandes-list').innerHTML = data.map((d) => `
    <div class="dash-item" data-demande="${d.id}">
      <span class="dash-title">${escapeHtml(d.civil_profiles ? d.civil_profiles.full_name : 'Utilisateur')}</span>
      <div class="dash-actions">
        <button class="approve-btn" data-id="${d.id}" data-profile="${d.profile_id}" data-action="approve">Accepter</button>
        <button class="reject-btn" data-id="${d.id}" data-action="reject">Refuser</button>
      </div>
    </div>
  `).join('');

  document.querySelectorAll('#demandes-list button[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => decideDemande(btn.dataset.id, btn.dataset.profile, btn.dataset.action));
  });
}

async function decideDemande(demandeId, profileId, action) {
  const status = action === 'approve' ? 'approved' : 'rejected';
  await supabase.from('civil_groupe_demandes').update({ status, decided_at: new Date().toISOString() }).eq('id', demandeId);

  if (action === 'approve') {
    await supabase.from('civil_groupe_membres').insert({ groupe_id: clubId, profile_id: profileId });
  }

  loadDemandes();
  init(); // rafraîchit la liste des membres affichée
}

init();
