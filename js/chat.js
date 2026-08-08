(function () {
  let typingTimeout = null;
  let activeTypers = {};

  window.currentUser = null;
  window.currentProfile = null;
  
  // Default to main server on load
  window.currentContext = { type: 'server', targetId: 'main-server', name: 'Main Server' };
  window.allProfiles = [];
  window.chatChannel = null;

  // Helper to format timestamps like Discord (Today at 3:45 PM, Yesterday at..., etc.)
  function formatDiscordTimestamp(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return '';

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const msgDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());

    const timeOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    const timeStr = date.toLocaleTimeString([], timeOptions);

    if (msgDate.getTime() === today.getTime()) {
      return `Today at ${timeStr}`;
    } else if (msgDate.getTime() === yesterday.getTime()) {
      return `Yesterday at ${timeStr}`;
    } else {
      const dateStr = date.toLocaleDateString([], { month: '2-digit', day: '2-digit', year: 'numeric' });
      return `${dateStr} ${timeStr}`;
    }
  }

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

  // Detect query after `@` symbol
  function getMentionQuery(text = '') {
    const match = text.match(/@([a-zA-Z0-9_]*)$/);
    return match ? match[1].toLowerCase() : null;
  }

  function hideMentionSuggestions() {
    const picker = document.getElementById('mention-picker');
    if (picker) {
      picker.innerHTML = '';
      picker.hidden = true;
    }
  }

  // Render Mention Suggestions dropdown
  function renderMentionSuggestions(text = '') {
    const picker = document.getElementById('mention-picker');
    if (!picker) return;

    const query = getMentionQuery(text);
    if (query === null) {
      hideMentionSuggestions();
      return;
    }

    const suggestions = (window.allProfiles || [])
      .filter((p) => p.id !== window.currentUser?.id)
      .map((p) => {
        const rawName = p.display_name || p.email.split('@')[0] || 'User';
        return {
          ...p,
          handle: rawName.replace(/\s+/g, '')
        };
      })
      .filter((p) => p.handle.toLowerCase().includes(query))
      .slice(0, 5);

    if (suggestions.length === 0) {
      hideMentionSuggestions();
      return;
    }

    picker.innerHTML = suggestions.map((p) => {
      return `<button class="mention-option" type="button" data-handle="${p.handle}">@${p.handle}</button>`;
    }).join('');

    picker.querySelectorAll('.mention-option').forEach((option) => {
      option.addEventListener('click', () => {
        const input = document.getElementById('msg-input');
        if (input) {
          const existing = input.value;
          const match = existing.match(/@([a-zA-Z0-9_]*)$/);
          if (match) {
            const before = existing.slice(0, match.index);
            input.value = `${before}@${option.dataset.handle} `;
            input.focus();
          }
        }
        hideMentionSuggestions();
      });
    });

    picker.hidden = false;
  }

  function isMessageMentionedForCurrentUser(message) {
    if (!message || !window.currentUser) return false;
    
    const myName = window.currentProfile?.display_name || window.currentUser?.email?.split('@')[0] || '';
    if (!myName) return false;

    const myHandle = `@${myName.replace(/\s+/g, '')}`.toLowerCase();
    const content = (message.content || '').toLowerCase();

    return content.includes(myHandle) || content.includes(`@(${myName.toLowerCase()})`);
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
      if (window.currentContext.type === 'server' && (!msg.is_dm || msg.is_dm === false)) {
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

  window.loadMessages = async function loadMessages() {
    const list = document.getElementById('messages-list');
    if (!list) return;
    list.innerHTML = '';

    let query = window.supabaseClient.from('messages').select('*').order('created_at', { ascending: true });

    if (window.currentContext.type === 'server') {
      query = query.or('is_dm.eq.false,is_dm.is.null');
    } else if (!window.currentContext.targetId) {
      const emptyState = document.createElement('div');
      emptyState.className = 'empty-state';
      emptyState.textContent = 'Select a direct message to start chatting.';
      list.appendChild(emptyState);
      return;
    } else {
      if (!window.currentUser?.id) {
        console.warn('Cannot load DM messages: Current user is not defined.');
        return;
      }
      const myId = window.currentUser.id;
      const targetId = window.currentContext.targetId;
      query = query.eq('is_dm', true).or(`and(sender_id.eq.${myId},receiver_id.eq.${targetId}),and(sender_id.eq.${targetId},receiver_id.eq.${myId})`);
    }

    const { data: messages, error } = await query;

    if (error) {
      console.error('Error fetching messages from Supabase:', error);
      return;
    }

    if (messages && messages.length > 0) {
      messages.forEach(renderMessage);
    } else {
      console.log('No messages found for current context.');
    }
  };

  function renderMessage(msg) {
    const list = document.getElementById('messages-list');
    if (!list) return;

    const div = document.createElement('div');
    
    // Check if current user was mentioned in this message
    const shouldHighlight = isMessageMentionedForCurrentUser(msg) && msg.sender_id !== window.currentUser?.id;
    div.className = shouldHighlight ? 'msg msg-mentioned' : 'msg';

    if (shouldHighlight) {
      if (typeof window.playSoundEffect === 'function') {
        window.playSoundEffect('ping');
      }
    }

    const cleanAvatarUrl = resolveAvatarUrl(msg.avatar_url || 'assets/icons/avatars/user1.png');
    const displayName = msg.display_name || msg.sender_email || 'User';
    const attachment = parseAttachment(msg.content || '');
    
    const timestampStr = formatDiscordTimestamp(msg.created_at);

    const rawText = stripAttachmentFromContent(msg.content || '');
    const plainTextContent = typeof window.censorContent === 'function' ? window.censorContent(rawText) : rawText;
    const formattedContent = typeof window.parseEmotes === 'function' ? window.parseEmotes(plainTextContent) : plainTextContent;
    
    // Convert mentions to mention chips
    const highlightedContent = formattedContent
      .replace(/@\(([^)]+)\)/g, '<span class="mention-chip">@$1</span>')
      .replace(/@([a-zA-Z0-9_]+)/g, '<span class="mention-chip">@$1</span>');

    const attachmentMarkup = renderAttachmentMarkup(attachment);

    div.innerHTML = `
      <img class="msg-avatar" src="${cleanAvatarUrl}" alt="pfp" onerror="this.onerror=null; this.src='assets/icons/avatars/user1.png'" />
      <div class="msg-content">
        <div class="msg-header">
          <span class="msg-user">${escapeHtml(displayName)}</span>
          <span class="msg-timestamp">${timestampStr}</span>
        </div>
        ${highlightedContent ? `<div class="msg-text">${highlightedContent}</div>` : ''}
        ${attachmentMarkup ? `<div class="msg-attachment-wrap">${attachmentMarkup}</div>` : ''}
      </div>
    `;

    list.appendChild(div);
    attachAudioAttachmentHandlers();
    list.scrollTop = list.scrollHeight;
  }

  window.renderMessage = renderMessage;

  window.handleFileUpload = async function handleFileUpload(event) {
    const input = event?.target;
    const file = input?.files?.[0];

    if (!file || !window.currentUser) {
      if (!window.currentUser) {
        alert('Please sign in before uploading a file.');
      }
      return;
    }

    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read selected file.'));
        reader.readAsDataURL(file);
      });

      const attachment = {
        type: file.type || 'application/octet-stream',
        name: file.name || 'attachment',
        dataUrl
      };

      await window.sendMessage(attachment);
    } catch (error) {
      console.error('Failed to upload attachment:', error);
      alert('Unable to attach this file right now.');
    } finally {
      if (input) input.value = '';
    }
  };

  window.sendMessage = async function sendMessage(attachment = null) {
    const input = document.getElementById('msg-input');
    if (!input || !window.currentUser) return;

    const content = input.value.trim();
    const finalContent = buildAttachmentPayload(content, attachment);
    if (!finalContent.trim() && !attachment) return;

    input.value = '';
    const picker = document.getElementById('emote-picker');
    if (picker) picker.style.display = 'none';

    if (typingTimeout) clearTimeout(typingTimeout);
    if (window.chatChannel) {
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
    }

    hideMentionSuggestions();

    const isDM = window.currentContext.type === 'dm';
    const payload = {
      sender_id: window.currentUser.id,
      sender_email: window.currentUser.email,
      display_name: window.currentProfile?.display_name,
      avatar_url: window.currentProfile?.avatar_url,
      content: finalContent,
      is_dm: isDM,
      receiver_id: isDM ? window.currentContext.targetId : null,
      server_id: isDM ? null : 'main-server'
    };

    await window.supabaseClient.from('messages').insert([payload]);
  };
})();

// Censor Filter Helpers
const FLAGGED_WORDS = ['klop'];

function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

window.censorContent = function censorContent(text) {
  if (!text) return text;

  const normalizedText = text.replace(/[\s\._\-]+/g, '').toLowerCase();

  const containsFlaggedWord = FLAGGED_WORDS.some((word) => {
    if (!word) return false;
    const lowerWord = word.toLowerCase();

    if (normalizedText.includes(lowerWord)) {
      return true;
    }

    const escaped = escapeRegExp(word);
    const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
    return regex.test(text);
  });

  if (containsFlaggedWord) {
    return '<span class="redacted-text">[redacted]</span>';
  }

  return text;
};
