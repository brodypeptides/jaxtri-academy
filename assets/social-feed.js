(function () {
  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[c]));
  }

  function isImage(url) {
    return /\.(png|jpe?g|gif|webp|avif|svg)(\?.*)?$/i.test(String(url || ''));
  }

  function roleLabel(post) {
    return post.author_title || (post.author_role ? post.author_role[0].toUpperCase() + post.author_role.slice(1) : 'Member');
  }

  function renderPost(post) {
    const media = post.media_url ? (isImage(post.media_url)
      ? `<a href="${escapeHtml(post.media_url)}" target="_blank" rel="noreferrer"><img class="feed-media" src="${escapeHtml(post.media_url)}" alt="Shared media"></a>`
      : `<a class="feed-link" href="${escapeHtml(post.media_url)}" target="_blank" rel="noreferrer">Open shared link</a>`)
      : '';

    return `
      <article class="feed-post">
        <div class="feed-post-head">
          <div class="feed-avatar">${escapeHtml((post.author_name || 'J').slice(0, 1).toUpperCase())}</div>
          <div>
            <strong>${escapeHtml(post.author_name || 'Jaxtri Member')}</strong>
            <p class="small">${escapeHtml(roleLabel(post))} • ${escapeHtml(post.published_at || post.created_at || '')}</p>
          </div>
        </div>
        <h3>${escapeHtml(post.title)}</h3>
        <p>${escapeHtml(post.body)}</p>
        ${media}
      </article>
    `;
  }

  async function loadPublishedFeed(targetId, emptyText = 'No published posts yet.') {
    const target = document.getElementById(targetId);
    if (!target) return;
    target.innerHTML = '<div class="notice">Loading feed...</div>';

    try {
      const response = await fetch('/api/feed-posts');
      const data = await response.json().catch(() => ({ error: 'Unknown error' }));
      if (!response.ok) {
        target.innerHTML = `<div class="notice error">${escapeHtml(data.error || 'Could not load feed.')}</div>`;
        return;
      }

      const posts = data.posts || [];
      if (!posts.length) {
        target.innerHTML = `<div class="notice success">${escapeHtml(emptyText)}</div>`;
        return;
      }

      target.innerHTML = posts.map(renderPost).join('');
    } catch (error) {
      target.innerHTML = '<div class="notice error">Could not load feed.</div>';
    }
  }

  function wirePostForm(formId, statusId, options = {}) {
    const form = document.getElementById(formId);
    const status = document.getElementById(statusId);
    if (!form) return;

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = form.querySelector('[name="title"]')?.value || '';
      const body = form.querySelector('[name="body"]')?.value || '';
      const media_url = form.querySelector('[name="media_url"]')?.value || '';

      if (status) {
        status.style.display = 'block';
        status.className = 'notice';
        status.textContent = 'Submitting for review...';
      }

      try {
        const response = await fetch('/api/feed-posts', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ title, body, media_url })
        });
        const data = await response.json().catch(() => ({ error: 'Unknown error' }));
        if (!response.ok) {
          if (status) {
            status.className = 'notice error';
            status.textContent = data.error || 'Could not submit post.';
          }
          return;
        }

        form.reset();
        if (status) {
          status.className = 'notice success';
          status.textContent = data.message || 'Submitted for review.';
        }
        if (typeof options.afterSubmit === 'function') options.afterSubmit();
      } catch {
        if (status) {
          status.className = 'notice error';
          status.textContent = 'Could not submit post.';
        }
      }
    });
  }

  window.JaxtriFeed = { loadPublishedFeed, wirePostForm, escapeHtml };
})();
