// ===================== CONFIGURATION SUPABASE — LAKOU GÉNIE CIVIL =====================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const SUPABASE_URL = 'https://vvizvjmvesjenuetsxyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6vv-OVHoOw2xCbKTbEOp8g_nRqdP7wc';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ===================== ÉTAT LOCAL =====================
let allProjects = [];   // tous les projets validés chargés une fois

// ===================== RÉFÉRENCES DOM =====================
const grid = document.getElementById('projects-grid');
const loadingMsg = document.getElementById('loading-msg');
const emptyMsg = document.getElementById('empty-msg');
const projectCount = document.getElementById('project-count');

const filterSchool = document.getElementById('filter-school');
const filterStructure = document.getElementById('filter-structure');
const filterSearch = document.getElementById('filter-search');

const modal = document.getElementById('project-modal');
const modalClose = document.getElementById('modal-close');

// ===================== CHARGEMENT INITIAL =====================
async function init() {
  const { data: projects, error: projErr } = await supabase
    .from('civil_projects')
    .select(`
      id, title, description, school, structure_type,
      charge_admissible, resistance_sol, surface, norme,
      cover_url, plan_url, created_at,
      student:civil_profiles!civil_projects_student_id_fkey ( full_name ),
      validator:civil_profiles!civil_projects_validated_by_fkey ( full_name )
    `)
    .eq('status', 'valide')
    .order('created_at', { ascending: false });

  if (projErr) {
    showError("Erreur de chargement des projets.");
    console.error(projErr);
    return;
  }

  allProjects = projects || [];
  loadingMsg.hidden = true;
  populateSchoolFilter(allProjects);
  renderProjects(allProjects);
  updateCount(allProjects.length);
}

function showError(msg) {
  loadingMsg.hidden = true;
  emptyMsg.hidden = false;
  emptyMsg.textContent = msg;
}

function updateCount(n) {
  projectCount.textContent = `${n} projet${n > 1 ? 's' : ''} validé${n > 1 ? 's' : ''} — GÉNIE CIVIL`;
}

// ===================== FILTRE ÉCOLE (dérivé des projets, pas de table à part) =====================
function populateSchoolFilter(list) {
  const schools = [...new Set(list.map(p => p.school).filter(Boolean))].sort();
  schools.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    filterSchool.appendChild(opt);
  });
}

// ===================== AFFICHAGE DE LA GRILLE =====================
function renderProjects(list) {
  grid.querySelectorAll('.project-card').forEach(el => el.remove());

  if (list.length === 0) {
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;

  list.forEach(project => {
    const card = document.createElement('article');
    card.className = 'project-card';
    card.innerHTML = `
      <img class="cover" src="${project.cover_url || ''}" alt="${escapeHtml(project.title)}" onerror="this.style.opacity=0">
      <div class="card-body">
        <span class="card-eyebrow">${project.school || 'École non renseignée'}</span>
        <h3>${escapeHtml(project.title)}</h3>
        <p class="card-desc">${escapeHtml(project.description || '')}</p>
        <div class="card-meta">
          <span>${project.structure_type || '—'}</span>
          <span>Voir le projet →</span>
        </div>
      </div>
    `;
    card.addEventListener('click', () => openModal(project));
    grid.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

// ===================== FILTRES =====================
function applyFilters() {
  const schoolVal = filterSchool.value;
  const structureVal = filterStructure.value;
  const searchVal = filterSearch.value.trim().toLowerCase();

  const filtered = allProjects.filter(p => {
    const matchSchool = !schoolVal || p.school === schoolVal;
    const matchStructure = !structureVal || p.structure_type === structureVal;
    const matchSearch = !searchVal || p.title.toLowerCase().includes(searchVal);
    return matchSchool && matchStructure && matchSearch;
  });

  renderProjects(filtered);
  updateCount(filtered.length);
}

filterSchool.addEventListener('change', applyFilters);
filterStructure.addEventListener('change', applyFilters);
filterSearch.addEventListener('input', applyFilters);

// ===================== MODALE DE DÉTAIL =====================
async function openModal(project) {
  document.getElementById('modal-cover').src = project.cover_url || '';
  document.getElementById('modal-school').textContent = project.school || '—';
  document.getElementById('modal-title').textContent = project.title;
  document.getElementById('modal-description').textContent = project.description || '';

  document.getElementById('modal-student').textContent = project.student?.full_name || 'Non renseigné';
  document.getElementById('modal-validator').textContent = project.validator?.full_name || 'Pas encore validé';

  document.getElementById('spec-type-structure').textContent = project.structure_type || '—';
  document.getElementById('spec-charge').textContent = project.charge_admissible || '—';
  document.getElementById('spec-resistance-sol').textContent = project.resistance_sol || '—';
  document.getElementById('spec-surface').textContent = project.surface || '—';
  document.getElementById('spec-norme').textContent = project.norme || '—';

  const planLink = document.getElementById('spec-plan-link');
  if (project.plan_url) {
    planLink.href = project.plan_url;
    planLink.style.pointerEvents = 'auto';
    planLink.style.opacity = '1';
  } else {
    planLink.removeAttribute('href');
    planLink.style.opacity = '0.4';
  }

  // Charger les livrables de ce projet
  const { data: deliverables } = await supabase
    .from('civil_deliverables')
    .select('step_number, step_name, status')
    .eq('project_id', project.id)
    .order('step_number');

  const list = document.getElementById('deliverables-list');
  list.innerHTML = '';
  (deliverables || []).forEach(d => {
    const li = document.createElement('li');
    li.className = 'deliverable-item';
    const isValidated = d.status === 'valide';
    li.innerHTML = `
      <span class="step-name"><span class="step-num">${String(d.step_number).padStart(2, '0')}</span> ${escapeHtml(d.step_name)}</span>
      <span class="status ${isValidated ? 'validated' : 'pending'}">${isValidated ? 'Validé' : 'En attente'}</span>
    `;
    list.appendChild(li);
  });

  modal.hidden = false;
}

modalClose.addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

// ===================== LANCEMENT =====================
init();
