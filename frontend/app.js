const API_BASE = "http://localhost:8080/api/v1";

const AVATAR_TEMPLATES = [
  { id: "cowo1", label: "Avatar 1", src: "avatars/cowo1.png" },
  { id: "cowo2", label: "Avatar 2", src: "avatars/cowo2.png" },
  { id: "cowo3", label: "Avatar 3", src: "avatars/cowo3.png" },
  { id: "cewe1", label: "Avatar 4", src: "avatars/cewe1.png" },
  { id: "cewe2", label: "Avatar 5", src: "avatars/cewe2.png" },
  { id: "cewe3", label: "Avatar 6", src: "avatars/cewe3.png" },
];

let currentUser = null;
let userCategories = [];
let debounceTimer = null;
let toastTimer = null;
let typingTimer = null;
let authTypingTimer = null;
let modalBlurTimer = null;
let happyTimer = null;
let tibyQuipIndex = 0;

let quizStep = 1;
let quizAnswers = {
  gender: "",
  source: "",
  theme: "dark",
};

let modalGenderChoice = "-";

function refreshIcons() {
  if (window.lucide) {
    window.lucide.createIcons();
  }
}

function setElClass(id, action, className, force) {
  const el = document.getElementById(id);
  if (!el) return;
  if (action === "add") el.classList.add(className);
  else if (action === "remove") el.classList.remove(className);
  else if (action === "toggle") el.classList.toggle(className, force);
}

function setElText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function extractUserPayload(res) {
  if (!res || typeof res !== "object") return null;
  if (res.user && typeof res.user === "object") return res.user;
  if (res.data?.user && typeof res.data.user === "object") return res.data.user;
  if (res.data && typeof res.data === "object" && res.data.email) return res.data;
  if (res.email && res.name) return res;
  return null;
}

function extractTokenPayload(res) {
  if (!res || typeof res !== "object") return null;
  return res.token || res.data?.token || null;
}

// ==================== THEME & USER PREFERENCES ====================
function getUserUniqueKey() {
  if (!currentUser) return "default";
  return currentUser.id || currentUser.email || "default";
}

function getThemeStorageKey() {
  return `tibytask_theme_${getUserUniqueKey()}`;
}

function getPrefsStorageKey() {
  return `tibytask_prefs_${getUserUniqueKey()}`;
}

