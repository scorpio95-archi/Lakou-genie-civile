import { supabase } from '/shared/supabase-client.js';

const guardMsg = document.getElementById('guard-msg');
const page = document.getElementById('dashboard-page');

let currentUser = null;
let currentProfile = null;

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function statusLabel(status) {
  const labels = { brouillon: 'Brouillon', soumis: 'Soumis', valide: 'Validé', rejete: 'Rejeté' };
  return labels[status] || status;
}

// ===================== INIT =====================
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    guardMsg.hidden = false;
    page.hidden = true;
    return;
  }
  currentUser = session.user;

  const { data: profile } = await supabase
    .from('civil_profiles')
    .select('full_name, role')
    .eq('id', currentUser.id)
    .single();

  currentProfile = profile;
  page.hidden = false;

  document.getElementById('user-name').textContent = profile?.full_name?.split(' ')[0] || 'compte';
  document.getElementById('role-badge').textContent = profile?.role || 'étudiant';

  if (profile?.role === 'etudiant') {
    document.getElementById('teacher-card').hidden = false;
    loadTeacherRequestStatus();
  }

  if (profile?.role === 'enseignant' || profile?.role === 'admin') {
    document.getElementById('validation-section').hidden = false;
    loadPendingValidation();
  }

  if (profile?.role === 'admin') {
    document.getElementById('teacher-requests-section').hidden = false;
    loadPendingTeacherRequests();
  }

  loadMyProjects();
  loadMyCreations();
  loadMyMemoires();
}

// ===================== DEMANDE ENSEIGNANT =====================
async function loadTeacherRequestStatus() {
  const { data: requests } = await supabase
    .from('civil_teacher_requests')
    .select('status, created_at')
    .eq('user_id', currentUser.id)
    .order('created_at', { ascending: false })
    .limit(1);

  const statusDiv = document.getElementById('teacher-request-status');
  const form = document.getElementById('teacher-request-form');

  if (requests && requests.length > 0 && requests[0].status === 'en_attente') {
    statusDiv.innerHTML = `<div class="form-success">Demande envoyée le ${new Date(requests[0].created_at).toLocaleDateString('fr-FR')} — en attente d'un administrateur.</div>`;
    form.hidden = true;
  } else if (requests && requests.length > 0 && requests[0].status === 'rejete') {
    statusDiv.innerHTML = `<div class="form-error">Ta dernière demande a été refusée. Tu peux en soumettre une nouvelle.</div>`;
  }
}

document.getElementById('teacher-request-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const btn = document.getElementById('teacher-request-btn');
  btn.disabled = true;
  btn.textContent = 'Envoi...';

  const { error } = await supabase.from('civil_teacher_requests').insert({
    user_id: currentUser.id,
    justification: document.getElementById('justification').value.trim(),
    institution: document.getElementById('institution').value.trim() || null,
  });

  if (error) {
    document.getElementById('teacher-request-status').innerHTML = `<div class="form-error">${error.message}</div>`;
    btn.disabled = false;
    btn.textContent = 'Envoyer la demande';
    return;
  }

  loadTeacherRequestStatus();
});

// ===================== MES PROJETS / CRÉATIONS / MÉMOIRES =====================
async function loadMyProjects() {
  const { data } = await supabase
    .from('civil_projects')
    .select('id, title, status, created_at')
    .eq('student_id', currentUser.id)
    .order('created_at', { ascending: false });

  renderDashList('my-projects', data, (item) => `
    <span class="dash-title">${escapeHtml(item.title)}</span>
    <span class="dash-meta">${new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
    <span class="status-badge ${item.status}">${statusLabel(item.status)}</span>
  `, 'Aucun projet pour le moment.');
}

async function loadMyCreations() {
  const { data } = await supabase
    .from('civil_creations')
    .select('id, title, is_hidden, created_at')
    .eq('creator_id', currentUser.id)
    .order('created_at', { ascending: false });

  renderDashList('my-creations', data, (item) => `
    <span class="dash-title">${escapeHtml(item.title)}</span>
    <span class="dash-meta">${new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
    <span class="status-badge ${item.is_hidden ? 'rejete' : 'valide'}">${item.is_hidden ? 'Masquée' : 'Publiée'}</span>
  `, 'Aucune création pour le moment.');
}

