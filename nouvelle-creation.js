import { supabase } from '/shared/client-supabase.js';

const guardMsg = document.getElementById('guard-msg');
const page = document.getElementById('submit-page');
const form = document.getElementById('creation-form');
const formMsg = document.getElementById('form-msg');
const publishBtn = document.getElementById('publish-btn');

let currentUser = null;

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    guardMsg.hidden = false;
    page.hidden = true;
    return;
  }
  currentUser = session.user;
  page.hidden = false;
}

function showMessage(text, type) {
  formMsg.innerHTML = `<div class="form-${type}">${text}</div>`;
}

async function uploadFile(file, subfolder) {
  if (!file) return null;
  const path = `${currentUser.id}/${subfolder}/${Date.now()}-${file.name}`;
  const { error } = await supabase.storage.from('civil-creations').upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from('civil-creations').getPublicUrl(path);
  return data.publicUrl;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.innerHTML = '';
  publishBtn.disabled = true;
  publishBtn.textContent = 'Publication...';

  try {
    const coverFile = document.getElementById('cover_file').files[0];
    const creationFile = document.getElementById('creation_file').files[0];

    const [coverUrl, fileUrl] = await Promise.all([
      uploadFile(coverFile, 'covers'),
      uploadFile(creationFile, 'files'),
    ]);

    const { error } = await supabase.from('civil_creations').insert({
      creator_id: currentUser.id,
      title: document.getElementById('title').value.trim(),
      description: document.getElementById('description').value.trim() || null,
      type: document.getElementById('type').value,
      cover_url: coverUrl,
      file_url: fileUrl,
    });

    if (error) throw error;

    showMessage('Création publiée.', 'success');
    setTimeout(() => { window.location.href = '/creations/index.html'; }, 1500);

  } catch (err) {
    console.error(err);
    showMessage(err.message || 'Une erreur est survenue pendant la publication. Réessaie.', 'error');
    publishBtn.disabled = false;
    publishBtn.textContent = 'Publier';
  }
});

init();
