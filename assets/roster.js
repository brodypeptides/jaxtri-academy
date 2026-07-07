(() => {
  const state = {
    open: false,
    tab: 'people',
    user: null,
    members: [],
    channels: [],
    activeType: null,
    activeId: null,
    activeTitle: '',
    refreshTimer: null,
    chatTimer: null,
  };

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>'"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#039;', '"': '&quot;'
    }[c]));
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

  function ensureShell() {
    if (document.getElementById('rosterShell')) return;

    const toggle = document.createElement('button');
    toggle.id = 'rosterToggle';
    toggle.className = 'roster-toggle';
    toggle.type = 'button';
    toggle.innerHTML = `<span>Team</span><strong id="rosterBadge" hidden>0</strong>`;
    toggle.addEventListener('click', () => setOpen(!state.open));

    const panel = document.createElement('aside');
    panel.id = 'rosterShell';
    panel.className = 'roster-shell';
    panel.innerHTML = `
      <div class="roster-head">
        <div>
          <p class="eyebrow">Team roster</p>
          <h2>Members</h2>
        </div>
        <button id="rosterClose" class="btn" type="button">Close</button>
      </div>

      <div id="rosterMe" class="roster-me">Loading team...</div>

      <div class="roster-tabs">
        <button id="rosterPeopleTab" class="active" type="button">People</button>
        <button id="rosterChannelsTab" type="button">Channels</button>
      </div>

      <div id="rosterStatus" class="notice" style="display:none"></div>
      <div id="rosterList" class="roster-list"></div>

      <div id="rosterChat" class="roster-chat" hidden>
        <div class="roster-chat-head">
          <button id="rosterBack" class="btn" type="button">Back</button>
          <div>
            <p class="eyebrow" id="rosterChatType">Message</p>
            <h3 id="rosterChatTitle">Conversation</h3>
          </div>
        </div>
        <div id="rosterMessages" class="roster-messages"></div>
        <form id="rosterMessageForm" class="roster-message-form">
          <textarea id="rosterMessageBody" placeholder="Type a message..."></textarea>
          <details class="roster-attach-box">
            <summary>Add file/image link</summary>
            <input id="rosterAttachmentUrl" type="url" placeholder="https://example.com/file-or-image.png">
            <input id="rosterAttachmentName" type="text" placeholder="Attachment name, optional">
            <p class="small">Sprint 4.4 supports shared links and image URLs. Real uploads come later with R2 storage.</p>
          </details>
          <button class="btn primary" type="submit">Send</button>
        </form>
      </div>
    `;

    document.body.appendChild(toggle);
    document.body.appendChild(panel);

    document.getElementById('rosterClose').addEventListener('click', () => setOpen(false));
    document.getElementById('rosterBack').addEventListener('click', closeChat);
    document.getElementById('rosterPeopleTab').addEventListener('click', () => setTab('people'));
    document.getElementById('rosterChannelsTab').addEventListener('click', () => setTab('channels'));
    document.getElementById('rosterMessageForm').addEventListener('submit', sendMessage);
  }

  function setOpen(open) {
    state.open = open;
    document.getElementById('rosterShell')?.classList.toggle('open', open);
    if (open) refreshAll();
  }

  function setTab(tab) {
    state.tab = tab;
    closeChat(false);
    document.getElementById('rosterPeopleTab')?.classList.toggle('active', tab === 'people');
    document.getElementById('rosterChannelsTab')?.classList.toggle('active', tab === 'channels');
    renderList();
  }

  function setStatus(message, type = '') {
    const el = document.getElementById('rosterStatus');
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

  function updateBadge() {
    const badge = document.getElementById('rosterBadge');
    if (!badge) return;
    const count = totalUnread();
    badge.hidden = count <= 0;
    badge.textContent = String(count > 99 ? '99+' : count);
  }

  function updateMe() {
    const el = document.getElementById('rosterMe');
    if (!el || !state.user) return;
    el.innerHTML = `${statusDot('online')} <strong>${escapeHtml(state.user.full_name)}</strong><span>${escapeHtml(roleLabel(state.user.role))}</span>`;
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

  async function refreshAll() {
    try {
      setStatus('Refreshing team...', '');
      await Promise.all([pingPresence(), loadRoster(), loadChannels()]);
      setStatus('');
      updateBadge();
      renderList();
      if (state.activeType && state.activeId) await loadActiveMessages(false);
    } catch (error) {
      setStatus(error.message, 'error');
      updateBadge();
    }
  }

  function memberCard(member) {
    const unread = Number(member.unread_count || 0);
    const disabled = member.is_self || !member.can_message;
    const title = member.is_self ? 'This is you' : disabled ? 'Affiliates can message owner/manager only.' : 'Open message';
    return `
      <button class="roster-member" type="button" ${disabled ? 'disabled' : ''} title="${escapeHtml(title)}" data-member-id="${member.id}">
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
    return `
      <button class="roster-member" type="button" data-channel-id="${channel.id}">
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
      <details class="roster-create-channel">
        <summary>Create channel</summary>
        <form id="rosterChannelForm" class="form">
          <input id="rosterChannelName" required placeholder="Channel name">
          <input id="rosterChannelDescription" placeholder="Description, optional">
          <select id="rosterChannelAccess">
            <option value="all">Everyone</option>
            <option value="staff">Owner/manager only</option>
          </select>
          <button class="btn primary" type="submit">Create</button>
        </form>
      </details>
    `;
  }

  function renderList() {
    const list = document.getElementById('rosterList');
    if (!list) return;

    if (state.tab === 'channels') {
      list.innerHTML = `${createChannelBox()}${state.channels.map(channelCard).join('') || '<div class="notice">No channels yet.</div>'}`;
      list.querySelectorAll('[data-channel-id]').forEach(button => {
        button.addEventListener('click', () => openChannel(Number(button.dataset.channelId)));
      });
      const form = document.getElementById('rosterChannelForm');
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
    list.querySelectorAll('[data-member-id]').forEach(button => {
      button.addEventListener('click', () => openDm(Number(button.dataset.memberId)));
    });
  }

  async function createChannel(event) {
    event.preventDefault();
    try {
      const name = document.getElementById('rosterChannelName').value;
      const description = document.getElementById('rosterChannelDescription').value;
      const access_role = document.getElementById('rosterChannelAccess').value;
      await api('/api/channels', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, description, access_role }),
      });
      await refreshAll();
    } catch (error) {
      alert(error.message);
    }
  }

  function openDm(memberId) {
    const member = state.members.find(m => Number(m.id) === Number(memberId));
    if (!member || !member.can_message) return;
    state.activeType = 'dm';
    state.activeId = memberId;
    state.activeTitle = member.full_name;
    openChat('Direct message', member.full_name);
  }

  function openChannel(channelId) {
    const channel = state.channels.find(c => Number(c.id) === Number(channelId));
    if (!channel) return;
    state.activeType = 'channel';
    state.activeId = channelId;
    state.activeTitle = `# ${channel.name}`;
    openChat(channel.access_role === 'staff' ? 'Leadership channel' : 'Team channel', `# ${channel.name}`);
  }

  function openChat(typeLabel, title) {
    document.getElementById('rosterList').hidden = true;
    document.getElementById('rosterChat').hidden = false;
    document.getElementById('rosterChatType').textContent = typeLabel;
    document.getElementById('rosterChatTitle').textContent = title;
    document.getElementById('rosterMessageBody').value = '';
    document.getElementById('rosterAttachmentUrl').value = '';
    document.getElementById('rosterAttachmentName').value = '';
    loadActiveMessages(true);
    clearInterval(state.chatTimer);
    state.chatTimer = setInterval(() => loadActiveMessages(false), 5000);
  }

  function closeChat(refresh = true) {
    state.activeType = null;
    state.activeId = null;
    state.activeTitle = '';
    clearInterval(state.chatTimer);
    const chat = document.getElementById('rosterChat');
    const list = document.getElementById('rosterList');
    if (chat) chat.hidden = true;
    if (list) list.hidden = false;
    if (refresh) refreshAll();
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
      const box = document.getElementById('rosterMessages');
      box.innerHTML = messages.length ? messages.map(messageHtml).join('') : '<div class="notice">No messages yet. Start the conversation.</div>';
      if (scroll) box.scrollTop = box.scrollHeight;
      await Promise.all([loadRoster(), loadChannels()]);
      updateBadge();
    } catch (error) {
      document.getElementById('rosterMessages').innerHTML = `<div class="notice error">${escapeHtml(error.message)}</div>`;
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!state.activeType || !state.activeId) return;
    const body = document.getElementById('rosterMessageBody').value;
    const attachment_url = document.getElementById('rosterAttachmentUrl').value;
    const attachment_name = document.getElementById('rosterAttachmentName').value;
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
      document.getElementById('rosterMessageBody').value = '';
      document.getElementById('rosterAttachmentUrl').value = '';
      document.getElementById('rosterAttachmentName').value = '';
      await loadActiveMessages(true);
    } catch (error) {
      alert(error.message);
    }
  }

  async function start() {
    ensureShell();
    await refreshAll();
    state.refreshTimer = setInterval(refreshAll, 10000);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) refreshAll();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