function getUserPrefs() {
  try {
    const raw = localStorage.getItem(getPrefsStorageKey());
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveUserPrefs(partial) {
  if (!currentUser) return {};
  const current = getUserPrefs();
  const updated = { ...current, ...partial };
  localStorage.setItem(getPrefsStorageKey(), JSON.stringify(updated));
  return updated;
}

function setAppTheme(theme, persist = true) {
  const validTheme = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", validTheme);
  localStorage.setItem("tibytask_theme_global", validTheme);

  if (persist && currentUser) {
    localStorage.setItem(getThemeStorageKey(), validTheme);
    saveUserPrefs({ theme: validTheme });
  }

  const topIcon = document.getElementById("topbar-theme-icon");
  if (topIcon) {
    topIcon.setAttribute("data-lucide", validTheme === "light" ? "moon" : "sun");
  }
  setElText("topbar-theme-label", validTheme === "light" ? "Mode Gelap" : "Mode Terang");

  setElClass("set-theme-dark", "toggle", "is-active-choice", validTheme === "dark");
  setElClass("set-theme-light", "toggle", "is-active-choice", validTheme === "light");

  refreshIcons();
}

function toggleThemeQuick() {
  const current = document.documentElement.getAttribute("data-theme") || "dark";
  const next = current === "light" ? "dark" : "light";
  setAppTheme(next, true);
  showToast(next === "light" ? "Beralih ke Mode Terang" : "Beralih ke Mode Gelap");
}

function applyInitialTheme() {
  const savedUserTheme = currentUser ? localStorage.getItem(getThemeStorageKey()) : null;
  const fallbackTheme = localStorage.getItem("tibytask_theme_global") || "dark";
  setAppTheme(savedUserTheme || fallbackTheme, false);
}

// ==================== CLICK-TRIGGERED SIDEBAR & NAV EFFECTS ====================
function openSidebar() {
  document.body.classList.add("sidebar-open");
}

function closeSidebar() {
  document.body.classList.remove("sidebar-open");
}

function toggleSidebar() {
  document.body.classList.toggle("sidebar-open");
}

function handleNavClick(btnEl, pageId) {
  if (btnEl) {
    btnEl.classList.remove("nav-click-pop");
    void btnEl.offsetWidth;
    btnEl.classList.add("nav-click-pop");
    setTimeout(() => btnEl.classList.remove("nav-click-pop"), 400);
  }
  navigate(pageId);
  closeSidebar();
}

// ==================== TIBY MASCOT ENGINE ====================
function getTibyDefs(uid) {
  return `
    <defs>
      <radialGradient id="tibyGrad-${uid}" cx="35%" cy="26%" r="74%">
        <stop offset="0%" stop-color="#2c5cf7" />
        <stop offset="56%" stop-color="#0d2fd4" />
        <stop offset="100%" stop-color="#081d8c" />
      </radialGradient>
      <linearGradient id="hornGrad-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#313542" />
        <stop offset="100%" stop-color="#141720" />
      </linearGradient>
      <linearGradient id="fedoraGrad-${uid}" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#2a2e39" />
        <stop offset="60%" stop-color="#13161e" />
        <stop offset="100%" stop-color="#080a0f" />
      </linearGradient>
    </defs>
  `;
}

function createAuthTibySVG(uid = "auth") {
  return `
    <svg class="tiby-svg" viewBox="0 0 264 236" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Tiby">
      ${getTibyDefs(uid)}
      <g class="ab-rig">
        <g class="ab-float">
          <g class="ab-wave-enter">
            <g class="tiby-wave-arm">
              <path d="M174 126 C204 114, 224 90, 220 68 C216 54, 198 54, 192 68 C184 86, 174 96, 166 106 Z"
                    fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.6" stroke-linejoin="round" />
              <g class="tiby-wave-lines">
                <path d="M232 54 C240 62, 242 74, 238 84" stroke="#f5b82e" stroke-width="3.8" stroke-linecap="round" />
                <path d="M243 60 C249 68, 250 76, 247 84" stroke="#f4f1ea" stroke-width="2.8" stroke-linecap="round" opacity="0.85" />
              </g>
            </g>
          </g>

          <path d="M58 78 C52 52, 58 40, 72 44 C80 47, 88 51, 95 54 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.6" stroke-linejoin="round" />
          <path d="M180 74 C187 48, 180 36, 166 40 C158 43, 150 48, 143 52 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.6" stroke-linejoin="round" />

          <path d="M118 42
                   C166 42, 196 74, 196 120
                   C196 144, 188 160, 180 172
                   C178 186, 178 200, 170 205
                   C162 210, 142 208, 136 200
                   C131 192, 127 182, 118 182
                   C109 182, 104 192, 98 200
                   C92 208, 72 210, 64 205
                   C56 200, 56 186, 54 172
                   C46 160, 40 144, 40 120
                   C40 74, 70 42, 118 42 Z"
                fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.8" stroke-linejoin="round" />

          <ellipse cx="96" cy="62" rx="24" ry="9" transform="rotate(-14 96 62)" fill="#ffffff" opacity="0.22" />

          <g class="ab-eyes-group">
            <g transform="translate(94, 96)">
              <circle cx="0" cy="0" r="16" stroke="#0a0c14" stroke-width="4.5" fill="none" />
              <path d="M2 -9 A9 9 0 1 1 -6 4.5 A5 5 0 1 1 5.2 -2.6" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
              <circle cx="4" cy="-4.5" r="2.6" fill="#f4f1ea" />
            </g>
            <g transform="translate(146, 92)">
              <circle cx="0" cy="0" r="16" stroke="#0a0c14" stroke-width="4.5" fill="none" />
              <path d="M2 -9 A9 9 0 1 1 -6 4.5 A5 5 0 1 1 5.2 -2.6" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
              <circle cx="4" cy="-4.5" r="2.6" fill="#f4f1ea" />
            </g>
          </g>

          <path class="ab-mouth-open" d="M72 126 Q124 132 174 108 C168 148, 142 168, 112 168 C86 168, 74 150, 72 126 Z" fill="#0a0c14" />
          <path class="ab-mouth-focus" d="M80 123 Q114 135 145 113" stroke="#0a0c14" stroke-width="5.5" stroke-linecap="round" fill="none" />

          <g class="ab-paper-enter">
            <path d="M34 152 L80 142 L106 176 L60 188 Z" fill="#cbd5e1" stroke="#0a0c14" stroke-width="3.8" stroke-linejoin="round" />
            <path d="M38 138 L88 134 L116 172 L66 182 Z" fill="#f8fafc" stroke="#0a0c14" stroke-width="3.8" stroke-linejoin="round" />
            <line x1="52" y1="149" x2="80" y2="146" stroke="#475569" stroke-width="3" stroke-linecap="round" class="tiby-paper-lines" />
            <line x1="58" y1="159" x2="90" y2="155" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" class="tiby-paper-lines" />
            <line x1="65" y1="169" x2="92" y2="165" stroke="#64748b" stroke-width="2.6" stroke-linecap="round" class="tiby-paper-lines" />
            <ellipse cx="64" cy="172" rx="13" ry="10.5" transform="rotate(34 64 172)" fill="#0d2fd4" stroke="#0a0c14" stroke-width="3.8" />
          </g>

          <g class="ab-hand-enter">
            <g class="tiby-write-hand">
              <g transform="translate(116, 140) rotate(44)">
                <rect x="-5.5" y="-22" width="11" height="36" rx="2.5" fill="#e04826" stroke="#0a0c14" stroke-width="2.8" />
                <rect x="-5.5" y="-27" width="11" height="7" rx="2" fill="#f5b82e" stroke="#0a0c14" stroke-width="2.5" />
                <polygon points="-5.5,14 5.5,14 0,25" fill="#fde68a" stroke="#0a0c14" stroke-width="2.4" stroke-linejoin="round" />
                <polygon points="-2.4,20 2.4,20 0,25" fill="#0a0c14" />
              </g>
              <path d="M158 152 C140 164, 116 152, 124 134 C128 124, 140 128, 148 134" fill="#0d2fd4" stroke="#0a0c14" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
              <g class="tiby-pen-spark">
                <circle cx="97" cy="157" r="3" fill="#f5b82e" />
                <line x1="89" y1="155" x2="93" y2="156" stroke="#f5b82e" stroke-width="2.2" stroke-linecap="round" />
                <line x1="93" y1="164" x2="96" y2="161" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  `;
}

function createWidgetTibySVG(uid = "widget") {
  return `
    <svg class="tiby-svg" viewBox="0 0 256 238" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Tiby Companion">
      ${getTibyDefs(uid)}

      <g class="wb-confetti">
        <g class="wb-confetti-drift">
          <rect x="44" y="42" width="13" height="8" rx="2.5" transform="rotate(-24 44 42)" fill="#ffd166" />
          <rect x="64" y="24" width="12" height="8" rx="2.5" transform="rotate(18 64 24)" fill="#ff6b6b" />
          <rect x="92" y="14" width="14" height="8" rx="2.5" transform="rotate(-12 92 14)" fill="#4ecdc4" />
          <rect x="122" y="16" width="12" height="8" rx="2.5" transform="rotate(25 122 16)" fill="#ff8fab" />
          <rect x="150" y="12" width="13" height="8" rx="2.5" transform="rotate(-18 150 12)" fill="#a78bfa" />
          <rect x="176" y="22" width="12" height="8" rx="2.5" transform="rotate(32 176 22)" fill="#ffd166" />
          <rect x="198" y="36" width="13" height="8" rx="2.5" transform="rotate(-28 198 36)" fill="#38bdf8" />
          <rect x="214" y="58" width="12" height="8" rx="2.5" transform="rotate(20 214 58)" fill="#4ade80" />
          <rect x="218" y="84" width="13" height="8" rx="2.5" transform="rotate(-15 218 84)" fill="#fb7185" />
          <rect x="206" y="106" width="12" height="8" rx="2.5" transform="rotate(24 206 106)" fill="#fde047" />
        </g>
      </g>

      <g class="wb-rig">
        <g class="wb-float">
          <g class="wb-tail-pivot">
            <g class="wb-tail-wag">
              <path d="M174 152 C198 148, 212 130, 210 104" stroke="#0a0c14" stroke-width="10" stroke-linecap="round" />
              <path d="M210 88 L222 112 L210 107 L198 112 Z" fill="#0a0c14" stroke="#0a0c14" stroke-width="2" stroke-linejoin="round" />
            </g>
          </g>

          <g class="wb-arm-l">
            <g class="wb-arm-l-wave">
              <path d="M58 112 C32 98, 24 74, 38 64 C50 56, 64 74, 72 92 Z"
                    fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />
            </g>
          </g>

          <g class="wb-arm-r">
            <g class="wb-arm-r-wave">
              <path d="M180 116 C202 112, 214 124, 206 136 C198 146, 182 144, 172 136 Z"
                    fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />
            </g>
          </g>

          <path d="M52 80 C47 56, 53 44, 66 48 C74 51, 82 55, 89 58 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />
          <path d="M178 76 C184 52, 177 40, 164 44 C156 47, 148 52, 141 55 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />

          <path d="M114 44
                   C160 44, 190 76, 190 120
                   C190 142, 182 158, 174 168
                   C172 182, 174 196, 167 200
                   C160 205, 140 204, 135 197
                   C130 190, 126 180, 114 180
                   C102 180, 97 190, 92 197
                   C86 204, 66 206, 59 201
                   C53 196, 54 182, 52 168
                   C44 158, 38 142, 38 120
                   C38 76, 68 44, 114 44 Z"
                fill="url(#tibyGrad-${uid})"
                stroke="#0a0c14"
                stroke-width="4.8"
                stroke-linejoin="round" />

          <ellipse cx="90" cy="64" rx="22" ry="8" transform="rotate(-14 90 64)" fill="#ffffff" opacity="0.22" />

          <g transform="translate(86, 96)">
            <circle cx="0" cy="0" r="15.5" stroke="#0a0c14" stroke-width="4.4" fill="none" />
            <path d="M0 -8.8 A8.8 8.8 0 1 1 -7.8 4.2 A5 5 0 1 1 3.6 -2.6" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
            <circle cx="-4" cy="-4.5" r="2.5" fill="#f4f1ea" />
          </g>
          <g transform="translate(136, 92)">
            <circle cx="0" cy="0" r="15.5" stroke="#0a0c14" stroke-width="4.4" fill="none" />
            <path d="M0 -8.8 A8.8 8.8 0 1 1 -7.8 4.2 A5 5 0 1 1 3.6 -2.6" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
            <circle cx="-4" cy="-4.5" r="2.5" fill="#f4f1ea" />
          </g>

          <path d="M62 126 Q114 132 166 108 C160 146, 135 166, 105 166 C79 166, 65 148, 62 126 Z" fill="#0a0c14" />
        </g>
      </g>
    </svg>
  `;
}

function createInteractiveModalTibySVG(uid = "modal") {
  return `
    <svg class="tiby-svg" viewBox="0 0 248 232" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Tiby Interaktif">
      ${getTibyDefs(uid)}
      <g class="mb-rig">
        <g class="mb-breathe">
          <g class="mb-tail-pivot">
            <g class="mb-tail-wag">
              <path d="M174 148 C198 144, 212 126, 210 100" stroke="#0a0c14" stroke-width="10" stroke-linecap="round" />
              <path d="M210 84 L222 108 L210 103 L198 108 Z" fill="#0a0c14" stroke="#0a0c14" stroke-width="2" stroke-linejoin="round" />
            </g>
          </g>

          <path d="M52 76 C47 52, 53 40, 66 44 C74 47, 82 51, 89 54 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />
          <path d="M178 72 C184 48, 177 36, 164 40 C156 43, 148 48, 141 51 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />

          <path d="M114 40
                   C160 40, 190 72, 190 116
                   C190 138, 182 154, 174 164
                   C172 178, 174 192, 167 196
                   C160 201, 140 200, 135 193
                   C130 186, 126 176, 114 176
                   C102 176, 97 186, 92 193
                   C86 200, 66 202, 59 197
                   C53 192, 54 178, 52 164
                   C44 154, 38 138, 38 116
                   C38 72, 68 40, 114 40 Z"
                fill="url(#tibyGrad-${uid})"
                stroke="#0a0c14"
                stroke-width="4.8"
                stroke-linejoin="round" />

          <ellipse cx="90" cy="60" rx="22" ry="8" transform="rotate(-14 90 60)" fill="#ffffff" opacity="0.22" />

          <g class="mb-eyes-group">
            <g transform="translate(86, 92)">
              <circle cx="0" cy="0" r="15.5" stroke="#0a0c14" stroke-width="4.4" fill="none" />
              <path d="M0 -8.8 A8.8 8.8 0 1 1 -7.8 4.2 A5 5 0 1 1 3.6 -2.6" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
              <circle cx="-4" cy="-4.5" r="2.5" fill="#f4f1ea" />
            </g>
            <g transform="translate(136, 88)">
              <circle cx="0" cy="0" r="15.5" stroke="#0a0c14" stroke-width="4.4" fill="none" />
              <path d="M0 -8.8 A8.8 8.8 0 1 1 -7.8 4.2 A5 5 0 1 1 3.6 -2.6" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
              <circle cx="-4" cy="-4.5" r="2.5" fill="#f4f1ea" />
            </g>
          </g>

          <path class="mb-mouth-open" d="M62 122 Q114 128 166 104 C160 142, 135 162, 105 162 C79 162, 65 144, 62 122 Z" fill="#0a0c14" />
          <path class="mb-mouth-focus" d="M72 119 Q106 131 137 109" stroke="#0a0c14" stroke-width="5.5" stroke-linecap="round" fill="none" />

          <g class="mb-paper-enter">
            <path d="M26 148 L72 138 L98 172 L52 184 Z" fill="#cbd5e1" stroke="#0a0c14" stroke-width="3.8" stroke-linejoin="round" />
            <path d="M30 134 L80 130 L108 168 L58 178 Z" fill="#f8fafc" stroke="#0a0c14" stroke-width="3.8" stroke-linejoin="round" />
            <line x1="44" y1="145" x2="72" y2="142" stroke="#475569" stroke-width="3" stroke-linecap="round" class="tiby-paper-lines" />
            <line x1="50" y1="155" x2="82" y2="151" stroke="#1d4ed8" stroke-width="3" stroke-linecap="round" class="tiby-paper-lines" />
            <line x1="57" y1="165" x2="84" y2="161" stroke="#64748b" stroke-width="2.6" stroke-linecap="round" class="tiby-paper-lines" />
            <ellipse cx="56" cy="168" rx="13" ry="10.5" transform="rotate(34 56 168)" fill="#0d2fd4" stroke="#0a0c14" stroke-width="3.8" />
          </g>

          <g class="mb-hand-enter">
            <g class="tiby-write-hand">
              <g transform="translate(108, 136) rotate(44)">
                <rect x="-5.5" y="-22" width="11" height="36" rx="2.5" fill="#e04826" stroke="#0a0c14" stroke-width="2.8" />
                <rect x="-5.5" y="-27" width="11" height="7" rx="2" fill="#f5b82e" stroke="#0a0c14" stroke-width="2.5" />
                <polygon points="-5.5,14 5.5,14 0,25" fill="#fde68a" stroke="#0a0c14" stroke-width="2.4" stroke-linejoin="round" />
                <polygon points="-2.4,20 2.4,20 0,25" fill="#0a0c14" />
              </g>
              <path d="M150 148 C132 160, 108 148, 116 130 C120 120, 132 124, 140 130" fill="#0d2fd4" stroke="#0a0c14" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
              <g class="tiby-pen-spark">
                <circle cx="89" cy="153" r="3" fill="#f5b82e" />
                <line x1="81" y1="151" x2="85" y2="152" stroke="#f5b82e" stroke-width="2.2" stroke-linecap="round" />
                <line x1="85" y1="160" x2="88" y2="157" stroke="#38bdf8" stroke-width="2.2" stroke-linecap="round" />
              </g>
            </g>
          </g>
        </g>
      </g>
    </svg>
  `;
}

// ==================== GENDER MORPHING TIBY SVG (NETRAL / PEREMPUAN / LAKI-LAKI) ====================
function createGenderTibySVG(uid = "gender") {
  return `
    <svg class="tiby-svg" viewBox="0 0 264 242" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Tiby">
      ${getTibyDefs(uid)}
      <g class="gb-rig">
        <!-- Ekor Melengkung ke Atas (Laki-laki & Perempuan) -->
        <g class="gb-tail-enter">
          <path d="M180 162 C202 162, 218 150, 224 132" stroke="#0a0c14" stroke-width="6.5" stroke-linecap="round" fill="none" />
          <path d="M214 136 L225 126 L230 140" stroke="#0a0c14" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round" fill="none" />
        </g>

        <!-- Tangan Kanan Melambai ke Samping (Perempuan) -->
        <g class="gb-female-arm-r">
          <path d="M182 146 C204 142, 226 124, 232 108 C235 100, 224 96, 212 102 C198 109, 186 118, 178 124 Z"
                fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />
        </g>

        <!-- Tanduk Kiri (Sembunyi saat topi Laki-laki dipakai) -->
        <g class="gb-horn-left">
          <path d="M58 80 C52 54, 58 42, 72 46 C80 49, 88 53, 95 56 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.6" stroke-linejoin="round" />
        </g>

        <!-- Tanduk Kanan -->
        <path d="M180 76 C187 50, 180 38, 166 42 C158 45, 150 50, 143 54 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.6" stroke-linejoin="round" />

        <!-- Badan Utama Tiby -->
        <path d="M118 44
                 C166 44, 196 76, 196 122
                 C196 146, 188 162, 180 174
                 C178 188, 178 202, 170 207
                 C162 212, 142 210, 136 202
                 C131 194, 127 184, 118 184
                 C109 184, 104 194, 98 202
                 C92 210, 72 212, 64 207
                 C56 202, 56 188, 54 174
                 C46 162, 40 146, 40 122
                 C40 76, 70 44, 118 44 Z"
              fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.8" stroke-linejoin="round" />

        <ellipse cx="96" cy="64" rx="22" ry="8" transform="rotate(-14 96 64)" fill="#ffffff" opacity="0.2" />

        <!-- Tangan Kiri Turun Rileks (Perempuan) -->
        <g class="gb-female-arm-l">
          <path d="M46 108 C32 124, 32 154, 42 164 C50 170, 58 160, 56 140"
                fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
        </g>

        <!-- Pita Pink Terkunci di Tanduk Kanan (Perempuan) -->
        <g transform="translate(158, 58) rotate(28)">
          <g class="gb-bow-enter">
            <path d="M-3 0 C-20 -16, -32 -4, -26 11 C-21 20, -9 13, -3 4 Z" fill="#ff7597" stroke="#0a0c14" stroke-width="3.6" stroke-linejoin="round" />
            <path d="M3 0 C20 -16, 32 -4, 26 11 C21 20, 9 13, 3 4 Z" fill="#ff7597" stroke="#0a0c14" stroke-width="3.6" stroke-linejoin="round" />
            <rect x="-7" y="-7" width="14" height="14" rx="5" fill="#ff4d79" stroke="#0a0c14" stroke-width="3.4" />
          </g>
        </g>

        <!-- Ekspresi Muka (Geser sedikit ke kiri saat Laki-laki) -->
        <g class="gb-male-face-shift">
          <!-- Mata Spiral Khas Tiby -->
          <g transform="translate(94, 98)">
            <circle cx="0" cy="0" r="16" stroke="#0a0c14" stroke-width="4.5" fill="none" />
            <path d="M2 -9 A9 9 0 1 1 -6 4.5 A5 5 0 1 1 5.2 -2.6" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
            <circle cx="-4" cy="-4.5" r="2.6" fill="#f4f1ea" />
          </g>
          <g transform="translate(146, 96)">
            <circle cx="0" cy="0" r="16" stroke="#0a0c14" stroke-width="4.5" fill="none" />
            <path d="M2 -9 A9 9 0 1 1 -6 4.5 A5 5 0 1 1 5.2 -2.6" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
            <circle cx="-4" cy="-4.5" r="2.6" fill="#f4f1ea" />
          </g>

          <!-- Kelopak Mata Setengah Tertutup / Cool (Laki-laki) -->
          <g class="gb-male-eyelids">
            <path d="M74 78 L116 90 L116 74 L74 74 Z" fill="#143bd8" />
            <path d="M74 82 L115 92" stroke="#0a0c14" stroke-width="4.8" stroke-linecap="round" />
            <path d="M168 74 L126 88 L126 72 L168 72 Z" fill="#1134c7" />
            <path d="M166 78 L127 90" stroke="#0a0c14" stroke-width="4.8" stroke-linecap="round" />
          </g>

        <!-- Pipi Merona Pink (Perempuan) -->
        <g class="gb-blush">
          <line x1="72" y1="120" x2="77" y2="114" stroke="#ff7597" stroke-width="3.6" stroke-linecap="round" />
          <line x1="81" y1="121" x2="86" y2="115" stroke="#ff7597" stroke-width="3.6" stroke-linecap="round" />
          <line x1="154" y1="118" x2="159" y2="112" stroke="#ff7597" stroke-width="3.6" stroke-linecap="round" />
          <line x1="163" y1="119" x2="168" y2="113" stroke="#ff7597" stroke-width="3.6" stroke-linecap="round" />
        </g>

        <!-- Mulut Senyum Kalem (Netral & Perempuan — diam tidak bergerak) -->
          <path class="gb-mouth-calm" d="M106 126 Q120 135 134 126" stroke="#0a0c14" stroke-width="5" stroke-linecap="round" fill="none" />

          <!-- Mulut Datar / Smirk (Laki-laki) -->
          <path class="gb-mouth-male" d="M108 124 Q120 127 132 122" stroke="#0a0c14" stroke-width="4.8" stroke-linecap="round" fill="none" />
        </g>

        <!-- Topi Hitam Besar Miring ke Kiri + Tangan Pegang Tepi Topi (Laki-laki) -->
        <g transform="translate(90, 54) rotate(-18)">
          <g class="gb-hat-enter">
            <!-- Pinggiran Topi (Brim) -->
            <path d="M-90 15 C-48 -2, 50 -2, 84 11 C58 27, -58 29, -90 15 Z"
                  fill="#12151d" stroke="#0a0c14" stroke-width="4.6" stroke-linejoin="round" />
            <!-- Mahkota Topi (Crown) -->
            <path d="M-50 11 L-40 -29 C-18 -37, 18 -35, 39 -25 L50 9 Z"
                  fill="url(#fedoraGrad-${uid})" stroke="#0a0c14" stroke-width="4.6" stroke-linejoin="round" />
            <!-- Highlight Sisi Kiri Topi -->
            <path d="M-34 -23 L-13 -26 L-19 6 L-42 8 Z" fill="#3a4052" opacity="0.55" />
            <!-- Tangan Kiri Nempel di Tepi Kiri Topi -->
            <g class="gb-hat-hand-enter">
              <path d="M-64 56 C-84 50, -92 30, -82 18 C-74 10, -62 16, -56 30 C-53 38, -56 48, -64 56 Z"
                    fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.6" stroke-linejoin="round" />
            </g>
          </g>
        </g>

        <!-- Tongkat Hitam Panjang & Tangan Kanan Melingkar Memegang Tongkat (Laki-laki) -->
        <g class="gb-cane-enter">
          <path d="M126 144 C126 132, 138 132, 140 144 L148 214" stroke="#181b24" stroke-width="7.5" stroke-linecap="round" fill="none" />
          <path d="M126 144 C126 132, 138 132, 140 144 L148 214" stroke="#0a0c14" stroke-width="3" stroke-linecap="round" fill="none" />
          <path d="M180 124 C172 152, 144 164, 136 150 C131 140, 146 134, 158 138"
                fill="url(#tibyGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round" />
        </g>
      </g>
    </svg>
  `;
}

function setTibyGenderVisual(stageId, gender) {
  const stage = document.getElementById(stageId);
  if (!stage) return;

  if (!stage.innerHTML) {
    stage.innerHTML = createGenderTibySVG(stageId);
  }

  stage.classList.remove("gender-male", "gender-female", "gender-neutral");
  if (gender === "Laki-laki") {
    stage.classList.add("gender-male");
  } else if (gender === "Perempuan") {
    stage.classList.add("gender-female");
  } else {
    stage.classList.add("gender-neutral");
  }
}

function createSadTibySVG(uid = "logout") {
  return `
    <svg class="tiby-svg" viewBox="0 0 248 232" fill="none" xmlns="http://www.w3.org/2000/svg" aria-label="Tiby Sedih">
      ${getTibyDefs(uid)}
      <g class="tiby-sad-body">
        <g class="tiby-sad-tail">
          <path d="M174 150 C196 156, 206 174, 202 198" stroke="#0a0c14" stroke-width="9.5" stroke-linecap="round" />
          <path d="M201 208 L192 189 L202 194 L212 190 Z" fill="#0a0c14" stroke="#0a0c14" stroke-width="1.8" stroke-linejoin="round" />
        </g>

        <path d="M48 80 C41 56, 48 44, 62 48 C70 50, 78 54, 86 57 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />
        <path d="M180 78 C187 54, 180 42, 166 46 C158 48, 150 52, 142 55 Z" fill="url(#hornGrad-${uid})" stroke="#0a0c14" stroke-width="4.5" stroke-linejoin="round" />

        <path d="M114 42
                 C160 42, 190 74, 190 118
                 C190 140, 182 156, 174 166
                 C172 180, 174 194, 167 198
                 C160 203, 140 202, 135 195
                 C130 188, 126 178, 114 178
                 C102 178, 97 188, 92 195
                 C86 202, 66 204, 59 199
                 C53 194, 54 180, 52 166
                 C44 156, 38 140, 38 118
                 C38 74, 68 42, 114 42 Z"
              fill="url(#tibyGrad-${uid})"
              stroke="#0a0c14"
              stroke-width="4.8"
              stroke-linejoin="round" />

        <ellipse cx="90" cy="62" rx="20" ry="7" transform="rotate(-14 90 62)" fill="#ffffff" opacity="0.16" />

        <g transform="translate(86, 94)">
          <circle cx="0" cy="0" r="15" stroke="#0a0c14" stroke-width="4.4" fill="none" />
          <path d="M0 -8.4 A8.4 8.4 0 1 1 -7.4 4 A4.8 4.8 0 1 1 3.5 -2.5" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
          <circle cx="-4" cy="-4" r="2.8" fill="#e0f2fe" />
        </g>
        <ellipse class="tiby-tear-pool-l" cx="84" cy="112" rx="11.5" ry="5.5" fill="#7dd3fc" stroke="#0a0c14" stroke-width="2" />

        <g transform="translate(138, 92)">
          <circle cx="0" cy="0" r="15" stroke="#0a0c14" stroke-width="4.4" fill="none" />
          <path d="M0 -8.4 A8.4 8.4 0 1 1 -7.4 4 A4.8 4.8 0 1 1 3.5 -2.5" stroke="#0a0c14" stroke-width="3.8" stroke-linecap="round" fill="none" />
          <circle cx="-4" cy="-4" r="2.8" fill="#e0f2fe" />
        </g>
        <ellipse class="tiby-tear-pool-r" cx="138" cy="110" rx="11.5" ry="5.5" fill="#7dd3fc" stroke="#0a0c14" stroke-width="2" />

        <path d="M98 124 Q112 121 126 124" stroke="#0a0c14" stroke-width="5.2" stroke-linecap="round" fill="none" />

        <g class="tiby-belly-arms">
          <path d="M74 134 C65 154, 83 166, 98 154" stroke="#081d8c" stroke-width="8.5" stroke-linecap="round" fill="none" />
          <path d="M74 134 C65 154, 83 166, 98 154" stroke="#2563eb" stroke-width="4.2" stroke-linecap="round" fill="none" />

          <path d="M152 132 C161 152, 143 164, 128 152" stroke="#081d8c" stroke-width="8.5" stroke-linecap="round" fill="none" />
          <path d="M152 132 C161 152, 143 164, 128 152" stroke="#2563eb" stroke-width="4.2" stroke-linecap="round" fill="none" />
        </g>
      </g>
    </svg>
  `;
}

function mountTibyInstances() {
  const authStage = document.getElementById("auth-tiby-stage");
  if (authStage && !authStage.innerHTML) {
    authStage.classList.add("is-waving");
    authStage.innerHTML = createAuthTibySVG("auth");
  }

  const modalStage = document.getElementById("modal-tiby-stage");
  if (modalStage && !modalStage.innerHTML) {
    modalStage.classList.add("is-waiting");
    modalStage.innerHTML = createInteractiveModalTibySVG("modal");
  }

  const widgetStage = document.getElementById("tiby-widget-stage");
  if (widgetStage && !widgetStage.innerHTML) {
    widgetStage.classList.add("is-idle");
    widgetStage.innerHTML = createWidgetTibySVG("widget");
  }

  const logoutStage = document.getElementById("logout-tiby-stage");
  if (logoutStage && !logoutStage.innerHTML) {
    logoutStage.innerHTML = createSadTibySVG("logout");
  }

  const quizStage = document.getElementById("quiz-tiby-stage");
  if (quizStage && !quizStage.innerHTML) {
    quizStage.classList.add("gender-neutral");
    quizStage.innerHTML = createGenderTibySVG("quiz");
  }

  const genderStage = document.getElementById("gender-tiby-stage");
  if (genderStage && !genderStage.innerHTML) {
    genderStage.classList.add("gender-neutral");
    genderStage.innerHTML = createGenderTibySVG("gender");
  }
}

function setAuthTibyPose(pose, isTypingFast = false) {
  const authStage = document.getElementById("auth-tiby-stage");
  if (!authStage) return;

  if (!authStage.innerHTML) {
    authStage.innerHTML = createAuthTibySVG("auth");
  }

  if (pose === "writing") {
    authStage.classList.remove("is-waving", "wave-fast");
    authStage.classList.add("is-writing");
    authStage.classList.toggle("fast-write", isTypingFast);

    setElText("auth-tiby-tag", "TIBY • LAGI NYATET");
    setElText(
      "auth-tiby-text",
      isTypingFast
        ? "Lagi kucatat data akun barumu nih... lanjutkan!"
        : "Halo teman baru! Isi datamu di kanan ya, biar langsung kucatat akunmu!"
    );
  } else {
    authStage.classList.remove("is-writing", "fast-write");
    authStage.classList.add("is-waving");

    setElText("auth-tiby-tag", "TIBY");
    setElText("auth-tiby-text", "Hai! Selamat datang kembali—yuk masuk di sebelah kanan, aku siap temani tugasmu hari ini!");
  }
}

function setModalTibyPose(pose, isTypingFast = false) {
  const modalStage = document.getElementById("modal-tiby-stage");
  if (!modalStage) return;

  if (!modalStage.innerHTML) {
    modalStage.innerHTML = createInteractiveModalTibySVG("modal");
  }

  if (pose === "writing") {
    modalStage.classList.remove("is-waiting");
    modalStage.classList.add("is-writing");
    modalStage.classList.toggle("fast-write", isTypingFast);

    setElText("modal-tiby-tag", "TIBY • LAGI NYATET");
    setElText(
      "modal-tiby-text",
      isTypingFast
        ? "Lagi nyatet detail tugasmu nih... lanjutkan!"
        : "Sip, kertas & pensil sudah siap! Tulis aja detailnya."
    );
  } else {
    modalStage.classList.remove("is-writing", "fast-write");
    modalStage.classList.add("is-waiting");

    setElText("modal-tiby-tag", "TIBY • MENUNGGU");
    setElText("modal-tiby-text", "Aku tunggu ya—klik kolom di bawah kalau sudah siap nyatet tugasmu!");
  }
}

function initTibyInputWatchers() {
  const taskForm = document.getElementById("task-form");
  if (taskForm) {
    taskForm.addEventListener("focusin", (e) => {
      if (e.target.matches("input, textarea, select")) {
        clearTimeout(modalBlurTimer);
        setModalTibyPose("writing", false);
      }
    });

    taskForm.addEventListener("input", (e) => {
      if (e.target.matches("input, textarea, select")) {
        clearTimeout(modalBlurTimer);
        setModalTibyPose("writing", true);
        clearTimeout(typingTimer);
        typingTimer = setTimeout(() => {
          const activeEl = document.activeElement;
          if (activeEl && taskForm.contains(activeEl) && activeEl.matches("input, textarea, select")) {
            setModalTibyPose("writing", false);
          }
        }, 750);
      }
    });

    taskForm.addEventListener("focusout", () => {
      clearTimeout(modalBlurTimer);
      modalBlurTimer = setTimeout(() => {
        const activeEl = document.activeElement;
        const stillEditing = activeEl && taskForm.contains(activeEl) && activeEl.matches("input, textarea, select");
        if (!stillEditing) {
          setModalTibyPose("idle", false);
        }
      }, 60);
    });
  }

  const loginForm = document.getElementById("login-form");
  if (loginForm) {
    loginForm.addEventListener("focusin", (e) => {
      const isLoginTabActive = document.getElementById("tab-login")?.classList.contains("active");
      if (!isLoginTabActive) return;

      if (e.target.matches("input")) {
        setElClass("auth-tiby-stage", "add", "wave-fast");
      }
    });
    loginForm.addEventListener("focusout", () => {
      setTimeout(() => {
        const activeEl = document.activeElement;
        if (!activeEl || !loginForm.contains(activeEl) || !activeEl.matches("input")) {
          setElClass("auth-tiby-stage", "remove", "wave-fast");
        }
      }, 60);
    });
  }

  const regForm = document.getElementById("register-form");
  if (regForm) {
    regForm.addEventListener("input", (e) => {
      const isRegTabActive = document.getElementById("tab-register")?.classList.contains("active");
      if (!isRegTabActive) return;

      if (e.target.matches("input")) {
        setAuthTibyPose("writing", true);
        clearTimeout(authTypingTimer);
        authTypingTimer = setTimeout(() => {
          if (document.getElementById("tab-register")?.classList.contains("active")) {
            setAuthTibyPose("writing", false);
          }
        }, 750);
      }
    });
  }
}

function setWidgetTibyMood(mood, message = null, durationMs = 4200) {
  const stage = document.getElementById("tiby-widget-stage");
  if (!stage) return;

  if (!stage.innerHTML) {
    stage.innerHTML = createWidgetTibySVG("widget");
  }

  clearTimeout(happyTimer);

  if (mood === "happy") {
    stage.classList.remove("is-idle");
    stage.classList.add("is-happy");
    happyTimer = setTimeout(() => {
      stage.classList.remove("is-happy");
      stage.classList.add("is-idle");
    }, durationMs);
  } else {
    stage.classList.remove("is-happy");
    stage.classList.add("is-idle");
  }

  if (message) {
    setTibyBubbleText(message, true);
  }
}

function setTibyBubbleText(text, forceOpen = true) {
  setElText("tiby-bubble-text", text);
  if (forceOpen) {
    setElClass("tiby-bubble", "remove", "collapsed");
  }
}

function toggleTibyBubble(show) {
  setElClass("tiby-bubble", "toggle", "collapsed", !show);
}

function pokeTiby() {
  const stage = document.getElementById("tiby-widget-stage");
  if (stage) {
    stage.classList.remove("poked");
    void stage.offsetWidth;
    stage.classList.add("poked");
    setTimeout(() => stage.classList.remove("poked"), 600);
  }

  const userQuips = [
    "Semangat! Cicil satu tugas kecil dulu biar makin ringan.",
    "Jangan lupa cek tenggat waktu di kotak Daftar Tugas ya!",
    "Satu langkah kecil hari ini lebih baik daripada ditunda terus.",
    "Kalau butuh istirahat sebentar, minum air dulu ya baru lanjut!",
    "Klik '+ Tugas Baru' kapan aja—kertas dan pensilku selalu siap!",
  ];
  const adminQuips = [
    "Semua data pengguna dan tugas terpantau rapi di sini.",
    "Halo Admin! Statistik sistem sudah siap dicek kapan saja.",
    "Mode pantau tugas bersifat read-only biar data pengguna tetap aman.",
  ];

  const list = currentUser && currentUser.role === "ADMIN" ? adminQuips : userQuips;
  setTibyBubbleText(list[tibyQuipIndex % list.length], true);
  tibyQuipIndex++;
}

// ==================== POP-UP UBAH JENIS KELAMIN (DARI PROFIL) ====================
function openGenderModal() {
  const prefs = getUserPrefs();
  modalGenderChoice = prefs.gender || "-";

  const stage = document.getElementById("gender-tiby-stage");
  if (stage && !stage.innerHTML) {
    stage.innerHTML = createGenderTibySVG("gender");
  }

  previewGenderChoice(modalGenderChoice);
  setElClass("gender-modal", "add", "open");
  refreshIcons();
}

function previewGenderChoice(gender) {
  modalGenderChoice = gender;
  setTibyGenderVisual("gender-tiby-stage", gender);

  document.querySelectorAll("[data-modal-gender]").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.modalGender === gender);
  });

  if (gender === "Laki-laki") {
    setElText("gender-tiby-caption", "Pilihan saat ini: Laki-laki");
  } else if (gender === "Perempuan") {
    setElText("gender-tiby-caption", "Pilihan saat ini: Perempuan");
  } else {
    setElText("gender-tiby-caption", "Tidak menampilkan jenis kelamin (-)");
  }
}

