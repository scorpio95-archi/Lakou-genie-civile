import { supabase } from '/shared/supabase-client.js';

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('submit-btn');
const formMsg = document.getElementById('form-msg');

function showMessage(text, type) {
  formMsg.innerHTML = `<div class="form-${type}">${text}</div>`;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.innerHTML = '';
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion...';

  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;

  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    showMessage(error.message === 'Invalid login credentials'
      ? 'Email ou mot de passe incorrect.'
      : (error.message || 'Une erreur est survenue côté serveur. Réessaie dans un instant.'), 'error');
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
    return;
  }

  window.location.href = '/index.html';
});
