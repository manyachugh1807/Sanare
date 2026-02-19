// ─── Custom Cursor ───
const cursor = document.getElementById('cursor');
const ring = document.getElementById('cursorRing');
let mx = 0, my = 0, rx = 0, ry = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX;
  my = e.clientY;
  cursor.style.transform = `translate(${mx - 6}px, ${my - 6}px)`;
});

function animateRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  ring.style.transform = `translate(${rx - 18}px, ${ry - 18}px)`;
  requestAnimationFrame(animateRing);
}
animateRing();

document.querySelectorAll('button, a').forEach(el => {
  el.addEventListener('mouseenter', () => {
    cursor.style.transform += ' scale(1.8)';
    ring.style.opacity = '1';
  });
  el.addEventListener('mouseleave', () => {
    ring.style.opacity = '0.5';
  });
});

// ─── Scroll Reveal ───
const reveals = document.querySelectorAll('.reveal');
const observer = new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (e.isIntersecting) {
      e.target.classList.add('visible');
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

reveals.forEach(el => observer.observe(el));

// ─── Breathing Exercise ───
const phases = [
  { text: 'Inhale', duration: 4 },
  { text: 'Hold',   duration: 4 },
  { text: 'Exhale', duration: 4 },
  { text: 'Hold',   duration: 4 },
];

let phaseIndex = 0;
let count = phases[0].duration;

const breathText  = document.getElementById('breatheText');
const breathCount = document.getElementById('breatheCount');

setInterval(() => {
  count--;
  breathCount.textContent = count;

  if (count <= 0) {
    phaseIndex = (phaseIndex + 1) % phases.length;
    count = phases[phaseIndex].duration;
    breathText.textContent  = phases[phaseIndex].text;
    breathCount.textContent = count;
  }
}, 1000);

const revealButtons = document.querySelectorAll("button.reveal");

revealButtons.forEach(button => {
  button.addEventListener("click", () => {
    window.location.href = "dashboard.html";
  });
});