function saveGenderChoice() {
  if (!currentUser) return;
  saveUserPrefs({ gender: modalGenderChoice });
  syncProfileDisplay();
  closeGenderModal();
  showToast(
    modalGenderChoice === "-"
      ? "Jenis kelamin diatur ke netral (-)"
      : `Jenis kelamin diperbarui: ${modalGenderChoice}`
  );
}

function closeGenderModal() {
  setElClass("gender-modal", "remove", "open");
}

// ==================== ONBOARDING QUIZ PENGGUNA BARU ====================
function openOnboardingQuiz() {
  const quizModal = document.getElementById("onboarding-quiz-modal");
  if (!quizModal) return;

  const quizStage = document.getElementById("quiz-tiby-stage");
  if (quizStage && !quizStage.innerHTML) {
    quizStage.innerHTML = createGenderTibySVG("quiz");
  }

  const existingPrefs = getUserPrefs();
  quizStep = 1;
  quizAnswers = {
    gender: existingPrefs.gender || "",
    source: "",
    theme: document.documentElement.getAttribute("data-theme") || "dark",
  };

  setTibyGenderVisual("quiz-tiby-stage", quizAnswers.gender || "-");
  renderQuizStep();
  quizModal.classList.add("open");
  refreshIcons();
}

function renderQuizStep() {
  setElClass("quiz-step-1", "toggle", "hidden", quizStep !== 1);
  setElClass("quiz-step-2", "toggle", "hidden", quizStep !== 2);
  setElClass("quiz-step-3", "toggle", "hidden", quizStep !== 3);

  setElText("quiz-step-counter", `${quizStep} / 3`);

  for (let i = 1; i <= 3; i++) {
    setElClass(`quiz-dot-${i}`, "toggle", "active", i === quizStep);
    setElClass(`quiz-dot-${i}`, "toggle", "done", i < quizStep);
  }

  setElClass("quiz-btn-prev", "toggle", "hidden", quizStep === 1);
  const nextBtn = document.getElementById("quiz-btn-next");
  if (nextBtn) {
    nextBtn.innerHTML = quizStep === 3
      ? `<span>Mulai Pakai TibyTask</span><i data-lucide="sparkles"></i>`
      : `<span>Lanjut</span><i data-lucide="arrow-right"></i>`;
  }

  document.querySelectorAll("[data-gender]").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.gender === quizAnswers.gender);
  });
  document.querySelectorAll("[data-source]").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.source === quizAnswers.source);
  });
  document.querySelectorAll("[data-theme]").forEach((btn) => {
    btn.classList.toggle("selected", btn.dataset.theme === quizAnswers.theme);
  });

  setTibyGenderVisual("quiz-tiby-stage", quizAnswers.gender || "-");

  const firstName = currentUser?.name ? currentUser.name.split(" ")[0] : "teman";
  if (quizStep === 1) {
    if (quizAnswers.gender === "Laki-laki") {
      setElText("quiz-tiby-speech", "Dipilih: Laki-laki. Klik Lanjut kalau sudah sesuai.");
    } else if (quizAnswers.gender === "Perempuan") {
      setElText("quiz-tiby-speech", "Dipilih: Perempuan. Klik Lanjut kalau sudah sesuai.");
    } else if (quizAnswers.gender === "-") {
      setElText("quiz-tiby-speech", "Oke, bagian ini dikosongkan (-). Klik Lanjut ya.");
    } else {
      setElText("quiz-tiby-speech", `Halo ${firstName}! Pilih jenis kelaminmu di sebelah kanan ya.`);
    }
  } else if (quizStep === 2) {
    setElText(
      "quiz-tiby-speech",
      quizAnswers.source
        ? `Wah dari ${quizAnswers.source}! Makasih udah mampir ke TibyTask ya!`
        : `Tiby penasaran nih, kamu tahu TibyTask dari mana?`
    );
  } else if (quizStep === 3) {
    setElText(
      "quiz-tiby-speech",
      quizAnswers.theme === "light"
        ? `Mode Terang cerah banget ya! Mau pakai tema ini?`
        : `Mode Gelap adem di mata! Pilih tema favoritmu sebelum mulai.`
    );
  }

  refreshIcons();
}

