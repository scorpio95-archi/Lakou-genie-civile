import { supabase } from '/shared/supabase-client.js';

const schoolSelect = document.getElementById('school-select');
const schoolOtherGroup = document.getElementById('school-other-group');
const schoolOtherInput = document.getElementById('school-other');
const form = document.getElementById('signup-form');
const submitBtn = document.getElementById('submit-btn');
const formMsg = document.getElementById('form-msg');

// ----- Peupler la liste des écoles connues -----
async function loadSchools() {
  const { data: schools } = await supabase
    .from('civil_schools')
    .select('name')
    .order('name');

  const autreOption = schoolSelect.querySelector('option[value="__autre__"]');
  (schools || []).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s.name;
    opt.textContent = s.name;
    schoolSelect.insertBefore(opt, autreOption);
  });
}
loadSchools();

// ----- Afficher le champ libre si "Autre" est choisi -----
schoolSelect.addEventListener('change', () => {
  const isOther = schoolSelect.value === '__autre__';
  schoolOtherGroup.hidden = !isOther;
  schoolOtherInput.required = isOther;
});

function showMessage(html, type) {
  formMsg.innerHTML = `<div class="form-${type}">${html}</div>`;
}

// ----- Soumission du formulaire (avec un essai automatique en plus si échec réseau) -----
async function trySignUp(payload, attempt = 1) {
  const { data, error } = await supabase.auth.signUp(payload);

  // AuthRetryableFetchError = la requête n'a pas atteint Supabase (réseau/CORS/timeout).
  // Ce type d'erreur est explicitement fait pour être retenté par supabase-js lui-même.
  if (error && error.name === 'AuthRetryableFetchError' && attempt < 2) {
    await new Promise(r => setTimeout(r, 1500));
    return trySignUp(payload, attempt + 1);
  }

  return { data, error };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.innerHTML = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Création en cours...';

  // ⚠️ CORRECTIF : tout le corps est maintenant dans un try/catch.
  // Avant, la moindre exception (import cassé, clé invalide, domaine non
  // autorisé dans Supabase Auth, etc.) laissait le bouton bloqué sur
  // "Création en cours..." sans JAMAIS rien afficher — l'échec "silencieux"
  // rapporté. Maintenant, TOUTE erreur remonte à l'écran, avec le vrai
  // message pour pouvoir diagnostiquer.
  try {
    const fullName = document.getElementById('full_name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const school = schoolSelect.value === '__autre__'
      ? schoolOtherInput.value.trim()
      : schoolSelect.value;

    const payload = {
      email,
      password,
      options: {
        data: { full_name: fullName, school },
        emailRedirectTo: `${window.location.origin}/connexion/index.html`,
      },
    };

    const { data, error } = await trySignUp(payload);

    if (error) {
      if (error.name === 'AuthRetryableFetchError') {
        showMessage(
          `Le service d'inscription est temporairement injoignable (incident réseau connu chez Supabase).
           <button type="button" id="retry-signup-btn" class="btn-outline" style="margin-top:10px;">Réessayer</button>`,
          'error'
        );
        document.getElementById('retry-signup-btn').addEventListener('click', () => {
          form.dispatchEvent(new Event('submit', { cancelable: true }));
        });
      } else {
        showMessage(error.message || 'Une erreur est survenue. Réessaie dans un instant.', 'error');
      }
      return;
    }

    if (data.session) {
      // Confirmation par email désactivée — session immédiate
      window.location.href = '/index.html';
      return;
    }

    showMessage('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.', 'success');
    form.reset();
    schoolOtherGroup.hidden = true;

  } catch (err) {
    // Capture tout ce qui n'est pas une erreur Supabase "propre" : import
    // cassé, exception JS, etc. C'est cette branche qui était invisible avant.
    console.error('Erreur inattendue à l\'inscription :', err);
    showMessage(
      `Erreur technique inattendue : ${err && err.message ? err.message : String(err)}<br>
       <small>Ouvre la console du navigateur (menu ⋮ → Outils de développement) et envoie-moi ce message exact.</small>`,
      'error'
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Créer mon compte';
  }
});
