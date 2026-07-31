import { supabase } from '/shared/supabase-client.js';

const guardMsg = document.getElementById('guard-msg');
const dashboard = document.getElementById('stats-dashboard');

function denyAccess() {
  guardMsg.hidden = false;
  dashboard.hidden = true;
}

async function guardAdmin() {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) { denyAccess(); return false; }

  const { data: profile } = await supabase
    .from('civil_profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (!profile || profile.role !== 'admin') { denyAccess(); return false; }
  return true;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function renderCounts(profiles, projects, creations, teacherRequests) {
  const byRole = { etudiant: 0, enseignant: 0, admin: 0 };
  profiles.forEach(p => { byRole[p.role] = (byRole[p.role] || 0) + 1; });

  const byStatus = { brouillon: 0, soumis: 0, valide: 0, rejete: 0 };
  projects.forEach(p => { byStatus[p.status] = (byStatus[p.status] || 0) + 1; });

  document.getElementById('count-total').textContent = profiles.length;
  document.getElementById('count-etudiants').textContent = byRole.etudiant;
  document.getElementById('count-enseignants').textContent = byRole.enseignant;
  document.getElementById('count-brouillon').textContent = byStatus.brouillon;
  document.getElementById('count-soumis').textContent = byStatus.soumis;
  document.getElementById('count-valide').textContent = byStatus.valide;
  document.getElementById('count-rejete').textContent = byStatus.rejete;
  document.getElementById('count-creations').textContent = creations.length;
  document.getElementById('count-creations-masquees').textContent = creations.filter(c => c.is_hidden).length;
  document.getElementById('count-demandes').textContent = teacherRequests.length;
}

function renderRegistrants(profiles) {
  const tbody = document.getElementById('registrants-body');
  tbody.innerHTML = '';
  profiles.slice(0, 50).forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${escapeHtml(p.full_name)}</td>
      <td>${p.role}</td>
      <td>${escapeHtml(p.school || '—')}</td>
      <td>${new Date(p.created_at).toLocaleDateString('fr-FR')}</td>
    `;
    tbody.appendChild(tr);
  });
}

function renderChart(profiles) {
  const months = [];
  const counts = [];
  const now = new Date();

  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(d.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' }));
    const count = profiles.filter(p => {
      const created = new Date(p.created_at);
      return created.getFullYear() === d.getFullYear() && created.getMonth() === d.getMonth();
    }).length;
    counts.push(count);
  }

  new Chart(document.getElementById('activity-chart'), {
    type: 'bar',
    data: {
      labels: months,
      datasets: [{ label: 'Inscriptions par mois', data: counts, backgroundColor: '#e3a72e' }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: '#a49c8f' }, grid: { color: 'rgba(255,255,255,0.06)' } },
        y: { ticks: { color: '#a49c8f', precision: 0 }, grid: { color: 'rgba(255,255,255,0.06)' }, beginAtZero: true }
      }
    }
  });
}

// ===================== ENVOYER LE RAPPORT =====================
// ⚠️ Nom de l'Edge Function à confirmer avec Sébastien — placeholder ci-dessous.
async function sendReport() {
  const btn = document.getElementById('send-report-btn');
  btn.disabled = true;
  btn.textContent = 'Envoi...';

  try {
    const { error } = await supabase.functions.invoke('NOM_FONCTION_A_CONFIRMER');
    if (error) throw error;
    btn.textContent = 'Rapport envoyé ✓';
  } catch (err) {
    console.error(err);
    btn.textContent = 'Échec — réessayer';
  } finally {
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = 'Envoyer le rapport';
    }, 3000);
  }
}

// ===================== LANCEMENT =====================
async function loadStats() {
  const ok = await guardAdmin();
  if (!ok) return;

  const [{ data: profiles }, { data: projects }, { data: creations }, { data: teacherRequests }] = await Promise.all([
    supabase.from('civil_profiles').select('id, full_name, role, school, created_at').order('created_at', { ascending: false }),
    supabase.from('civil_projects').select('id, status, created_at'),
    supabase.from('civil_creations').select('id, is_hidden, created_at'),
    supabase.from('civil_teacher_requests').select('id, status').eq('status', 'en_attente')
  ]);

  renderCounts(profiles || [], projects || [], creations || [], teacherRequests || []);
  renderRegistrants(profiles || []);
  renderChart(profiles || []);

  document.getElementById('send-report-btn').addEventListener('click', sendReport);
}

loadStats();
