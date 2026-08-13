// chantier.js
import { supabase } from '/shared/supabase-client.js';

const grid = document.getElementById('chantier-grid');
const loadingEl = document.getElementById('chantier-loading');
const emptyEl = document.getElementById('chantier-empty');
const modalOverlay = document.getElementById('entree-modal-overlay');
const modalClose = document.getElementById('entree-modal-close');
const modalBody = document.getElementById('entree-modal-body');

let currentUserId = null;
let carouselImages = [];
let carouselIndex = 0;

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(`${dateStr}T00:00:00`);
  return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
}

function statusBadge(entry) {
  if (entry.author_id !== currentUserId) return '';
  if (entry.status === 'pending') return '<span class="badge-pending">En attente de validation</span>';
  if (entry.status === 'rejected') return '<span class="badge-pending">Non retenu</span>';
  if (entry.status === 'approved' && !entry.is_public) return '<span class="badge-pending">Approuvé — pas encore public</span>';
  return '';
}

function renderCard(entry) {
  const card = document.createElement('div');
  card.className = 'gallery-card';

  const imgHtml = entry.cover_image_url
    ? `<img class="gallery-card-image" src="${escapeHtml(entry.cover_image_url)}" alt="">`
    : '<div class="gallery-card-image placeholder">Pas de photo</div>';

  const dateStr = formatDate(entry.date_chantier);
  const metaParts = [entry.lieu, dateStr].filter(Boolean).map(escapeHtml).join(' · ');

  card.innerHTML = `
    ${imgHtml}
    <div class="gallery-card-body">
      <div class="gallery-card-title">${escapeHtml(entry.title)}</div>
      ${metaParts ? `<div class="gallery-card-meta">${metaParts}</div>` : ''}
      <div class="gallery-card-badge-row">
        ${entry.est_echec_instructif ? '<span class="badge-echec">Échec instructif</span>' : ''}
        ${statusBadge(entry)}
      </div>
    </div>
  `;
  card.addEventListener('click', () => openDetail(entry));
  return card;
}

async function loadEntries() {
  const { data, error } = await supabase
    .from('civil_chantier_entries')
    .select('*')
    .order('created_at', { ascending: false });

  loadingEl.hidden = true;

  if (error) {
    console.error(error);
    emptyEl.textContent = 'Erreur de chargement. Réessaie plus tard.';
    emptyEl.hidden = false;
    return;
  }

  if (!data || data.length === 0) {
    emptyEl.hidden = false;
    return;
  }

  data.forEach((entry) => grid.appendChild(renderCard(entry)));
}

async function openDetail(entry) {
  const { data: images } = await supabase
    .from('civil_chantier_images')
    .select('*')
    .eq('entry_id', entry.id)
    .order('order_index', { ascending: true });

  carouselImages = (images && images.length > 0)
    ? images.map((i) => i.url)
    : (entry.cover_image_url ? [entry.cover_image_url] : []);
  carouselIndex = 0;

  let authorName = 'Auteur inconnu';
  const { data: profile } = await supabase
    .from('civil_profiles')
    .select('full_name')
    .eq('id', entry.author_id)
    .single();
  if (profile?.full_name) authorName = profile.full_name;

  const dateStr = formatDate(entry.date_chantier);

  modalBody.innerHTML = `
    ${carouselImages.length > 0 ? `
      <div class="detail-carousel">
        <img class="detail-carousel-track" id="carousel-track" src="${escapeHtml(carouselImages[0])}" alt="">
        ${carouselImages.length > 1 ? `
          <button type="button" class="detail-carousel-nav detail-carousel-prev" id="carousel-prev">‹</button>
          <button type="button" class="detail-carousel-nav detail-carousel-next" id="carousel-next">›</button>
          <span class="detail-carousel-count" id="carousel-count">1 / ${carouselImages.length}</span>
        ` : ''}
      </div>
    ` : ''}
    <p class="section-label">§ CARNET DE CHANTIER</p>
    <h2>${escapeHtml(entry.title)}</h2>
    <div class="detail-meta-row">
      ${entry.lieu ? `<span>📍 ${escapeHtml(entry.lieu)}</span>` : ''}
      ${dateStr ? `<span>🗓 ${dateStr}</span>` : ''}
      <span>✍️ ${escapeHtml(authorName)}</span>
      ${entry.est_echec_instructif ? '<span class="badge-echec">Échec instructif</span>' : ''}
    </div>
    ${entry.description ? `
      <p class="detail-section-label">Description</p>
      <p class="detail-body-text">${escapeHtml(entry.description)}</p>
    ` : ''}
    ${entry.difficultes_rencontrees ? `
      <p class="detail-section-label">Difficultés rencontrées</p>
      <p class="detail-body-text">${escapeHtml(entry.difficultes_rencontrees)}</p>
    ` : ''}
  `;

  modalOverlay.hidden = false;

  if (carouselImages.length > 1) {
    document.getElementById('carousel-prev').addEventListener('click', () => moveCarousel(-1));
    document.getElementById('carousel-next').addEventListener('click', () => moveCarousel(1));
  }
}

function moveCarousel(delta) {
  carouselIndex = (carouselIndex + delta + carouselImages.length) % carouselImages.length;
  document.getElementById('carousel-track').src = carouselImages[carouselIndex];
  document.getElementById('carousel-count').textContent = `${carouselIndex + 1} / ${carouselImages.length}`;
}

function closeDetail() {
  modalOverlay.hidden = true;
  modalBody.innerHTML = '';
}

modalClose.addEventListener('click', closeDetail);
modalOverlay.addEventListener('click', (e) => {
  if (e.target === modalOverlay) closeDetail();
});

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  currentUserId = session?.user?.id || null;
  await loadEntries();
}

init();
