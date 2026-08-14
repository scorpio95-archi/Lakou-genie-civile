// nouveau-document-bibliotheque.js
import { supabase } from '/shared/client-supabase.js';

const authGate = document.getElementById('auth-gate');
const form = document.getElementById('doc-form');
const formMsg = document.getElementById('form-msg');
const submitBtn = document.getElementById('submit-btn');

const BUCKET = 'genie-civil-assets';

function showMessage(type, text) {
  formMsg.innerHTML = `<div class="form-${type}">${text}</div>`;
}

async function uploadFile(file, userId) {
  const ext = file.name.split('.').pop();
  const path = `bibliotheque/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file);
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    authGate.hidden = false;
    form.hidden = true;
    return;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    submitBtn.disabled = true;
    submitBtn.textContent = 'Envoi...';
    formMsg.innerHTML = '';

    try {
      const userId = session.user.id;
      const title = document.getElementById('title').value.trim();
      const typeDocument = document.getElementById('type_document').value;
      const description = document.getElementById('description').value.trim() || null;
      const estEchec = document.getElementById('est_echec_instructif').checked;
      const file = document.getElementById('doc_file').files[0];

      if (!title) throw new Error('Le titre est obligatoire.');
      if (!file) throw new Error('Le fichier est obligatoire.');

      const fileUrl = await uploadFile(file, userId);

      const { error: insertError } = await supabase.from('civil_bibliotheque_documents').insert({
        title,
        type_document: typeDocument,
        description,
        file_url: fileUrl,
        est_echec_instructif: estEchec,
        author_id: userId,
      });

      if (insertError) throw insertError;

      showMessage('success', 'Document envoyé pour validation. Merci !');
      form.reset();
      setTimeout(() => { window.location.href = '/bibliotheque.html'; }, 1800);
    } catch (error) {
      console.error(error);
      showMessage('error', error.message || 'Une erreur est survenue. Réessaie.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer pour validation';
    }
  });
}

init();
