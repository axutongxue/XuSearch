

  
  const _EYE = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>`;
  const _CLOSE = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`;

  
  
  
  
  const PREVIEW_CSS = `
.xuSearch-preview-shell {
  position: fixed;
  z-index: 2147483647;
  display: none;
  pointer-events: none;
}
.xuSearch-preview-shell:not([hidden]) {
  display: block;
  pointer-events: auto;
}
.xuSearch-preview-card {
  position: relative;
  width: min(392px, calc(100vw - 28px));
  max-height: min(300px, calc(100vh - 28px));
  background: #ffffff;
  border: 1px solid rgba(0, 0, 0, 0.08);
  border-radius: 18px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.18), 0 2px 8px rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: "Segoe UI", "Microsoft YaHei UI", "PingFang SC", Arial, sans-serif;
}
.xuSearch-preview-card[hidden] { display: none; }
.xuSearch-preview-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px 12px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.07);
  flex-shrink: 0;
}
.xuSearch-preview-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.xuSearch-preview-btn {
  height: 34px;
  padding: 0 20px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: background 140ms ease, color 140ms ease, border-color 140ms ease, filter 140ms ease;
  white-space: nowrap;
  font-family: inherit;
  line-height: 1;
}
/* 2026-10-05：统一设置页口径 —— 复制 = 主按钮蓝渐变（hover 两端同比加深），去阴影 */
.xuSearch-preview-btn--copy {
  border: none;
  background: linear-gradient(90deg, #0057ff, #87ceeb);
  color: #ffffff;
}
.xuSearch-preview-btn--copy:hover {
  background: linear-gradient(90deg, #0043cc, #6bc0e8);
  filter: saturate(1.12);
}
.xuSearch-preview-btn--copy:active {
  background: linear-gradient(90deg, #0038ab, #57b3e0);
  filter: saturate(1.18);
}
.xuSearch-preview-btn--copy.is-copied { background: #2dbf62; filter: none; }
/* 2026-10-05：编辑 = 次要按钮方案 B（浅蓝底 + 蓝字，hover 底加深） */
.xuSearch-preview-btn--edit {
  border: none;
  background: #eaf1ff;
  color: #0057ff;
}
.xuSearch-preview-btn--edit:hover {
  background: #cfdfff;
  color: #0046d4;
}
.xuSearch-preview-btn--edit:active {
  background: #b9d0ff;
}
.xuSearch-preview-close-btn {
  width: 28px;
  height: 28px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  border-radius: 50%;
  color: rgba(0, 0, 0, 0.3);
  cursor: pointer;
  flex-shrink: 0;
  padding: 0;
  transition: background 150ms ease, color 150ms ease;
}
.xuSearch-preview-close-btn:hover {
  background: #f9fafb;
  color: #000000;
}
.xuSearch-preview-title {
  padding: 14px 18px 0;
  font-size: 16px;
  font-weight: 600;
  color: #111111;
  line-height: 1.4;
  flex-shrink: 0;
}
.xuSearch-preview-body {
  flex: 1;
  overflow-y: auto;
  padding: 10px 18px 18px;
  font-size: 16px;
  line-height: 1.7;
  color: #444444;
  white-space: pre-wrap;
  word-break: break-word;
  margin: 0;
}
.xuSearch-preview-body::-webkit-scrollbar { width: 5px; }
.xuSearch-preview-body::-webkit-scrollbar-track { background: transparent; }
.xuSearch-preview-body::-webkit-scrollbar-thumb {
  background: #dcdcdc;
  border-radius: 3px;
}
`.trim();

  
  
  function createPreviewManager(shadowRoot, { centerOn } = {}) {
    let cardShell = null;
    let cardEl = null;
    let hideTimer = null;
    let currentOnEdit = null;
    let currentOnSaveEdit = null;
    let currentPrompt = null;
    let isEditMode = false;

    function getHost() {
      return shadowRoot || document.body;
    }

    function fallbackCopy(text) {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      } catch (_) {  }
    }

    function ensureCard() {
      const host = getHost();
      if (!cardShell || !host.contains(cardShell)) {
        cardShell = document.createElement('div');
        cardShell.className = 'xuSearch-preview-shell';
        cardShell.hidden = true;

        cardEl = document.createElement('div');
        cardEl.className = 'xuSearch-preview-card';
        cardEl.hidden = true;
        cardEl.addEventListener('mouseenter', () => {
          cancelHide();
        });
        cardEl.addEventListener('mouseleave', () => scheduleHide());

        cardShell.appendChild(cardEl);
        host.appendChild(cardShell);
      }
      return cardEl;
    }

    function cancelHide() {
      if (hideTimer) {
        clearTimeout(hideTimer);
        hideTimer = null;
      }
    }

    function switchToEditMode(card) {
      isEditMode = true;
      
      const currentH = card.offsetHeight;
      if (currentH > 0) card.style.height = `${currentH}px`;
      card.innerHTML = '';

      const header = document.createElement('div');
      header.className = 'xuSearch-preview-header';
      const lbl = document.createElement('span');
      lbl.style.cssText = 'flex:1;font-size:13px;color:#888;font-weight:500';
      lbl.textContent = '编辑提示词';
      const doneBtn = document.createElement('button');
      doneBtn.type = 'button';
      doneBtn.className = 'xuSearch-preview-btn xuSearch-preview-btn--copy';
      doneBtn.textContent = '完成';
      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'xuSearch-preview-close-btn';
      closeBtn.setAttribute('aria-label', '取消');
      closeBtn.innerHTML = _CLOSE;
      closeBtn.addEventListener('click', (ev) => { ev.stopPropagation(); hide(); });
      header.appendChild(lbl);
      header.appendChild(doneBtn);
      header.appendChild(closeBtn);

      const form = document.createElement('div');
      form.style.cssText = 'display:flex;flex-direction:column;flex:1;padding:8px 14px 12px;gap:8px;overflow:hidden';
      const baseStyle = 'width:100%;padding:6px 10px;border:1px solid #dcdcdc;border-radius:8px;font-size:13px;font-family:inherit;outline:none;box-sizing:border-box;transition:border-color 140ms ease';
      const titleInput = document.createElement('input');
      titleInput.type = 'text';
      titleInput.style.cssText = `${baseStyle};color:#111;flex-shrink:0`;
      titleInput.value = currentPrompt?.title || '';
      titleInput.placeholder = '提示词名称';
      const ta = document.createElement('textarea');
      ta.style.cssText = `${baseStyle};resize:none;flex:1;min-height:80px;line-height:1.6;color:#444`;
      ta.value = currentPrompt?.content || '';
      ta.placeholder = '提示词内容';
      [titleInput, ta].forEach((el) => {
        el.addEventListener('focus', () => { el.style.borderColor = '#999'; });
        el.addEventListener('blur', () => { el.style.borderColor = '#dcdcdc'; });
      });
      form.appendChild(titleInput);
      form.appendChild(ta);
      card.appendChild(header);
      card.appendChild(form);

      doneBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const p = currentPrompt;
        const saveCb = currentOnSaveEdit;
        const newTitle = titleInput.value.trim() || (p?.title || '');
        const newContent = ta.value;
        hide();
        if (saveCb && p) saveCb(p, newTitle, newContent);
      });
      requestAnimationFrame(() => { titleInput.focus(); titleInput.select(); });
    }

    
    function show(anchorEl, prompt, opts) {
      cancelHide();
      const card = ensureCard();
      card.innerHTML = '';
      currentPrompt = prompt;
      currentOnEdit = (opts && typeof opts.onEdit === 'function') ? opts.onEdit : null;
      currentOnSaveEdit = (opts && typeof opts.onSaveEdit === 'function') ? opts.onSaveEdit : null;

      
      const header = document.createElement('div');
      header.className = 'xuSearch-preview-header';

      const actions = document.createElement('div');
      actions.className = 'xuSearch-preview-actions';

      const copyBtn = document.createElement('button');
      copyBtn.type = 'button';
      copyBtn.className = 'xuSearch-preview-btn xuSearch-preview-btn--copy';
      copyBtn.textContent = '复制';
      copyBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        const text = (currentPrompt && currentPrompt.content) || '';
        const markCopied = () => {
          copyBtn.textContent = '✓ 已复制';
          copyBtn.classList.add('is-copied');
          setTimeout(() => {
            copyBtn.textContent = '复制';
            copyBtn.classList.remove('is-copied');
          }, 1500);
        };
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(markCopied).catch(() => {
            fallbackCopy(text);
            markCopied();
          });
        } else {
          fallbackCopy(text);
          markCopied();
        }
      });

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'xuSearch-preview-btn xuSearch-preview-btn--edit';
      editBtn.textContent = '编辑';
      editBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        if (currentOnSaveEdit) {
          switchToEditMode(card);
        } else {
          const cb = currentOnEdit;
          const p = currentPrompt;
          hide();
          if (cb) cb(p);
        }
      });

      actions.appendChild(copyBtn);
      actions.appendChild(editBtn);

      const closeBtn = document.createElement('button');
      closeBtn.type = 'button';
      closeBtn.className = 'xuSearch-preview-close-btn';
      closeBtn.setAttribute('aria-label', '关闭');
      closeBtn.innerHTML = _CLOSE;
      closeBtn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        hide();
      });

      header.appendChild(actions);
      header.appendChild(closeBtn);

      const titleRow = document.createElement('div');
      titleRow.className = 'xuSearch-preview-title';
      titleRow.textContent = (prompt && prompt.title) || '未命名提示词';

      const body = document.createElement('p');
      body.className = 'xuSearch-preview-body';
      body.textContent = (prompt && prompt.content) || '（暂无内容）';

      card.appendChild(header);
      card.appendChild(titleRow);
      card.appendChild(body);
      card.hidden = false;
      if (cardShell) cardShell.hidden = false;

      
      requestAnimationFrame(() => {
        const rect = anchorEl.getBoundingClientRect();
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cardW = card.offsetWidth || 392;
        const cardH = card.offsetHeight || 200;
        const box = typeof centerOn === "function" ? centerOn() : null;
        const base = box?.getBoundingClientRect?.();
        let top;
        let left;
        if (base && base.width && base.height) {
          top = base.top + (base.height - cardH) / 2;
          left = base.left + (base.width - cardW) / 2;
        } else {
          top = rect.bottom + 6;
          left = rect.left;
          if (top + cardH > vh - 8) top = rect.top - cardH - 6;
        }
        if (top < 8) top = 8;
        if (top + cardH > vh - 8) top = Math.max(8, vh - cardH - 8);
        if (left + cardW > vw - 8) left = vw - cardW - 8;
        if (left < 8) left = 8;
        if (cardShell) {
          cardShell.style.top = `${top}px`;
          cardShell.style.left = `${left}px`;
        }
      });
    }

    function hide() {
      isEditMode = false;
      cancelHide();
      if (cardEl) cardEl.style.height = '';
      if (cardShell) cardShell.hidden = true;
      if (cardEl) cardEl.hidden = true;
      currentOnEdit = null;
      currentOnSaveEdit = null;
      currentPrompt = null;
    }

    function scheduleHide() {
      if (isEditMode) return;
      cancelHide();
      hideTimer = setTimeout(() => hide(), 260);
    }

    function destroy() {
      hide();
      if (cardShell && cardShell.parentNode) cardShell.parentNode.removeChild(cardShell);
      cardShell = null;
      cardEl = null;
    }

    return { show, hide, scheduleHide, cancelHide, destroy };
  }

  
  
  function createItem(prompt, {
    onFill,
    onEdit,
    onSaveEdit,
    previewManager,
    itemClass    = 'popup-prompt-item',
    labelClass   = 'popup-prompt-item-label',
    iconsClass   = 'popup-prompt-edit-wrap',
    iconBtnClass = 'popup-prompt-icon-btn',
    rich         = false,
    groupLabel   = '',
  } = {}) {
    const item = document.createElement('div');
    item.className = rich ? `${itemClass} prompt-item--rich` : itemClass;

    const label = document.createElement('span');
    label.className = labelClass;
    label.textContent = prompt.title || '未命名提示词';

    
    
    
    
    
    item.addEventListener('mousedown', (e) => {
      if (!onFill) return;
      if (e.target instanceof Element && e.target.closest(`.${iconsClass}`)) return;
      e.preventDefault();
    });
    item.addEventListener('click', (e) => {
      if (!onFill) return;
      
      if (e.target instanceof Element && e.target.closest(`.${iconsClass}`)) return;
      e.preventDefault();
      e.stopPropagation();
      onFill(prompt);
    });
    
    item.style.cursor = 'pointer';

    const icons = document.createElement('div');
    icons.className = iconsClass;

    
    const eyeBtn = document.createElement('button');
    eyeBtn.type = 'button';
    eyeBtn.className = iconBtnClass;
    eyeBtn.setAttribute('aria-label', '预览');
    eyeBtn.title = '预览';
    eyeBtn.innerHTML = _EYE;
    if (previewManager) {
      let showTimer = null;
      const cancelShow = () => {
        if (showTimer) { clearTimeout(showTimer); showTimer = null; }
      };
      const scheduleShow = () => {
        cancelShow();
        previewManager.cancelHide?.();
        showTimer = setTimeout(() => {
          showTimer = null;
          previewManager.show(eyeBtn, prompt, { onEdit, onSaveEdit });
        }, 200);
      };
      const hidePreview = () => {
        cancelShow();
        previewManager.scheduleHide();
      };
      eyeBtn.addEventListener('mouseenter', scheduleShow);
      eyeBtn.addEventListener('pointerenter', scheduleShow);
      eyeBtn.addEventListener('focus', scheduleShow);
      eyeBtn.addEventListener('mouseleave', hidePreview);
      eyeBtn.addEventListener('pointerleave', hidePreview);
      eyeBtn.addEventListener('blur', hidePreview);
      eyeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        cancelShow();
        previewManager.cancelHide?.();
        previewManager.show(eyeBtn, prompt, { onEdit, onSaveEdit });
      });
    }

    icons.appendChild(eyeBtn);

    if (!rich) {
      item.appendChild(label);
      item.appendChild(icons);
      return item;
    }

    const main = document.createElement('div');
    main.className = 'prompt-item-main';

    const top = document.createElement('div');
    top.className = 'prompt-item-top';
    top.appendChild(label);
    if (groupLabel) {
      const tag = document.createElement('span');
      tag.className = 'prompt-item-tag';
      tag.textContent = groupLabel;
      top.appendChild(tag);
    }
    const count = document.createElement('span');
    count.className = 'prompt-item-count';
    count.textContent = `${String(prompt.content || '').length} 字`;
    top.appendChild(count);

    const excerpt = document.createElement('div');
    excerpt.className = 'prompt-item-ex';
    excerpt.textContent = prompt.content || '';

    main.appendChild(top);
    main.appendChild(excerpt);
    item.appendChild(main);
    item.appendChild(icons);
    return item;
  }

  window.PromptItemUI = { createItem, createPreviewManager, PREVIEW_CSS };