function selectQuizGender(gender) {
  quizAnswers.gender = gender;
  renderQuizStep();
}

function selectQuizSource(source) {
  quizAnswers.source = source;
  renderQuizStep();
}

function selectQuizTheme(theme) {
  quizAnswers.theme = theme;
  setAppTheme(theme, true);
  renderQuizStep();
}

function prevQuizStep() {
  if (quizStep > 1) {
    quizStep--;
    renderQuizStep();
  }
}

function nextQuizStep() {
  if (quizStep === 1) {
    if (!quizAnswers.gender) {
      showToast("Pilih Laki-laki, '-', atau Perempuan dulu ya!", "error");
      return;
    }
    quizStep = 2;
    renderQuizStep();
    return;
  }

  if (quizStep === 2) {
    if (!quizAnswers.source) {
      showToast("Pilih dulu kamu tahu TibyTask dari mana ya!", "error");
      return;
    }
    quizStep = 3;
    renderQuizStep();
    return;
  }

  saveUserPrefs({
    gender: quizAnswers.gender,
    theme: quizAnswers.theme,
    onboarded: true,
  });
  setAppTheme(quizAnswers.theme, true);

  setElClass("onboarding-quiz-modal", "remove", "open");
  syncProfileDisplay();
  showToast("Profil & tema berhasil diatur!");
  const displayName = currentUser?.name || "teman";
  setWidgetTibyMood("happy", `Yeay, salam kenal ${displayName}! Yuk mulai atur tugas pertamamu.`);
}

