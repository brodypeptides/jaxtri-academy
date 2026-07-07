(() => {
  const state = {
    tab: 'channels',
    user: null,
    members: [],
    channels: [],
    activeType: null,
    activeId: null,
    activeTitle: '',
    activeSubtitle: '',
    refreshTimer: null,
    chatTimer: null,
    density: 'compact',
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[c]));
  }


  function applyDensity(density) {
    state.density = density === 'comfort' ? 'comfort' : 'compact';
    document.body.classList.toggle('chat-density-compact', state.density === 'compact');
    const button = document.getElementById('teamDensity');
    if (button) button.textContent = state.density === 'compact' ? 'Compact: On' : 'Compact: Off';
    try { localStorage.setItem('jaxtri_team_chat_density', state.density); } catch {}
  }

  function toggleDensity() {
    applyDensity(state.density === 'compact' ? 'comfort' : 'compact');
  }

  function roleLabel(role) {
    if (role === 'owner') return 'Owner';
    if (role === 'manager') return 'Manager';
    return 'Affiliate';
  }

  function isStaff() {
    return state.user && (state.user.role === 'owner' || state.user.role === 'manager');
  }

  function isImageUrl(url) {
    return /\.(png|jpe?g|gif|webp|avif)(\?.*)?$/i.test(String(url || ''));
  }

  function attachmentHtml(message) {
    if (!message.attachment_url) return '';
    const name = message.attachment_name || 'Shared link';
    const safeUrl = escapeHtml(message.attachment_url);
    const safeName = escapeHtml(name);
    if (isImageUrl(message.attachment_url)) {
      return `<a class="roster-attachment" href="${safeUrl}" target="_blank" rel="noreferrer"><img src="${safeUrl}" alt="${safeName}"><span>${safeName}</span></a>`;
    }
    return `<a class="roster-attachment roster-file" href="${safeUrl}" target="_blank" rel="noreferrer">↗ ${safeName}</a>`;
  }

  function statusDot(presence) {
    return `<span class="roster-dot ${escapeHtml(presence || 'offline')}"></span>`;
  }

  function totalUnread() {
    const dmUnread = state.members.reduce((sum, member) => sum + Number(member.unread_count || 0), 0);
    const channelUnread = state.channels.reduce((sum, channel) => sum + Number(channel.unread_count || 0), 0);
    return dmUnread + channelUnread;
  }

  async function api(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({ error: 'Unknown error' }));
    if (!response.ok) throw new Error(data.error || 'Request failed.');
    return data;
  }

  async function pingPresence() {
    try { await fetch('/api/presence', { method: 'POST' }); } catch {}
  }

  async function loadRoster() {
    const data = await api('/api/roster');
    state.user = data.user;
    state.members = data.members || [];
    updateMe();
  }

  async function loadChannels() {
    const data = await api('/api/channels');
    state.channels = data.channels || [];
  }

  function setStatus(message, type = '') {
    const el = document.getElementById('teamStatus');
    if (!el) return;
    if (!message) {
      el.style.display = 'none';
      el.textContent = '';
      return;
    }
    el.style.display = 'block';
    el.className = `notice ${type}`.trim();
    el.textContent = message;
  }

  function updateMe() {
    const el = document.getElementById('teamMe');
    if (!el || !state.user) return;
    el.innerHTML = `${statusDot('online')} <div><strong>${escapeHtml(state.user.full_name)}</strong><p class="small" style="margin:0">${escapeHtml(roleLabel(state.user.role))}${state.user.company_title ? ` • ${escapeHtml(state.user.company_title)}` : ''}</p></div>`;

    const dash = document.getElementById('teamDashboardLink');
    if (dash) dash.href = isStaff() ? 'owner-dashboard.html' : 'academy-dashboard.html';
  }

  function updateCounts() {
    const count = totalUnread();
    const badge = document.getElementById('teamUnreadPill');
    if (badge) badge.textContent = count ? `${count} unread` : 'All caught up';
  }

  async function refreshAll() {
    try {
      await Promise.all([pingPresence(), loadRoster(), loadChannels()]);
      setStatus('');
      updateCounts();
      renderSidebar();
      renderDetails();
      if (!state.activeType) chooseDefaultConversation();
      if (state.activeType && state.activeId) await loadActiveMessages(false);
    } catch (error) {
      setStatus(error.message, 'error');
      updateCounts();
    }
  }

  function chooseDefaultConversation() {
    const params = new URLSearchParams(location.search);
    const dm = Number(params.get('dm'));
    if (dm) {
      const member = state.members.find(m => Number(m.id) === dm && m.can_message);
      if (member) return openDm(dm, false);
    }

    const channelParam = params.get('channel');
    if (channelParam) {
      const channel = state.channels.find(c => String(c.id) === channelParam || c.slug === channelParam);
      if (channel) return openChannel(channel.id, false);
    }

    const general = state.channels.find(c => c.slug === 'general') || state.channels[0];
    if (general) return openChannel(general.id, false);
    renderEmpty('No channels yet', 'Create a channel or open a direct message to start chatting.');
  }

  function memberCard(member) {
    const unread = Number(member.unread_count || 0);
    const disabled = member.is_self || !member.can_message;
    const active = state.activeType === 'dm' && Number(state.activeId) === Number(member.id);
    const title = member.is_self ? 'This is you' : disabled ? 'Affiliates can message owner/manager only.' : 'Open message';
    return `
      <button class="roster-member ${active ? 'active' : ''}" type="button" ${disabled ? 'disabled' : ''} title="${escapeHtml(title)}" data-member-id="${member.id}">
        <span class="roster-avatar">${escapeHtml((member.full_name || '?').slice(0,1).toUpperCase())}</span>
        <span class="roster-member-main">
          <strong>${escapeHtml(member.full_name)}</strong>
          <small>${statusDot(member.presence)} ${escapeHtml(roleLabel(member.role))}${member.company_title ? ` • ${escapeHtml(member.company_title)}` : ''}</small>
        </span>
        ${unread ? `<em>${unread}</em>` : ''}
      </button>
    `;
  }

  function channelCard(channel) {
    const unread = Number(channel.unread_count || 0);
    const active = state.activeType === 'channel' && Number(state.activeId) === Number(channel.id);
    return `
      <button class="roster-member ${active ? 'active' : ''}" type="button" data-channel-id="${channel.id}">
        <span class="roster-avatar">#</span>
        <span class="roster-member-main">
          <strong>${escapeHtml(channel.name)}</strong>
          <small>${channel.access_role === 'staff' ? 'Leadership channel' : 'Team channel'}${channel.latest_at ? ` • ${escapeHtml(channel.latest_at)}` : ''}</small>
        </span>
        ${unread ? `<em>${unread}</em>` : ''}
      </button>
    `;
  }

  function createChannelBox() {
    if (!isStaff()) return '';
    return `
      <details class="team-create-channel">
        <summary>Create channel</summary>
        <form id="teamChannelForm" class="form">
          <input id="teamChannelName" required placeholder="Channel name">
          <input id="teamChannelDescription" placeholder="Description, optional">
          <select id="teamChannelAccess">
            <option value="all">Everyone</option>
            <option value="staff">Owner/manager only</option>
          </select>
          <button class="btn primary" type="submit">Create</button>
        </form>
      </details>
    `;
  }

  function setTab(tab) {
    state.tab = tab;
    document.getElementById('teamChannelsTab')?.classList.toggle('active', tab === 'channels');
    document.getElementById('teamPeopleTab')?.classList.toggle('active', tab === 'people');
    renderSidebar();
  }

  function renderSidebar() {
    const list = document.getElementById('teamSidebarList');
    if (!list) return;

    if (state.tab === 'channels') {
      list.innerHTML = `${createChannelBox()}${state.channels.map(channelCard).join('') || '<div class="notice">No channels yet.</div>'}`;
      list.querySelectorAll('[data-channel-id]').forEach(button => button.addEventListener('click', () => openChannel(Number(button.dataset.channelId))));
      const form = document.getElementById('teamChannelForm');
      if (form) form.addEventListener('submit', createChannel);
      return;
    }

    const online = state.members.filter(m => !m.is_self && m.presence === 'online');
    const away = state.members.filter(m => !m.is_self && m.presence === 'away');
    const offline = state.members.filter(m => !m.is_self && m.presence === 'offline');
    list.innerHTML = `
      ${online.length ? `<p class="roster-section-title">Online</p>${online.map(memberCard).join('')}` : ''}
      ${away.length ? `<p class="roster-section-title">Away</p>${away.map(memberCard).join('')}` : ''}
      ${offline.length ? `<p class="roster-section-title">Offline</p>${offline.map(memberCard).join('')}` : ''}
      ${!state.members.length ? '<div class="notice">No members loaded.</div>' : ''}
    `;
    list.querySelectorAll('[data-member-id]').forEach(button => button.addEventListener('click', () => openDm(Number(button.dataset.memberId))));
  }

  async function createChannel(event) {
    event.preventDefault();
    try {
      const name = document.getElementById('teamChannelName').value;
      const description = document.getElementById('teamChannelDescription').value;
      const access_role = document.getElementById('teamChannelAccess').value;
      await api('/api/channels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, description, access_role }),
      });
      await refreshAll();
      setTab('channels');
    } catch (error) {
      alert(error.message);
    }
  }

  function openDm(memberId, push = true) {
    const member = state.members.find(m => Number(m.id) === Number(memberId));
    if (!member || !member.can_message) return;
    state.activeType = 'dm';
    state.activeId = memberId;
    state.activeTitle = member.full_name;
    state.activeSubtitle = `${roleLabel(member.role)}${member.company_title ? ` • ${member.company_title}` : ''}`;
    setTab('people');
    openChat('Direct message', member.full_name, state.activeSubtitle, push ? `?dm=${memberId}` : null);
  }

  function openChannel(channelId, push = true) {
    const channel = state.channels.find(c => Number(c.id) === Number(channelId));
    if (!channel) return;
    state.activeType = 'channel';
    state.activeId = channelId;
    state.activeTitle = `# ${channel.name}`;
    state.activeSubtitle = channel.access_role === 'staff' ? 'Leadership channel' : 'Team channel';
    setTab('channels');
    openChat(state.activeSubtitle, `# ${channel.name}`, channel.description || state.activeSubtitle, push ? `?channel=${encodeURIComponent(channel.slug || channel.id)}` : null);
  }

  function openChat(typeLabel, title, subtitle, nextUrl) {
    document.getElementById('teamChatType').textContent = typeLabel;
    document.getElementById('teamChatTitle').textContent = title;
    document.getElementById('teamChatSubtitle').textContent = subtitle || '';
    document.getElementById('teamMessageBody').value = '';
    document.getElementById('teamAttachmentUrl').value = '';
    document.getElementById('teamAttachmentName').value = '';
    if (nextUrl) history.replaceState(null, '', nextUrl);
    renderSidebar();
    renderDetails();
    loadActiveMessages(true);
    clearInterval(state.chatTimer);
    state.chatTimer = setInterval(() => loadActiveMessages(false), 5000);
  }

  function renderEmpty(title, text) {
    document.getElementById('teamChatType').textContent = 'Team chat';
    document.getElementById('teamChatTitle').textContent = title;
    document.getElementById('teamChatSubtitle').textContent = text;
    document.getElementById('teamMessages').innerHTML = `<div class="team-empty"><div><h2>${escapeHtml(title)}</h2><p>${escapeHtml(text)}</p></div></div>`;
  }

  function messageHtml(message) {
    const mine = state.user && Number(message.sender_id) === Number(state.user.id);
    return `
      <article class="roster-message ${mine ? 'mine' : ''}">
        <div><strong>${escapeHtml(message.sender_name || 'Member')}</strong><span>${escapeHtml(message.created_at || '')}</span></div>
        ${message.body ? `<p>${escapeHtml(message.body)}</p>` : ''}
        ${attachmentHtml(message)}
      </article>
    `;
  }

  async function loadActiveMessages(scroll = false) {
    if (!state.activeType || !state.activeId) return;
    try {
      const url = state.activeType === 'dm'
        ? `/api/messages/direct?user_id=${encodeURIComponent(state.activeId)}`
        : `/api/channels/${encodeURIComponent(state.activeId)}/messages`;
      const data = await api(url);
      const messages = data.messages || [];
      const box = document.getElementById('teamMessages');
      box.innerHTML = messages.length ? messages.map(messageHtml).join('') : '<div class="notice">No messages yet. Start the conversation.</div>';
      if (scroll) box.scrollTop = box.scrollHeight;
      await Promise.all([loadRoster(), loadChannels()]);
      updateCounts();
      renderSidebar();
      renderDetails();
    } catch (error) {
      document.getElementById('teamMessages').innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.activeType || !state.activeId) return;
    const body = document.getElementById('teamMessageBody').value;
    const attachment_url = document.getElementById('teamAttachmentUrl').value;
    const attachment_name = document.getElementById('teamAttachmentName').value;
    try {
      const url = state.activeType === 'dm' ? '/api/messages/direct' : `/api/channels/${encodeURIComponent(state.activeId)}/messages`;
      const payload = state.activeType === 'dm'
        ? { receiver_id: state.activeId, body, attachment_url, attachment_name }
        : { body, attachment_url, attachment_name };
      await api(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      document.getElementById('teamMessageBody').value = '';
      document.getElementById('teamAttachmentUrl').value = '';
      document.getElementById('teamAttachmentName').value = '';
      await loadActiveMessages(true);
    } catch (error) {
      alert(error.message);
    }
  }

  function renderDetails() {
    const meta = document.getElementById('teamConversationMeta');
    const online = document.getElementById('teamOnlineList');
    if (meta) {
      if (!state.activeType) {
        meta.innerHTML = '<p class="small">Choose a conversation to view details.</p>';
      } else {
        meta.innerHTML = `<h3>${escapeHtml(state.activeTitle)}</h3><p>${escapeHtml(state.activeSubtitle)}</p><p class="small">Unread total: ${totalUnread()}</p>`;
      }
    }

    if (online) {
      const members = state.members.filter(m => !m.is_self && m.presence !== 'offline').slice(0, 20);
      online.innerHTML = members.length
        ? members.map(m => `<div class="team-mini-member">${statusDot(m.presence)}<strong>${escapeHtml(m.full_name)}</strong><span>${escapeHtml(roleLabel(m.role))}</span></div>`).join('')
        : '<p class="small">No one else is active right now.</p>';
    }
  }

  function bind() {
    document.getElementById('teamChannelsTab')?.addEventListener('click', () => setTab('channels'));
    document.getElementById('teamPeopleTab')?.addEventListener('click', () => setTab('people'));
    document.getElementById('teamMessageForm')?.addEventListener('submit', sendMessage);
    document.getElementById('teamRefresh')?.addEventListener('click', () => refreshAll());
    document.getElementById('teamDensity')?.addEventListener('click', toggleDensity);
  }

  async function start() {
    document.body.classList.add('team-page-body');
    try { applyDensity(localStorage.getItem('jaxtri_team_chat_density') || 'compact'); } catch { applyDensity('compact'); }
    bind();
    await refreshAll();
    state.refreshTimer = setInterval(refreshAll, 10000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshAll();
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
