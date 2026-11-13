(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const el = (tag, attrs = {}, ...kids) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === false || v == null) continue;
      if (k === 'class') n.className = v;
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) n.append(kid);
    return n;
  };
  const icon = (name) => {
    const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    s.setAttribute('class', 'ic'); s.setAttribute('aria-hidden', 'true');
    const u = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    u.setAttribute('href', '/icons.svg#' + name); s.append(u);
    return s;
  };
  const votesWord = (n) => (n === 1 ? 'صوت واحد' : n === 2 ? 'صوتان' : n >= 3 && n <= 10 ? `${n} أصوات` : `${n} صوتاً`);

  async function api(path, body) {
    const res = await fetch(path, body ? {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    } : undefined);
    const data = await res.json().catch(() => ({}));
    if (res.status === 401 && path !== '/api/admin/login' && path !== '/api/admin/password') { showGate(true); throw new Error('انتهت الجلسة'); }
    if (!res.ok) throw new Error(data.error || 'حدث خطأ. حاول مجدداً.');
    return data;
  }
  function setError(node, msg) { node.textContent = msg || ''; node.hidden = !msg; }

  let toastTimer;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg; t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
  }

  // ---------- نافذة التأكيد / الإدخال ----------
  const dlg = $('dlg');
  function ask({ title, body, ok, danger, input, select, label, run }) {
    return new Promise((resolve) => {
      $('dlg-title').textContent = title;
      $('dlg-body').textContent = body || '';
      $('dlg-body').hidden = !body;
      $('dlg-ok').textContent = ok;
      $('dlg-ok').className = 'btn ' + (danger ? 'btn-danger' : 'btn-primary');
      const inp = $('dlg-input'), sel = $('dlg-select');
      $('dlg-field').hidden = input == null && !select;
      $('dlg-label').textContent = label || '';
      $('dlg-label').htmlFor = select ? 'dlg-select' : 'dlg-input';
      inp.hidden = input == null; sel.hidden = !select;
      if (input != null) inp.value = input;
      if (select) sel.replaceChildren(...select.map((o) => el('option', { value: o.value }, o.label)));
      setError($('dlg-error'), '');
      const form = $('dlg-form');
      const close = (val) => { form.onsubmit = null; dlg.close(); resolve(val); };
      form.onsubmit = async (e) => {
        e.preventDefault();
        const value = select ? sel.value : input != null ? inp.value.trim() : true;
        $('dlg-ok').disabled = true;
        try { await run(value); close(true); }
        catch (err) { setError($('dlg-error'), err.message); }
        finally { $('dlg-ok').disabled = false; }
      };
      $('dlg-cancel').onclick = () => close(false);
      dlg.oncancel = () => { form.onsubmit = null; resolve(false); };
      dlg.showModal();
      (input != null ? inp : select ? sel : $('dlg-cancel')).focus();
    });
  }

  // ---------- الدخول ----------
  let gateMode = 'login';
  function showGate(login) {
    $('app').hidden = true; $('gate').hidden = false;
    gateMode = login ? 'login' : 'setup';
    $('gate-title').textContent = login ? 'لوحة النتائج' : 'إعداد اللوحة';
    FX.enter($('gate-form'));
    $('gate-lede').textContent = login ? 'أدخل كلمة مرور المدير لعرض النتائج.'
      : 'هذه أول مرة تُفتح فيها اللوحة. اختر كلمة مرور للمدير (6 أحرف على الأقل) واحتفظ بها.';
    $('gate-label').textContent = login ? 'كلمة المرور' : 'كلمة مرور جديدة';
    $('gate-pass').autocomplete = login ? 'current-password' : 'new-password';
    $('gate-btn').textContent = login ? 'ادخل' : 'أنشئ كلمة المرور وادخل';
    $('gate-pass').focus();
  }
  $('gate-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const password = $('gate-pass').value;
    if (!password) { setError($('gate-error'), 'اكتب كلمة المرور.'); return; }
    try {
      await api(gateMode === 'login' ? '/api/admin/login' : '/api/admin/setup', { password });
      $('gate-pass').value = ''; setError($('gate-error'), '');
      start();
    } catch (err) { setError($('gate-error'), err.message); }
  });

  // ---------- التبويبات ----------
  const tabs = ['results', 'review', 'teachers', 'qr', 'settings'];
  let shown = null;
  function selectTab(name) {
    for (const t of tabs) {
      $('t-' + t).setAttribute('aria-selected', String(t === name));
      $('t-' + t).tabIndex = t === name ? 0 : -1;
      $('tab-' + t).hidden = t !== name;
    }
    if (FX.on && shown !== name) Motion.animate($('tab-' + name), { opacity: [0, 1], y: [8, 0] }, { duration: 0.28 });
    shown = name;
    if (name === 'qr' && data) renderPoster();
    try { sessionStorage.setItem('tab', name); } catch {}
  }
  tabs.forEach((t, i) => {
    $('t-' + t).addEventListener('click', () => selectTab(t));
    $('t-' + t).addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowLeft' ? 1 : e.key === 'ArrowRight' ? -1 : 0; // RTL
      if (!d) return;
      const next = tabs[(i + d + tabs.length) % tabs.length];
      selectTab(next); $('t-' + next).focus();
    });
  });

  // ---------- العرض ----------
  let data = null;
  const sig = {};
  const changed = (key, value) => {
    const s = JSON.stringify(value);
    if (sig[key] === s) return false;
    sig[key] = s; return true;
  };
  const busyIn = (node) => node.contains(document.activeElement) || dlg.open;

  function emptyState(title, text, action, ico) {
    return el('div', { class: 'empty' }, icon(ico || 'notebook'), el('h3', {}, title), el('p', {}, text), action);
  }

  function renderResults() {
    const { totals, results, settings } = data;
    $('m-school').textContent = settings.school || 'استفتاء المعلّم المفضّل';
    const st = $('m-status');
    st.textContent = settings.open ? 'التصويت مفتوح' : 'التصويت مغلق';
    st.classList.toggle('is-open', settings.open);

    const rc = $('review-count');
    rc.textContent = totals.pending; rc.hidden = !totals.pending;

    if (changed('figures', totals)) {
      const box = $('figures');
      const defs = [['all', 'إجمالي المشاركات', 'users-three'], ['counted', 'أصوات محسوبة', 'check-circle'],
        ['pending', 'بانتظار المراجعة', 'magnifying-glass'], ['teachers', 'معلّمون في القائمة', 'chalkboard-teacher']];
      if (!box.children.length) {
        box.replaceChildren(...defs.map(([k, label, ico]) => el('div', { class: 'figure', 'data-k': k },
          icon(ico), el('dt', {}, label), el('dd', { class: 'num' }, '0'))));
        if (FX.on) Motion.animate([...box.children], { opacity: [0, 1], y: [12, 0] }, { delay: Motion.stagger(0.06), duration: 0.4 });
      }
      for (const [k] of defs) {
        const node = box.querySelector(`[data-k="${k}"]`);
        node.classList.toggle('alert', k === 'pending' && totals.pending > 0);
        FX.count(node.querySelector('dd'), totals[k], (v) => String(Math.round(v)));
      }
    }

    if (!changed('results', results)) return;
    const box = $('results'), leader = $('leader');
    const open = new Set([...box.querySelectorAll('details[open]')].map((d) => d.dataset.id));
      const said = (r) => r.reasons.length > 0 && el('details', { class: 'variants said', 'data-id': 'r' + r.id, open: open.has('r' + r.id) },
        el('summary', {}, icon('heart'), ` كلمات الطلاب عنه (${r.reasons.length})`),
        el('ul', {}, r.reasons.map((q) => el('li', {},
          el('q', {}, q.text),
          el('button', { class: 'link link-ink', onclick: () => dropReason(r, q) }, 'احذف التعليق')))));

    if (!totals.teachers) {
      leader.replaceChildren();
      box.replaceChildren(emptyState('ابدأ بقائمة المعلّمين',
        'أضف أسماء معلّمي المدرسة ليتعرّف النظام على ما يكتبه الطلاب ويحسب كل صوت لصاحبه.',
        el('button', { class: 'btn btn-primary', onclick: () => selectTab('teachers') }, 'أضف المعلّمين'), 'chalkboard-teacher'));
      return;
    }
    if (!totals.counted) {
      leader.replaceChildren();
    } else {
      const tops = results.filter((r) => r.rank === 1);
      const leadKey = tops.map((t) => t.id).join(',');
      const cup = el('span', { class: 'cup' }, icon(tops.length > 1 ? 'medal' : 'trophy'));
      const pctNode = el('span', { class: 'num' }, tops[0].pct + '%');
      const block = el('div', { class: 'leader' }, cup,
        el('p', { class: 'kicker' }, tops.length > 1 ? 'تعادل في الصدارة' : 'المتصدّر الآن'),
        el('p', { class: 'display name' }, tops.map((t) => t.name).join(' و ')),
        el('p', { class: 'pct' }, pctNode,
          el('small', {}, votesWord(tops[0].votes) + (tops.length > 1 ? ' لكلٍّ منهم' : ''))));
      leader.replaceChildren(block);
      if (leader.dataset.key !== leadKey) {   // متصدّر جديد: احتفل
        leader.dataset.key = leadKey;
        FX.pop(cup);
        if (FX.on) Motion.animate(block, { opacity: [0, 1], y: [10, 0] }, { duration: 0.4 });
      }
    }

    const max = Math.max(1, ...results.map((r) => r.votes));
    const first = !box.querySelector('.ledger');
    const head = el('div', { class: 'ledger-head' }, el('div', { class: 'row' },
      el('span', {}, '#'), el('span', {}, 'المعلّم'), el('span', {}, ''), el('span', {}, 'الأصوات'), el('span', {}, 'النسبة')));
    const list = el('ol', { class: 'ledger' }, results.map((r) => {
      const variants = r.variants.length > 1 || (r.variants[0] && r.variants[0].raw !== r.name);
      return el('li', { class: r.rank === 1 && r.votes ? 'is-first' : '' },
        el('div', { class: 'row' },
          el('span', { class: 'rank num' + (r.votes && r.rank <= 3 ? ' r' + r.rank : ''), 'aria-label': r.votes ? `المركز ${r.rank}` : 'بلا أصوات' },
            !r.votes ? '–' : r.rank === 1 ? icon('trophy') : r.rank <= 3 ? icon('medal') : String(r.rank)),
          el('span', { class: 'tname' }, r.name),
          el('span', { class: 'bar', role: 'presentation' }, el('i', { 'data-w': (r.votes / max) * 100, style: `width:${first ? 0 : (r.votes / max) * 100}%` })),
          el('span', { class: 'votes' }, votesWord(r.votes).replace(/^0 صوتاً$/, 'لا أصوات')),
          el('span', { class: 'share num' }, r.pct + '%')),
        variants && el('details', { class: 'variants', 'data-id': r.id, open: open.has(String(r.id)) },
          el('summary', {}, r.variants.length === 1 ? 'كُتب اسمه بصيغة مختلفة' : r.variants.length === 2 ? 'كُتب اسمه بصيغتين' : `كُتب اسمه بـ ${r.variants.length} صيغ`),
          el('ul', {}, r.variants.map((v) => el('li', {},
            el('span', {}, `${v.raw} `, el('span', { class: 'meta num' }, `×${v.count}`)),
            el('button', { class: 'link link-ink', onclick: () => detach(r, v) }, 'ليست له'))))),
        said(r));
    }));
    box.replaceChildren(head, list);
    if (first) {   // أول عرض: الصفوف تدخل والأشرطة تمتلئ
      if (FX.on) Motion.animate([...list.children], { opacity: [0, 1], x: [18, 0] }, { delay: Motion.stagger(0.05), duration: 0.4 });
      requestAnimationFrame(() => requestAnimationFrame(() => list.querySelectorAll('.bar i').forEach((b) => { b.style.width = b.dataset.w + '%'; })));
    }
  }

  function renderReview() {
    const box = $('review');
    if (!changed('review', [data.pending, data.results.map((r) => [r.id, r.name])]) || busyIn(box)) {
      if (busyIn(box)) delete sig.review;
      return;
    }
    if (!data.pending.length) {
      box.replaceChildren(emptyState('لا شيء ينتظر المراجعة',
        'كل الأسماء التي كتبها الطلاب حُسبت لأصحابها. ستظهر هنا أي أسماء لا يستطيع النظام تحديد صاحبها.', null, 'seal-check'));
      return;
    }
    const teachers = [...data.results].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    box.replaceChildren(el('ul', { class: 'ledger review' }, data.pending.map((g) => {
      const norms = g.names.map((n) => n.norm);
      const sugIds = new Set(g.suggestions.map((s) => s.id));
      const select = el('select', { class: 'select', 'aria-label': `المعلّم المقصود بـ ${g.label}` },
        g.suggestions.length ? el('optgroup', { label: 'الأقرب' }, g.suggestions.map((s) => el('option', { value: s.id }, s.name))) : null,
        el('optgroup', { label: 'جديد' }, el('option', { value: 'new', selected: !g.suggestions.length }, 'معلّم جديد غير موجود في القائمة')),
        teachers.some((t) => !sugIds.has(t.id)) ? el('optgroup', { label: 'كل المعلّمين' },
          teachers.filter((t) => !sugIds.has(t.id)).map((t) => el('option', { value: t.id }, t.name))) : null);
      const newName = el('input', { class: 'input', value: g.label, 'aria-label': 'اسم المعلّم الجديد', maxlength: 80 });
      const newWrap = el('div', { class: 'field' }, el('span', { class: 'hint' }, 'الاسم الذي سيُضاف للقائمة:'), newName);
      const err = el('p', { class: 'error', role: 'alert', hidden: true });
      const sync = () => { newWrap.hidden = select.value !== 'new'; };
      select.addEventListener('change', sync); sync();
      const apply = async (btn) => {
        btn.disabled = true;
        try {
          const body = select.value === 'new' ? { norms, newTeacherName: newName.value.trim() } : { norms, teacherId: Number(select.value) };
          if (select.value === 'new' && !body.newTeacherName) throw new Error('اكتب اسم المعلّم الجديد.');
          await api('/api/admin/pending/resolve', body);
          toast(`حُسب ${votesWord(g.count)}`);
          document.activeElement.blur(); await refresh();
        } catch (e) { setError(err, e.message); btn.disabled = false; }
      };
      return el('li', {},
        el('div', {},
          g.ambiguous && el('p', { class: 'flag' }, 'يحتمل أكثر من معلّم'),
          el('h3', {}, g.label),
          el('p', { class: 'spell' }, votesWord(g.count), g.names.length > 1
            ? ' · كُتب: ' + g.names.map((n) => `${n.raw} (${n.count})`).join('، ') : '')),
        el('div', { class: 'act' },
          el('div', { class: 'act-row' }, select,
            el('button', { class: 'btn btn-primary', onclick: (e) => apply(e.currentTarget) }, 'احسبها له')),
          newWrap, err,
          el('div', {}, el('button', { class: 'link link-ink', onclick: () => discard(g, norms) }, 'استبعد هذه الأصوات'))));
    })));
  }

  function renderRoster() {
    const box = $('roster');
    const rows = data.results.map((r) => [r.id, r.name, r.votes]);
    if (!changed('roster', rows) || busyIn(box)) return;
    $('roster-count').textContent = data.results.length ? `${data.results.length} معلّماً` : '';
    if (!data.results.length) {
      box.replaceChildren(emptyState('القائمة فارغة', 'الصق أسماء المعلّمين في الخانة المجاورة، اسم في كل سطر.'));
      return;
    }
    const teachers = [...data.results].sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    box.replaceChildren(el('ul', { class: 'ledger troster' }, teachers.map((t) => el('li', {},
      el('span', {}, t.name, ' ', el('span', { class: 'meta' }, t.votes ? `· ${votesWord(t.votes)}` : '')),
      el('span', { class: 'acts' },
        el('button', { class: 'link link-ink', onclick: () => rename(t) }, 'عدّل الاسم'),
        teachers.length > 1 && el('button', { class: 'link link-ink', onclick: () => merge(t, teachers) }, 'ادمج'),
        el('button', { class: 'link', onclick: () => remove(t) }, 'احذف'))))));
  }

  function renderSettingsOnce() {
    const s = data.settings;
    $('set-school').value = s.school; $('set-title').value = s.title; $('set-open').checked = s.open;
    $('qr-url').value = s.publicUrl || location.origin + '/';
    renderPoster();
  }
  async function renderPoster() {
    const s = data.settings, url = $('qr-url').value.trim();
    $('p-school').textContent = s.school || '';
    $('p-school').hidden = !s.school;
    $('p-title').textContent = s.title;
    $('p-url').textContent = url;
    try {
      const res = await fetch('/api/admin/qr.svg?url=' + encodeURIComponent(url));
      if (!res.ok) throw new Error((await res.json()).error);
      const svg = await res.text();
      $('p-qr').innerHTML = svg;
      $('qr-download').href = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg.replace('#0000', '#ffffff'));
      const local = /\/\/(localhost|127\.|192\.168\.|10\.)/.test(url);
      setError($('qr-error'), local ? 'هذا رابط محلي لن يفتح على هواتف الطلاب. ضع رابط الموقع بعد نشره.' : '');
    } catch (e) { setError($('qr-error'), e.message || 'تعذّر إنشاء الباركود.'); }
  }

  // ---------- الإجراءات ----------
  const act = (path, body, done) => async () => { await api(path, body); if (done) toast(done); await refresh(); };

  function detach(t, v) {
    ask({ title: `فصل «${v.raw}» عن ${t.name}؟`, ok: 'افصلها وأعدها للمراجعة',
      body: `${votesWord(v.count)} ستخرج من رصيده وتنتقل إلى تبويب المراجعة لتقرّر لمن هي.`,
      run: act('/api/admin/variants/detach', { teacherId: t.id, norm: v.norm }, 'أُعيدت إلى المراجعة') });
  }
  function dropReason(t, q) {
    ask({ title: 'حذف هذا التعليق؟', ok: 'احذف التعليق', danger: true,
      body: `«${q.text}» — سيُحذف التعليق فقط، والصوت يبقى محسوباً لـ ${t.name}.`,
      run: act('/api/admin/reasons/delete', { id: q.id }, 'حُذف التعليق') });
  }
  function discard(g, norms) {
    ask({ title: `استبعاد «${g.label}»؟`, ok: `استبعد ${votesWord(g.count)}`, danger: true,
      body: 'لن تُحسب هذه الأصوات لأي معلّم. استخدم هذا للأسماء العبثية أو غير المعروفة.',
      run: act('/api/admin/pending/resolve', { norms, discard: true }, 'تم الاستبعاد') });
  }
  function rename(t) {
    ask({ title: 'تعديل اسم المعلّم', ok: 'احفظ الاسم', input: t.name, label: 'الاسم الكامل',
      run: (name) => { if (!name) throw new Error('اكتب الاسم.'); return act('/api/admin/teachers/rename', { id: t.id, name }, 'حُفظ الاسم')(); } });
  }
  function merge(t, all) {
    ask({ title: `دمج ${t.name} مع معلّم آخر`, ok: 'ادمج وانقل الأصوات', label: 'انقل أصواته إلى',
      body: 'استخدم الدمج إذا تكرّر المعلّم نفسه باسمين. سيُحذف هذا الاسم وتنتقل أصواته كلها.',
      select: all.filter((x) => x.id !== t.id).map((x) => ({ value: x.id, label: x.name })),
      run: (intoId) => act('/api/admin/teachers/merge', { fromId: t.id, intoId: Number(intoId) }, 'تم الدمج')() });
  }
  function remove(t) {
    ask({ title: `حذف ${t.name}؟`, ok: `احذف ${t.name}`, danger: true,
      body: t.votes ? `له ${votesWord(t.votes)}؛ لن تُحذف بل ستعود إلى تبويب المراجعة.` : 'سيُحذف من قائمة المعلّمين.',
      run: act('/api/admin/teachers/delete', { id: t.id }, 'حُذف المعلّم') });
  }

  $('add-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const names = $('add-names').value.split(/\n|،|,/).map((s) => s.trim()).filter(Boolean);
    if (!names.length) { setError($('add-error'), 'اكتب اسماً واحداً على الأقل.'); return; }
    try {
      const r = await api('/api/admin/teachers', { names });
      setError($('add-error'), r.skipped.length ? `موجود مسبقاً ولم يُضف: ${r.skipped.join('، ')}` : '');
      $('add-names').value = '';
      toast(r.added.length ? `أُضيف ${r.added.length} إلى القائمة` : 'لم يُضف أحد');
      document.activeElement.blur(); await refresh();
    } catch (err) { setError($('add-error'), err.message); }
  });

  $('qr-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const publicUrl = $('qr-url').value.trim();
    if (!/^https?:\/\/.+/.test(publicUrl)) { setError($('qr-error'), 'الرابط يبدأ بـ https://'); return; }
    await api('/api/admin/settings', { publicUrl });
    data.settings.publicUrl = publicUrl;
    await renderPoster(); toast('حُدّث الباركود');
  });
  $('qr-print').addEventListener('click', () => window.print());

  $('set-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    await api('/api/admin/settings', { school: $('set-school').value, title: $('set-title').value, open: $('set-open').checked });
    toast('حُفظت الإعدادات'); await refresh(); renderPoster();
  });
  $('pass-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      await api('/api/admin/password', { current: $('pass-cur').value, next: $('pass-new').value });
      e.target.reset(); setError($('pass-error'), ''); toast('تغيّرت كلمة المرور');
    } catch (err) { setError($('pass-error'), err.message); }
  });
  $('reset-btn').addEventListener('click', () => {
    ask({ title: 'حذف كل الأصوات؟', ok: 'احذف كل الأصوات', danger: true, input: '', label: 'اكتب كلمة «حذف» للتأكيد',
      body: `سيُحذف ${votesWord(data.totals.all)} نهائياً ولا يمكن استرجاعها. نزّل ملف الأصوات أولاً إن أردت الاحتفاظ بنسخة.`,
      run: (confirm) => act('/api/admin/reset', { confirm }, 'حُذفت كل الأصوات')() });
  });
  $('logout-btn').addEventListener('click', async () => { await api('/api/admin/logout', {}); location.reload(); });

  // ---------- التحديث ----------
  async function refresh() {
    data = await api('/api/admin/dashboard');
    renderResults(); renderReview(); renderRoster();
  }
  let started = false;
  async function start() {
    $('gate').hidden = true; $('app').hidden = false;
    await refresh();
    renderSettingsOnce();
    let saved; try { saved = sessionStorage.getItem('tab'); } catch {}
    selectTab(tabs.includes(saved) ? saved : 'results');
    if (started) return;
    started = true;
    setInterval(() => { if (!document.hidden && !$('app').hidden) refresh().catch(() => {}); }, 5000);
  }

  (async () => {
    const res = await fetch('/api/admin/status');
    const s = await res.json();
    if (s.authed) start(); else showGate(s.setup);
  })();
})();