// ==================== UI HELPERS ====================
function animateNumber(elementId, targetValue) {
  const el = document.getElementById(elementId);
  if (!el) return;
  const target = Number(targetValue) || 0;
  const start = parseInt(el.textContent, 10) || 0;
  if (start === target) {
    el.textContent = target;
    return;
  }

  const duration = 500;
  const startTime = performance.now();

  function tick(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

function updateGreetingAndDate() {
  const now = new Date();
  const hour = now.getHours();
  let greeting = "Selamat Malam";
  if (hour >= 4 && hour < 11) greeting = "Selamat Pagi";
  else if (hour >= 11 && hour < 15) greeting = "Selamat Siang";
  else if (hour >= 15 && hour < 18) greeting = "Selamat Sore";

  const greetEl = document.getElementById("topbar-greeting");
  if (greetEl && currentUser) {
    greetEl.innerHTML = `${greeting}, <strong style="color:var(--ink);">${escapeHtml(currentUser.name || "Pengguna")}</strong>`;
  }

  setElText(
    "topbar-date",
    now.toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
    })
  );
}

function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isPwd = input.type === "password";
  input.type = isPwd ? "text" : "password";
  if (btn) {
    btn.innerHTML = `<i data-lucide="${isPwd ? "eye-off" : "eye"}"></i>`;
  }
  refreshIcons();
}

function handleBackdropClick(e, modalId) {
  if (e.target.id === modalId && modalId !== "onboarding-quiz-modal") {
    setElClass(modalId, "remove", "open");
    if (modalId === "task-modal") setModalTibyPose("idle", false);
  }
}

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    document.querySelectorAll(".modal.open").forEach((m) => {
      if (m.id !== "onboarding-quiz-modal") {
        m.classList.remove("open");
      }
    });
    closeSidebar();
    setModalTibyPose("idle", false);
  }
});

// ==================== TOAST & API CLIENT ====================
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  const icon = document.getElementById("toast-icon");
  if (!toast) return;

  clearTimeout(toastTimer);
  setElText("toast-msg", message);
  if (icon) {
    icon.setAttribute("data-lucide", type === "error" ? "alert-circle" : "check-circle-2");
  }
  toast.className = `toast ${type} show`;
  refreshIcons();

  toastTimer = setTimeout(() => {
    toast.classList.remove("show");
  }, 3200);
}

async function apiRequest(endpoint, options = {}) {
  const token = localStorage.getItem("token");
  const headers = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (response.status === 401 && !endpoint.includes("/auth/login")) {
    showToast("Sesi berakhir. Silakan masuk kembali.", "error");
    handleLogout(false);
    throw new Error("Unauthorized");
  }

  if (response.status === 403) {
    showToast(data.error || "Akses ditolak (403).", "error");
    throw new Error(data.error || "Forbidden");
  }

  if (!response.ok) {
    throw new Error(data.error || "Terjadi kesalahan pada permintaan");
  }

  return data;
}

// ==================== AVATAR TEMPLATE PICKER ====================
function getAvatarStorageKey() {
  return `tibytask_avatar_${getUserUniqueKey()}`;
}

function renderSidebarAvatar() {
  const box = document.getElementById("user-avatar-box");
  if (!box || !currentUser) return;

  const savedSrc = localStorage.getItem(getAvatarStorageKey());
  const initial = (currentUser.name || "U").charAt(0).toUpperCase();

  if (savedSrc) {
    box.innerHTML = `<img src="${savedSrc}" alt="Avatar" onerror="this.parentElement.textContent='${initial}'" />`;
  } else {
    box.textContent = initial;
  }
}

function renderProfileAvatarPreview() {
  const preview = document.getElementById("prof-avatar-preview");
  if (!preview || !currentUser) return;

  const savedSrc = localStorage.getItem(getAvatarStorageKey());
  const initial = (currentUser.name || "U").charAt(0).toUpperCase();

  if (savedSrc) {
    preview.innerHTML = `<img src="${savedSrc}" alt="Avatar" onerror="this.parentElement.textContent='${initial}'" />`;
  } else {
    preview.textContent = initial;
  }
}

function renderAvatarGrid() {
  const savedSrc = localStorage.getItem(getAvatarStorageKey());
  const grid = document.getElementById("avatar-grid");
  if (!grid) return;
  const initial = currentUser?.name ? currentUser.name.charAt(0).toUpperCase() : "U";

  grid.innerHTML = AVATAR_TEMPLATES.map((av) => {
    const isSelected = savedSrc === av.src;
    return `
      <div class="avatar-option ${isSelected ? "selected" : ""}" onclick="selectAvatar('${av.src}')">
        <img src="${av.src}" alt="${av.label}" onerror="this.src='data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2266%22 height=%2266%22><rect width=%22100%%22 height=%22100%%22 fill=%22%23282e44%22/><text x=%2250%%22 y=%2256%%22 font-size=%2224%22 fill=%22%23f4f1ea%22 text-anchor=%22middle%22 font-family=%22sans-serif%22>${initial}</text></svg>'" />
        <span>${av.label}</span>
      </div>
    `;
  }).join("");
}

function openAvatarModal() {
  renderAvatarGrid();
  setElClass("avatar-modal", "add", "open");
  refreshIcons();
}

function selectAvatar(src) {
  localStorage.setItem(getAvatarStorageKey(), src);
  renderSidebarAvatar();
  renderProfileAvatarPreview();
  renderAvatarGrid();
  showToast("Foto profil berhasil diperbarui");
}

function resetAvatarToInitial() {
  localStorage.removeItem(getAvatarStorageKey());
  renderSidebarAvatar();
  renderProfileAvatarPreview();
  renderAvatarGrid();
  showToast("Menggunakan inisial nama");
}

