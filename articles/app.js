import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

/* ⚠️ ASSOMPTIONS À VÉRIFIER AVEC SÉBASTIEN :
   - Table partagée "profiles" (full_name, avatar_url, role) — à confirmer, sinon remplacer
     les jointures/select ci-dessous par "civil_profiles".
   - Bucket storage "civils-upload", dossier "articles/{user_id}/..." pour les pièces jointes.
   - Edge function "link-preview" réutilisée telle quelle (générique, sans dépendance à une discipline). */

const SUPABASE_URL = 'https://vvizvjmvesjenuetsxyq.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_6vv-OVHoOw2xCbKTbEOp8g_nRqdP7wc';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentUser = null;
let currentRole = null;
let allArticles = [];
let currentType = 'written';
let editingArticleId = null;

// ===================== RÉFÉRENCES DOM =====================
const newArticleBtn = document.getElementById('new-article-btn');
const loginHint = document.getElementById('login-hint');
const feed = document.getElementById('articles-feed');
const loadingMsg = document.getElementById('loading-msg');
const emptyMsg = document.getElementById('empty-msg');

const modal = document.getElementById('article-modal');
const modalClose = document.getElementById('article-modal-close');
const modalModeTitle = document.getElementById('modal-mode-title');
const form = document.getElementById('article-form');
const errorEl = document.getElementById('article-error');
const submitBtn = document.getElementById('article-submit-btn');

const writtenFields = document.getElementById('written-fields');
const linkFields = document.getElementById('link-fields');
const linkInput = document.getElementById('article-link');
const linkPreviewCard = document.getElementById('link-preview-card');
const linkPreviewImg = document.getElementById('link-preview-img');
const linkPreviewTitleText = document.getElementById('link-preview-title-text');
const linkPreviewStatus = document.getElementById('link-preview-status');

let cachedPreview = { title: null, image: null };

// ===================== INIT =====================
async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    currentUser = session.user;
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', currentUser.id).single();
    currentRole = profile?.role;
    if (currentRole !== 'visitor') {
      newArticleBtn.hidden = false;
      loginHint.hidden = true;
    }
  }
  await loadArticles();
}

// ===================== CHARGEMENT DU FLUX =====================
async function loadArticles() {
  const { data, error } = await supabase
    .from('civil_articles')
    .select(`
      id, type, title, content, file_url, link_url, link_preview_title, link_preview_image,
      created_at, author_id,
      profiles ( full_name, avatar_url )
    `)
    .order('created_at', { ascending: false });

  loadingMsg.hidden = true;

  if (error) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Erreur de chargement.';
    console.error(error);
    return;
  }

  allArticles = data || [];
  renderFeed();
}

