(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const views = ['form', 'choose', 'done', 'already', 'closed', 'error'];
  const show = (name) => {
    for (const v of views) $('view-' + v).hidden = v !== name;
    FX.enter($('view-' + name));
  };

  const input = $('name'), form = $('form'), sendBtn = $('send');
  const nameError = $('name-error');
  let picked = null;      // {id, name} المعلّم الذي اختاره الطالب من الاقتراحات
  let suggestSeq = 0;
  let busy = false;

  async function api(path, body) {
    const res = await fetch(path, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    } : undefined);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error || 'حدث خطأ. حاول مجدداً.'), { status: res.status });
    return data;
  }

  function setError(el, msg) {
    el.textContent = msg || '';
    el.hidden = !msg;
  }

  function optionButton(item, onPick, pressed) {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    b.insertAdjacentHTML('afterbegin', '<svg class="ic" aria-hidden="true"><use href="/icons.svg#chalkboard-teacher"/></svg>');
    const n = document.createElement('span');
    n.className = 'nm';
    n.textContent = item.name;
    const p = document.createElement('span');
    p.className = 'pick';
    p.textContent = pressed ? 'تم الاختيار' : 'اختر';
    b.append(n, p);
    b.addEventListener('click', () => onPick(item));
    li.append(b);
    return li;
  }

  function renderSuggest(items) {
    const list = $('suggest');
    const key = items.map((i) => i.id).join(',');
    const fresh = key !== list.dataset.key;
    list.dataset.key = key;
    list.replaceChildren(...items.map((it) => optionButton(it, (item) => {
      picked = picked && picked.id === item.id ? null : item;
      if (picked) input.value = item.name;
      renderSuggest(items);
    }, picked && picked.id === it.id)));
    $('suggest-wrap').hidden = !items.length;
    if (fresh && items.length) FX.list(list.children);
  }

  let timer;
  input.addEventListener('input', () => {
    picked = null;
    setError(nameError, '');
    clearTimeout(timer);
    const q = input.value.trim();
    if (q.length < 2) { renderSuggest([]); return; }
    timer = setTimeout(async () => {
      const seq = ++suggestSeq;
      try {
        const { items } = await api('/api/suggest?q=' + encodeURIComponent(q));
        if (seq === suggestSeq) renderSuggest(items);
      } catch { /* الاقتراحات اختيارية */ }
    }, 160);
  });

  async function submit(payload, errorEl) {
    if (busy) return;
    busy = true;
    sendBtn.disabled = true;
    try {
      const r = await api('/api/vote', payload);
      if (r.status === 'choose') {
        $('typed').textContent = payload.name;
        $('choices').replaceChildren(...r.candidates.map((c) =>
          optionButton(c, (item) => submit({ name: payload.name, teacherId: item.id }, $('choose-error')))));
        setError($('choose-error'), '');
        show('choose');
        FX.list($('choices').children);
        return;
      }
      try { localStorage.setItem('voted', '1'); } catch {}
      if (r.status === 'counted') {
        $('done-line').textContent = 'سُجّل صوتك للمعلّم';
        $('done-who').textContent = r.teacher;
      } else {
        $('done-line').textContent = 'سُجّل الاسم الذي كتبته';
        $('done-who').textContent = payload.name;
      }
      show('done');
      FX.celebrate($('done-badge'));
    } catch (err) {
      if (err.status === 409) { show('already'); return; }
      if (err.status === 403) { show('closed'); return; }
      setError(errorEl, err.message === 'Failed to fetch' ? 'لا يوجد اتصال. تحقّق من الإنترنت وحاول مجدداً.' : err.message);
    } finally {
      busy = false;
      sendBtn.disabled = false;
    }
  }

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = input.value.replace(/\s+/g, ' ').trim();
    if (name.replace(/\s/g, '').length < 2) {
      setError(nameError, 'اكتب اسم المعلّم أولاً.');
      input.focus();
      return;
    }
    submit(picked ? { name, teacherId: picked.id } : { name }, nameError);
  });

  $('none').addEventListener('click', () => submit({ name: $('typed').textContent, force: true }, $('choose-error')));
  $('back').addEventListener('click', () => { show('form'); input.focus(); });

  (async () => {
    try {
      const s = await api('/api/state');
      if (s.school) $('school').textContent = s.school;
      if (s.title) { $('title').textContent = s.title; document.title = s.title; }
      if (s.voted) return show('already');
      if (!s.open) return show('closed');
      show('form');
      FX.pop($('hero-badge'));
    } catch {
      show('error');
    }
  })();
})();
