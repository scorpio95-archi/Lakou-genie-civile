import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* ⚠️ ASSOMPTIONS À VÉRIFIER AVEC SÉBASTIEN — aucun modèle "paramètres" ne m'a été fourni,
   cette page est construite à partir des conventions déjà établies dans le réseau Lakou :
   - Table partagée "profiles" (id, full_name, avatar_url, role) — à confirmer, sinon "civil_profiles".
   - Bucket storage "civils-upload", dossier "avatars/{user_id}/..." pour les photos de profil.
   - Edge function "delete-account" réutilisée telle quelle (déjà utilisée ailleurs dans Lakou Enjenyè)
     — à recréer sur ce projet Supabase si elle n'existe pas encore ici. */

const SUPABASE_URL = 'https://vvizvjmvesjenuetsxyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6vv-OVHoOw2xCbKTbEOp8g_nRqdP7wc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;

// ===================== RÉFÉRENCES DOM =====================
const loadingMsg = document.getElementById('loading-msg');
const settingsContent = document.getElementById('settings-content');

const avatarPreview = document.getElementById('avatar-preview');
const avatarInput = document.getElementById('avatar-input');
const avatarStatus = document.getElementById('avatar-status');
let pendingAvatarFile = null;

const profileForm = document.getElementById('profile-form');
const fullNameInput = document.getElementById('full-name');
const roleBadge = document.getElementById('role-badge');
const profileError = document.getElementById('profile-error');
const profileSuccess = document.getElementById('profile-success');
const profileSubmitBtn = document.getElementById('profile-submit-btn');

const passwordForm = document.getElementById('password-form');
const passwordError = document.getElementById('password-error');
const passwordSuccess = document.getElementById('password-success');
const passwordSubmitBtn = document.getElementById('password-submit-btn');

const logoutBtn = document.getElementById('logout-btn');

const deleteAccountBtn = document.getElementById('delete-account-btn');
const deleteModal = document.getElementById('delete-modal');
const deleteModalClose = document.getElementById('delete-modal-close');
const deleteConfirmInput = document.getElementById('delete-confirm-input');
const deleteConfirmBtn = document.getElementById('delete-confirm-btn');
const deleteError = document.getElementById('delete-error');

// ===================== INIT =====================
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    window.location.href = '/connexion/index.html';
    return;
  }
  currentUser = session.user;

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role')
    .eq('id', currentUser.id)
    .single();

  if (error) {
    loadingMsg.textContent = 'Erreur de chargement du profil.';
    console.error(error);
    return;
  }

  fullNameInput.value = profile.full_name || '';
  roleBadge.textContent = profile.role || '—';
  avatarPreview.src = profile.avatar_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=' + currentUser.id;

  loadingMsg.hidden = true;
  settingsContent.hidden = false;
}

// ===================== AVATAR =====================
avatarInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  pendingAvatarFile = file;
  avatarPreview.src = URL.createObjectURL(file);
  avatarStatus.textContent = file.name;
});

// ===================== PROFIL : SOUMISSION =====================
profileForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  profileError.hidden = true;
  profileSuccess.hidden = true;
  profileSubmitBtn.disabled = true;
  profileSubmitBtn.textContent = 'Enregistrement...';

  let avatarUrl = null;

  if (pendingAvatarFile) {
    const path = `avatars/${currentUser.id}/${Date.now()}_${pendingAvatarFile.name}`;
    const { error: uploadError } = await supabase.storage.from('civils-upload').upload(path, pendingAvatarFile, { upsert: true });
    if (uploadError) {
      profileError.textContent = 'Erreur upload photo : ' + uploadError.message;
      profileError.hidden = false;
      profileSubmitBtn.disabled = false;
      profileSubmitBtn.textContent = 'Enregistrer';
      return;
    }
    const { data: urlData } = supabase.storage.from('civils-upload').getPublicUrl(path);
    avatarUrl = urlData.publicUrl;
  }

  const payload = { full_name: fullNameInput.value.trim() };
  if (avatarUrl) payload.avatar_url = avatarUrl;

  const { error } = await supabase.from('profiles').update(payload).eq('id', currentUser.id);

  profileSubmitBtn.disabled = false;
  profileSubmitBtn.textContent = 'Enregistrer';

  if (error) {
    profileError.textContent = 'Erreur : ' + error.message;
    profileError.hidden = false;
    return;
  }

  pendingAvatarFile = null;
  avatarStatus.textContent = '';
  profileSuccess.hidden = false;
});

// ===================== MOT DE PASSE =====================
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

  const { error } = await supabase.auth.updateUser({ password: newPassword });

  passwordSubmitBtn.disabled = false;
  passwordSubmitBtn.textContent = 'Changer le mot de passe';

  if (error) {
    passwordError.textContent = 'Erreur : ' + error.message;
    passwordError.hidden = false;
    return;
  }

  passwordForm.reset();
  passwordSuccess.hidden = false;
});

// ===================== DÉCONNEXION =====================
logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.href = '/index.html';
});

// ===================== SUPPRESSION DE COMPTE =====================
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

  const { error } = await supabase.functions.invoke('delete-account');

  if (error) {
    deleteError.textContent = 'Erreur : ' + error.message;
    deleteError.hidden = false;
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Supprimer définitivement';
    return;
  }

  await supabase.auth.signOut();
  window.location.href = '/index.html';
});

// ===================== LANCEMENT =====================
init();
