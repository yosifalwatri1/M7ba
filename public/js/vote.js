(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const views = ['intro', 'form', 'choose', 'done', 'already', 'closed', 'error'];
  const show = (name) => {
    for (const v of views) $('view-' + v).hidden = v !== name;
    FX.enter($('view-' + name));
  };

  const form = $('form'), sendBtn = $('send');
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

  /* قائمة المعلّمين كما أضافتها المدرسة، مجمّعة حسب المادة: الطالب يختار ولا يبحث */
  let teachers = [], seated = false;
  function renderPick() {
    const groups = new Map();
    for (const t of teachers) {
      const k = t.subject || 'معلّمون آخرون';
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(t);
    }
    const keys = [...groups.keys()].sort((a, b) => (a === 'معلّمون آخرون') - (b === 'معلّمون آخرون') || a.localeCompare(b, 'ar'));
    $('pick').replaceChildren(...keys.map((k) => {
      const box = document.createElement('div');
      const cap = document.createElement('p');
      cap.className = 'suggest-cap'; cap.textContent = k;
      const ul = document.createElement('ul');
      ul.className = 'suggest';
      ul.append(...groups.get(k).map((t) => optionButton(t, (item) => {
        picked = picked && picked.id === item.id ? null : item;
        setError(nameError, '');
        renderPick();
      }, picked && picked.id === t.id)));
      box.append(cap, ul);
      return box;
    }));
  }

  async function submit(payload, errorEl) {
    if (busy) return;
    busy = true;
    sendBtn.disabled = true;
    try {
      payload.reason = $('reason').value.trim();
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
      FX.celebrate();
    } catch (err) {
      if (err.status === 409 && payload.seat) { setError(errorEl, err.message); return; }
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
    if (!picked) {
      setError(nameError, 'اختر المعلّم من القائمة أولاً.');
      $('pick').querySelector('button')?.focus();
      return;
    }
    const payload = { name: picked.name, teacherId: picked.id };
    if (seated) {
      const klass = $('klass').value, roll = $('roll').value.trim();
      if (!klass || !roll) { setError($('seat-error'), 'اختر فصلك واكتب رقمك في الكشف.'); (klass ? $('roll') : $('klass')).focus(); return; }
      setError($('seat-error'), '');
      payload.seat = { klass, roll };
    }
    submit(payload, seated ? $('seat-error') : nameError);
  });

  $('reason').addEventListener('input', () => { $('reason-count').textContent = $('reason').value.length + '/300'; });

  $('none').addEventListener('click', () => submit({ name: $('typed').textContent, force: true }, $('choose-error')));
  $('go-quick').addEventListener('click', () => { show('form'); });
  $('back').addEventListener('click', () => { show('form'); });

  (async () => {
    try {
      const s = await api('/api/state');
      if (s.school) $('school').textContent = s.school;
      if (s.title) { $('title').textContent = s.title; document.title = s.title; }
      if (s.voted) return show('already');
      if (!s.open) return show('closed');
      // لعبة البكسل تعمل على كل الأجهزة؛ ‎?quick‎ يفتح التصويت السريع مباشرة
      if (!new URLSearchParams(location.search).has('quick')) { location.replace('/play'); return; }
      const g = await api('/api/game');
      teachers = g.teachers || [];
      seated = !!(g.classes && g.classes.length);
      if (seated) {
        $('seat-row').hidden = false;
        $('klass').append(...g.classes.map((c) => Object.assign(document.createElement('option'), { value: c.name, textContent: `${c.name} (من 1 إلى ${c.size})` })));
      }
      renderPick();
      show('form');
    } catch {
      show('error');
    }
  })();
})();
