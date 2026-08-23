(() => {
  const config = window.AYRA_CHAT_CONFIG || {};
  if (!config.apiUrl || !config.fullInterface || document.querySelector(".ayra-chat")) return;

  const AUTH_KEY = "ayra-auth";
  const SESSION_KEY = "ayra-chat-session-v1";
  const OPEN_KEY = "ayra-chat-open";
  const MAX_MESSAGES = 30;
  const authRequired = config.requireDiscordAuth === true;
  const avatarUrl = "/assets/ayra-avatar.webp";
  const incomingSoundUrl = "/assets/discord-message.mp3";
  let sending = false;
  let wakeState = "idle";

  const readJson = (storage, key, fallback) => {
    try { return JSON.parse(storage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
  };
  const getAuth = () => readJson(sessionStorage, AUTH_KEY, null);
  const setAuth = auth => auth ? sessionStorage.setItem(AUTH_KEY, JSON.stringify(auth)) : sessionStorage.removeItem(AUTH_KEY);
  const newSessionId = () => crypto.randomUUID();
  let sessionId = localStorage.getItem(SESSION_KEY) || newSessionId();
  localStorage.setItem(SESSION_KEY, sessionId);
  let messages = [];
  let sessionPending = false;
  let pollTimer;

  const shell = document.createElement("section");
  shell.className = "ayra-chat ayra-chat-full";
  shell.innerHTML = `
    <button class="ayra-chat-toggle" type="button" aria-controls="ayra-chat-panel" aria-expanded="false">
      <span class="ayra-avatar-wrap ayra-toggle-avatar-wrap"><img class="ayra-toggle-avatar" src="${avatarUrl}" alt=""><i class="ayra-presence" data-chat-presence data-presence="offline" aria-label="Offline"></i></span>
      <span class="ayra-toggle-copy"><strong>Ask Aira</strong><small>rules & gameplay rulings</small></span>
      <span class="ayra-toggle-status" aria-hidden="true"></span>
    </button>
    <aside class="ayra-chat-panel" id="ayra-chat-panel" aria-label="Ask Aira AI chat" hidden>
      <header class="ayra-chat-header">
        <div class="ayra-chat-identity"><span class="ayra-avatar-wrap"><img class="ayra-avatar" src="${avatarUrl}" alt=""><i class="ayra-presence" data-chat-presence data-presence="offline" aria-label="Offline"></i></span><div><strong>Aira <em>AI</em></strong><small data-chat-status>Offline</small></div></div>
        <div class="ayra-chat-actions">
          <button type="button" data-chat-new title="Start a new chat" aria-label="Start a new chat">↻</button>
          <button type="button" data-chat-close title="Close chat" aria-label="Close chat">×</button>
        </div>
      </header>
      <div class="ayra-chat-account" data-chat-account></div>
      <div class="ayra-chat-scroll" data-chat-scroll>
        <section class="ayra-chat-wake" data-chat-wake hidden aria-live="polite">
          <span class="ayra-wake-ring" aria-hidden="true"></span>
          <div><strong>Waking up…</strong><p>First response may take 5–15 seconds. A researched answer can take several minutes; Aira will leave progress updates here while it works.</p></div>
        </section>
        <section class="ayra-chat-welcome" data-chat-welcome>
          <p class="ayra-kicker">Rules & rulings</p>
          <h2>Ask Aira.</h2>
          <p>Aira searches the current rulebook and the Discord <strong>#gameplay-questions</strong> archive for the answer.</p>
          <div class="ayra-chat-suggestions" aria-label="Suggested questions">
            <button type="button" data-suggestion="How is initiative calculated?">How does initiative work?</button>
            <button type="button" data-suggestion="What happens if I attack the merchant NPCs?">What happens if I attack the merchant NPCs?</button>
            <button type="button" data-suggestion="Can I use a reaction outside my turn?">Can I use a reaction outside my turn?</button>
            <button type="button" data-suggestion="How do I calculate fall damage?">How does fall damage work?</button>
            <button type="button" data-suggestion="What are the rules for stealth and being detected?">How do stealth and detection work?</button>
            <button type="button" data-suggestion="What class will let me get extra AP without using Haste?">What class will let me get extra AP without using Haste?</button>
            <button type="button" data-suggestion="What should a new player know before their first Mirane expedition?">Prep for Mirane</button>
          </div>
        </section>
        <div class="ayra-chat-messages" data-chat-messages role="log" aria-live="polite" aria-relevant="additions"></div>
      </div>
      ${authRequired ? `<section class="ayra-chat-signin" data-chat-signin>
        <div><strong>Continue with Discord</strong><p>Your Discord identity is used for access and rate limits. The bot never receives your password.</p></div>
        <button type="button" data-chat-login><span aria-hidden="true">◈</span> Sign in</button>
      </section>` : `<section class="ayra-chat-signin" data-chat-signin hidden></section>`}
      <form class="ayra-chat-composer" data-chat-form>
        <label class="sr-only" for="ayra-chat-input">Message Aira AI</label>
        <textarea id="ayra-chat-input" rows="1" maxlength="4000" placeholder="Ask about a rule or ruling…" data-chat-input></textarea>
        <button type="submit" data-chat-send aria-label="Send message"><span aria-hidden="true">↑</span></button>
      </form>
      <footer class="ayra-chat-disclosure"><span>Aira (AI)</span> roleplays the designer's style; it is not the real person. Check <strong>#gameplay-questions</strong> for a final ruling.</footer>
    </aside>`;
  document.body.append(shell);

  const panel = shell.querySelector(".ayra-chat-panel");
  const toggle = shell.querySelector(".ayra-chat-toggle");
  const scroll = shell.querySelector("[data-chat-scroll]");
  const wakeScreen = shell.querySelector("[data-chat-wake]");
  const welcome = shell.querySelector("[data-chat-welcome]");
  const messageList = shell.querySelector("[data-chat-messages]");
  const account = shell.querySelector("[data-chat-account]");
  const signin = shell.querySelector("[data-chat-signin]");
  const loginButton = shell.querySelector("[data-chat-login]");
  const form = shell.querySelector("[data-chat-form]");
  const input = shell.querySelector("[data-chat-input]");
  const sendButton = shell.querySelector("[data-chat-send]");
  const status = shell.querySelector("[data-chat-status]");
  const presenceIndicators = [...shell.querySelectorAll("[data-chat-presence]")];

  const setStatus = (text, state = "idle") => {
    status.textContent = text;
    shell.dataset.state = state;
  };
  const setPresence = online => {
    for (const indicator of presenceIndicators) {
      indicator.dataset.presence = online ? "online" : "offline";
      indicator.setAttribute("aria-label", online ? "Active" : "Offline");
    }
  };
  const setOpen = open => {
    panel.hidden = !open;
    toggle.setAttribute("aria-expanded", String(open));
    localStorage.setItem(OPEN_KEY, String(open));
    document.body.classList.toggle("ayra-chat-open", open && matchMedia("(max-width: 600px)").matches);
    if (open) {
      wakeAgent();
      requestAnimationFrame(() => {
        if (wakeState === "waking") return;
        (!authRequired || getAuth()?.token) ? input.focus() : loginButton.focus();
      });
    }
  };

  const safeLink = raw => {
    try {
      const url = new URL(raw, location.origin);
      return ["http:", "https:"].includes(url.protocol) ? url : null;
    } catch { return null; }
  };
  const appendInline = (parent, text) => {
    const pattern = /(\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|`([^`]+)`|https?:\/\/[^\s<]+)/g;
    let cursor = 0;
    for (const match of text.matchAll(pattern)) {
      parent.append(document.createTextNode(text.slice(cursor, match.index)));
      if (match[2] && safeLink(match[3])) {
        const link = document.createElement("a");
        link.href = safeLink(match[3]);
        link.textContent = match[2];
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        parent.append(link);
      } else if (match[4]) {
        const strong = document.createElement("strong");
        strong.textContent = match[4];
        parent.append(strong);
      } else if (match[5]) {
        const code = document.createElement("code");
        code.textContent = match[5];
        parent.append(code);
      } else {
        const url = safeLink(match[0]);
        if (url) {
          const link = document.createElement("a");
          link.href = url;
          link.textContent = match[0];
          link.target = "_blank";
          link.rel = "noopener noreferrer";
          parent.append(link);
        } else parent.append(document.createTextNode(match[0]));
      }
      cursor = match.index + match[0].length;
    }
    parent.append(document.createTextNode(text.slice(cursor)));
  };
  const renderText = (container, text) => {
    const lines = String(text).split("\n");
    let list = null;
    for (const line of lines) {
      const bullet = line.match(/^\s*[-*]\s+(.+)/);
      if (bullet) {
        if (!list) { list = document.createElement("ul"); container.append(list); }
        const item = document.createElement("li");
        appendInline(item, bullet[1]);
        list.append(item);
      } else {
        list = null;
        if (!line.trim()) continue;
        const paragraph = document.createElement("p");
        appendInline(paragraph, line);
        container.append(paragraph);
      }
    }
  };
  const formatMessageTime = value => {
    if (!value) return "now";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return "now";
    return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(date);
  };
  const createMessage = ({ role, text, timestamp, kind = "final", pending = false, error = false }) => {
    const article = document.createElement("article");
    article.className = `ayra-message ayra-message-${role}${pending ? " is-pending" : ""}${kind === "progress" ? " is-progress" : ""}${error || kind === "error" ? " is-error" : ""}`;
    const avatar = document.createElement("div");
    avatar.className = "ayra-message-avatar";
    if (role === "assistant") {
      const image = document.createElement("img");
      image.src = avatarUrl;
      image.alt = "";
      avatar.append(image);
    } else avatar.textContent = "Y";
    const content = document.createElement("div");
    content.className = "ayra-message-content";
    const meta = document.createElement("div");
    meta.className = "ayra-message-meta";
    const author = document.createElement("strong");
    author.textContent = role === "assistant" ? "Aira" : "You";
    meta.append(author);
    if (role === "assistant") {
      const bot = document.createElement("span");
      bot.className = "ayra-bot-tag";
      bot.textContent = "BOT";
      meta.append(bot);
    }
    const time = document.createElement("time");
    time.textContent = formatMessageTime(timestamp);
    meta.append(time);
    const body = document.createElement("div");
    body.className = "ayra-message-body";
    if (pending) body.innerHTML = '<span class="ayra-thinking"><i></i><i></i><i></i></span><span class="sr-only">Aira is thinking</span>';
    else renderText(body, text);
    content.append(meta, body);
    article.append(avatar, content);
    return article;
  };
  const renderMessages = () => {
    messageList.replaceChildren(...messages.map(createMessage));
    const waking = wakeState === "waking";
    wakeScreen.hidden = !waking;
    welcome.hidden = waking || messages.length > 0;
    messageList.hidden = waking;
    scroll.scrollTop = scroll.scrollHeight;
  };
  const sessionHeaders = () => {
    const auth = getAuth();
    return auth?.token ? { authorization: `Bearer ${auth.token}` } : {};
  };
  const syncSession = async () => {
    const response = await fetch(`${config.apiUrl}/chat/session?session_id=${encodeURIComponent(sessionId)}`, { headers: sessionHeaders(), cache: "no-store" });
    if (!response.ok) throw new Error(`Chat sync failed (${response.status})`);
    const data = await response.json();
    const remoteMessages = Array.isArray(data.messages) ? data.messages.filter(message =>
      ["user", "assistant"].includes(message?.role) && typeof message.text === "string"
    ).slice(-MAX_MESSAGES) : [];
    if (remoteMessages.length || !sending) messages = remoteMessages.map(message => ({ ...message, timestamp: message.createdAt }));
    const latest = remoteMessages.at(-1);
    sessionPending = latest?.role === "assistant" && latest.kind === "progress";
    renderMessages();
    updateComposer();
    if (!sessionPending) stopPolling();
  };
  const pollSession = () => syncSession().catch(() => {});
  const startPolling = () => {
    if (pollTimer) return;
    pollSession();
    pollTimer = setInterval(pollSession, 2_500);
  };
  const stopPolling = () => {
    if (!pollTimer) return;
    clearInterval(pollTimer);
    pollTimer = undefined;
  };
  const updateComposer = () => {
    const signedIn = Boolean(getAuth()?.token);
    const hasAccess = !authRequired || signedIn;
    const canChat = hasAccess && wakeState !== "waking";
    signin.hidden = !authRequired || signedIn;
    form.classList.toggle("is-locked", !canChat);
    input.disabled = !canChat || sending || sessionPending;
    sendButton.disabled = !canChat || sending || sessionPending || !input.value.trim();
    if (wakeState === "waking") setStatus("Waking up…", "working");
    else if (!hasAccess) setStatus("Sign in to ask", "locked");
    else if (sending || sessionPending) setStatus("Aira is researching…", "working");
    else if (!sending) setStatus(wakeState === "awake" ? "Active" : "Offline", wakeState === "awake" ? "ready" : "locked");
  };
  const renderAccount = () => {
    const auth = getAuth();
    account.replaceChildren();
    account.hidden = !authRequired;
    if (!authRequired) return updateComposer();
    if (auth?.token) {
      const label = document.createElement("span");
      label.textContent = auth.user || "Discord user";
      const signout = document.createElement("button");
      signout.type = "button";
      signout.textContent = "Sign out";
      signout.addEventListener("click", () => { setAuth(null); renderAccount(); updateComposer(); });
      account.append(label, signout);
    } else {
      const label = document.createElement("span");
      label.textContent = "Discord authentication required";
      account.append(label);
    }
    updateComposer();
  };
  const beginLogin = () => {
    const returnTo = location.href.split("#")[0];
    const url = `${config.apiUrl}/auth/login?return_to=${encodeURIComponent(returnTo)}`;
    const popup = window.open(url, "ayra-discord-login", "popup,width=520,height=720");
    if (!popup) location.href = url;
  };
  const validateAuth = async () => {
    if (!authRequired) return renderAccount();
    const auth = getAuth();
    if (!auth?.token) return renderAccount();
    try {
      const response = await fetch(`${config.apiUrl}/auth/me`, { headers: { authorization: `Bearer ${auth.token}` } });
      if (!response.ok) throw new Error("expired");
      const data = await response.json();
      setAuth({ ...auth, user: data.user?.name || auth.user });
    } catch { setAuth(null); }
    renderAccount();
  };
  const wakeAgent = async () => {
    if (wakeState !== "idle") return;
    wakeState = "waking";
    setPresence(false);
    renderMessages();
    updateComposer();
    try {
      const response = await fetch(`${config.apiUrl}/wake`, {
        headers: { accept: "application/json" },
        cache: "no-store",
        signal: AbortSignal.timeout(20_000),
      });
      if (!response.ok) throw new Error(`Wake request failed (${response.status})`);
      wakeState = "awake";
      setPresence(true);
    } catch {
      wakeState = "failed";
      setPresence(false);
    } finally {
      renderMessages();
      updateComposer();
      if (!panel.hidden && (!authRequired || getAuth()?.token)) input.focus();
    }
  };
  const send = async question => {
    const auth = getAuth();
    const text = String(question || "").trim();
    if (authRequired && !auth?.token) return beginLogin();
    if (!text || sending || sessionPending || wakeState === "waking") return;
    messages.push({ role: "user", text, timestamp: Date.now() });
    messages = messages.slice(-MAX_MESSAGES);
    renderMessages();
    input.value = "";
    input.style.height = "";
    sending = true;
    setStatus("Searching rules…", "working");
    updateComposer();
    try {
      const headers = { "content-type": "application/json", ...sessionHeaders() };
      startPolling();
      const response = await fetch(`${config.apiUrl}/chat`, {
        method: "POST",
        headers,
        body: JSON.stringify({ message: text, sessionId }),
      });
      const data = await response.json().catch(() => ({}));
      if (response.status === 401 && authRequired) { setAuth(null); renderAccount(); }
      if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
      await syncSession();
      if (data.answer) {
        const sound = new Audio(incomingSoundUrl);
        sound.volume = 0.3;
        sound.play().catch(() => {});
      }
    } catch (error) {
      messages.push({ role: "assistant", kind: "error", text: error.message || "couldn't reach it. try again.", timestamp: Date.now() });
      renderMessages();
    } finally {
      sending = false;
      updateComposer();
      if (!authRequired || getAuth()?.token) input.focus();
    }
  };

  toggle.addEventListener("click", () => setOpen(panel.hidden));
  shell.querySelector("[data-chat-close]").addEventListener("click", () => { setOpen(false); toggle.focus(); });
  shell.querySelector("[data-chat-new]").addEventListener("click", () => {
    messages = [];
    sessionPending = false;
    stopPolling();
    sessionId = newSessionId();
    localStorage.setItem(SESSION_KEY, sessionId);
    renderMessages();
    input.focus();
  });
  loginButton?.addEventListener("click", beginLogin);
  shell.querySelectorAll("[data-suggestion]").forEach(button => button.addEventListener("click", () => {
    if (authRequired && !getAuth()?.token) return beginLogin();
    input.value = button.dataset.suggestion;
    updateComposer();
    input.focus();
  }));
  input.addEventListener("input", () => {
    input.style.height = "auto";
    input.style.height = `${Math.min(input.scrollHeight, 132)}px`;
    updateComposer();
  });
  input.addEventListener("keydown", event => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });
  form.addEventListener("submit", event => { event.preventDefault(); send(input.value); });
  addEventListener("message", event => {
    if (event.origin !== location.origin || event.data?.type !== "ayra-auth" || !event.data.token) return;
    setAuth({ token: event.data.token, user: event.data.user || "Discord user" });
    renderAccount();
    setOpen(true);
    input.focus();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && !panel.hidden) { setOpen(false); toggle.focus(); }
  });

  syncSession().then(() => { if (sessionPending) startPolling(); }).catch(() => {});

  renderMessages();
  renderAccount();
  validateAuth();
  setOpen(localStorage.getItem(OPEN_KEY) === "true" && innerWidth > 600);
})();
