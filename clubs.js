// clubs.js
import { supabase } from '/shared/client-supabase.js';

const grid = document.getElementById('clubs-grid');
const loadingEl = document.getElementById('clubs-loading');
const emptyEl = document.getElementById('clubs-empty');
const typeFilter = document.getElementById('type-filter');

let allGroupes = [];
let activeType = '';

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function renderCard(groupe) {
  const card = document.createElement('div');
  card.className = 'gallery-card';

  const imageHtml = groupe.cover_image_url
    ? `<div class="gallery-card-image" style="background-image:url('${groupe.cover_image_url}')"></div>`
    : `<div class="gallery-card-image placeholder">${groupe.type === 'promotion' ? '🎓' : '👥'}</div>`;

  card.innerHTML = `
    ${imageHtml}
    <div class="gallery-card-body">
      <div class="gallery-card-title">${escapeHtml(groupe.name)}</div>
      <div class="gallery-card-meta">
        ${groupe.type === 'promotion' ? 'Promotion' : 'Club'}${groupe.annee ? ' · ' + groupe.annee : ''}
        · ${groupe.member_count || 0} membre${(groupe.member_count || 0) > 1 ? 's' : ''}
      </div>
    </div>
  `;
  card.addEventListener('click', () => { window.location.href = `/club-detail.html?id=${groupe.id}`; });
  return card;
}

function renderFeed() {
  grid.innerHTML = '';
  const filtered = activeType ? allGroupes.filter((g) => g.type === activeType) : allGroupes;

  if (filtered.length === 0) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;
  filtered.forEach((g) => grid.appendChild(renderCard(g)));
}

typeFilter.querySelectorAll('.category-chip').forEach((chip) => {
  chip.addEventListener('click', () => {
    activeType = chip.dataset.type;
    typeFilter.querySelectorAll('.category-chip').forEach((c) => c.classList.toggle('active', c === chip));
    renderFeed();
  });
});

async function loadGroupes() {
  const { data, error } = await supabase
    .from('civil_groupes')
    .select('id, type, name, annee, cover_image_url, civil_groupe_membres(id)')
    .eq('status', 'approved')
    .eq('is_public', true)
    .order('created_at', { ascending: false });

  loadingEl.hidden = true;

  if (error) {
    console.error(error);
    emptyEl.textContent = 'Erreur de chargement. Réessaie plus tard.';
    emptyEl.hidden = false;
    return;
  }

  allGroupes = (data || []).map((g) => ({ ...g, member_count: g.civil_groupe_membres?.length || 0 }));
  renderFeed();
}

loadGroupes();