function closeAvatarModal() {
  setElClass("avatar-modal", "remove", "open");
}

// ==================== HALAMAN PROFIL & PENGATURAN (USER & ADMIN) ====================
function syncProfileDisplay() {
  if (!currentUser) return;
  const prefs = getUserPrefs();
  const genderText = prefs.gender || "-";
  const hasRealGender = genderText === "Laki-laki" || genderText === "Perempuan";
  const roleStr = (currentUser.role || "USER").toUpperCase();

  setElText("prof-name-display", currentUser.name || "-");
  setElText("prof-email-display", currentUser.email || "-");
  setElText("prof-id-val", `#${currentUser.id ?? "-"}`);
  setElText("prof-role-val", roleStr);
  setElText("prof-name-val", currentUser.name || "-");
  setElText("prof-gender-val", genderText);
  setElText("settings-gender-current", genderText);
  setElText("prof-email-val", currentUser.email || "-");

  const roleBadge = document.getElementById("prof-role-badge");
  if (roleBadge) {
    roleBadge.textContent = roleStr;
    roleBadge.className = `badge badge-${roleStr}`;
  }

  const genderBadge = document.getElementById("prof-gender-badge");
  if (genderBadge) {
    genderBadge.textContent = genderText;
    genderBadge.className = `badge ${hasRealGender ? "badge-IN_PROGRESS" : "badge-TODO"}`;
  }

  const isActive = currentUser.is_active !== false;
  const statusBadge = document.getElementById("prof-status-badge");
  if (statusBadge) {
    statusBadge.textContent = isActive ? "Aktif" : "Nonaktif";
    statusBadge.className = `badge ${isActive ? "badge-DONE" : "badge-HIGH"}`;
  }

  const activeTheme = document.documentElement.getAttribute("data-theme") || "dark";
  setElClass("set-theme-dark", "toggle", "is-active-choice", activeTheme === "dark");
  setElClass("set-theme-light", "toggle", "is-active-choice", activeTheme === "light");
}

