// nouveau-club.js
import { supabase } from '/shared/client-supabase.js';

const authGate = document.getElementById('auth-gate');
const form = document.getElementById('club-form');
const formMsg = document.getElementById('form-msg');
const submitBtn = document.getElementById('submit-btn');

const BUCKET = 'genie-civil-assets';

function showMessage(type, text) {
  formMsg.innerHTML = `<div class="form-${type}">${text}</div>`;
}

async function uploadCover(file, userId) {
  const ext = file.name.split('.').pop();
  const path = `clubs/${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
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
    submitBtn.textContent = 'Création...';
    formMsg.innerHTML = '';

    try {
      const userId = session.user.id;
      const type = document.getElementById('type').value;
      const name = document.getElementById('name').value.trim();
      const annee = document.getElementById('annee').value ? parseInt(document.getElementById('annee').value, 10) : null;
      const description = document.getElementById('description').value.trim();
      const coverFile = document.getElementById('cover_image').files[0];

      if (!name) throw new Error('Le nom est obligatoire.');

      let coverUrl = null;
      if (coverFile) coverUrl = await uploadCover(coverFile, userId);

      const { data: inserted, error: insertError } = await supabase
        .from('civil_groupes')
        .insert({
          type,
          name,
          annee,
          description,
          cover_image_url: coverUrl,
          created_by: userId,
        })
        .select('id')
        .single();

      if (insertError) throw insertError;

      // Le créateur devient automatiquement premier membre.
      await supabase.from('civil_groupe_membres').insert({
        groupe_id: inserted.id,
        profile_id: userId,
        role_in_groupe: 'fondateur',
      });

      showMessage('success', 'Groupe créé ! Il sera visible publiquement après validation.');
      form.reset();
      setTimeout(() => { window.location.href = `/club-detail.html?id=${inserted.id}`; }, 1500);
    } catch (error) {
      console.error(error);
      showMessage('error', error.message || 'Une erreur est survenue. Réessaie.');
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer le groupe';
    }
  });
}

init();
