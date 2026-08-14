import { supabase } from '/shared/client-supabase.js';

const grid = document.getElementById('creations-grid');
const loadingMsg = document.getElementById('loading-msg');
const emptyMsg = document.getElementById('empty-msg');
const modal = document.getElementById('creation-modal');
const modalClose = document.getElementById('modal-close');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function loadCreations() {
  const { data: creations, error } = await supabase
    .from('civil_creations')
    .select(`
      id, title, description, type, cover_url, file_url, created_at,
      creator:civil_profiles!civil_creations_creator_id_fkey ( full_name )
    `)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false });

  loadingMsg.hidden = true;

  if (error) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Erreur de chargement.';
    console.error(error);
    return;
  }

  if (!creations || creations.length === 0) {
    emptyMsg.hidden = false;
    return;
  }

  creations.forEach(item => {
    const card = document.createElement('article');
    card.className = 'item-card';
    card.innerHTML = `
      <img class="cover" src="${item.cover_url || ''}" alt="${escapeHtml(item.title)}" onerror="this.style.opacity=0">
      <div class="card-body">
        <span class="card-eyebrow">${item.type}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description || '')}</p>
        <div class="card-meta">${item.creator?.full_name || 'Anonyme'}</div>
      </div>
    `;
    card.addEventListener('click', () => openModal(item));
    grid.appendChild(card);
  });
}

function openModal(item) {
  document.getElementById('modal-cover').src = item.cover_url || '';
  document.getElementById('modal-type').textContent = item.type;
  document.getElementById('modal-title').textContent = item.title;
  document.getElementById('modal-description').textContent = item.description || '';
  document.getElementById('modal-creator').textContent = item.creator?.full_name || 'Anonyme';

  const fileLink = document.getElementById('modal-file-link');
  if (item.file_url) {
    fileLink.href = item.file_url;
    fileLink.hidden = false;
  } else {
    fileLink.hidden = true;
  }

  modal.hidden = false;
}

modalClose.addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

loadCreations();
