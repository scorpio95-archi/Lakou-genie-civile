import { supabase } from '/shared/client-supabase.js';

const form = document.getElementById('login-form');
const submitBtn = document.getElementById('submit-btn');
const formMsg = document.getElementById('form-msg');

function showMessage(html, type) {
  formMsg.hidden = false;
  formMsg.className = type === 'error' ? 'form-error' : 'form-success';
  formMsg.innerHTML = html;
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  formMsg.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Connexion en cours...';

  try {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (error.name === 'AuthRetryableFetchError') {
        showMessage('Le service de connexion est temporairement injoignable. Réessaie dans un instant.', 'error');
      } else if (error.message?.includes('Invalid login credentials')) {
        showMessage('Email ou mot de passe incorrect.', 'error');
      } else {
        showMessage(error.message || 'Une erreur est survenue.', 'error');
      }
      return;
    }

    if (data.session) {
      window.location.href = '/tableau-de-bord.html';
      return;
    }

    showMessage('Confirme ton email avant de te connecter.', 'error');

  } catch (err) {
    console.error('Erreur inattendue à la connexion :', err);
    showMessage(
      `Erreur technique inattendue : ${err && err.message ? err.message : String(err)}<br>
       <small>Envoie-moi ce message exact si ça persiste.</small>`,
      'error'
    );
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Se connecter';
  }
});
