const TOKEN_KEY = 'asyncjob_token';
const USER_KEY = 'asyncjob_user';

const $ = (id) => document.getElementById(id);

const state = {
  token: localStorage.getItem(TOKEN_KEY),
  user: localStorage.getItem(USER_KEY) || 'admin',
};

function toast(message) {
  const el = $('toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => {
    el.hidden = true;
  }, 3200);
}

async function api(path, options = {}) {
  const headers = {
    'content-type': 'application/json',
    ...(options.headers || {}),
  };
  if (state.token) {
    headers.authorization = `Bearer ${state.token}`;
  }

  const res = await fetch(path, { ...options, headers });
  const body = await res.json().catch(() => ({}));

  if (res.status === 401 && !path.includes('/auth/login')) {
    logout(false);
    throw new Error(body.message || 'Unauthorized');
  }

  if (!res.ok) {
    throw new Error(body.message || `Request failed (${res.status})`);
  }
  return body.data;
}

function showWorkspace(signedIn) {
  $('auth-panel').hidden = signedIn;
  $('workspace').hidden = !signedIn;
  if (signedIn) {
    $('user-label').textContent = state.user;
  }
}

function logout(showToast = true) {
  state.token = null;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  showWorkspace(false);
  if (showToast) toast('Signed out');
}

function statusBadge(status) {
  return `<span class="status ${status}">${status}</span>`;
}

function priorityLabel(value) {
  const n = Number(value);
  if (n >= 100) return `High (${n})`;
  if (n >= 50) return `Medium (${n})`;
  return `Normal (${n})`;
}

function fmtDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

async function login(event) {
  event.preventDefault();
  const err = $('auth-error');
  err.hidden = true;
  try {
    const data = await api('/api/v1/auth/login', {
      method: 'POST',
      body: JSON.stringify({
        username: $('username').value.trim(),
        password: $('password').value,
      }),
    });
    state.token = data.accessToken;
    state.user = $('username').value.trim();
    localStorage.setItem(TOKEN_KEY, state.token);
    localStorage.setItem(USER_KEY, state.user);
    showWorkspace(true);
    toast('Signed in');
    await refreshAll();
  } catch (e) {
    err.textContent = e.message;
    err.hidden = false;
  }
}

async function createJob(event) {
  event.preventDefault();
  const msg = $('job-form-msg');
  msg.textContent = '';

  let payload;
  try {
    payload = JSON.parse($('job-payload').value || '{}');
  } catch {
    msg.textContent = 'Payload must be valid JSON';
    return;
  }

  const body = {
    type: $('job-type').value,
    payload,
    priority: Number($('job-priority').value || 0),
    maxAttempts: Number($('job-attempts').value || 3),
  };

  const idem = $('job-idem').value.trim();
  const delayRaw = $('job-delay').value.trim();
  const runAtLocal = $('job-runat').value.trim();

  if (idem) body.idempotencyKey = idem;
  if (delayRaw !== '') body.delayMs = Number(delayRaw);
  if (runAtLocal) {
    const runAtDate = new Date(runAtLocal);
    if (Number.isNaN(runAtDate.getTime())) {
      msg.textContent = 'Invalid runAt date/time';
      return;
    }
    if (runAtDate.getTime() <= Date.now()) {
      msg.textContent = 'runAt must be in the future';
      return;
    }
    body.runAt = runAtDate.toISOString();
  }

  try {
    const job = await api('/api/v1/jobs', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: idem ? { 'Idempotency-Key': idem } : {},
    });
    msg.textContent = `Created ${job.id} (${job.status})`;
    toast(`Job ${job.status}`);
    $('job-idem').value = '';
    await refreshJobs();
    await refreshMeta();
  } catch (e) {
    msg.textContent = e.message;
    toast(e.message);
  }
}

async function refreshJobs() {
  const params = new URLSearchParams({ page: '1', limit: '20', sortBy: 'createdAt', sortOrder: 'desc' });
  const status = $('filter-status').value;
  const type = $('filter-type').value.trim();
  if (status) params.set('status', status);
  if (type) params.set('type', type);

  const result = await api(`/api/v1/jobs?${params}`);
  const tbody = $('jobs-body');
  if (!result.data.length) {
    tbody.innerHTML = `<tr><td colspan="6" class="muted">No jobs found</td></tr>`;
    return;
  }

  tbody.innerHTML = result.data
    .map((job) => {
      const canCancel = ['queued', 'delayed', 'retrying'].includes(job.status);
      return `
      <tr>
        <td>${statusBadge(job.status)}</td>
        <td><code>${job.type}</code></td>
        <td>${job.attempts}/${job.maxAttempts}</td>
        <td>${priorityLabel(job.priority)}</td>
        <td>${fmtDate(job.createdAt)}</td>
        <td class="row">
          <button type="button" class="ghost" data-view="${job.id}">View</button>
          ${
            canCancel
              ? `<button type="button" class="ghost danger" data-cancel="${job.id}">Cancel</button>`
              : ''
          }
        </td>
      </tr>`;
    })
    .join('');

  tbody.querySelectorAll('button[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => showDetail(btn.dataset.view));
  });
  tbody.querySelectorAll('button[data-cancel]').forEach((btn) => {
    btn.addEventListener('click', () => cancelJob(btn.dataset.cancel));
  });
}

