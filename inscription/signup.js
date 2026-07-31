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

function showMessage(text, type) {
  formMsg.innerHTML = `<div class="form-${type}">${text}</div>`;
}

// ----- DIAGNOSTIC TEMPORAIRE — affiche tous les détails de l'erreur à l'écran -----
function showDebugError(label, err) {
  let details = 'Aucune info supplémentaire.';
  try {
    if (err && typeof err === 'object') {
      const allProps = Object.getOwnPropertyNames(err);
      const dump = {};
      allProps.forEach(k => { dump[k] = err[k]; });
      details = JSON.stringify(dump, null, 2);
    } else {
      details = String(err);
    }
  } catch (dumpErr) {
    details = 'Impossible de sérialiser l\'erreur : ' + dumpErr.message;
  }

  formMsg.innerHTML = `
    <div class="form-error" style="white-space:pre-wrap; font-family:monospace; font-size:12px; line-height:1.5;">
      <strong>${label}</strong>
      ${details}
    </div>
  `;
}

// ----- Soumission du formulaire -----
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.innerHTML = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Création en cours...';

  const fullName = document.getElementById('full_name').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const school = schoolSelect.value === '__autre__'
    ? schoolOtherInput.value.trim()
    : schoolSelect.value;

  try {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, school },
        emailRedirectTo: `${window.location.origin}/connexion/index.html`,
      },
    });

    if (error) {
      showDebugError('Erreur Supabase (auth.signUp) :', error);
      submitBtn.disabled = false;
      submitBtn.textContent = 'Créer mon compte';
      return;
    }

    if (data.session) {
      window.location.href = '/index.html';
      return;
    }

    showMessage('Compte créé. Vérifie ta boîte mail pour confirmer ton adresse avant de te connecter.', 'success');
    form.reset();
    schoolOtherGroup.hidden = true;
    submitBtn.disabled = false;
    submitBtn.textContent = 'Créer mon compte';

  } catch (jsError) {
    // Erreur JS non prévue (réseau coupé, script bloqué, etc.) — normalement invisible avant ce patch
    showDebugError('Erreur JavaScript inattendue (avant même d\'atteindre Supabase) :', jsError);
    submitBtn.disabled = false;
    submitBtn.textContent = 'Créer mon compte';
  }
});
