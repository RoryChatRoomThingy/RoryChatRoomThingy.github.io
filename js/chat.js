(function () {
  let typingTimeout = null;
  let activeTypers = {};

  window.currentUser = null;
  window.currentProfile = null;
  window.currentContext = { type: 'dm', targetId: null, name: 'Direct Messages' };
  window.allProfiles = [];
  window.chatChannel = null;

  /* ==========================================================================
     1. Text Formatting & Markdown Parser
     ========================================================================== */
  function processInlineAndLineStyles(text = '') {
    const lines = text.split('\n');
    const processedLines = lines.map((line) => {
      // Single-Line Quote (> text or &gt; text)
      if (/^(?:>|&gt;)\s+(.*)$/.test(line)) {
        return line.replace(/^(?:>|&gt;)\s+(.*)$/, '<blockquote class="msg-quote">$1</blockquote>');
      }
      // Subtext (-# text)
      if (/^-#\s+(.*)$/.test(line)) {
        return line.replace(/^-#\s+(.*)$/, '<span class="msg-subtext">$1</span>');
      }
      // Small Header (### text)
      if (/^###\s+(.*)$/.test(line)) {
        return line.replace(/^###\s+(.*)$/, '<h3 class="msg-h3">$1</h3>');
      }
      // Medium Header (## text)
      if (/^##\s+(.*)$/.test(line)) {
        return line.replace(/^##\s+(.*)$/, '<h2 class="msg-h2">$1</h2>');
      }
      // Big Header (# text)
      if (/^#\s+(.*)$/.test(line)) {
        return line.replace(/^#\s+(.*)$/, '<h1 class="msg-h1">$1</h1>');
      }
      // Bullet Points (- text or * text)
      if (/^[\*\-]\s+(.*)$/.test(line)) {
        return line.replace(/^[\*\-]\s+(.*)$/, '<div class="msg-bullet">• $1</div>');
      }
      // Numbered Lists (1. text)
      if (/^(\d+)\.\s+(.*)$/.test(line)) {
        return line.replace(/^(\d+)\.\s+(.*)$/, '<div class="msg-number">$1. $2</div>');
      }

      return line;
    });

    let result = processedLines.join('\n');

    // Core Inline Formatting
    // Bold (**text**)
    result = result.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    // Underline (__text__)
    result = result.replace(/__(.*?)__/g, '<u>$1</u>');
    // Strikethrough (~~text~~)
    result = result.replace(/~~(.*?)~~/g, '<del>$1</del>');
    // Italics (*text* or _text_)
    result = result.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    result = result.replace(/_([^_]+)_/g, '<em>$1</em>');

    return result;
  }

  function parseTextStyles(text = '') {
    if (!text) return '';

    // Extract Inline Code (`text`) first so formatting regex doesn't affect code contents
    const codeBlocks = [];
    text = text.replace(/`([^`]+)`/g, (match, code) => {
      codeBlocks.push(`<code class="msg-inline-code">${code}</code>`);
      return `___CODE_BLOCK_${codeBlocks.length - 1}___`;
    });

    // Multi-Line Quote (>>> text or &gt;&gt;&gt; text)
    if (/^(?:>>>|&gt;&gt;&gt;)\s+/.test(text)) {
      const quoteContent = text.replace(/^(?:>>>|&gt;&gt;&gt;)\s+/, '');
      text = `<blockquote class="msg-quote-multi">${processInlineAndLineStyles(quoteContent)}</blockquote>`;
    } else {
      text = processInlineAndLineStyles(text);
    }

    // Restore Inline Code Blocks
    text = text.replace(/___CODE_BLOCK_(\d+)___/g, (match, index) => {
      return codeBlocks[Number(index)] || '';
    });

    return text;
  }

  /* ==========================================================================
     2. Helper Functions
     ========================================================================== */
  function resolveAvatarUrl(url) {
    const fallback = 'assets/icons/avatars/user1.png';
    if (!url) return fallback;

    const cleaned = String(url).trim().replace(/^['"]|['"]$/g, '');
    if (!cleaned) return fallback;

    if (/^(file:\/\/\/|[a-zA-Z]:\\|\\\\)/.test(cleaned)) return fallback;
    if (/^https?:\/\//i.test(cleaned) || cleaned.startsWith('data:') || cleaned.startsWith('blob:')) return cleaned;
    if (cleaned.startsWith('/')) return cleaned;
    if (cleaned.startsWith('assets/')) return cleaned;
    if (cleaned.includes('/')) return `assets/${cleaned}`;
    
    return `assets/icons/avatars/${cleaned}`;
  }

  function normalizeMentionValue(value) {
    return String(value || '').toLowerCase().trim().replace(/\s+/g, '');
  }

  function escapeHtml(value = '') {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function buildAttachmentPayload(contentText = '', attachment = null) {
    if (!attachment) return contentText;
    const payload = {
      type: attachment.type || 'application/octet-stream',
      name: attachment.name || 'attachment',
      dataUrl: attachment.dataUrl || ''
    };
    return `${contentText}\n\n[[attachment:${JSON.stringify(payload)}]]`;
  }

  function parseAttachment(content = '') {
    if (!content || typeof content !== 'string') return null;
    const markerStart = content.indexOf('[[attachment:');
    if (markerStart === -1) return null;
    const markerEnd = content.indexOf(']]', markerStart);
    if (markerEnd === -1) return null;

    try {
      return JSON.parse(content.slice(markerStart + 13, markerEnd));
    } catch (error) {
      console.warn('Unable to parse attachment payload:', error);
      return null;
    }
  }

  function stripAttachmentFromContent(content = '') {
    if (!content || typeof content !== 'string') return '';
    const markerStart = content.indexOf('[[attachment:');
    if (markerStart === -1) return content;
    const markerEnd = content.indexOf(']]', markerStart);
    if (markerEnd === -1) return content.slice(0, markerStart).trim();

    return `${content.slice(0, markerStart)}${content.slice(markerEnd + 2)}`.trim();
  }

  function isAudioFile(type = '', name = '') {
    if (type && type.startsWith('audio/')) return true;
    const lowerName = String(name).toLowerCase();
    return /\.(mp3|wav|ogg|m4a|aac|webm|flac)$/i.test(lowerName);
  }

  function renderAttachmentMarkup(attachment) {
    if (!attachment) return '';

    const safeName = escapeHtml(attachment.name || 'Attachment');
    const safeUrl = escapeHtml(attachment.dataUrl || '');

    if (safeUrl.startsWith('file:///')) {
      return `<div class="msg-attachment-file">⚠️ Invalid local file reference</div>`;
    }

    if (attachment.type?.startsWith('image/')) {
      return `<img class="msg-attachment-img" src="${safeUrl}" alt="${safeName}" />`;
    }

    if (isAudioFile(attachment.type, attachment.name)) {
      return `
        <div class="msg-audio-player-card">
          <button class="msg-attachment-audio" type="button" aria-label="Play audio attachment" data-audio-url="${safeUrl}">
            <svg class="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"></path>
            </svg>
            <svg class="pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"></path>
            </svg>
          </button>
          <span class="msg-audio-name">${safeName}</span>
        </div>
      `;
    }

    return `<a class="msg-attachment-file" href="${safeUrl}" download="${safeName}" target="_blank">📎 ${safeName}</a>`;
  }

  function attachAudioAttachmentHandlers() {
    document.querySelectorAll('.msg-attachment-audio').forEach((button) => {
      if (button.dataset.listenerAttached) return;
      button.dataset.listenerAttached = 'true';

      button.addEventListener('click', () => {
        const audioUrl = button.dataset.audioUrl;
        if (!audioUrl) return;

        if (typeof window.toggleAudioPlayback === 'function') {
          window.toggleAudioPlayback(button, audioUrl);
        }
      });
    });
  }

  /* ==========================================================================
     3. Mention System & Typing Indicators
     ========================================================================== */
  function getMentionedUsers(text = '') {
    if (!text || !window.allProfiles?.length) return [];

    const mentions = [];
    const seenIds = new Set();
    const regex = /@\(([^)]+)\)/g;

    for (const match of text.matchAll(regex)) {
      const candidateName = match[1].trim();
      if (!candidateName) continue;

      const normalizedCandidate = normalizeMentionValue(candidateName);
      const matchedProfile = window.allProfiles.find((profile) => {
        const values = [profile.display_name, profile.email, profile.user_name, profile.full_name].filter(Boolean);
        return values.some((value) => {
          const normalizedValue = normalizeMentionValue(value);
          return normalizedValue === normalizedCandidate ||
            normalizedValue.includes(normalizedCandidate) ||
            normalizedCandidate.includes(normalizedValue);
        });
      });

      if (matchedProfile && !seenIds.has(matchedProfile.id)) {
        mentions.push(matchedProfile);
        seenIds.add(matchedProfile.id);
      }
    }

    return mentions;
  }

  function hideMentionSuggestions() {
    const picker = document.getElementById('mention-picker');
    if (picker) {
      picker.innerHTML = '';
      picker.hidden = true;
    }
  }

  function getMentionQuery(text = '') {
    const match = text.match(/@([A-Za-z0-9_. -]*)$/);
    return match ? match[1] : '';
  }

  function renderMentionSuggestions(text = '') {
    const picker = document.getElementById('mention-picker');
    if (!picker) return;

    const query = getMentionQuery(text);
    const shouldShow = text.endsWith('@') || query.length > 0;
    if (!shouldShow) {
      hideMentionSuggestions();
      return;
    }

    const suggestions = (window.allProfiles || [])
      .filter((profile) => profile.id !== window.currentUser?.id)
      .filter((profile) => {
        const values = [profile.display_name, profile.email, profile.user_name, profile.full_name].filter(Boolean);
        const normalizedQuery = normalizeMentionValue(query);
        return values.some((value) => {
          const normalizedValue = normalizeMentionValue(value);
          return !normalizedQuery || normalizedValue.includes(normalizedQuery) || normalizedQuery.includes(normalizedValue);
        });
      })
      .slice(0, 5);

    if (!suggestions.length) {
      hideMentionSuggestions();
      return;
    }

    picker.innerHTML = suggestions.map((profile) => {
      const label = profile.display_name || profile.email || profile.user_name || 'User';
      return `<button class="mention-option" type="button" data-user-id="${profile.id}" data-user-name="${label}">${label}</button>`;
    }).join('');

    picker.querySelectorAll('.mention-option').forEach((option) => {
      option.addEventListener('click', () => {
        if (option.dataset.userId) {
          const input = document.getElementById('msg-input');
          if (input) {
            const existing = input.value;
            const match = existing.match(/@([A-Za-z0-9_. -]*)$/);
            const before = match ? existing.slice(0, match.index) : existing;
            const after = match ? existing.slice(match.index + match[0].length) : '';
            const mentionText = `@(${option.dataset.userName || 'User'})`;
            input.value = `${before}${mentionText}${after}`;
            input.dispatchEvent(new Event('input'));
            input.focus();
            input.setSelectionRange(input.value.length, input.value.length);
          }
        }
        hideMentionSuggestions();
      });
    });

    picker.hidden = false;
  }

  function isMessageMentionedForCurrentUser(message) {
    if (!message || !window.currentUser) return false;
    const mentionedUsers = getMentionedUsers(message.content || '');
    return mentionedUsers.some((user) => user.id === window.currentUser.id);
  }

  function updateTypingUI() {
    const el = document.getElementById('typing-indicator');
    const names = Object.values(activeTypers).map((t) => t.name);

    if (!el) return;
    if (names.length === 0) {
      el.innerText = '';
    } else if (names.length === 1) {
      el.innerText = `${names[0]} is typing...`;
    } else if (names.length === 2) {
      el.innerText = `${names[0]} and ${names[1]} are typing...`;
    } else {
      el.innerText = 'Several people are typing...';
    }
  }

  window.handleTypingInput = function handleTypingInput() {
    const input = document.getElementById('msg-input');
    renderMentionSuggestions(input?.value || '');

    if (!window.chatChannel || !window.currentUser) return;

    window.chatChannel.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        userId: window.currentUser.id,
        userName: window.currentProfile?.display_name || window.currentUser.email.split('@')[0],
        contextType: window.currentContext.type,
        targetId: window.currentContext.targetId,
        isTyping: true
      }
    });

    if (typingTimeout) clearTimeout(typingTimeout);

    typingTimeout = setTimeout(() => {
      window.chatChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: window.currentUser.id,
          userName: window.currentProfile?.display_name || window.currentUser.email.split('@')[0],
          contextType: window.currentContext.type,
          targetId: window.currentContext.targetId,
          isTyping: false
        }
      });
    }, 2000);
  };

  /* ==========================================================================
     4. Realtime & Navigation
     ========================================================================== */
  window.setupRealtime = function setupRealtime() {
    if (window.chatChannel) {
      try {
        window.chatChannel.unsubscribe();
      } catch (error) {
        console.warn('Unable to unsubscribe existing realtime channel:', error);
      }
    }

    const channel = window.supabaseClient.channel('public_chat', {
      config: { broadcast: { self: false } }
    });

    channel.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const msg = payload.new;
      if (window.currentContext.type === 'server' && !msg.is_dm) {
        renderMessage(msg);
      } else if (
        window.currentContext.type === 'dm' &&
        msg.is_dm &&
        ((msg.sender_id === window.currentUser.id && msg.receiver_id === window.currentContext.targetId) ||
          (msg.sender_id === window.currentContext.targetId && msg.receiver_id === window.currentUser.id))
      ) {
        renderMessage(msg);
      }
    });

    channel.on('broadcast', { event: 'typing' }, (payload) => {
      const { userId, userName, contextType, isTyping } = payload.payload;
      const isRelevant = (contextType === 'server' && window.currentContext.type === 'server') ||
        (contextType === 'dm' && window.currentContext.type === 'dm' && userId === window.currentContext.targetId);

      if (!isRelevant) return;

      if (isTyping) {
        if (activeTypers[userId]) clearTimeout(activeTypers[userId].timeout);
        const timeout = setTimeout(() => {
          delete activeTypers[userId];
          updateTypingUI();
        }, 3000);
        activeTypers[userId] = { name: userName, timeout };
      } else {
        if (activeTypers[userId]) {
          clearTimeout(activeTypers[userId].timeout);
          delete activeTypers[userId];
        }
      }
      updateTypingUI();
    });

    window.chatChannel = channel;
    channel.subscribe();
  };

  async function loadUsersList() {
    if (!window.currentUser) return;

    const { data: profiles } = await window.supabaseClient.from('profiles').select('*');
    window.allProfiles = profiles || [];

    const container = document.getElementById('users-list');
    if (!container) return;
    container.innerHTML = '';

    window.allProfiles.forEach((user) => {
      if (user.id === window.currentUser.id) return;

      const div = document.createElement('div');
      div.className = `nav-item dm-user-${user.id}`;
      div.onclick = () => window.switchToContext('dm', user);

      const cleanAvatar = resolveAvatarUrl(user.avatar_url || '');
      div.innerHTML = `
        <img class="user-avatar-small" src="${cleanAvatar}" onerror="this.onerror=null; this.src='assets/icons/avatars/user1.png'" />
        <span>${user.display_name || user.email}</span>
      `;
      container.appendChild(div);
    });
  }

  window.loadUsersList = loadUsersList;

  window.updateUserControls = function updateUserControls() {
    const avatar = document.getElementById('current-user-avatar');
    const name = document.getElementById('current-user-name');
    if (!avatar || !name) return;
    const profileName = window.currentProfile?.display_name || window.currentUser?.email.split('@')[0] || 'You';
    const avatarUrl = resolveAvatarUrl(window.currentProfile?.avatar_url || 'assets/icons/avatars/user1.png');
    avatar.src = avatarUrl;
    name.textContent = profileName;
  };

  /* ==========================================================================
   Egg Room Secret (Deltarune Easter Egg)
   ========================================================================== */
function showEggRoom() {
  let eggOverlay = document.getElementById('egg-room-overlay');

  // Create the overlay dynamically if it doesn't exist yet
  if (!eggOverlay) {
    eggOverlay = document.createElement('div');
    eggOverlay.id = 'egg-room-overlay';

    // Fullscreen dark overlay styling
    Object.assign(eggOverlay.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '100vw',
      height: '100vh',
      backgroundColor: '#000000',
      zIndex: '999999',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      cursor: 'pointer',
      userSelect: 'none'
    });

    eggOverlay.innerHTML = `
      <img 
        src="assets/kris.png" 
        alt="Kris" 
        style="max-height: 55vh; image-rendering: pixelated; object-fit: contain;" 
        onerror="this.alt='[assets/kris.png not found]';"
      />
      <h1 style="
        color: #ffffff; 
        font-family: monospace, sans-serif; 
        font-size: 36px; 
        margin-top: 30px; 
        transform: scaleX(2.4) scaleY(0.85); 
        transform-origin: center; 
        letter-spacing: 2px;
        text-transform: uppercase;
        text-shadow: 2px 2px #000;
      ">Congrats! You found me!</h1>
      <p style="color: #555; margin-top: 50px; font-size: 12px; transform: scaleX(1.2); font-family: monospace;">
        [Click anywhere to exit]
      </p>
    `;

    // Click anywhere on the overlay to close it
    eggOverlay.addEventListener('click', () => {
      eggOverlay.style.display = 'none';
    });

    document.body.appendChild(eggOverlay);
  } else {
    eggOverlay.style.display = 'flex';
  }
}

window.switchToContext = function switchToContext(type, targetUser = null) {
    document.querySelectorAll('.nav-item, .server-icon').forEach((el) => el.classList.remove('active'));

    activeTypers = {};
    updateTypingUI();
    const emotePicker = document.getElementById('emote-picker');
    const audioPicker = document.getElementById('audio-picker');
    const sidebarTitle = document.getElementById('sidebar-title');
    const userList = document.getElementById('users-list');
    if (emotePicker) emotePicker.style.display = 'none';
    if (audioPicker) audioPicker.style.display = 'none';

    if (type === 'server') {
      // 🎲 1 in 20 (5%) chance to show the secret Egg Room
      if (Math.floor(Math.random() * 100) === 0) {
        showEggRoom();
      }

      window.currentContext = { type: 'server', targetId: 'main-server', name: 'Main Server' };
      const serverBtn = document.getElementById('server-btn');
      if (serverBtn) serverBtn.classList.add('active');
      if (sidebarTitle) sidebarTitle.innerText = 'Main Server';
      if (userList) userList.innerHTML = '';
    } else {
      window.currentContext = { type: 'dm', targetId: null, name: 'Direct Messages' };
      const dmBtn = document.getElementById('dm-btn');
      if (dmBtn) dmBtn.classList.add('active');
      if (sidebarTitle) sidebarTitle.innerText = 'Direct Messages';
      if (userList) {
        userList.innerHTML = '';
        loadUsersList();
      }
      if (targetUser) {
        const userName = targetUser.display_name || targetUser.email;
        window.currentContext = { type: 'dm', targetId: targetUser.id, name: `Direct Message: ${userName}` };
        const activeElem = document.querySelector(`.dm-user-${targetUser.id}`);
        if (activeElem) activeElem.classList.add('active');
      }
    }

    const title = document.getElementById('chat-title');
    if (title) title.innerText = window.currentContext.name;
    window.loadMessages();
  };

  /* ==========================================================================
     5. Message Rendering & Sending
     ========================================================================== */
  function formatTimestamp(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function renderMessage(msg) {
    const list = document.getElementById('messages-list');
    if (!list) return;

    const div = document.createElement('div');
    const shouldHighlight = isMessageMentionedForCurrentUser(msg) && msg.sender_id !== window.currentUser?.id;
    div.className = shouldHighlight ? 'msg msg-mentioned' : 'msg';

    try {
      if (shouldHighlight && typeof window.playSoundEffect === 'function') {
        window.playSoundEffect('mention');
      }
    } catch (e) {
      console.warn('Failed to play mention sound', e);
    }

    const cleanAvatarUrl = resolveAvatarUrl(msg.avatar_url || 'assets/icons/avatars/user1.png');
    const displayName = msg.display_name || msg.sender_email || 'User';
    const attachment = parseAttachment(msg.content || '');

    // Strip attachment JSON before styling
    const plainTextContent = stripAttachmentFromContent(msg.content || '');

    // Escape HTML first for security
    const safeContent = escapeHtml(plainTextContent);

    // Parse Markdown text styles
    const styledContent = parseTextStyles(safeContent);

    // Parse emotes and user mentions
    const formattedContent = typeof window.parseEmotes === 'function' ? window.parseEmotes(styledContent) : styledContent;
    const highlightedContent = formattedContent.replace(/@\(([^)]+)\)/g, '<span class="mention-chip">$&</span>');
    const attachmentMarkup = renderAttachmentMarkup(attachment);
    const timeFormatted = formatTimestamp(msg.created_at);

    div.innerHTML = `
      <img class="msg-avatar" src="${cleanAvatarUrl}" alt="pfp" onerror="this.onerror=null; this.src='assets/icons/avatars/user1.png'" />
      <div class="msg-content">
        <div class="msg-header">
          <span class="msg-user">${escapeHtml(displayName)}</span>
          ${timeFormatted ? `<span class="msg-timestamp">${timeFormatted}</span>` : ''}
        </div>
        ${highlightedContent ? `<div class="msg-text">${highlightedContent}</div>` : ''}
        ${attachmentMarkup ? `<div class="msg-attachment-wrap">${attachmentMarkup}</div>` : ''}
      </div>
    `;

    list.appendChild(div);
    attachAudioAttachmentHandlers();
    list.scrollTop = list.scrollHeight;
  }

  window.loadMessages = async function loadMessages() {
    const list = document.getElementById('messages-list');
    if (!list) return;
    list.innerHTML = '';

    let query = window.supabaseClient.from('messages').select('*').order('created_at', { ascending: true });

    if (window.currentContext.type === 'server') {
      query = query.eq('is_dm', false);
    } else if (!window.currentContext.targetId) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'Select a direct message to start chatting.';
      list.appendChild(emptyState);
      return;
    } else {
      query = query.eq('is_dm', true).or(`and(sender_id.eq.${window.currentUser.id},receiver_id.eq.${window.currentContext.targetId}),and(sender_id.eq.${window.currentContext.targetId},receiver_id.eq.${window.currentUser.id})`);
    }

    const { data: messages } = await query;
    if (messages) messages.forEach(renderMessage);
  };

  window.sendMessage = async function sendMessage(attachment = null) {
    const input = document.getElementById('msg-input');
    const contentText = input ? input.value.trim() : '';

    if (!contentText && !attachment) return;
    if (!window.currentUser) return;

    const fullContent = buildAttachmentPayload(contentText, attachment);

    const isDm = window.currentContext.type === 'dm';
    if (isDm && !window.currentContext.targetId) {
      alert('Please select a user to direct message.');
      return;
    }

    const payload = {
      sender_id: window.currentUser.id,
      display_name: window.currentProfile?.display_name || window.currentUser.email.split('@')[0],
      avatar_url: window.currentProfile?.avatar_url || 'assets/icons/avatars/user1.png',
      content: fullContent,
      is_dm: isDm,
      receiver_id: isDm ? window.currentContext.targetId : null
    };

    if (input) input.value = '';
    hideMentionSuggestions();

    const { error } = await window.supabaseClient.from('messages').insert([payload]);
    if (error) {
      console.error('Error sending message:', error);
      alert('Failed to send message.');
    }
  };
})();
