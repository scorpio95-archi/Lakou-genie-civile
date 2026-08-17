import { supabase } from '/shared/client-supabase.js';

/* ⚠️ Toujours à vérifier si non confirmés côté Storage/Edge Functions :
   - Bucket "civils-upload" pour l'avatar (confirmé existant par Sébastien).
   - Edge Function "delete-account" (construite, à déployer si pas déjà fait). */

let currentUser = null;
let currentProfile = null;

const loadingMsg = document.getElementById('loading-msg');
const settingsContent = document.getElementById('settings-content');

const avatarPreview = document.getElementById('avatar-preview');
const avatarInput = document.getElementById('avatar-input');
const avatarStatus = document.getElementById('avatar-status');
let pendingAvatarFile = null;

const profileForm = document.getElementById('profile-form');
const fullNameInput = document.getElementById('full-name');
const bioInput = document.getElementById('bio');
const schoolInput = document.getElementById('school');
const levelGroup = document.getElementById('level-group');
const levelInput = document.getElementById('level');
const roleBadge = document.getElementById('role-badge');
const profileError = document.getElementById('profile-error');
const profileSuccess = document.getElementById('profile-success');
const profileSubmitBtn = document.getElementById('profile-submit-btn');

const passwordForm = document.getElementById('password-form');
const passwordError = document.getElementById('password-error');
const passwordSuccess = document.getElementById('password-success');
const passwordSubmitBtn = document.getElementById('password-submit-btn');

const deleteAccountBtn = document.getElementById('delete-account-btn');
const deleteModal = document.getElementById('delete-modal');
const deleteModalClose = document.getElementById('delete-modal-close');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteError = document.getElementById('delete-error');

async function init() {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      window.location.href = '/connexion.html';
      return;
    }
    currentUser = session.user;

    const { data: profile, error } = await supabase
      .from('civil_profiles')
      .select('full_name, avatar_url, role, bio, school, level')
      .eq('id', currentUser.id)
      .single();

    if (error) {
      loadingMsg.textContent = 'Erreur de chargement du profil : ' + error.message;
      console.error(error);
      return;
    }

    currentProfile = profile;

    fullNameInput.value = profile.full_name || '';
    bioInput.value = profile.bio || '';
    schoolInput.value = profile.school || '';
    roleBadge.textContent = profile.role || '—';
    avatarPreview.src = profile.avatar_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=' + currentUser.id;

    // Niveau : seulement pertinent pour un profil étudiant.
    if (profile.role === 'etudiant') {
      levelGroup.hidden = false;
      levelInput.value = profile.level || '';
    }

    loadingMsg.hidden = true;
    settingsContent.hidden = false;
  } catch (err) {
    console.error('Erreur inattendue à l\'initialisation :', err);
    loadingMsg.textContent = 'Erreur technique : ' + (err?.message || String(err));
  }
}

avatarInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingAvatarFile = file;
  avatarPreview.src = URL.createObjectURL(file);
  avatarStatus.textContent = file.name;
});

profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileError.hidden = true;
  profileSuccess.hidden = true;
  profileSubmitBtn.disabled = true;
  profileSubmitBtn.textContent = 'Enregistrement...';

  try {
    let avatarUrl = null;

    if (pendingAvatarFile) {
      const path = `avatars/${currentUser.id}/${Date.now()}_${pendingAvatarFile.name}`;
      const { error: uploadError } = await supabase.storage.from('civils-upload').upload(path, pendingAvatarFile, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from('civils-upload').getPublicUrl(path);
      avatarUrl = urlData.publicUrl;
    }

    const payload = {
      full_name: fullNameInput.value.trim(),
      bio: bioInput.value.trim() || null,
      school: schoolInput.value.trim() || null,
    };
    if (currentProfile.role === 'etudiant') {
      payload.level = levelInput.value || null;
    }
    if (avatarUrl) payload.avatar_url = avatarUrl;

    const { error } = await supabase.from('civil_profiles').update(payload).eq('id', currentUser.id);
    if (error) throw error;

    pendingAvatarFile = null;
    avatarStatus.textContent = '';
    profileSuccess.hidden = false;

  } catch (err) {
    profileError.textContent = 'Erreur : ' + (err?.message || String(err));
    profileError.hidden = false;
  } finally {
    profileSubmitBtn.disabled = false;
    profileSubmitBtn.textContent = 'Enregistrer';
  }
});

passwordForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  passwordError.hidden = true;
  passwordSuccess.hidden = true;

  const newPassword = document.getElementById('new-password').value;
  const confirmPassword = document.getElementById('confirm-password').value;

  if (newPassword !== confirmPassword) {
    passwordError.textContent = 'Les mots de passe ne correspondent pas.';
    passwordError.hidden = false;
    return;
  }

  passwordSubmitBtn.disabled = true;
  passwordSubmitBtn.textContent = 'Modification...';

  try {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;

    passwordForm.reset();
    passwordSuccess.hidden = false;

  } catch (err) {
    passwordError.textContent = 'Erreur : ' + (err?.message || String(err));
    passwordError.hidden = false;
  } finally {
    passwordSubmitBtn.disabled = false;
    passwordSubmitBtn.textContent = 'Changer le mot de passe';
  }
});

// Déconnexion retirée de cette page — déjà disponible dans le menu (nav.js).

deleteAccountBtn.addEventListener('click', () => {
  deleteConfirmInput.value = '';
  deleteError.hidden = true;
  deleteModal.hidden = false;
});
deleteModalClose.addEventListener('click', () => { deleteModal.hidden = true; });
deleteModal.addEventListener('click', (e) => { if (e.target === deleteModal) deleteModal.hidden = true; });

deleteConfirmBtn.addEventListener('click', async () => {
  if (deleteConfirmInput.value.trim() !== 'SUPPRIMER') {
    deleteError.textContent = 'Tape SUPPRIMER pour confirmer.';
    deleteError.hidden = false;
    return;
  }

  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.textContent = 'Suppression...';

  try {
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw error;

    await supabase.auth.signOut();
    window.location.href = '/index.html';

  } catch (err) {
    deleteError.textContent = 'Erreur : ' + (err?.message || String(err));
    deleteError.hidden = false;
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Supprimer définitivement';
  }
});

init();
