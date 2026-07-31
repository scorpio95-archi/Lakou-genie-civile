// ===================== MENU GLOBAL — LAKOU GÉNIE CIVIL =====================
// À coller dans /shared/nav.js — chargé par <script src="/shared/nav.js" defer> sur chaque page

(function () {
  const toggle = document.getElementById('nav-toggle');
  const links = document.getElementById('nav-links');

  // ----- Hamburger mobile -----
  if (toggle && links) {
    toggle.addEventListener('click', () => {
      const isOpen = links.classList.toggle('open');
      toggle.setAttribute('aria-expanded', isOpen);
      toggle.setAttribute('aria-label', isOpen ? 'Fermer le menu' : 'Ouvrir le menu');
    });
  }

  // ----- Fermer le menu mobile si on redimensionne vers desktop -----
  window.addEventListener('resize', () => {
    if (window.innerWidth > 780 && links && links.classList.contains('open')) {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // ----- Marquer le lien de la page courante comme actif -----
  const currentPath = window.location.pathname;
  document.querySelectorAll('.nav-link[href]').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.style.color = 'var(--safety, #e3a72e)';
    }
  });

  // ----- NOTE POUR PLUS TARD (branché avec l'authentification) -----
  // - vérifier la session Supabase (supabase.auth.getSession())
  // - si connecté :
  //     - retirer "hidden" sur #nav-settings-link
  //     - remplacer #nav-auth-zone (Connexion/Inscription) par "Bonjour {prénom}" + "Tableau de bord" + "Déconnexion"
  // - si non connecté : garder l'état actuel (Connexion + Inscription visibles, Paramètres caché)
})();
