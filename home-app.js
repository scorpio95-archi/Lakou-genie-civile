// /home-app.js — Lakou Génie Civil
// Alimente §01 (stats en direct) et le profil admin en bas de page.
// Réutilise le client partagé déjà en place ailleurs sur le site —
// aucun nouveau client créé, pas de risque de doublon GoTrueClient.
import { supabase } from '/shared/supabase-client.js';

async function loadStats(){
  const [{ count: inscrits }, { count: projets }, { count: creations },
         { count: defis }, { count: clubs }] = await Promise.all([
    supabase.from('civil_profiles').select('*', { count: 'exact', head: true }),
    supabase.from('civil_projects').select('*', { count: 'exact', head: true }),
    supabase.from('civil_deliverables').select('*', { count: 'exact', head: true }),
    supabase.from('civil_forum_sujets').select('*', { count: 'exact', head: true }),
    supabase.from('civil_groupes').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('is_public', true),
  ]);

  const el = id => document.getElementById(id);
  if (el('stat-inscrits')) el('stat-inscrits').textContent = inscrits ?? 0;
  if (el('stat-projets')) el('stat-projets').textContent = (projets ?? 0) + (creations ?? 0);
  if (el('stat-defis')) el('stat-defis').textContent = defis ?? 0;
  if (el('stat-clubs')) el('stat-clubs').textContent = clubs ?? 0;
}

async function loadAdminProfile(){
  const band = document.getElementById('admin-profile-band');
  if (!band) return;

  const { data, error } = await supabase
    .from('civil_profiles')
    .select('full_name, bio, avatar_url, role')
    .eq('role', 'admin')
    .limit(1)
    .maybeSingle();

  if (error || !data) return; // pas d'admin visible encore, on n'affiche rien

  const initial = (data.full_name || '?').trim().charAt(0).toUpperCase() || '?';
  const avatarHtml = data.avatar_url
    ? `<img src="${data.avatar_url}" alt="">`
    : `<span>${initial}</span>`;

  band.innerHTML = `
    <div class="admin-profile-card">
      <div class="admin-profile-avatar">${avatarHtml}</div>
      <div class="admin-profile-name">${data.full_name || 'Administrateur'}</div>
      <span class="admin-profile-badge">Admin</span>
      ${data.bio ? `<p class="admin-profile-bio">${data.bio}</p>` : ''}
    </div>
  `;
}

loadStats();
loadAdminProfile();
