// ===================== MENU GLOBAL — LAKOU GÉNIE CIVIL =====================
// /shared/nav.js — chargé en tant que module sur chaque page
import './contact-modal.js';
import { supabase } from './client-supabase.js';
// ----- Hamburger mobile + lien actif -----
(function () {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  if (toggle && links) {
    // Le bouton hamburger s'anime déjà en X à l'ouverture (voir nav.css) —
    // pas besoin d'un second bouton de fermeture injecté dans le menu.
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    });
  }

  window.addEventListener('resize', () => {
    if (window.innerWidth > 780 && links && links.classList.contains('open')) {
      links.classList.remove('open');
      if (toggle) toggle.setAttribute('aria-expanded', 'false');
    }
  });

  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link[href]').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.style.color = 'var(--safety, #e3a72e)';
    }
  });
})();

// ----- État de connexion : Paramètres / Statistiques / zone auth -----
async function initAuthState() {
  const settingsLink = document.getElementById('nav-settings-link');
  const statsLink = document.getElementById('nav-stats-link');
  const authZone = document.getElementById('nav-auth-zone');

  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return; // état par défaut déjà correct : Connexion/Inscription visibles

  const { data: profile } = await supabase
    .from('civil_profiles')
    .select('full_name, role')
    .eq('id', session.user.id)
    .single();

  if (settingsLink) settingsLink.hidden = false;
  if (statsLink) statsLink.hidden = !(profile && profile.role === 'admin');

  if (authZone) {
    // Corrigé : on ne détruit plus tout le contenu de la zone avec innerHTML
    // (ça effaçait le bouton Contact, et même en le remettant dans le HTML,
    // contact-modal.js avait déjà attaché son écouteur à l'ancien bouton —
    // le nouveau n'aurait jamais réagi au clic). On retire seulement
    // Connexion/Inscription et on insère la salutation + Tableau de bord +
    // Déconnexion avant le bouton Contact, qui reste le même nœud DOM.
    const loginLink = document.getElementById('nav-login-link');
    const signupLink = document.getElementById('nav-signup-link');
    const contactBtn = document.getElementById('nav-contact-btn');

    if (loginLink) loginLink.remove();
    if (signupLink) signupLink.remove();

    const firstName = (profile?.full_name || 'Compte').split(' ')[0];
    const wrapper = document.createElement('div');
    wrapper.className = 'nav-auth-authenticated';
    wrapper.innerHTML = `
      <span class="nav-link nav-greeting">Bonjour ${firstName}</span>
      <a href="/tableau-de-bord.html" class="nav-link nav-cta">Tableau de bord</a>
      <button class="nav-link nav-cta-outline" id="nav-logout-btn" type="button">Déconnexion</button>
    `;

    if (contactBtn) {
      authZone.insertBefore(wrapper, contactBtn);
    } else {
      authZone.appendChild(wrapper);
    }

    document.getElementById('nav-logout-btn').addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/index.html';
    });
  }
}

initAuthState();
