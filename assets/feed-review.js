const postsEl = document.getElementById('reviewPosts');
const statusEl = document.getElementById('reviewStatus');
const tabsEl = document.getElementById('reviewTabs');
let allPosts = [];
let activeTab = 'pending';
const tabs = [['pending','Pending'],['published','Published'],['rejected','Rejected'],['archived','Archived'],['all','All']];

function esc(value) { return window.JaxtriFeed?.escapeHtml ? window.JaxtriFeed.escapeHtml(value) : String(value || ''); }
function setStatus(text, type = '') { statusEl.className = `notice ${type}`.trim(); statusEl.textContent = text; }
function filteredPosts() { return activeTab === 'all' ? allPosts : allPosts.filter(p => p.status === activeTab); }
function countFor(tab) { return tab === 'all' ? allPosts.length : allPosts.filter(p => p.status === tab).length; }
function setTab(tab) { activeTab = tab; render(); }
window.setTab = setTab;

function renderTabs() {
  tabsEl.innerHTML = tabs.map(([key, label]) => `<button class="${activeTab === key ? 'btn primary' : 'btn'}" onclick="setTab('${key}')">${label} (${countFor(key)})</button>`).join('');
}

function media(post) {
  if (!post.media_url) return '';
  return `<p><strong>Media:</strong> <a href="${esc(post.media_url)}" target="_blank" rel="noreferrer">${esc(post.media_url)}</a></p>`;
}

function actions(post) {
  return `
    ${post.status !== 'published' ? `<button class="btn primary" onclick="reviewPost(${post.id}, 'publish')">Publish</button>` : ''}
    ${post.status !== 'rejected' ? `<button class="btn" onclick="reviewPost(${post.id}, 'reject')">Reject</button>` : ''}
    ${post.status !== 'archived' ? `<button class="btn" onclick="reviewPost(${post.id}, 'archive')">Archive</button>` : ''}
    <button class="btn danger" onclick="deletePost(${post.id})">Delete</button>
  `;
}

function card(post) {
  const note = post.review_note ? `<p><strong>Review note:</strong> ${esc(post.review_note)}</p>` : '';
  return `
    <article class="card compact-card">
      <div class="feed-review-head">
        <span class="pill ${esc(post.status)}">${esc(post.status)}</span>
        <span class="small">${esc(post.created_at || '')}</span>
      </div>
      <h2>${esc(post.title)}</h2>
      <p class="small">Submitted by ${esc(post.author_name)} • ${esc(post.author_email)}</p>
      <p>${esc(post.body)}</p>
      ${media(post)}
      ${note}
      <div class="actions">${actions(post)}</div>
    </article>
  `;
}

function render() {
  renderTabs();
  const posts = filteredPosts();
  if (!posts.length) {
    setStatus(`No ${activeTab === 'all' ? '' : activeTab + ' '}feed submissions.`, 'success');
    postsEl.innerHTML = '';
    return;
  }
  setStatus(`${posts.length} ${activeTab === 'all' ? '' : activeTab + ' '}feed submission${posts.length === 1 ? '' : 's'} shown.`, 'success');
  postsEl.innerHTML = posts.map(card).join('');
}

async function loadPosts() {
  setStatus('Loading feed submissions...');
  const response = await fetch('/api/admin/feed-posts');
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) {
    setStatus(data.error || 'Could not load feed submissions.', 'error');
    return;
  }
  allPosts = data.posts || [];
  render();
}

async function reviewPost(id, action) {
  const body = action === 'reject' ? { note: prompt('Optional rejection note:') || '' } : {};
  const response = await fetch(`/api/admin/feed-posts/${id}/${action}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) { alert(data.error || 'Action failed.'); return; }
  await loadPosts();
}
window.reviewPost = reviewPost;

async function deletePost(id) {
  if (!confirm('Delete this feed submission permanently?')) return;
  const response = await fetch(`/api/admin/feed-posts/${id}/delete`, { method: 'POST' });
  const data = await response.json().catch(() => ({ error: 'Unknown error' }));
  if (!response.ok) { alert(data.error || 'Delete failed.'); return; }
  await loadPosts();
}
window.deletePost = deletePost;

document.getElementById('refreshReview')?.addEventListener('click', loadPosts);
loadPosts();