function renderFeed() {
  feed.querySelectorAll('.article-card').forEach(el => el.remove());

  if (allArticles.length === 0) {
    emptyMsg.hidden = false;
    emptyMsg.textContent = 'Aucun article pour l\'instant.';
    return;
  }
  emptyMsg.hidden = true;

  allArticles.forEach(article => {
    const card = document.createElement('article');
    card.className = 'article-card';

    const isOwner = currentUser && article.author_id === currentUser.id;
    const avatarUrl = article.profiles?.avatar_url || 'https://api.dicebear.com/7.x/shapes/svg?seed=' + article.author_id;
    const date = new Date(article.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

    let bodyHtml = '';
    if (article.type === 'written') {
      bodyHtml = `<div class="article-content">${escapeHtml(article.content || '')}</div>`;
      if (article.file_url) {
        bodyHtml += `<a href="${article.file_url}" target="_blank" class="article-file-link">📎 Voir le document</a>`;
      }
    } else {
      const domain = safeDomain(article.link_url);
      bodyHtml = `
        <a href="${article.link_url}" target="_blank" class="article-link-card">
          <img src="${article.link_preview_image || ''}" alt="" onerror="this.style.display='none'">
          <div class="link-card-body">
            <div class="link-card-title">${escapeHtml(article.link_preview_title || article.link_url)}</div>
            <div class="link-card-url">${domain}</div>
          </div>
        </a>
      `;
    }
     card.innerHTML = `
      <div class="article-author-row">
        <img class="author-avatar" src="${avatarUrl}" alt="">
        <div class="author-info">
          <span class="author-name">${escapeHtml(article.profiles?.full_name || 'Utilisateur')}</span>
          <span class="author-meta">${date}</span>
        </div>
        ${isOwner ? `
          <div class="article-actions">
            <button class="edit-btn">Modifier</button>
            <button class="delete-btn">Supprimer</button>
          </div>` : ''}
      </div>
      <h3>${escapeHtml(article.title)}</h3>
      ${bodyHtml}
    `;

    if (isOwner) {
      card.querySelector('.edit-btn').addEventListener('click', () => openEditModal(article));
      card.querySelector('.delete-btn').addEventListener('click', () => deleteArticle(article.id));
    }

    feed.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function safeDomain(url) {
  try { return new URL(url).hostname.replace('www.', ''); }
  catch (_) { return url; }
}

// ===================== MODALE : OUVERTURE =====================
newArticleBtn.addEventListener('click', () => {
  editingArticleId = null;
  modalModeTitle.textContent = 'Nouvel article';
  form.reset();
  document.getElementById('article-file-name').textContent = '';
  cachedPreview = { title: null, image: null };
  linkPreviewCard.hidden = true;
  setType('written');
  modal.hidden = false;
});

modalClose.addEventListener('click', () => { modal.hidden = true; });
modal.addEventListener('click', (e) => { if (e.target === modal) modal.hidden = true; });

function openEditModal(article) {
  editingArticleId = article.id;
  modalModeTitle.textContent = 'Modifier l\'article';
  form.reset();
  setType(article.type);

  document.getElementById('article-title').value = article.title;

  if (article.type === 'written') {
    document.getElementById('article-content').value = article.content || '';
  } else {
    linkInput.value = article.link_url || '';
    cachedPreview = { title: article.link_preview_title, image: article.link_preview_image };
    if (article.link_preview_image) {
      linkPreviewImg.src = article.link_preview_image;
      linkPreviewTitleText.textContent = article.link_preview_title || '';
      linkPreviewCard.hidden = false;
    }
  }

  modal.hidden = false;
}

// ===================== BASCULE TYPE =====================
function setType(type) {
  currentType = type;
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
  writtenFields.hidden = type !== 'written';
  linkFields.hidden = type !== 'link';
}

document.querySelectorAll('.type-btn').forEach(btn => {
  btn.addEventListener('click', () => setType(btn.dataset.type));
});

document.getElementById('article-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  document.getElementById('article-file-name').textContent = file ? file.name : '';
});

// ===================== APERÇU DE LIEN AUTOMATIQUE =====================
let previewTimeout;
linkInput.addEventListener('input', () => {
  clearTimeout(previewTimeout);
  const url = linkInput.value.trim();
  if (!url || !url.startsWith('http')) {
    linkPreviewCard.hidden = true;
    return;
  }
  linkPreviewStatus.textContent = 'Chargement de l\'aperçu...';
  previewTimeout = setTimeout(() => fetchLinkPreview(url), 800);
});
async function fetchLinkPreview(url) {
  try {
    const { data, error } = await supabase.functions.invoke('link-preview', { body: { url } });
    if (error || !data) {
      linkPreviewStatus.textContent = 'Aperçu indisponible, l\'article sera quand même publié.';
      return;
    }
    cachedPreview = { title: data.title, image: data.image };
    linkPreviewStatus.textContent = '';
    if (data.image) {
      linkPreviewImg.src = data.image;
      linkPreviewTitleText.textContent = data.title || '';
      linkPreviewCard.hidden = false;
    } else {
      linkPreviewCard.hidden = true;
      linkPreviewStatus.textContent = 'Aucune image trouvée pour ce lien.';
    }
  } catch (e) {
    linkPreviewStatus.textContent = 'Aperçu indisponible.';
  }
}

// ===================== SOUMISSION =====================
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorEl.hidden = true;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Publication...';

  const title = document.getElementById('article-title').value.trim();

  let payload = {
    author_id: currentUser.id,
    type: currentType,
    title,
  };

  if (currentType === 'written') {
    const content = document.getElementById('article-content').value.trim();
    const file = document.getElementById('article-file').files[0];
    payload.content = content;
     if (file) {
      const path = `articles/${currentUser.id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage.from('civils-upload').upload(path, file);
      if (uploadError) {
        errorEl.textContent = 'Erreur upload : ' + uploadError.message;
        errorEl.hidden = false;
        submitBtn.disabled = false;
        submitBtn.textContent = 'Publier';
        return;
      }
      const { data: urlData } = supabase.storage.from('civils-upload').getPublicUrl(path);
      payload.file_url = urlData.publicUrl;
    }
  } else {
    const url = linkInput.value.trim();
    if (!url) {
      errorEl.textContent = 'Merci de renseigner un lien.';
      errorEl.hidden = false;
      submitBtn.disabled = false;
      submitBtn.textContent = 'Publier';
      return;
    }
    payload.link_url = url;
    payload.link_preview_title = cachedPreview.title || null;
    payload.link_preview_image = cachedPreview.image || null;
  }

  let error;
  if (editingArticleId) {
    payload.updated_at = new Date().toISOString();
    ({ error } = await supabase.from('civil_articles').update(payload).eq('id', editingArticleId));
  } else {
    ({ error } = await supabase.from('civil_articles').insert(payload));
  }

  submitBtn.disabled = false;
  submitBtn.textContent = 'Publier';

  if (error) {
    errorEl.textContent = 'Erreur : ' + error.message;
    errorEl.hidden = false;
    return;
  }

  modal.hidden = true;
  await loadArticles();
});

// ===================== SUPPRESSION =====================
async function deleteArticle(id) {
  if (!confirm('Supprimer définitivement cet article ?')) return;
  const { error } = await supabase.from('civil_articles').delete().eq('id', id);
  if (error) {
    alert('Erreur : ' + error.message);
    return;
  }
  await loadArticles();
}

// ===================== LANCEMENT =====================
init();
