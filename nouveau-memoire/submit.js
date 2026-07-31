import { supabase } from '/shared/supabase-client.js';

const guardMsg = document.getElementById('guard-msg');
const page = document.getElementById('submit-page');
const form = document.getElementById('memoire-form');
const formMsg = document.getElementById('form-msg');
const schoolSelect = document.getElementById('school-select');
const schoolOtherGroup = document.getElementById('school-other-group');
const schoolOtherInput = document.getElementById('school-other');

let currentUser = null;
let submittingStatus = null;

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
}

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

function showMessage(text, type) {
  formMsg.innerHTML = `<div class="form-${type}">${text}</div>`;
}

async function uploadFile(file, subfolder) {
  if (!file) return null;
  const path = `${currentUser.id}/${subfolder}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('civil-uploads').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('civil-uploads').getPublicUrl(path);
  return data.publicUrl;
}

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
    const memoireFile = document.getElementById('memoire_file').files[0];

    const [coverUrl, fileUrl] = await Promise.all([
      uploadFile(coverFile, 'memoires-covers'),
      uploadFile(memoireFile, 'memoires'),
    ]);

    if (submittingStatus === 'soumis' && !fileUrl) {
      throw new Error('Le fichier PDF du mémoire est requis pour soumettre.');
    }

    const { error } = await supabase.from('civil_memoires').insert({
      student_id: currentUser.id,
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim() || null,
      school,
      degree_level: document.getElementById('degree_level').value,
      year: document.getElementById('year').value ? parseInt(document.getElementById('year').value) : null,
      cover_url: coverUrl,
      file_url: fileUrl,
      status: submittingStatus,
    });

    if (error) throw error;

    showMessage(
      submittingStatus === 'brouillon'
        ? 'Brouillon enregistré.'
        : 'Mémoire soumis. Il apparaîtra une fois validé par un enseignant.',
      'success'
    );
    setTimeout(() => { window.location.href = '/memoires/index.html'; }, 1800);

  } catch (err) {
    console.error(err);
    showMessage(err.message || 'Une erreur est survenue. Réessaie.', 'error');
    saveDraftBtn.disabled = false;
    submitFinalBtn.disabled = false;
    activeBtn.textContent = originalText;
  }
});

init();
