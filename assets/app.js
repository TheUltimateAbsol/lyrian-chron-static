(() => {
  const chatConfig = window.AYRA_CHAT_CONFIG || {};
  const oauthHash = new URLSearchParams(location.hash.slice(1));
  if (oauthHash.has("ayra_token")) {
    const auth = { token: oauthHash.get("ayra_token"), user: oauthHash.get("ayra_user") || "Discord user" };
    sessionStorage.setItem("ayra-auth", JSON.stringify(auth));
    history.replaceState(null, "", `${location.pathname}${location.search}`);
    if (window.opener) {
      window.opener.postMessage({ type: "ayra-auth", ...auth }, location.origin);
      window.close();
    }
  }
  const normalize = value => String(value || "").toLowerCase().trim();
  const params = new URLSearchParams(location.search);

  const navToggle = document.querySelector(".nav-toggle");
  const sidebar = document.querySelector(".site-sidebar");
  const sidebarClose = document.querySelector(".sidebar-close");
  const sidebarScrim = document.querySelector(".sidebar-scrim");
  const setSidebarOpen = open => {
    navToggle?.setAttribute("aria-expanded", String(open));
    sidebar?.classList.toggle("open", open);
    document.body.classList.toggle("sidebar-open", open);
    if (sidebarScrim) sidebarScrim.hidden = !open;
    if (open) sidebarClose?.focus();
  };
  navToggle?.addEventListener("click", () => setSidebarOpen(navToggle.getAttribute("aria-expanded") !== "true"));
  sidebarClose?.addEventListener("click", () => {
    setSidebarOpen(false);
    navToggle?.focus();
  });
  sidebarScrim?.addEventListener("click", () => setSidebarOpen(false));
  sidebar?.querySelectorAll("a").forEach(link => link.addEventListener("click", () => setSidebarOpen(false)));
  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && navToggle?.getAttribute("aria-expanded") === "true") {
      setSidebarOpen(false);
      navToggle.focus();
    }
  });
  addEventListener("resize", () => {
    if (innerWidth > 900 && navToggle?.getAttribute("aria-expanded") === "true") setSidebarOpen(false);
  });

  const keywordLinks = [...document.querySelectorAll(".keyword[data-tooltip]")];
  if (keywordLinks.length) {
    const tooltip = document.createElement("div");
    tooltip.id = "keyword-tooltip";
    tooltip.className = "keyword-tooltip-popover";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.append(tooltip);
    let activeKeyword = null;
    const positionTooltip = () => {
      if (!activeKeyword || tooltip.hidden) return;
      const anchor = activeKeyword.getBoundingClientRect();
      const gap = 9;
      const edge = 12;
      const width = tooltip.offsetWidth;
      const height = tooltip.offsetHeight;
      const left = Math.min(innerWidth - width - edge, Math.max(edge, anchor.left + anchor.width / 2 - width / 2));
      let top = anchor.top - height - gap;
      if (top < edge) top = anchor.bottom + gap;
      top = Math.min(innerHeight - height - edge, Math.max(edge, top));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };
    const showTooltip = link => {
      activeKeyword = link;
      tooltip.textContent = link.dataset.tooltip;
      tooltip.hidden = false;
      link.setAttribute("aria-describedby", tooltip.id);
      requestAnimationFrame(positionTooltip);
    };
    const hideTooltip = link => {
      if (activeKeyword !== link) return;
      link.removeAttribute("aria-describedby");
      activeKeyword = null;
      tooltip.hidden = true;
    };
    keywordLinks.forEach(link => {
      link.addEventListener("pointerenter", () => showTooltip(link));
      link.addEventListener("pointerleave", () => hideTooltip(link));
      link.addEventListener("focus", () => showTooltip(link));
      link.addEventListener("blur", () => hideTooltip(link));
    });
    addEventListener("scroll", positionTooltip, true);
    addEventListener("resize", positionTooltip);
  }

  const abilityPreviewLinks = [...document.querySelectorAll(".ability-preview-link[data-ability-preview]")];
  if (abilityPreviewLinks.length) {
    const tooltip = document.createElement("div");
    tooltip.id = "ability-preview-tooltip";
    tooltip.className = "ability-preview-popover";
    tooltip.setAttribute("role", "tooltip");
    tooltip.hidden = true;
    document.body.append(tooltip);
    let activeLink = null;
    let showTimer = 0;
    const positionTooltip = () => {
      if (!activeLink || tooltip.hidden) return;
      const anchor = activeLink.getBoundingClientRect();
      const gap = 10;
      const edge = 12;
      const width = tooltip.offsetWidth;
      const height = tooltip.offsetHeight;
      const left = Math.min(innerWidth - width - edge, Math.max(edge, anchor.left + anchor.width / 2 - width / 2));
      let top = anchor.top - height - gap;
      if (top < edge) top = anchor.bottom + gap;
      top = Math.min(innerHeight - height - edge, Math.max(edge, top));
      tooltip.style.left = `${left}px`;
      tooltip.style.top = `${top}px`;
    };
    const cancelPending = () => {
      clearTimeout(showTimer);
      showTimer = 0;
    };
    const showTooltip = link => {
      cancelPending();
      if (activeLink && activeLink !== link) activeLink.removeAttribute("aria-describedby");
      activeLink = link;
      tooltip.innerHTML = link.dataset.abilityPreview;
      tooltip.hidden = false;
      link.setAttribute("aria-describedby", tooltip.id);
      requestAnimationFrame(positionTooltip);
    };
    const scheduleTooltip = link => {
      cancelPending();
      showTimer = setTimeout(() => showTooltip(link), 550);
    };
    const hideTooltip = link => {
      cancelPending();
      if (activeLink !== link) return;
      link.removeAttribute("aria-describedby");
      activeLink = null;
      tooltip.hidden = true;
      tooltip.replaceChildren();
    };
    abilityPreviewLinks.forEach(link => {
      link.addEventListener("pointerenter", () => scheduleTooltip(link));
      link.addEventListener("pointerleave", () => hideTooltip(link));
      link.addEventListener("focus", () => showTooltip(link));
      link.addEventListener("blur", () => hideTooltip(link));
    });
    addEventListener("scroll", positionTooltip, true);
    addEventListener("resize", positionTooltip);
  }

  const controls = document.querySelector("[data-index-controls]");
  const grid = document.querySelector("[data-index-grid]");
  if (controls && grid) {
    for (const field of controls.elements) {
      if (!field.name) continue;
      field.value = params.has(field.name) ? params.get(field.name) : field.value;
    }
    for (const disclosure of controls.querySelectorAll("[data-filter-disclosure]")) {
      disclosure.open = [...disclosure.querySelectorAll("[name]")].some(field => field.value);
    }
    const update = () => {
      const state = Object.fromEntries(new FormData(controls));
      const next = new URLSearchParams();
      for (const [name, value] of Object.entries(state)) if (value) next.set(name, value);
      history.replaceState(null, "", `${location.pathname}${next.size ? `?${next}` : ""}`);
      const returnPath = `${location.pathname}${next.size ? `?${next}` : ""}`;
      const sectionPath = `/${controls.dataset.sectionKey}/`;
      for (const link of grid.querySelectorAll("a[href]")) {
        const destination = new URL(link.getAttribute("href"), location.origin);
        if (destination.origin !== location.origin || !destination.pathname.startsWith(sectionPath) || destination.pathname === sectionPath) continue;
        destination.searchParams.delete("return");
        if (next.size) destination.searchParams.set("return", returnPath);
        link.href = `${destination.pathname}${destination.search}${destination.hash}`;
      }
      const cards = [...grid.querySelectorAll("[data-card]")];
      const query = normalize(state.filter);
      const exactFacets = new Set(["keyword", "source", "l1Grant", "l3Skill", "l5Stat", "l7Stat", "alternateUnlock", "hasRefund"]);
      for (const card of cards) {
        const matchesQuery = !query || normalize(`${card.dataset.name} ${card.dataset.search}`).includes(query);
        const facetNames = Object.keys(state).filter(name => name !== "filter" && name !== "sort");
        const matches = matchesQuery && facetNames.every(name => {
          if (!state[name]) return true;
          const cardValue = normalize(card.dataset[name]);
          const wanted = normalize(state[name]);
          return exactFacets.has(name) ? cardValue.split("|").includes(wanted) : cardValue.includes(wanted);
        });
        card.hidden = !matches;
      }
      const direction = state.sort?.endsWith("desc") ? -1 : 1;
      const sortField = state.sort?.split("-")[0] || "name";
      cards.sort((a, b) => {
        // A typed name match is always more useful than a match found only in
        // descriptive text or metadata. Preserve the selected sort inside each tier.
        if (query) {
          const aTitleMatch = normalize(a.dataset.name).includes(query);
          const bTitleMatch = normalize(b.dataset.name).includes(query);
          if (aTitleMatch !== bTitleMatch) return aTitleMatch ? -1 : 1;
        }
        const numericFields = new Set(["cost", "tier", "l1skill", "l1stat", "l3points", "l3count", "l5count", "l7count"]);
        const av = numericFields.has(sortField) ? Number(a.dataset[sortField] || 0) : normalize(a.dataset[sortField]);
        const bv = numericFields.has(sortField) ? Number(b.dataset[sortField] || 0) : normalize(b.dataset[sortField]);
        return (av > bv ? 1 : av < bv ? -1 : 0) * direction;
      }).forEach(card => grid.append(card));
      const visible = cards.filter(card => !card.hidden).length;
      controls.querySelector("[data-result-count]").textContent = `${visible} result${visible === 1 ? "" : "s"}`;
    };
    controls.addEventListener("input", update);
    controls.addEventListener("change", update);
    controls.querySelector("[data-clear]")?.addEventListener("click", () => {
      controls.reset();
      for (const disclosure of controls.querySelectorAll("[data-filter-disclosure]")) disclosure.open = false;
      update();
    });
    update();
  }

  document.querySelectorAll("[data-return-section]").forEach(link => {
    const returnPath = params.get("return");
    const sectionPath = `/${link.dataset.returnSection}/`;
    if (returnPath?.startsWith(sectionPath)) link.href = returnPath;
  });

  const searchInput = document.querySelector("[data-search-query]");
  const searchCards = [...document.querySelectorAll("[data-search-card]")];
  if (searchInput && searchCards.length) {
    searchInput.value = params.get("q") || "";
    const updateSearch = () => {
      const query = normalize(searchInput.value);
      let shown = 0;
      for (const card of searchCards) {
        const visible = !query || normalize(`${card.dataset.name} ${card.dataset.search}`).includes(query);
        card.hidden = !visible;
        if (visible) shown++;
      }
      if (query) {
        searchCards.sort((a, b) => {
          const aTitleMatch = normalize(a.dataset.name).includes(query);
          const bTitleMatch = normalize(b.dataset.name).includes(query);
          if (aTitleMatch !== bTitleMatch) return aTitleMatch ? -1 : 1;
          return normalize(a.dataset.name).localeCompare(normalize(b.dataset.name));
        }).forEach(card => card.parentElement.append(card));
      }
      document.querySelector("[data-search-count]").textContent = `${shown} result${shown === 1 ? "" : "s"}`;
    };
    searchInput.addEventListener("input", updateSearch);
    updateSearch();
  }

  const copyCommand = async (button, command) => {
    const originalLabel = button.textContent;
    try {
      await navigator.clipboard.writeText(command);
      button.textContent = "Copied";
    } catch {
      button.textContent = "Copy failed";
    }
    window.setTimeout(() => { button.textContent = originalLabel; }, 1400);
  };

  const actionStats = document.querySelector("[data-action-stats]");
  const sharedStatInputs = new Map([...document.querySelectorAll("[data-shared-stat]")].map(input => [input.dataset.sharedStat, input]));
  const inlineSharedInputs = [...document.querySelectorAll("[data-inline-shared-stat]")];
  const rollRangeUpdaters = [];
  const actionStatsKey = "lyrian-manual:basic-action-stats";
  const saveSharedStats = () => {
    localStorage.setItem(actionStatsKey, JSON.stringify(Object.fromEntries([...sharedStatInputs].map(([key, input]) => [key, Number(input.value || 0)]))));
  };
  const setSharedStat = (key, rawValue, source = null, persist = true) => {
    const value = Number(rawValue || 0);
    const topInput = sharedStatInputs.get(key);
    if (topInput && topInput !== source) topInput.value = String(value);
    for (const input of inlineSharedInputs) {
      if (input.dataset.inlineSharedStat === key && input !== source) input.value = String(value);
    }
    if (persist) saveSharedStats();
    rollRangeUpdaters.forEach(update => update());
    document.dispatchEvent(new CustomEvent("sharedstatschange", { detail: { key, value } }));
  };
  if (actionStats && sharedStatInputs.size) {
    let savedStats = {};
    try { savedStats = JSON.parse(localStorage.getItem(actionStatsKey) || "{}"); } catch {}
    for (const [key, input] of sharedStatInputs) input.value = savedStats[key] ?? input.value;
    for (const [key, input] of sharedStatInputs) setSharedStat(key, input.value, input, false);
    saveSharedStats();
    actionStats.addEventListener("input", event => {
      const input = event.target.closest("[data-shared-stat]");
      if (!input) return;
      setSharedStat(input.dataset.sharedStat, input.value, input);
      actionStats.querySelector("[data-stat-storage-status]").textContent = "Stats saved in this browser and applied to every action below.";
    });
    inlineSharedInputs.forEach(input => input.addEventListener("input", () => {
      setSharedStat(input.dataset.inlineSharedStat, input.value, input);
      actionStats.querySelector("[data-stat-storage-status]").textContent = "Stats saved in this browser and applied to every action below.";
    }));
    actionStats.querySelector("[data-reset-action-stats]")?.addEventListener("click", () => {
      for (const [key, input] of sharedStatInputs) {
        input.value = "0";
        setSharedStat(key, 0, input, false);
      }
      localStorage.removeItem(actionStatsKey);
      actionStats.querySelector("[data-stat-storage-status]").textContent = "Saved stats cleared from this browser.";
    });
  }

  document.querySelectorAll("[data-roll-card]").forEach(card => {
    const specs = [...card.querySelectorAll("[data-roll-spec]")];
    const parseDice = spec => {
      const match = spec.dataset.dice.match(/^(\d+)d(\d+)(kh1)?$/i);
      return { count: Number(match[1]), sides: Number(match[2]), keepHighest: Boolean(match[3]) };
    };
    const terms = spec => [
      ...[...spec.querySelectorAll("[data-shared-term]")].map(term => {
        const raw = Number(term.value || 0);
        const multiplier = Number(term.dataset.multiplier || 1);
        return { label: term.dataset.termLabel, raw, multiplier, value: raw * multiplier };
      }),
      ...[...spec.querySelectorAll("[data-roll-term]")].map(input => {
        const raw = Number(input.value || 0);
        const multiplier = Number(input.dataset.multiplier || 1);
        return { label: input.dataset.termLabel, raw, multiplier, value: raw * multiplier };
      }),
    ];
    const signed = value => value < 0 ? ` - ${Math.abs(value)}` : ` + ${value}`;
    const resolvedSpec = spec => {
      const values = terms(spec);
      const fixed = Number(spec.dataset.fixed || 0);
      const expression = `${spec.dataset.dice}${values.map(term => signed(term.value)).join("")}${fixed ? signed(fixed) : ""}`;
      const details = values.map(term => term.multiplier === 1 ? `${term.label} ${term.raw}` : `${term.label} ${term.raw} × ${term.multiplier} = ${term.value}`);
      if (fixed) details.push(`fixed bonus ${fixed}`);
      return { label: spec.dataset.rollLabel, expression, details, values, fixed };
    };
    const updateRanges = () => {
      specs.forEach(spec => {
        const dice = parseDice(spec);
        const resolved = resolvedSpec(spec);
        const bonus = resolved.values.reduce((sum, term) => sum + term.value, 0) + resolved.fixed;
        const minimum = (dice.keepHighest ? 1 : dice.count) + bonus;
        const maximum = (dice.keepHighest ? dice.sides : dice.count * dice.sides) + bonus;
        spec.querySelector("[data-roll-range]").textContent = `Possible total: ${minimum}–${maximum}`;
      });
    };
    const rollIcon = label => /^accuracy$/i.test(label) ? "🎯" : /^damage$/i.test(label) ? "⚔️" : "🎲";
    const generate = () => {
      const rolls = specs.map(resolvedSpec);
      const command = rolls.length > 1
        ? `!multiline\n${rolls.map(roll => `!r ${roll.expression} ${rollIcon(roll.label)} ${card.dataset.actionName} ${roll.label}: ${roll.details.join(", ")}`).join("\n")}`
        : `!r ${rolls[0].expression} ${card.dataset.actionName}: ${rolls[0].details.join(", ")}`;
      card.querySelector("[data-avrae-output]").textContent = command;
      return command;
    };
    card.addEventListener("input", () => {
      updateRanges();
      generate();
    });
    rollRangeUpdaters.push(() => { updateRanges(); generate(); });
    updateRanges();
    generate();
    card.querySelector("[data-copy-roll]")?.addEventListener("click", async () => {
      await copyCommand(card.querySelector("[data-copy-roll]"), generate());
    });
  });

  const skillTool = document.querySelector("[data-skill-check]");
  if (skillTool) {
    const skillProfileKey = "lyrian-manual:skill-check-profile";
    const select = skillTool.querySelector("[data-skill-select]");
    const bonusInput = skillTool.querySelector("[data-skill-bonus]");
    const modifierInput = skillTool.querySelector("[data-skill-modifiers]");
    const substatInput = skillTool.querySelector("[data-skill-substat]");
    const substatField = skillTool.querySelector("[data-skill-substat-field]");
    const formulaOutput = skillTool.querySelector("[data-skill-formula]");
    const rangeOutput = skillTool.querySelector("[data-skill-range]");
    let skillProfile = { selected: select.value, skills: {} };
    try { skillProfile = { ...skillProfile, ...JSON.parse(localStorage.getItem(skillProfileKey) || "{}") }; } catch {}
    skillProfile.skills ||= {};
    skillProfile.skills = Object.fromEntries(Object.entries(skillProfile.skills).map(([key, saved]) => [key, { bonus: Number(saved?.bonus || 0) }]));
    if ([...select.options].some(option => option.value === skillProfile.selected)) select.value = skillProfile.selected;

    const selectedSkill = () => {
      const option = select.selectedOptions[0];
      const substatInput = sharedStatInputs.get(option.dataset.substatKey);
      const dice = option.dataset.dice || "1d20";
      return {
        key: option.value,
        name: option.dataset.skillName,
        kind: option.dataset.rollKind || "main",
        dice,
        dieSides: Number(dice.match(/d(\d+)/i)?.[1] || 20),
        substatKey: option.dataset.substatKey,
        substatLabel: option.dataset.substatLabel,
        substat: Number(substatInput?.value || 0),
      };
    };
    const saveSkillProfile = () => localStorage.setItem(skillProfileKey, JSON.stringify(skillProfile));
    saveSkillProfile();
    const updateSkillDisplay = () => {
      const skill = selectedSkill();
      skillTool.querySelector("[data-selected-skill-label]").textContent = skill.name;
      const usesSubstat = Boolean(skill.substatKey);
      substatField.hidden = !usesSubstat;
      skillTool.querySelector("[data-selected-substat-label]").textContent = usesSubstat ? skill.substatLabel : "";
      substatInput.dataset.substatKey = skill.substatKey;
      substatInput.value = String(skill.substat);
      formulaOutput.textContent = usesSubstat
        ? `${skill.dice} + Sub-stat + Skill + Expertise + modifiers`
        : `${skill.dice} + ${skill.name} + Expertise + modifiers`;
      updateSkillRange();
      generateSkill();
    };
    const loadSelectedSkill = () => {
      const skill = selectedSkill();
      const saved = skillProfile.skills[skill.key] || {};
      bonusInput.value = saved.bonus ?? 0;
      modifierInput.value = 0;
      updateSkillDisplay();
    };
    const saveSelectedSkill = () => {
      const skill = selectedSkill();
      skillProfile.selected = skill.key;
      skillProfile.skills[skill.key] = { bonus: Number(bonusInput.value || 0) };
      saveSkillProfile();
      updateSkillDisplay();
    };
    const signedSkill = value => value < 0 ? ` - ${Math.abs(value)}` : ` + ${value}`;
    const skillRoll = () => {
      const skill = selectedSkill();
      const bonus = Number(bonusInput.value || 0);
      const modifiers = Number(modifierInput.value || 0);
      const expression = `${skill.dice}${skill.substatKey ? signedSkill(skill.substat) : ""}${signedSkill(bonus)}${signedSkill(modifiers)}`;
      const terms = [skill.substatKey && `${skill.substatLabel} ${skill.substat}`, `${skill.name} ${bonus}`, `Expertise + modifiers ${modifiers}`].filter(Boolean);
      const annotation = `${skill.name} check: ${terms.join(", ")}`;
      return { skill, bonus, modifiers, expression, command: `!r ${expression} ${annotation}` };
    };
    function updateSkillRange() {
      const roll = skillRoll();
      const bonus = roll.skill.substat + roll.bonus + roll.modifiers;
      const minimum = 1 + bonus;
      const maximum = roll.skill.dieSides + bonus;
      rangeOutput.textContent = `Possible total: ${minimum}–${maximum}`;
    }

    select.addEventListener("change", () => {
      skillProfile.selected = select.value;
      saveSkillProfile();
      loadSelectedSkill();
    });
    bonusInput.addEventListener("input", saveSelectedSkill);
    modifierInput.addEventListener("input", () => { updateSkillRange(); generateSkill(); });
    substatInput.addEventListener("input", () => {
      const skill = selectedSkill();
      if (skill.substatKey) setSharedStat(skill.substatKey, substatInput.value, substatInput);
      updateSkillRange();
      generateSkill();
    });
    document.addEventListener("sharedstatschange", event => {
      if (selectedSkill().substatKey && event.detail.key === selectedSkill().substatKey && event.target !== substatInput) updateSkillDisplay();
    });
    const generateSkill = () => {
      const command = skillRoll().command;
      skillTool.querySelector("[data-skill-output]").textContent = command;
      return command;
    };
    skillTool.querySelector("[data-copy-skill]").addEventListener("click", async () => {
      await copyCommand(skillTool.querySelector("[data-copy-skill]"), generateSkill());
    });
    loadSelectedSkill();
  }
  if (chatConfig.apiUrl && !chatConfig.fullInterface) {
    const shell = document.createElement("section");
    shell.className = "ayra-chat";
    shell.innerHTML = `<button class="ayra-chat-toggle" type="button" aria-expanded="false">Ask Aira <small>AI</small></button><div class="ayra-chat-panel" hidden><header><div><strong>Aira <span>(AI)</span></strong><small>rules, rulings & builds</small></div><button type="button" data-chat-close aria-label="Close chat">×</button></header><div class="ayra-chat-log" role="log" aria-live="polite"><p class="ayra-message ayra-message-agent">yea?</p></div><div class="ayra-chat-auth"></div><form><label class="sr-only" for="ayra-chat-input">Ask a question</label><textarea id="ayra-chat-input" rows="2" maxlength="4000" placeholder="Ask about a rule or paste a Google Sheet URL…"></textarea><button type="submit">Ask</button></form><p class="ayra-chat-disclosure">AI roleplay, not the actual designer. Verify important rulings.</p></div>`;
    document.body.append(shell);
    const panel = shell.querySelector(".ayra-chat-panel");
    const toggle = shell.querySelector(".ayra-chat-toggle");
    const log = shell.querySelector(".ayra-chat-log");
    const form = shell.querySelector("form");
    const textarea = shell.querySelector("textarea");
    const authBox = shell.querySelector(".ayra-chat-auth");
    const conversation = [];
    const getAuth = () => { try { return JSON.parse(sessionStorage.getItem("ayra-auth") || "null"); } catch { return null; } };
    const addMessage = (text, kind) => {
      const message = document.createElement("p");
      message.className = `ayra-message ayra-message-${kind}`;
      message.textContent = text;
      log.append(message);
      log.scrollTop = log.scrollHeight;
      return message;
    };
    const renderAuth = () => {
      const auth = getAuth();
      authBox.replaceChildren();
      const button = document.createElement("button");
      button.type = "button";
      if (auth?.token) {
        button.textContent = `${auth.user} · sign out`;
        button.addEventListener("click", () => { sessionStorage.removeItem("ayra-auth"); renderAuth(); });
      } else {
        button.textContent = "Sign in with Discord";
        button.addEventListener("click", () => {
          const login = `${chatConfig.apiUrl}/auth/login?return_to=${encodeURIComponent(location.href.split("#")[0])}`;
          window.open(login, "ayra-discord-login", "popup,width=520,height=720");
        });
      }
      authBox.append(button);
      form.hidden = !auth?.token;
    };
    addEventListener("message", event => {
      if (event.origin !== location.origin || event.data?.type !== "ayra-auth") return;
      sessionStorage.setItem("ayra-auth", JSON.stringify({ token: event.data.token, user: event.data.user }));
      renderAuth();
      textarea.focus();
    });
    toggle.addEventListener("click", () => { panel.hidden = !panel.hidden; toggle.setAttribute("aria-expanded", String(!panel.hidden)); if (!panel.hidden) textarea.focus(); });
    shell.querySelector("[data-chat-close]").addEventListener("click", () => { panel.hidden = true; toggle.setAttribute("aria-expanded", "false"); toggle.focus(); });
    form.addEventListener("submit", async event => {
      event.preventDefault();
      const auth = getAuth();
      const question = textarea.value.trim();
      if (!auth?.token || !question) return renderAuth();
      textarea.value = "";
      addMessage(question, "user");
      const waiting = addMessage("…", "agent");
      form.querySelector("button").disabled = true;
      try {
        const response = await fetch(`${chatConfig.apiUrl}/chat`, { method: "POST", headers: { authorization: `Bearer ${auth.token}`, "content-type": "application/json" }, body: JSON.stringify({ message: question, history: conversation.slice(-8) }) });
        const data = await response.json();
        if (response.status === 401) { sessionStorage.removeItem("ayra-auth"); renderAuth(); }
        if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
        waiting.textContent = data.answer;
        conversation.push({ user: question, assistant: data.answer });
      } catch (error) {
        waiting.textContent = error.message;
        waiting.classList.add("ayra-message-error");
      } finally { form.querySelector("button").disabled = false; }
    });
    renderAuth();
  }
})();
