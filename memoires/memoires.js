import { supabase } from '/shared/supabase-client.js';

const grid = document.getElementById('memoires-grid');
const loadingMsg = document.getElementById('loading-msg');
const emptyMsg = document.getElementById('empty-msg');
const modal = document.getElementById('memoire-modal');
const modalClose = document.getElementById('modal-close');

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

async function loadMemoires() {
  const { data: memoires, error } = await supabase
    .from('civil_memoires')
    .select(`
      id, title, description, school, degree_level, year, cover_url, file_url, created_at,
      author:civil_profiles!civil_memoires_student_id_fkey ( full_name )
    `)
    .eq('status', 'valide')
    .order('created_at', { ascending: false });

  loadingMsg.hidden = true;

  if (error) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Erreur de chargement.';
    console.error(error);
    return;
  }

  if (!memoires || memoires.length === 0) {
    emptyMsg.hidden = false;
    return;
  }

  memoires.forEach(item => {
    const card = document.createElement('article');
    card.className = 'item-card';
    card.innerHTML = `
      <img class="cover" src="${item.cover_url || ''}" alt="${escapeHtml(item.title)}" onerror="this.style.opacity=0">
      <div class="card-body">
        <span class="card-eyebrow">${item.school || 'École non renseignée'}</span>
        <h3>${escapeHtml(item.title)}</h3>
        <p class="card-desc">${escapeHtml(item.description || '')}</p>
        <div class="card-meta">${item.year || '—'} · ${item.degree_level || '—'}</div>
      </div>
    `;
    card.addEventListener('click', () => openModal(item));
    grid.appendChild(card);
  });
}

function openModal(item) {
  document.getElementById('modal-cover').src = item.cover_url || '';
  document.getElementById('modal-school').textContent = item.school || '—';
  document.getElementById('modal-title').textContent = item.title;
  document.getElementById('modal-description').textContent = item.description || '';
  document.getElementById('modal-author').textContent = item.author?.full_name || 'Non renseigné';
  document.getElementById('modal-year').textContent = item.year || '—';
  document.getElementById('modal-degree').textContent = item.degree_level || '—';
  document.getElementById('modal-file-link').href = item.file_url || '#';
  modal.hidden = false;
}

modalClose.addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

loadMemoires();
