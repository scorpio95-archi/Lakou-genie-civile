// ===================== MENU GLOBAL — LAKOU GÉNIE CIVIL =====================
// /shared/nav.js — chargé en tant que module sur chaque page

import { supabase } from './supabase-client.js';

// ----- Hamburger mobile + lien actif -----
(function () {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  if (toggle && links) {
    // Bouton "Fermer" explicite, injecté en haut du menu mobile —
    // plus fiable que de compter sur l'animation hamburger → X.
    if (!document.getElementById('nav-close-btn')) {
      const closeBtn = document.createElement('button');
      closeBtn.id = 'nav-close-btn';
      closeBtn.type = 'button';
      closeBtn.className = 'nav-close-btn';
      closeBtn.setAttribute('aria-label', 'Fermer le menu');
      closeBtn.innerHTML = '✕ Fermer le menu';
      closeBtn.addEventListener('click', () => {
        links.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        toggle.setAttribute('aria-label', 'Ouvrir le menu');
      });
      links.insertBefore(closeBtn, links.firstChild);
    }

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
    const firstName = (profile?.full_name || 'Compte').split(' ')[0];
    authZone.innerHTML = `
      <span class="nav-link nav-greeting">Bonjour ${firstName}</span>
      <a href="/tableau-de-bord/index.html" class="nav-link nav-cta">Tableau de bord</a>
      <button class="nav-link nav-cta-outline" id="nav-logout-btn" type="button">Déconnexion</button>
    `;
    document.getElementById('nav-logout-btn').addEventListener('click', async () => {
      await supabase.auth.signOut();
      window.location.href = '/index.html';
    });
  }
}

initAuthState();