async function loadProfilePage() {
  if (!currentUser) return;
  try {
    const res = await apiRequest("/auth/me");
    const user = extractUserPayload(res);
    if (user) {
      currentUser = user;
    }
    syncProfileDisplay();

    const roleStr = (currentUser.role || "USER").toUpperCase();
    setElText(
      "prof-role-desc",
      roleStr === "ADMIN"
        ? "Akun ini memiliki hak akses ADMIN untuk mengelola pengguna, memantau seluruh tugas secara read-only, dan melihat statistik sistem."
        : "Akun ini memiliki hak akses USER untuk mengelola daftar tugas pribadi, kategori, dan memantau progres penyelesaian harian."
    );

    renderProfileAvatarPreview();
    refreshIcons();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==================== MODAL PERINGATAN LOGOUT (TIBY SEDIH) ====================
function openLogoutModal() {
  closeSidebar();
  const logoutStage = document.getElementById("logout-tiby-stage");
  if (logoutStage && !logoutStage.innerHTML) {
    logoutStage.innerHTML = createSadTibySVG("logout");
  }
  const name = currentUser?.name || "kamu";
  setElText("logout-tiby-msg", `Yah, ${name} beneran mau keluar? Nanti Tiby sendirian di sini...`);
  setElClass("logout-modal", "add", "open");
  refreshIcons();
}

function closeLogoutModal() {
  setElClass("logout-modal", "remove", "open");
  setTibyBubbleText("Yeay, gajadi keluar! Yuk lanjutin lagi.", true);
}

function confirmLogout() {
  setElClass("logout-modal", "remove", "open");
  handleLogout(true);
}

// ==================== AUTHENTICATION ====================
function switchAuthTab(tab) {
  const isReg = tab === "register";
  setElClass("tab-login", "toggle", "active", !isReg);
  setElClass("tab-register", "toggle", "active", isReg);
  setElClass("auth-tab-slider", "toggle", "right", isReg);
  setElClass("login-form", "toggle", "hidden", isReg);
  setElClass("register-form", "toggle", "hidden", !isReg);

  clearTimeout(authTypingTimer);
  setAuthTibyPose(isReg ? "writing" : "waving", false);
}

async function handleLogin(e) {
  e.preventDefault();
  const email = document.getElementById("login-email")?.value.trim() || "";
  const password = document.getElementById("login-password")?.value || "";

  try {
    const res = await apiRequest("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    const token = extractTokenPayload(res);
    const user = extractUserPayload(res);

    if (!token) {
      throw new Error("Token login tidak ditemukan pada response server.");
    }

    localStorage.setItem("token", token);
    currentUser = user;

    await initApp(true);

    if (currentUser?.name) {
      showToast(`Halo, ${currentUser.name}! Selamat datang kembali.`);
    }
  } catch (err) {
    console.error("Login error:", err);
    showToast(err.message, "error");
  }
}

async function handleRegister(e) {
  e.preventDefault();
  const name = document.getElementById("reg-name")?.value.trim() || "";
  const email = document.getElementById("reg-email")?.value.trim() || "";
  const password = document.getElementById("reg-password")?.value || "";

  try {
    await apiRequest("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });

    showToast("Akun berhasil dibuat! Silakan masuk.");
    document.getElementById("register-form")?.reset();
    switchAuthTab("login");
    const loginEmailEl = document.getElementById("login-email");
    if (loginEmailEl) loginEmailEl.value = email;
  } catch (err) {
    showToast(err.message, "error");
  }
}

function handleLogout(notify = true) {
  localStorage.removeItem("token");
  currentUser = null;
  closeSidebar();
  document.querySelectorAll(".modal.open").forEach((m) => m.classList.remove("open"));
  setElClass("app-view", "add", "hidden");
  setElClass("auth-view", "remove", "hidden");
  switchAuthTab("login");
  refreshIcons();
  if (notify) showToast("Anda telah keluar");
}

// ==================== ROUTING & INIT ====================
async function initApp(fromLogin = false) {
  mountTibyInstances();
  applyInitialTheme();
  refreshIcons();

  const token = localStorage.getItem("token");
  if (!token || token === "undefined" || token === "null") {
    localStorage.removeItem("token");
    setElClass("auth-view", "remove", "hidden");
    setElClass("app-view", "add", "hidden");
    switchAuthTab("login");
    return;
  }

  try {
    const me = await apiRequest("/auth/me");
    const fetchedUser = extractUserPayload(me);
    if (fetchedUser) {
      currentUser = fetchedUser;
    }

    if (!currentUser) {
      throw new Error("Data profil pengguna kosong dari /auth/me.");
    }

    applyInitialTheme();

    setElClass("auth-view", "add", "hidden");
    setElClass("app-view", "remove", "hidden");
    closeSidebar();

    setElText("sidebar-user-name", currentUser.name || "Pengguna");
    setElText("sidebar-user-email", currentUser.email || "-");
    renderSidebarAvatar();
    updateGreetingAndDate();

    const roleStr = (currentUser.role || "USER").toUpperCase();
    const badge = document.getElementById("role-badge");
    if (badge) {
      badge.textContent = roleStr;
      badge.className = `badge badge-${roleStr}`;
    }

    if (roleStr === "ADMIN") {
      setElClass("nav-admin", "remove", "hidden");
      setElClass("nav-user", "add", "hidden");
      navigate("admin-dashboard");
    } else {
      setElClass("nav-user", "remove", "hidden");
      setElClass("nav-admin", "add", "hidden");
      await loadUserCategories().catch(() => {});
      navigate("user-dashboard");
    }

    const prefs = getUserPrefs();
    if (roleStr !== "ADMIN" && !prefs.onboarded) {
      setTimeout(() => openOnboardingQuiz(), 250);
    }

    refreshIcons();
  } catch (err) {
    console.error("initApp error:", err);
    if (fromLogin) {
      showToast(`Gagal masuk ruang kerja: ${err.message}`, "error");
    }
    handleLogout(false);
  }
}

function navigate(pageId) {
  if (!currentUser) return;

  const roleStr = (currentUser.role || "USER").toUpperCase();
  if (roleStr === "USER" && pageId.startsWith("admin-")) {
    showToast("Akses ditolak.", "error");
    return;
  }
  if (roleStr === "ADMIN" && pageId.startsWith("user-")) {
    showToast("Akses ditolak.", "error");
    return;
  }

  document.querySelectorAll(".page-section").forEach((sec) => sec.classList.add("hidden"));
  const target = document.getElementById(`page-${pageId}`);
  if (target) {
    target.classList.remove("hidden");
    target.style.animation = "none";
    void target.offsetWidth;
    target.style.animation = "";
  }

  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.page === pageId);
  });

  if (pageId === "user-dashboard") loadUserDashboard();
  if (pageId === "user-tasks") {
    loadUserTasks(1);
    setTibyBubbleText("Ini daftar tugasmu! Klik 'Selesai' atau Edit kalau tugas sudah kelar ya.", false);
  }
  if (pageId === "user-categories") {
    loadUserCategories();
    setTibyBubbleText("Bikin kategori biar tugas sekolah, proyek, dan pribadi nggak kecampur!", false);
  }
  if (pageId === "admin-dashboard") loadAdminDashboard();
  if (pageId === "admin-users") {
    loadAdminUsers(1);
    setTibyBubbleText("Di sini kamu bisa kelola role dan status akun pengguna dengan aman.", false);
  }
  if (pageId === "admin-tasks") {
    loadAdminTasks(1);
    setTibyBubbleText("Mode pantau seluruh tugas aktif (read-only).", false);
  }
  if (pageId === "profile") {
    loadProfilePage();
    setTibyBubbleText("Ini halaman profil & pengaturanmu! Kamu bisa ubah tema atau jenis kelamin di sini.", false);
  }
  refreshIcons();
}

// ==================== USER: DASHBOARD ====================
async function loadUserDashboard(keepHappy = false) {
  if (!currentUser) return;
  try {
    const res = await apiRequest("/dashboard");
    const d = res.data || res;
    animateNumber("u-stat-total", d.total_tasks);
    animateNumber("u-stat-todo", d.todo_count);
    animateNumber("u-stat-progress", d.in_progress_count);
    animateNumber("u-stat-done", d.done_count);

    const total = Number(d.total_tasks) || 0;
    const done = Number(d.done_count) || 0;
    const pct = total > 0 ? Math.round((done / total) * 100) : 0;

    setElText("u-progress-percent", `${pct}%`);
    const fillEl = document.getElementById("u-progress-fill");
    if (fillEl) fillEl.style.width = `${pct}%`;
    setElText("u-progress-text", `${done} dari ${total} tugas telah selesai`);

    if (!keepHappy && currentUser) {
      const displayName = currentUser.name || "Pengguna";
      if (total === 0) {
        setWidgetTibyMood("idle", `Halo ${displayName}! Belum ada tugas nih—yuk tambah tugas pertamamu.`);
      } else if (pct === 100) {
        setWidgetTibyMood("happy", `Keren banget! Semua ${total} tugasmu sudah beres 100%!`, 5000);
      } else if (d.in_progress_count > 0) {
        setWidgetTibyMood("idle", `Ada ${d.in_progress_count} tugas lagi berjalan & ${d.todo_count} menunggu. Pelan-pelan pasti beres!`);
      } else {
        setWidgetTibyMood("idle", `Kamu punya ${d.todo_count} tugas yang siap dikerjakan. Mulai dari prioritas tertinggi ya!`);
      }
    }

    const tbody = document.getElementById("u-upcoming-tbody");
    if (!tbody) return;

    if (!d.upcoming_tasks || d.upcoming_tasks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" class="text-center">Semua tugas sudah selesai atau belum ada tugas baru.</td></tr>`;
      return;
    }

    tbody.innerHTML = d.upcoming_tasks.map((t, idx) => `
      <tr style="animation-delay:${idx * 45}ms">
        <td><strong>${escapeHtml(t.title)}</strong></td>
        <td>${t.category_name ? `<span class="badge badge-TODO">${escapeHtml(t.category_name)}</span>` : "-"}</td>
        <td><span class="badge badge-${t.priority}">${t.priority}</span></td>
        <td><span class="badge badge-${t.status}">${t.status.replace("_", " ")}</span></td>
        <td class="mono">${t.due_date || "-"}</td>
      </tr>
    `).join("");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==================== USER: CATEGORIES ====================
async function loadUserCategories() {
  try {
    const res = await apiRequest("/categories");
    userCategories = res.data || [];

    const tbody = document.getElementById("u-categories-tbody");
    if (tbody) {
      tbody.innerHTML = userCategories.length === 0
        ? `<tr><td colspan="3" class="text-center">Belum ada kategori. Tambahkan kategori pertama di atas.</td></tr>`
        : userCategories.map((c, idx) => `
          <tr style="animation-delay:${idx * 40}ms">
            <td class="mono text-slate">#${c.id}</td>
            <td><strong>${escapeHtml(c.name)}</strong></td>
            <td class="text-right">
              <button class="btn btn-outline btn-sm" onclick="editCategory(${c.id}, '${escapeAttr(c.name)}')">
                <i data-lucide="pencil"></i> Edit
              </button>
              <button class="btn btn-danger btn-sm" onclick="deleteCategory(${c.id})">
                <i data-lucide="trash-2"></i> Hapus
              </button>
            </td>
          </tr>
        `).join("");
      refreshIcons();
    }

    const filterSelect = document.getElementById("t-filter-category");
    const modalSelect = document.getElementById("task-category");
    const optionsHtml = userCategories.map((c) => `<option value="${c.id}">${escapeHtml(c.name)}</option>`).join("");

    if (filterSelect) filterSelect.innerHTML = `<option value="">Semua Kategori</option>${optionsHtml}`;
    if (modalSelect) modalSelect.innerHTML = `<option value="">Tanpa Kategori</option>${optionsHtml}`;
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function handleSaveCategory(e) {
  e.preventDefault();
  const id = document.getElementById("cat-id")?.value;
  const name = document.getElementById("cat-name")?.value.trim() || "";

  try {
    if (id) {
      await apiRequest(`/categories/${id}`, { method: "PUT", body: JSON.stringify({ name }) });
      showToast("Kategori diperbarui");
    } else {
      await apiRequest("/categories", { method: "POST", body: JSON.stringify({ name }) });
      showToast("Kategori ditambahkan");
    }
    resetCategoryForm();
    loadUserCategories();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function editCategory(id, name) {
  const idEl = document.getElementById("cat-id");
  const nameEl = document.getElementById("cat-name");
  const saveBtn = document.getElementById("btn-save-cat");
  if (idEl) idEl.value = id;
  if (nameEl) {
    nameEl.value = name;
    nameEl.focus();
  }
  if (saveBtn) saveBtn.innerHTML = `<i data-lucide="check"></i><span>Update Kategori</span>`;
  setElClass("btn-cancel-cat", "remove", "hidden");
  refreshIcons();
}

function resetCategoryForm() {
  const idEl = document.getElementById("cat-id");
  const nameEl = document.getElementById("cat-name");
  const saveBtn = document.getElementById("btn-save-cat");
  if (idEl) idEl.value = "";
  if (nameEl) nameEl.value = "";
  if (saveBtn) saveBtn.innerHTML = `<i data-lucide="save"></i><span>Simpan Kategori</span>`;
  setElClass("btn-cancel-cat", "add", "hidden");
  refreshIcons();
}

async function deleteCategory(id) {
  if (!confirm("Yakin ingin menghapus kategori ini? Tugas di kategori ini tidak akan terhapus.")) return;
  try {
    await apiRequest(`/categories/${id}`, { method: "DELETE" });
    showToast("Kategori dihapus");
    loadUserCategories();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==================== USER: TASKS (PER KOTAK / CARD GRID) ====================
function debounceLoadTasks() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadUserTasks(1), 320);
}

function renderUserTasksGrid(tasks) {
  const grid = document.getElementById("u-tasks-grid");
  if (!grid) return;

  if (!tasks || tasks.length === 0) {
    grid.innerHTML = `<div class="task-box-empty">Belum ada kotak tugas yang sesuai. Klik "+ Tugas Baru" untuk menambah.</div>`;
    return;
  }

  grid.innerHTML = tasks.map((t, idx) => {
    const isDone = t.status === "DONE";
    return `
      <article class="task-box-card ${isDone ? "is-done-card" : ""}" style="animation-delay:${Math.min(idx * 65, 520)}ms">
        <div>
          <div class="task-box-top">
            <span class="badge badge-${t.status}">${t.status.replace("_", " ")}</span>
            <div class="task-box-badges">
              <span class="badge badge-${t.priority}">${t.priority}</span>
              ${t.category_name ? `<span class="badge badge-TODO">${escapeHtml(t.category_name)}</span>` : ""}
            </div>
          </div>

          <h3 class="task-box-title" style="margin-top: 12px;">${escapeHtml(t.title)}</h3>
          ${t.description
            ? `<p class="task-box-desc">${escapeHtml(t.description)}</p>`
            : `<p class="task-box-desc" style="font-style: italic; opacity: 0.7;">Tidak ada catatan tambahan.</p>`}
        </div>

        <div class="task-box-footer">
          <span class="task-box-due mono">
            <i data-lucide="calendar-clock"></i>
            <span>${t.due_date || "Tanpa tenggat"}</span>
          </span>
          <div class="task-box-actions">
            ${!isDone ? `
              <button class="btn btn-success btn-sm" onclick="markTaskDone(${t.id})" title="Tandai selesai">
                <i data-lucide="check-circle-2"></i> Selesai
              </button>
            ` : ""}
            <button class="btn btn-outline btn-sm" onclick="openTaskModal(${t.id})">
              <i data-lucide="pencil"></i> Edit
            </button>
            <button class="btn btn-danger btn-sm" onclick="deleteTask(${t.id})">
              <i data-lucide="trash-2"></i> Hapus
            </button>
          </div>
        </div>
      </article>
    `;
  }).join("");

  refreshIcons();
}

async function loadUserTasks(page = 1) {
  const search = document.getElementById("t-search")?.value.trim() || "";
  const status = document.getElementById("t-filter-status")?.value || "";
  const priority = document.getElementById("t-filter-priority")?.value || "";
  const categoryId = document.getElementById("t-filter-category")?.value || "";
  const sortBy = document.getElementById("t-sort-by")?.value || "created_at";
  const sortOrder = document.getElementById("t-sort-order")?.value || "DESC";

  const query = new URLSearchParams({
    page,
    limit: 10,
    ...(search && { search }),
    ...(status && { status }),
    ...(priority && { priority }),
    ...(categoryId && { category_id: categoryId }),
    sort_by: sortBy,
    sort_order: sortOrder,
  });

  try {
    const res = await apiRequest(`/tasks?${query.toString()}`);
    renderUserTasksGrid(res.data || []);
    renderPagination("u-tasks-pagination", res.page, res.total_pages, res.total, "loadUserTasks");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function markTaskDone(taskId) {
  try {
    const detail = await apiRequest(`/tasks/${taskId}`);
    const t = detail.data;
    const payload = {
      title: t.title,
      description: t.description || null,
      category_id: t.category_id || null,
      priority: t.priority,
      status: "DONE",
      due_date: t.due_date || null,
    };

    await apiRequest(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });

    showToast(`Tugas "${t.title}" selesai!`);
    setWidgetTibyMood("happy", `Yeay! "${t.title}" sudah DONE! Keren banget!`);
    await loadUserTasks(1);
    await loadUserDashboard(true);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function openTaskModal(taskId = null) {
  await loadUserCategories();
  document.getElementById("task-form")?.reset();
  const idEl = document.getElementById("task-id");
  if (idEl) idEl.value = "";

  setModalTibyPose("idle", false);

  if (taskId) {
    setElText("task-modal-title", "Edit Tugas");
    try {
      const res = await apiRequest(`/tasks/${taskId}`);
      const t = res.data;
      if (idEl) idEl.value = t.id;
      document.getElementById("task-title").value = t.title;
      document.getElementById("task-desc").value = t.description || "";
      document.getElementById("task-category").value = t.category_id || "";
      document.getElementById("task-due-date").value = t.due_date || "";
      document.getElementById("task-priority").value = t.priority;
      document.getElementById("task-status").value = t.status;
    } catch (err) {
      showToast(err.message, "error");
      return;
    }
  } else {
    setElText("task-modal-title", "Tugas Baru");
  }

  setElClass("task-modal", "add", "open");
  refreshIcons();
}

function closeTaskModal() {
  setElClass("task-modal", "remove", "open");
  setModalTibyPose("idle", false);
}

async function handleSaveTask(e) {
  e.preventDefault();
  const id = document.getElementById("task-id")?.value;
  const catVal = document.getElementById("task-category")?.value;
  const descVal = document.getElementById("task-desc")?.value.trim() || "";
  const dueVal = document.getElementById("task-due-date")?.value;
  const statusVal = document.getElementById("task-status")?.value || "TODO";

  const payload = {
    title: document.getElementById("task-title")?.value.trim() || "",
    description: descVal ? descVal : null,
    category_id: catVal ? parseInt(catVal, 10) : null,
    priority: document.getElementById("task-priority")?.value || "MEDIUM",
    status: statusVal,
    due_date: dueVal ? dueVal : null,
  };

  try {
    if (id) {
      await apiRequest(`/tasks/${id}`, { method: "PUT", body: JSON.stringify(payload) });
      showToast("Tugas berhasil diperbarui");
    } else {
      await apiRequest("/tasks", { method: "POST", body: JSON.stringify(payload) });
      showToast("Tugas berhasil ditambahkan");
    }
    closeTaskModal();

    const isDone = statusVal === "DONE";
    if (isDone) {
      setWidgetTibyMood("happy", `Yeay! Tugas "${payload.title}" selesai dikerjakan. Mantap!`);
    } else if (!id) {
      setTibyBubbleText(`Sip! "${payload.title}" sudah masuk catatanku.`, true);
    }

    await loadUserTasks(1);
    await loadUserDashboard(isDone);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function deleteTask(id) {
  if (!confirm("Yakin ingin menghapus tugas ini?")) return;
  try {
    await apiRequest(`/tasks/${id}`, { method: "DELETE" });
    showToast("Tugas berhasil dihapus");
    loadUserTasks(1);
    loadUserDashboard();
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==================== ADMIN: DASHBOARD, USERS & MONITORING ====================
async function loadAdminDashboard() {
  try {
    const res = await apiRequest("/admin/dashboard");
    const d = res.data || res;

    animateNumber("a-stat-users", d.total_users);
    setElText("a-stat-users-sub", `Aktif: ${d.active_users} | Nonaktif: ${d.inactive_users}`);
    animateNumber("a-stat-admins", d.total_admins);
    setElText("a-stat-new7d", `+${d.new_users_last_7_days} pengguna 7 hari terakhir`);
    animateNumber("a-stat-tasks", d.total_tasks);
    setElText(
      "a-stat-tasks-sub",
      `TODO: ${d.tasks_by_status?.TODO || 0} | Progress: ${d.tasks_by_status?.IN_PROGRESS || 0} | Done: ${d.tasks_by_status?.DONE || 0}`
    );

    setWidgetTibyMood("idle", `Halo Admin! Saat ini ada ${d.total_users} pengguna aktif dan ${d.total_tasks} total tugas di sistem.`);

    const tbody = document.getElementById("a-recent-users-tbody");
    if (!tbody) return;
    tbody.innerHTML = (d.recent_users || []).map((u, idx) => `
      <tr style="animation-delay:${idx * 45}ms">
        <td class="mono text-slate">#${u.id}</td>
        <td><strong>${escapeHtml(u.name)}</strong></td>
        <td class="text-slate">${escapeHtml(u.email)}</td>
        <td><span class="badge badge-${u.role}">${u.role}</span></td>
        <td><span class="badge ${u.is_active ? "badge-DONE" : "badge-HIGH"}">${u.is_active ? "Aktif" : "Nonaktif"}</span></td>
      </tr>
    `).join("");
  } catch (err) {
    showToast(err.message, "error");
  }
}

function debounceLoadAdminUsers() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadAdminUsers(1), 320);
}

async function loadAdminUsers(page = 1) {
  const search = document.getElementById("au-search")?.value.trim() || "";
  const role = document.getElementById("au-filter-role")?.value || "";
  const isActive = document.getElementById("au-filter-status")?.value || "";
  const sortBy = document.getElementById("au-sort-by")?.value || "created_at";

  const query = new URLSearchParams({
    page,
    limit: 10,
    ...(search && { search }),
    ...(role && { role }),
    ...(isActive && { is_active: isActive }),
    sort_by: sortBy,
  });

  try {
    const res = await apiRequest(`/admin/users?${query.toString()}`);
    const tbody = document.getElementById("a-users-tbody");
    if (!tbody) return;

    tbody.innerHTML = (res.data || []).map((u, idx) => {
      const isSelf = currentUser && u.id === currentUser.id;
      return `
        <tr style="animation-delay:${idx * 35}ms">
          <td class="mono text-slate">#${u.id}</td>
          <td>
            <strong>${escapeHtml(u.name)}</strong> ${isSelf ? `<span class="badge badge-USER">Anda</span>` : ""}<br>
            <small class="text-slate">${escapeHtml(u.email)}</small>
          </td>
          <td>
            <select class="role-select" ${isSelf ? "disabled" : ""} onchange="changeUserRole(${u.id}, this.value)">
              <option value="USER" ${u.role === "USER" ? "selected" : ""}>USER</option>
              <option value="ADMIN" ${u.role === "ADMIN" ? "selected" : ""}>ADMIN</option>
            </select>
          </td>
          <td>
            <span class="badge ${u.is_active ? "badge-DONE" : "badge-HIGH"}">
              ${u.is_active ? "Aktif" : "Nonaktif"}
            </span>
          </td>
          <td class="text-right">
            <button class="btn btn-outline btn-sm" onclick="viewUserDetail(${u.id})">
              <i data-lucide="info"></i> Detail
            </button>
            ${!isSelf ? `
              <button class="btn ${u.is_active ? "btn-danger" : "btn-primary"} btn-sm"
                onclick="toggleUserStatus(${u.id}, ${!u.is_active})">
                <i data-lucide="${u.is_active ? "user-x" : "user-check"}"></i>
                ${u.is_active ? "Nonaktifkan" : "Aktifkan"}
              </button>
            ` : ""}
          </td>
        </tr>
      `;
    }).join("");
    refreshIcons();

    renderPagination("a-users-pagination", res.page, res.total_pages, res.total, "loadAdminUsers");
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function changeUserRole(userId, newRole) {
  if (!confirm(`Ubah role pengguna ID ${userId} menjadi ${newRole}?`)) {
    loadAdminUsers(1);
    return;
  }
  try {
    await apiRequest(`/admin/users/${userId}/role`, {
      method: "PATCH",
      body: JSON.stringify({ role: newRole }),
    });
    showToast("Role pengguna diperbarui");
    loadAdminUsers(1);
  } catch (err) {
    showToast(err.message, "error");
    loadAdminUsers(1);
  }
}

async function toggleUserStatus(userId, targetStatus) {
  const actionLabel = targetStatus ? "mengaktifkan" : "menonaktifkan";
  if (!confirm(`Yakin ingin ${actionLabel} pengguna ID ${userId}?`)) return;
  try {
    await apiRequest(`/admin/users/${userId}/status`, {
      method: "PATCH",
      body: JSON.stringify({ is_active: targetStatus }),
    });
    showToast(`Berhasil ${actionLabel} akun`);
    loadAdminUsers(1);
  } catch (err) {
    showToast(err.message, "error");
  }
}

async function viewUserDetail(userId) {
  try {
    const res = await apiRequest(`/admin/users/${userId}`);
    const { user, task_summary } = res.data;
    const bodyEl = document.getElementById("user-detail-body");
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="detail-grid">
          <div class="detail-item"><small>Nama Lengkap</small><strong>${escapeHtml(user.name)}</strong></div>
          <div class="detail-item"><small>Email</small><strong>${escapeHtml(user.email)}</strong></div>
          <div class="detail-item"><small>Role</small><strong>${user.role}</strong></div>
          <div class="detail-item"><small>Status Akun</small><strong>${user.is_active ? "Aktif" : "Nonaktif"}</strong></div>
        </div>
        <h4 style="margin-bottom:10px;font-size:13px;color:var(--ink-soft);">Ringkasan Tugas Pengguna</h4>
        <div class="detail-grid" style="grid-template-columns: repeat(4, 1fr); text-align:center; margin-bottom:0;">
          <div class="detail-item"><small>Total</small><strong class="mono">${task_summary.total}</strong></div>
          <div class="detail-item"><small>TODO</small><strong class="mono">${task_summary.todo}</strong></div>
          <div class="detail-item"><small>Progress</small><strong class="mono">${task_summary.in_progress}</strong></div>
          <div class="detail-item"><small>Done</small><strong class="mono">${task_summary.done}</strong></div>
        </div>
      `;
    }
    setElClass("user-detail-modal", "add", "open");
    refreshIcons();
  } catch (err) {
    showToast(err.message, "error");
  }
}

function closeUserDetailModal() {
  setElClass("user-detail-modal", "remove", "open");
}

function debounceLoadAdminTasks() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => loadAdminTasks(1), 320);
}

async function loadAdminTasks(page = 1) {
  const search = document.getElementById("at-search")?.value.trim() || "";
  const userId = document.getElementById("at-user-id")?.value.trim() || "";
  const status = document.getElementById("at-filter-status")?.value || "";
  const priority = document.getElementById("at-filter-priority")?.value || "";

  const query = new URLSearchParams({
    page,
    limit: 10,
    ...(search && { search }),
    ...(userId && { user_id: userId }),
    ...(status && { status }),
    ...(priority && { priority }),
  });

  try {
    const res = await apiRequest(`/admin/tasks?${query.toString()}`);
    const tbody = document.getElementById("a-tasks-tbody");
    if (!tbody) return;

    if (!res.data || res.data.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" class="text-center">Tidak ada data tugas.</td></tr>`;
    } else {
      tbody.innerHTML = res.data.map((t, idx) => `
        <tr style="animation-delay:${idx * 35}ms">
          <td class="mono text-slate">#${t.id}</td>
          <td>
            <strong>${escapeHtml(t.owner_name)}</strong><br>
            <small class="text-slate">${escapeHtml(t.owner_email)} (ID: ${t.user_id})</small>
          </td>
          <td><strong>${escapeHtml(t.title)}</strong></td>
          <td>${t.category_name ? `<span class="badge badge-TODO">${escapeHtml(t.category_name)}</span>` : "-"}</td>
          <td><span class="badge badge-${t.priority}">${t.priority}</span></td>
          <td><span class="badge badge-${t.status}">${t.status.replace("_", " ")}</span></td>
          <td class="mono">${t.due_date || "-"}</td>
        </tr>
      `).join("");
    }

    renderPagination("a-tasks-pagination", res.page, res.total_pages, res.total, "loadAdminTasks");
  } catch (err) {
    showToast(err.message, "error");
  }
}

// ==================== PAGINATION & SECURITY ESCAPE ====================
function renderPagination(containerId, page, totalPages, total, fnName) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!total || total === 0) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <small class="text-slate">Halaman <strong class="mono" style="color:var(--ink);">${page}</strong> dari <strong class="mono" style="color:var(--ink);">${totalPages}</strong> (Total ${total} data)</small>
    <div class="pagination-btns">
      <button class="btn btn-outline btn-sm" ${page <= 1 ? "disabled" : ""} onclick="${fnName}(${page - 1})">Sebelumnya</button>
      <button class="btn btn-outline btn-sm" ${page >= totalPages ? "disabled" : ""} onclick="${fnName}(${page + 1})">Berikutnya</button>
    </div>
  `;
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[m]));
}

function escapeAttr(str) {
  return escapeHtml(str);
}

initTibyInputWatchers();
initApp();