async function cancelJob(id) {
  try {
    const job = await api(`/api/v1/jobs/${id}`, { method: 'DELETE' });
    toast(`Cancelled ${job.id.slice(0, 8)}…`);
    await refreshJobs();
    await refreshMeta();
  } catch (e) {
    toast(e.message);
  }
}

async function showDetail(id) {
  const job = await api(`/api/v1/jobs/${id}`);
  $('detail-panel').hidden = false;
  $('job-detail').textContent = JSON.stringify(job, null, 2);
  const actions = $('detail-actions');
  if (actions) {
    const canCancel = ['queued', 'delayed', 'retrying'].includes(job.status);
    actions.innerHTML = canCancel
      ? `<button type="button" class="ghost danger" id="detail-cancel">Cancel job</button>`
      : '';
    const cancelBtn = $('detail-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', async () => {
        await cancelJob(job.id);
        await showDetail(job.id);
      });
    }
  }
}

async function refreshMeta() {
  const [health, metrics, queue] = await Promise.all([
    api('/api/health'),
    api('/api/metrics'),
    api('/api/v1/queue/status'),
  ]);

  $('health-box').textContent = JSON.stringify(health, null, 2);
  $('metrics-box').textContent = JSON.stringify(metrics, null, 2);

  $('stat-waiting').textContent = metrics.queue?.waiting ?? metrics.queueLength ?? 0;
  $('stat-active').textContent = metrics.queue?.active ?? metrics.activeJobs ?? 0;
  $('stat-failed').textContent = metrics.queue?.failed ?? metrics.failedJobs ?? 0;
  $('stat-dlq').textContent = metrics.dlq?.waiting ?? 0;

  $('queue-paused').textContent = queue.paused ? 'Status: paused' : 'Status: running';
}

async function pauseQueue() {
  await api('/api/v1/queue/pause', {
    method: 'POST',
    body: JSON.stringify({ reason: 'Paused from console' }),
  });
  toast('Queue paused');
  await refreshMeta();
}

async function resumeQueue() {
  await api('/api/v1/queue/resume', {
    method: 'POST',
    body: JSON.stringify({ reason: 'Resumed from console' }),
  });
  toast('Queue resumed');
  await refreshMeta();
}

async function refreshAll() {
  await Promise.all([refreshJobs(), refreshMeta()]);
}

function setRunAtMin() {
  const input = $('job-runat');
  const now = new Date();
  // datetime-local expects local YYYY-MM-DDTHH:mm:ss
  const pad = (n) => String(n).padStart(2, '0');
  const local = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  input.min = local;
}

function bind() {
  setRunAtMin();
  $('job-runat').addEventListener('focus', setRunAtMin);
  $('job-delay').addEventListener('input', () => {
    if ($('job-delay').value.trim() !== '') $('job-runat').value = '';
  });
  $('job-runat').addEventListener('change', () => {
    if ($('job-runat').value) $('job-delay').value = '';
  });
  $('login-form').addEventListener('submit', login);
  $('logout-btn').addEventListener('click', () => logout());
  $('job-form').addEventListener('submit', createJob);
  $('refresh-jobs').addEventListener('click', () => refreshJobs().catch((e) => toast(e.message)));
  $('refresh-meta').addEventListener('click', () => refreshMeta().catch((e) => toast(e.message)));
  $('pause-btn').addEventListener('click', () => pauseQueue().catch((e) => toast(e.message)));
  $('resume-btn').addEventListener('click', () => resumeQueue().catch((e) => toast(e.message)));
  $('close-detail').addEventListener('click', () => {
    $('detail-panel').hidden = true;
  });
  $('filter-status').addEventListener('change', () => refreshJobs().catch((e) => toast(e.message)));
  $('filter-type').addEventListener('change', () => refreshJobs().catch((e) => toast(e.message)));
}

(async function init() {
  bind();
  if (state.token) {
    showWorkspace(true);
    try {
      await refreshAll();
    } catch (e) {
      toast(e.message);
      logout(false);
    }
  } else {
    showWorkspace(false);
  }
})();
