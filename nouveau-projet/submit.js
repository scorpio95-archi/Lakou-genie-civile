import { supabase } from '/shared/supabase-client.js';

const guardMsg = document.getElementById('guard-msg');
const page = document.getElementById('submit-page');
const form = document.getElementById('project-form');
const formMsg = document.getElementById('form-msg');
const schoolSelect = document.getElementById('school-select');
const schoolOtherGroup = document.getElementById('school-other-group');
const schoolOtherInput = document.getElementById('school-other');
const livrablesList = document.getElementById('livrables-list');
const addLivrableBtn = document.getElementById('add-livrable-btn');

let currentUser = null;
let livrableCount = 0;

// ===================== GARDE-FOU AUTH =====================
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    guardMsg.hidden = false;
    page.hidden = true;
    return;
  }
  currentUser = session.user;
  page.hidden = false;

  await loadSchools();
  addLivrableRow(); // au moins une étape par défaut
}

// ===================== ÉCOLES =====================
async function loadSchools() {
  const { data: schools } = await supabase.from('civil_schools').select('name').order('name');
  const autreOption = schoolSelect.querySelector('option[value="__autre__"]');
  (schools || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    schoolSelect.insertBefore(opt, autreOption);
  });
}

schoolSelect.addEventListener('change', () => {
  const isOther = schoolSelect.value === '__autre__';
  schoolOtherGroup.hidden = !isOther;
  schoolOtherInput.required = isOther;
});

// ===================== LIVRABLES DYNAMIQUES =====================
function addLivrableRow() {
  livrableCount++;
  const row = document.createElement('div');
  row.className = 'livrable-row';
  row.innerHTML = `
    <span class="livrable-step-num">Étape ${String(livrableCount).padStart(2, '0')}</span>
    <input type="text" class="livrable-name" placeholder="Nom de l'étape (ex: Note de calcul)" required>
    <input type="file" class="livrable-file">
    <button type="button" class="remove-livrable-btn" title="Retirer cette étape">✕</button>
  `;
  row.querySelector('.remove-livrable-btn').addEventListener('click', () => {
    row.remove();
    renumberLivrables();
  });
  livrablesList.appendChild(row);
}

function renumberLivrables() {
  const rows = livrablesList.querySelectorAll('.livrable-row');
  livrableCount = rows.length;
  rows.forEach((row, i) => {
    row.querySelector('.livrable-step-num').textContent = `Étape ${String(i + 1).padStart(2, '0')}`;
  });
}

addLivrableBtn.addEventListener('click', addLivrableRow);

// ===================== UPLOAD FICHIER =====================
async function uploadFile(file, subfolder) {
  if (!file) return null;
  const path = `${currentUser.id}/${subfolder}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('civil-uploads').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('civil-uploads').getPublicUrl(path);
  return data.publicUrl;
}

// ===================== MESSAGE =====================
function showMessage(text, type) {
  formMsg.innerHTML = `<div class="form-${type}">${text}</div>`;
}

// ===================== SOUMISSION =====================
let submittingStatus = null;

document.getElementById('save-draft-btn').addEventListener('click', () => { submittingStatus = 'brouillon'; });
document.getElementById('submit-final-btn').addEventListener('click', () => { submittingStatus = 'soumis'; });

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!submittingStatus) return;

  const saveDraftBtn = document.getElementById('save-draft-btn');
  const submitFinalBtn = document.getElementById('submit-final-btn');
  saveDraftBtn.disabled = true;
  submitFinalBtn.disabled = true;
  formMsg.innerHTML = '';

  const activeBtn = submittingStatus === 'brouillon' ? saveDraftBtn : submitFinalBtn;
  const originalText = activeBtn.textContent;
  activeBtn.textContent = 'Envoi en cours...';

  try {
    const school = schoolSelect.value === '__autre__' ? schoolOtherInput.value.trim() : schoolSelect.value;

    const coverFile = document.getElementById('cover_file').files[0];
    const planFile = document.getElementById('plan_file').files[0];

    const [coverUrl, planUrl] = await Promise.all([
      uploadFile(coverFile, 'covers'),
      uploadFile(planFile, 'plans'),
    ]);

    const { data: project, error: projectError } = await supabase
      .from('civil_projects')
      .insert({
        student_id: currentUser.id,
        title: document.getElementById('title').value.trim(),
        description: document.getElementById('description').value.trim(),
        school,
        structure_type: document.getElementById('structure_type').value,
        charge_admissible: document.getElementById('charge_admissible').value.trim() || null,
        resistance_sol: document.getElementById('resistance_sol').value.trim() || null,
        surface: document.getElementById('surface').value.trim() || null,
        norme: document.getElementById('norme').value.trim() || null,
        cover_url: coverUrl,
        plan_url: planUrl,
        status: submittingStatus,
      })
      .select()
      .single();

    if (projectError) throw projectError;

    // ----- Livrables -----
    const livrableRows = livrablesList.querySelectorAll('.livrable-row');
    let stepNumber = 0;
    for (const row of livrableRows) {
      const name = row.querySelector('.livrable-name').value.trim();
      if (!name) continue;
      stepNumber++;
      const file = row.querySelector('.livrable-file').files[0];
      const fileUrl = await uploadFile(file, `livrables/${project.id}`);

      const { error: deliverableError } = await supabase.from('civil_deliverables').insert({
        project_id: project.id,
        step_number: stepNumber,
        step_name: name,
        file_url: fileUrl,
      });
      if (deliverableError) throw deliverableError;
    }

    showMessage(
      submittingStatus === 'brouillon'
        ? 'Brouillon enregistré. Tu peux le retrouver depuis ton tableau de bord.'
        : 'Projet soumis. Il apparaîtra une fois validé par un enseignant.',
      'success'
    );

    setTimeout(() => { window.location.href = '/index.html'; }, 1800);

  } catch (err) {
    console.error(err);
    showMessage(err.message || 'Une erreur est survenue pendant l\'envoi. Réessaie.', 'error');
    saveDraftBtn.disabled = false;
    submitFinalBtn.disabled = false;
    activeBtn.textContent = originalText;
  }
});

init();
