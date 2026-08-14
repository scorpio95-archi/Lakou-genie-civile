// bibliotheque.js
import { supabase } from '/shared/client-supabase.js';

const grid = document.getElementById('biblio-grid');
const loadingEl = document.getElementById('biblio-loading');
const emptyEl = document.getElementById('biblio-empty');
const modalOverlay = document.getElementById('doc-modal-overlay');
const modalClose = document.getElementById('doc-modal-close');
const modalBody = document.getElementById('doc-modal-body');
const typeFilter = document.getElementById('type-filter');

const TYPE_LABELS = {
  cahier_charges: 'Cahier des charges',
  metre: 'Métré',
  devis: 'Devis',
  bordereau: 'Bordereau',
  rapport_technique: 'Rapport technique',
  note_calcul: 'Note de calcul',
  detail_constructif: 'Détail constructif',
  autre: 'Autre',
};

let currentUserId = null;
let allDocs = [];
let activeType = '';

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

function statusBadge(doc) {
  if (doc.author_id !== currentUserId) return '';
  if (doc.status === 'pending') return '<span class="badge-pending">En attente de validation</span>';
  if (doc.status === 'rejected') return '<span class="badge-pending">Non retenu</span>';
  if (doc.status === 'approved' && !doc.is_public) return '<span class="badge-pending">Approuvé — pas encore public</span>';
  return '';
}

function renderCard(doc) {
  const card = document.createElement('div');
  card.className = 'gallery-card';

  card.innerHTML = `
    <div class="gallery-card-image placeholder">📄 ${TYPE_LABELS[doc.type_document] || 'Document'}</div>
    <div class="gallery-card-body">
      <div class="gallery-card-title">${escapeHtml(doc.title)}</div>
      <div class="gallery-card-meta">${formatDate(doc.created_at) || ''}</div>
      <div class="gallery-card-badge-row">
        ${doc.est_echec_instructif ? '<span class="badge-echec">Échec instructif</span>' : ''}
        ${statusBadge(doc)}
      </div>
    </div>
  `;
  card.addEventListener('click', () => openDetail(doc));
  return card;
}

function renderFeed() {
  grid.innerHTML = '';
  const filtered = activeType ? allDocs.filter((d) => d.type_document === activeType) : allDocs;

  if (filtered.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  filtered.forEach((doc) => grid.appendChild(renderCard(doc)));
}

typeFilter.querySelectorAll('.category-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    activeType = chip.dataset.type;
    typeFilter.querySelectorAll('.category-chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderFeed();
  });
});

async function loadDocs() {
  const { data, error } = await supabase
    .from('civil_bibliotheque_documents')
    .select('*')
    .order('created_at', { ascending: false });

  loadingEl.hidden = true;

  if (error) {
    console.error(error);
    emptyEl.textContent = 'Erreur de chargement. Réessaie plus tard.';
    emptyEl.hidden = false;
    return;
  }

  allDocs = data || [];
  renderFeed();
}

async function openDetail(doc) {
  let authorName = 'Auteur inconnu';
  const { data: profile } = await supabase
    .from('civil_profiles')
    .select('full_name')
    .eq('id', doc.author_id)
    .single();
  if (profile?.full_name) authorName = profile.full_name;

  modalBody.innerHTML = `
    <p class="section-label">§ ${TYPE_LABELS[doc.type_document] || 'DOCUMENT'}</p>
    <h2>${escapeHtml(doc.title)}</h2>
    <div class="detail-meta-row">
      <span>🗓 ${formatDate(doc.created_at) || ''}</span>
      <span>✍️ ${escapeHtml(authorName)}</span>
      ${doc.est_echec_instructif ? '<span class="badge-echec">Échec instructif</span>' : ''}
    </div>
    ${doc.description ? `
      <p class="detail-section-label">Description</p>
      <p class="detail-body-text">${escapeHtml(doc.description)}</p>
    ` : ''}
    <p class="detail-section-label">Fichier</p>
    <a href="${escapeHtml(doc.file_url)}" target="_blank" rel="noopener" class="btn-outline">Ouvrir le document</a>
  `;
  modalOverlay.hidden = false;
}

function closeDetail() {
  modalOverlay.hidden = true;
  modalBody.innerHTML = '';
}
modalClose.addEventListener('click', closeDetail);
modalOverlay.addEventListener('click', (e) => { if (e.target === modalOverlay) closeDetail(); });

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUserId = session?.user?.id || null;
  await loadDocs();
}

init();
