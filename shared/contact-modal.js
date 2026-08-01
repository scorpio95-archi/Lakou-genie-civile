// shared/contact-modal.js
// Importé par shared/nav.js sur chaque page. Construit le modal Contact
// à la volée (pas besoin de dupliquer son HTML dans chaque page.html),
// détecte le rôle via la session, et adapte le formulaire :
//   - étudiant / visiteur -> Suggestion / Autre -> admin_email
//   - admin               -> 5 catégories       -> owner_email

import { supabase } from './supabase-client.js';

const EDGE_FUNCTION_URL = 'https://vvizvjmvesjenuetsxyq.supabase.co/functions/v1/send-network-email';
const SUPABASE_ANON_KEY = 'sb_publishable_6vv-OVHoOw2xCbKTbEOp8g_nRqdP7wc';

const VISITOR_CATEGORIES = [
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'autre', label: 'Autre' },
];

const ADMIN_CATEGORIES = [
  { value: 'question_generale', label: 'Question générale' },
  { value: 'probleme_technique', label: 'Problème technique' },
  { value: 'signalement_utilisateur', label: "Signalement d'un utilisateur" },
  { value: 'changement_admin', label: "Demande de changement d'administrateur" },
  { value: 'urgence_administrative', label: 'Urgence administrative' },
];

let modalBuilt = false;
let currentContext = { role: 'visitor', email: null, name: null };

function buildModalSkeleton() {
  if (modalBuilt) return;
  const overlay = document.createElement('div');
  overlay.id = 'contact-modal-overlay';
  overlay.className = 'modal-overlay';
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal-card contact-modal-card">
      <button type="button" class="contact-modal-close" id="contact-modal-close" aria-label="Fermer">✕</button>
      <p class="section-label">§ CONTACT</p>
      <h2 class="contact-modal-title">Contactez-nous</h2>
      <form id="contact-form" class="auth-form">
        <div class="form-group" id="contact-email-group" hidden>
          <label for="contact-email">Votre email</label>
          <input type="email" id="contact-email" name="email" placeholder="vous@exemple.com" />
        </div>
        <div class="form-group">
          <label for="contact-category">Catégorie</label>
          <select id="contact-category" name="category"></select>
        </div>
        <div class="form-group">
          <label for="contact-message">Message</label>
          <textarea id="contact-message" name="message" rows="5" required></textarea>
        </div>
        <div id="contact-form-feedback"></div>
        <button type="submit" class="btn-primary" id="contact-submit-btn">Envoyer</button>
      </form>
    </div>
  `;
  document.body.appendChild(overlay);

  document.getElementById('contact-modal-close').addEventListener('click', closeContactModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeContactModal();
  });
  document.getElementById('contact-form').addEventListener('submit', handleContactSubmit);

  modalBuilt = true;
}

function populateCategories(categories) {
  const select = document.getElementById('contact-category');
  select.innerHTML = categories
    .map((c) => `<option value="${c.value}">${c.label}</option>`)
    .join('');
}

async function resolveContext() {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session) {
    currentContext = { role: 'visitor', email: null, name: null };
    return;
  }

  const { data: profile } = await supabase
    .from('civil_profiles')
    .select('role, full_name')
    .eq('id', session.user.id)
    .single();

  currentContext = {
    role: profile?.role === 'admin' ? 'admin' : 'visitor',
    email: session.user.email,
    name: profile?.full_name || null,
  };
}

async function openContactModal() {
  buildModalSkeleton();
  await resolveContext();

  const emailGroup = document.getElementById('contact-email-group');
  const emailInput = document.getElementById('contact-email');
  const feedback = document.getElementById('contact-form-feedback');
  feedback.innerHTML = '';
  document.getElementById('contact-message').value = '';

  if (currentContext.role === 'admin') {
    populateCategories(ADMIN_CATEGORIES);
    emailGroup.hidden = true;
    emailInput.required = false;
  } else {
    populateCategories(VISITOR_CATEGORIES);
    if (currentContext.email) {
      emailGroup.hidden = true;
      emailInput.required = false;
    } else {
      emailGroup.hidden = false;
      emailInput.required = true;
    }
  }

  document.getElementById('contact-modal-overlay').hidden = false;
}

function closeContactModal() {
  const overlay = document.getElementById('contact-modal-overlay');
  if (overlay) overlay.hidden = true;
}

function categoryLabel(role, value) {
  const list = role === 'admin' ? ADMIN_CATEGORIES : VISITOR_CATEGORIES;
  return list.find((c) => c.value === value)?.label || value;
}

async function handleContactSubmit(e) {
  e.preventDefault();
  const submitBtn = document.getElementById('contact-submit-btn');
  const feedback = document.getElementById('contact-form-feedback');
  const category = document.getElementById('contact-category').value;
  const message = document.getElementById('contact-message').value.trim();
  const manualEmail = document.getElementById('contact-email').value.trim();
  const senderEmail = currentContext.email || manualEmail;

  if (!message) return;
  if (!senderEmail) {
    feedback.innerHTML = '<div class="form-error">Merci de renseigner votre email.</div>';
    return;
  }

  const targetKey = currentContext.role === 'admin' ? 'owner_email' : 'admin_email';
  const subject =
    currentContext.role === 'admin'
      ? `[Génie Civil · Admin] ${categoryLabel('admin', category)}`
      : `[Génie Civil · Contact] ${categoryLabel('visitor', category)}`;

  const html = `
    <p><strong>Catégorie :</strong> ${categoryLabel(currentContext.role, category)}</p>
    <p><strong>De :</strong> ${currentContext.name || 'Visiteur'} (${senderEmail})</p>
    <p><strong>Message :</strong></p>
    <p>${message.replace(/\n/g, '<br>')}</p>
  `;

  await sendWithRetry({ targetKey, subject, html, replyTo: senderEmail }, submitBtn, feedback);
}

async function sendWithRetry(payload, submitBtn, feedback, isRetry = false) {
  submitBtn.disabled = true;
  submitBtn.textContent = 'Envoi...';
  feedback.innerHTML = '';

  try {
    const res = await fetch(EDGE_FUNCTION_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(payload),
    });

    const result = await res.json();

    if (!res.ok) throw new Error(result.error || 'Échec de l’envoi.');

    feedback.innerHTML = '<div class="form-success">Message envoyé. Merci !</div>';
    document.getElementById('contact-message').value = '';
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer';
    setTimeout(closeContactModal, 1500);
  } catch (error) {
    // Convention réseau : afficher error.message, retry auto pour les erreurs réseau instables.
    const isNetworkError = error.name === 'TypeError' || /fetch/i.test(error.message);
    if (isNetworkError && !isRetry) {
      return sendWithRetry(payload, submitBtn, feedback, true);
    }
    feedback.innerHTML = `
      <div class="form-error">${error.message}</div>
      <button type="button" class="btn-outline" id="contact-retry-btn">Réessayer</button>
    `;
    const retryBtn = document.getElementById('contact-retry-btn');
    if (retryBtn) {
      retryBtn.addEventListener('click', () => sendWithRetry(payload, submitBtn, feedback));
    }
    submitBtn.disabled = false;
    submitBtn.textContent = 'Envoyer';
  }
}

// ----- Câblage du bouton déclencheur (présent dans le nav de chaque page) -----
document.addEventListener('DOMContentLoaded', () => {
  const trigger = document.getElementById('nav-contact-btn');
  if (trigger) trigger.addEventListener('click', openContactModal);
});
