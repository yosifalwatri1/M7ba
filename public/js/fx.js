/* التحريكات: Motion (motion.dev) + canvas-confetti (ألعاب نارية). كل شيء اختياري:
   إن لم تُحمَّل المكتبة أو فضّل المستخدم تقليل الحركة، تظهر العناصر مباشرة. */
window.FX = (() => {
  'use strict';
  const M = window.Motion;
  const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const on = !!M && !calm;
  const spring = { type: 'spring', stiffness: 320, damping: 22 };

  return {
    /** دخول قسم: عناصره تصعد واحداً تلو الآخر */
    enter(section) {
      if (!on) return;
      const kids = [...section.children].filter((k) => !k.hidden);
      M.animate(kids, { opacity: [0, 1], y: [14, 0] }, { delay: M.stagger(0.07), duration: 0.45, ease: [0.2, 0, 0, 1] });
    },
    /** عناصر قائمة تنزلق للداخل */
    list(items) {
      if (!on || !items.length) return;
      M.animate([...items], { opacity: [0, 1], x: [16, 0] }, { delay: M.stagger(0.05), ...spring });
    },
    /** نبضة مرحة لشارة أو أيقونة */
    pop(node) {
      if (!on || !node) return;
      M.animate(node, { scale: [0.6, 1], rotate: [-14, 0] }, { type: 'spring', stiffness: 260, damping: 12 });
    },
    /** احتفال بعد التصويت: الأبراج تضيء وألعاب نارية فوقها */
    celebrate() {
      if (window.Skyline) Skyline.light(true);
      if (calm || !window.confetti) return;
      const canvas = document.getElementById('fx');
      const fire = canvas ? window.confetti.create(canvas, { resize: true }) : window.confetti;
      const colors = ['#f3c76c', '#e9b44c', '#5cc0b5', '#ffffff'];
      const burst = (x, y, delay) => setTimeout(() => fire({
        particleCount: 46, spread: 360, startVelocity: 22, gravity: 0.55, decay: 0.93, ticks: 140,
        scalar: 0.75, shapes: ['circle'], origin: { x, y }, colors,
      }), delay);
      burst(0.5, 0.16, 0); burst(0.3, 0.1, 380); burst(0.7, 0.13, 720); burst(0.45, 0.06, 1100);
    },
    /** عدّاد يصعد من القيمة السابقة إلى الجديدة */
    count(node, to, fmt = (v) => String(v)) {
      const from = Number(node.dataset.v || 0);
      node.dataset.v = to;
      if (!on || from === to) { node.textContent = fmt(to); return; }
      M.animate(from, to, { duration: 0.8, ease: [0.2, 0, 0, 1], onUpdate: (v) => { node.textContent = fmt(v); } });
    },
    on,
  };
})();