async function loadMyMemoires() {
  const { data } = await supabase
    .from('civil_memoires')
    .select('id, title, status, created_at')
    .eq('student_id', currentUser.id)
    .order('created_at', { ascending: false });

  renderDashList('my-memoires', data, (item) => `
    <span class="dash-title">${escapeHtml(item.title)}</span>
    <span class="dash-meta">${new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
    <span class="status-badge ${item.status}">${statusLabel(item.status)}</span>
  `, 'Aucun mémoire pour le moment.');
}

function renderDashList(containerId, items, rowHtml, emptyText) {
  const container = document.getElementById(containerId);
  container.innerHTML = '';
  if (!items || items.length === 0) {
    container.innerHTML = `<p class="empty-note">${emptyText}</p>`;
    return;
  }
  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'dash-item';
    row.innerHTML = rowHtml(item);
    container.appendChild(row);
  });
}

// ===================== VALIDATION (enseignant/admin) =====================
async function loadPendingValidation() {
  const [{ data: projects }, { data: memoires }] = await Promise.all([
    supabase.from('civil_projects').select('id, title, created_at').eq('status', 'soumis').order('created_at'),
    supabase.from('civil_memoires').select('id, title, created_at').eq('status', 'soumis').order('created_at'),
  ]);

  const container = document.getElementById('pending-validation');
  container.innerHTML = '';

  const items = [
    ...(projects || []).map(p => ({ ...p, table: 'civil_projects' })),
    ...(memoires || []).map(m => ({ ...m, table: 'civil_memoires' })),
  ];

  if (items.length === 0) {
    container.innerHTML = `<p class="empty-note">Rien en attente.</p>`;
    return;
  }

  items.forEach(item => {
    const row = document.createElement('div');
    row.className = 'dash-item';
    row.innerHTML = `
      <span class="dash-title">${escapeHtml(item.title)}</span>
      <span class="dash-meta">${item.table === 'civil_projects' ? 'Projet' : 'Mémoire'} · ${new Date(item.created_at).toLocaleDateString('fr-FR')}</span>
      <div class="dash-actions">
        <button class="approve-btn" data-table="${item.table}" data-id="${item.id}" data-action="valide">Valider</button>
        <button class="reject-btn" data-table="${item.table}" data-id="${item.id}" data-action="rejete">Rejeter</button>
      </div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { table, id, action } = btn.dataset;
      const { error } = await supabase
        .from(table)
        .update({ status: action, validated_by: currentUser.id, validated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { console.error(error); btn.disabled = false; return; }
      loadPendingValidation();
    });
  });
}

// ===================== DEMANDES ENSEIGNANT (admin) =====================
async function loadPendingTeacherRequests() {
  const { data: requests } = await supabase
    .from('civil_teacher_requests')
    .select(`
      id, justification, institution, created_at,
      applicant:civil_profiles!civil_teacher_requests_user_id_fkey ( full_name )
    `)
    .eq('status', 'en_attente')
    .order('created_at');

  const container = document.getElementById('pending-teacher-requests');
  container.innerHTML = '';

  if (!requests || requests.length === 0) {
    container.innerHTML = `<p class="empty-note">Aucune demande en attente.</p>`;
    return;
  }

  requests.forEach(req => {
    const row = document.createElement('div');
    row.className = 'dash-item';
    row.innerHTML = `
      <span class="dash-title">${escapeHtml(req.applicant?.full_name || 'Utilisateur')}</span>
      <span class="dash-meta">${escapeHtml(req.justification)}${req.institution ? ' — ' + escapeHtml(req.institution) : ''}</span>
      <div class="dash-actions">
        <button class="approve-btn" data-id="${req.id}" data-action="approuve">Approuver</button>
        <button class="reject-btn" data-id="${req.id}" data-action="rejete">Rejeter</button>
      </div>
    `;
    container.appendChild(row);
  });

  container.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      const { id, action } = btn.dataset;
      const { error } = await supabase
        .from('civil_teacher_requests')
        .update({ status: action, reviewed_by: currentUser.id, reviewed_at: new Date().toISOString() })
        .eq('id', id);
      if (error) { console.error(error); btn.disabled = false; return; }
      loadPendingTeacherRequests();
    });
  });
}

init();
