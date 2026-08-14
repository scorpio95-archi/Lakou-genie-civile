// nouvelle-entree-chantier.js
import { supabase } from '/shared/client-supabase.js';

const authGate = document.getElementById('auth-gate');
const form = document.getElementById('entree-form');
const formMsg = document.getElementById('form-msg');
const submitBtn = document.getElementById('submit-btn');

const BUCKET = 'genie-civil-assets';

function showMessage(type, text) {
  formMsg.innerHTML = `<div class="form-${type}">${text}</div>`;
}

async function uploadImage(file, userId, tag) {
  const ext = file.name.split('.').pop();
  const path = `chantier/${userId}/${Date.now()}-${tag}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
      const lieu = document.getElementById('lieu').value.trim() || null;
      const dateChantier = document.getElementById('date_chantier').value || null;
      const description = document.getElementById('description').value.trim() || null;
      const difficultes = document.getElementById('difficultes').value.trim() || null;
      const estEchec = document.getElementById('est_echec_instructif').checked;
      const coverFile = document.getElementById('cover_image').files[0];
      const extraFiles = Array.from(document.getElementById('extra_images').files);

      if (!title) throw new Error('Le titre est obligatoire.');

      let coverUrl = null;
      if (coverFile) coverUrl = await uploadImage(coverFile, userId, 'cover');

      const { data: entry, error: insertError } = await supabase
        .from('civil_chantier_entries')
        .insert({
          title,
          lieu,
          date_chantier: dateChantier,
          description,
          difficultes_rencontrees: difficultes,
          est_echec_instructif: estEchec,
          cover_image_url: coverUrl,
          author_id: userId,
        })
        .select()
        .single();

      if (insertError) throw insertError;

      if (extraFiles.length > 0) {
        const urls = await Promise.all(extraFiles.map((f) => uploadImage(f, userId, 'extra')));
        const rows = urls.map((url, i) => ({ entry_id: entry.id, url, order_index: i }));
        const { error: imagesError } = await supabase.from('civil_chantier_images').insert(rows);
        if (imagesError) throw imagesError;
      }

      showMessage('success', 'Entrée envoyée pour validation. Merci !');
      form.reset();
      setTimeout(() => { window.location.href = '/chantier.html'; }, 1800);
    } catch (error) {
      console.error(error);
      showMessage('error', error.message || 'Une erreur est survenue. Réessaie.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Envoyer pour validation';
    }
  });
}

init();
