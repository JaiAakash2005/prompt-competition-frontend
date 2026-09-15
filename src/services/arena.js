// Complete Arena implementation.
// Backend is the source of truth for competition submission/scoring.

export function initArena() {
  "use strict";

  const API_BASE = import.meta.env.VITE_API_BASE;
  const ADMIN_EMAIL = import.meta.env.VITE_ADMIN_EMAIL;
  const ADMIN_NAME = import.meta.env.VITE_ADMIN_NAME;

  const KEYWORDS = [
    "create",
    "generate",
    "design",
    "write",
    "build",
    "explain",
    "summarize",
    "list",
    "compare",
    "analyze",
    "optimize",
    "professional",
    "detailed",
    "concise",
    "step",
    "format",
    "style",
    "example",
    "structure",
    "improve",
    "make",
    "draft",
    "outline",
    "plan",
    "specific",
  ];

  const POLITE = [
    "please",
    "thanks",
    "thank you",
    "kindly",
    "appreciate",
    "would you",
    "could you",
    "grateful",
  ];

  const HARSH = [
    "now",
    "immediately",
    "stupid",
    "idiot",
    "useless",
    "hurry",
    "asap",
    "dumb",
    "hate",
    "terrible",
    "worthless",
    "shut up",
  ];

  const FALLBACK_WORDS = [
    "prompt",
    "efficiency",
    "credit",
    "arena",
    "compete",
    "score",
    "optimize",
    "craft",
    "refine",
    "precision",
    "clarity",
    "focus",
    "impact",
    "signal",
    "noise",
    "trim",
    "polish",
  ];

  const TIMER_SECONDS = 600;

  const GMAIL_DOMAINS = ["gmail.com", "googlemail.com"];

  const OUTLOOK_DOMAINS = ["outlook.com", "hotmail.com", "live.com", "msn.com"];

  const YEAR = 2026;

  // ============================================================
  // SESSION STATE
  // ============================================================

  let userName = "";
  let registrationNumber = "";
  let currentUserId = null;
  let userEmail = "";

  // IMPORTANT:
  // One session ID is created for one competition attempt.
  let sessionId = null;

  let adminToken = null;
  let malpracticeReported = false;

  let isAdmin = false;

  let contestStarted = false;
  let eliminated = false;

  let timerRemaining = TIMER_SECONDS;
  let timerId = null;

  let isTouch = false;

  let kbVisible = false;
  let kbShift = false;
  let kbMode = "letters";

  let lastScore = null;

  let sessionFinished = false;

  let integrityId = null;

  let fwWords = [];
  let fwAnimId = null;
  let lastFwHash = "";

  let loginCount = 0;

  let currentRequestId = null;

  // ============================================================
  // DOM
  // ============================================================

  const $ = (id) => document.getElementById(id);

  const loginScreen = $("login-screen");
  const nudgeOverlay = $("nudge-overlay");
  const mainApp = $("main-app");
  const adminApp = $("admin-app");

  const resultModal = $("result-modal");
  const elimScreen = $("elim-screen");

  const nameInput = $("name-input");
  const registrationInput = $("registration-input");
  const emailInput = $("email-input");

  const enterBtn = $("enter-btn");

  const promptArea = $("prompt-area");
  const finishBtn = $("finish-btn");

  const viewResultsBtn = $("view-results-btn");

  const creationTypes = $("creation-types");

  const timerEl = $("timer");

  const kbToggle = $("kb-toggle");

  const floatingKb = $("floating-kb");

  const kbRows = $("kb-rows");

  const toastEl = $("toast");

  const floatingWordsEl = $("floating-words");

  const certPanel = $("cert-panel");

  const certStatus = $("cert-status");

  const requestCertBtn = $("request-cert-btn");

  // ============================================================
  // LOCAL STORAGE HELPERS
  // ============================================================

  function lsGet(key, fallback) {
    try {
      const value = localStorage.getItem(key);

      return value ? JSON.parse(value) : fallback;
    } catch (_) {
      return fallback;
    }
  }

  function lsSet(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function getLogins() {
    return lsGet("ec_logins", {});
  }

  function setLogins(obj) {
    lsSet("ec_logins", obj);
  }

  function getRequests() {
    return lsGet("ec_requests", []);
  }

  function setRequests(arr) {
    lsSet("ec_requests", arr);
  }

  function incrementLogin(email) {
    const logins = getLogins();

    logins[email] = (logins[email] || 0) + 1;

    setLogins(logins);

    return logins[email];
  }

  // ============================================================
  // THEME
  // ============================================================

  function setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);

    const icon = theme === "dark" ? "☀" : "☾";

    if ($("theme-btn")) {
      $("theme-btn").textContent = icon;
    }

    if ($("admin-theme-btn")) {
      $("admin-theme-btn").textContent = icon;
    }

    try {
      localStorage.setItem("ec-theme", theme);
    } catch (_) {}
  }

  (function initTheme() {
    let theme = "dark";

    try {
      theme =
        localStorage.getItem("ec-theme") ||
        (matchMedia("(prefers-color-scheme: light)").matches
          ? "light"
          : "dark");
    } catch (_) {}

    setTheme(theme);
  })();

  function toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme");

    setTheme(current === "dark" ? "light" : "dark");
  }

  if ($("theme-btn")) {
    $("theme-btn").addEventListener("click", toggleTheme);
  }

  if ($("admin-theme-btn")) {
    $("admin-theme-btn").addEventListener("click", toggleTheme);
  }

  // ============================================================
  // TOUCH / FLOATING KEYBOARD
  // ============================================================

  isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  if (isTouch) {
    promptArea.setAttribute("readonly", "");

    promptArea.setAttribute("inputmode", "none");

    if ($("input-hint")) {
      $("input-hint").textContent =
        "Native keyboard is disabled — type using the floating keyboard (⌨️ button)";
    }
  }

  // ============================================================
  // EMAIL
  // ============================================================

  function classifyEmail(email) {
    const match = String(email)
      .trim()
      .toLowerCase()
      .match(/^[^@\s]+@([^@\s]+)$/);

    if (!match) {
      return null;
    }

    const domain = match[1];

    if (GMAIL_DOMAINS.includes(domain)) {
      return "gmail";
    }

    if (OUTLOOK_DOMAINS.includes(domain)) {
      return "outlook";
    }

    if (domain.includes(".") && domain.length > 3) {
      return "professional";
    }

    return null;
  }

  function updateLoginState() {
    const nameOk = nameInput.value.trim().length >= 2;

    const registrationOk = registrationInput.value.trim().length >= 2;

    const email = emailInput.value.trim().toLowerCase();

    const kind = classifyEmail(email);

    const isAdminEmail = email === ADMIN_EMAIL;

    const emailOk = !!kind || isAdminEmail;

    enterBtn.disabled = !(nameOk && registrationOk && emailOk);

    if ($("chip-gmail")) {
      $("chip-gmail").classList.toggle("active", kind === "gmail");
    }

    if ($("chip-outlook")) {
      $("chip-outlook").classList.toggle("active", kind === "outlook");
    }

    if ($("chip-pro")) {
      $("chip-pro").classList.toggle("active", kind === "professional");
    }
  }

  nameInput.addEventListener("input", updateLoginState);

  registrationInput.addEventListener("input", updateLoginState);

  emailInput.addEventListener("input", () => {
    /*
     * Always convert email to lowercase
     * while the contestant is typing.
     */

    const start = emailInput.selectionStart;

    const end = emailInput.selectionEnd;

    emailInput.value = emailInput.value.toLowerCase();

    try {
      emailInput.setSelectionRange(start, end);
    } catch (_) {}

    updateLoginState();
  });

  // ============================================================
  // FULLSCREEN
  // ============================================================

  function isFullscreen() {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  }

  function requestFS() {
    const element = document.documentElement;

    if (element.requestFullscreen) {
      return element.requestFullscreen().catch(() => {});
    }

    if (element.webkitRequestFullscreen) {
      return Promise.resolve(element.webkitRequestFullscreen());
    }

    return Promise.resolve();
  }

  function exitFS() {
    try {
      if (document.exitFullscreen) {
        return document.exitFullscreen().catch(() => {});
      }

      if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      }
    } catch (_) {}
  }

  // ============================================================
  // LOGIN
  // ============================================================

  enterBtn.addEventListener("click", async () => {
    /*
     * Prevent double-click login.
     */

    if (enterBtn.dataset.loggingIn === "1") {
      return;
    }

    enterBtn.dataset.loggingIn = "1";

    enterBtn.disabled = true;

    userName = nameInput.value.trim();

    registrationNumber = registrationInput.value.trim().toLowerCase();

    userEmail = emailInput.value.trim().toLowerCase();

    const apiBase = API_BASE;

    try {
      const loginResponse = await fetch(apiBase + "/auth/login", {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          name: userName,

          registrationNumber: registrationNumber,

          email: userEmail,
        }),
      });

      const loginData = await loginResponse.json().catch(() => ({}));

      /*
       * Backend duplicate email /
       * duplicate registration errors
       * are shown as an alert.
       */

      if (!loginResponse.ok) {
        alert(loginData.message || "Unable to login.");

        enterBtn.dataset.loggingIn = "0";

        updateLoginState();

        return;
      }

      /*
       * ======================================================
       * READ BACKEND USER
       * ======================================================
       */

      const loggedInUser = loginData.user || loginData;

      currentUserId = loggedInUser.id || loggedInUser._id || null;

      if (!currentUserId) {
        console.error("[LOGIN] Invalid backend response:", loginData);

        alert("Login could not be completed. Please try again.");

        enterBtn.dataset.loggingIn = "0";

        updateLoginState();

        return;
      }

      /*
       * ======================================================
       * CREATE SESSION ID
       *
       * One login = one competition attempt.
       * ======================================================
       */

      if (window.crypto && typeof window.crypto.randomUUID === "function") {
        sessionId = window.crypto.randomUUID();
      } else {
        sessionId =
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 12);
      }

      /*
       * ======================================================
       * USE NORMALIZED BACKEND DATA
       * ======================================================
       */

      userName = String(loggedInUser.name || userName || "").trim();

      registrationNumber = String(
        loggedInUser.registrationNumber || registrationNumber || "",
      ).trim();

      userEmail = String(loggedInUser.email || userEmail || "")
        .trim()
        .toLowerCase();

      loginCount = Number(loggedInUser.loginCount || 1);

      isAdmin = Boolean(loggedInUser.isAdmin);

      adminToken = loginData.adminToken || null;
      malpracticeReported = false;

      try {
        if (isAdmin && adminToken) {
          localStorage.setItem("ec_admin_token", adminToken);
        }

        localStorage.setItem(
          "ec_arena_session",
          JSON.stringify({
            userId: currentUserId,
            sessionId,
            name: userName,
            registrationNumber,
            email: userEmail,
            isAdmin,
            savedAt: Date.now(),
          }),
        );
      } catch (_) {}

      console.log("[LOGIN] User authenticated:", {
        userId: currentUserId,

        sessionId: sessionId,

        registrationNumber: registrationNumber,

        email: userEmail,

        isAdmin: isAdmin,
      });
    } catch (error) {
      console.error("[LOGIN]", error);

      alert("Backend is not reachable. Start the Express server first.");

      enterBtn.dataset.loggingIn = "0";

      updateLoginState();

      return;
    }

    /*
     * Make sure the normalized values
     * still pass frontend validation.
     */

    if (userName.length < 2) {
      enterBtn.dataset.loggingIn = "0";

      updateLoginState();

      return;
    }

    isAdmin = userEmail === ADMIN_EMAIL;

    if (!isAdmin && !classifyEmail(userEmail)) {
      enterBtn.dataset.loggingIn = "0";

      updateLoginState();

      return;
    }

    /*
     * Login is successful.
     */

    loginScreen.classList.add("hidden");

    /*
     * ======================================================
     * ADMIN
     * ======================================================
     */

    if (isAdmin) {
      adminApp.classList.remove("hidden");

      /*
       * Load MongoDB competition data.
       */

      loadAdminDashboard();

      enterBtn.dataset.loggingIn = "0";

      return;
    }

    /*
     * ======================================================
     * CONTESTANT
     * ======================================================
     */

    mainApp.classList.remove("hidden");

    kbToggle.classList.remove("hidden");

    $("avatar").textContent = userName.charAt(0).toUpperCase();

    $("display-name").textContent = userName;

    $("display-email").textContent =
      registrationNumber + " · " + userEmail + " · Login #" + loginCount;

    startTimer();

    buildKeyboard();

    if (isTouch) {
      showKeyboard(true);
    }

    checkExistingRequest();

    /*
     * Try fullscreen.
     */

    try {
      await requestFS();
    } catch (_) {}

    setTimeout(() => {
      if (isFullscreen()) {
        contestStarted = true;

        startIntegrityChecks();

        initFloatingWords();
      } else {
        nudgeOverlay.classList.remove("hidden");
      }
    }, 350);

    enterBtn.dataset.loggingIn = "0";
  });

  // ============================================================
  // FULLSCREEN NUDGE
  // ============================================================

  $("nudge-fs-btn").addEventListener("click", async () => {
    try {
      await requestFS();
    } catch (_) {}

    setTimeout(() => {
      if (isFullscreen()) {
        nudgeOverlay.classList.add("hidden");

        contestStarted = true;

        startIntegrityChecks();

        initFloatingWords();
      }
    }, 300);
  });

  // ============================================================
  // MANUAL FULLSCREEN BUTTON
  // ============================================================

  $("fs-btn").addEventListener("click", () => {
    if (isFullscreen()) {
      /*
       * During an active test this remains
       * a possible integrity violation.
       *
       * After finishing, it is harmless.
       */

      exitFS();
    } else {
      requestFS();
    }
  });

  // ============================================================
  // ADMIN LOGOUT
  // ============================================================

  $("admin-logout").addEventListener("click", () => {
    adminApp.classList.add("hidden");

    loginScreen.classList.remove("hidden");

    nameInput.value = "";
    registrationInput.value = "";
    emailInput.value = "";

    currentUserId = null;
    sessionId = null;

    userName = "";
    registrationNumber = "";
    userEmail = "";

    isAdmin = false;

    enterBtn.dataset.loggingIn = "0";

    updateLoginState();
  });

  // ============================================================
  // TIMER
  // ============================================================

  function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);

    const remainingSeconds = seconds % 60;

    return (
      String(minutes).padStart(2, "0") +
      ":" +
      String(remainingSeconds).padStart(2, "0")
    );
  }

  function startTimer() {
    stopTimer();

    timerRemaining = TIMER_SECONDS;

    timerEl.textContent = formatTime(timerRemaining);

    timerEl.classList.remove("critical");

    timerId = setInterval(() => {
      if (eliminated || sessionFinished) {
        return;
      }

      timerRemaining--;

      timerEl.textContent = formatTime(Math.max(0, timerRemaining));

      if (timerRemaining <= 60) {
        timerEl.classList.add("critical");
      }

      if (timerRemaining <= 0) {
        stopTimer();

        if (promptArea.value.trim() && !sessionFinished) {
          finishSession();
        }
      }
    }, 1000);
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);

      timerId = null;
    }
  }

  // ============================================================
  // OLD LOCAL SCORE
  //
  // This is retained ONLY for the existing live UI.
  //
  // It is NOT the official competition score.
  // ============================================================

  function scorePrompt(text) {
    const raw = String(text || "");

    const words = raw.trim() ? raw.trim().split(/\s+/).filter(Boolean) : [];

    const wordCount = words.length;

    const letters = (raw.match(/[a-zA-Z]/g) || []).length;

    const lower = raw.toLowerCase();

    let keywordHits = 0;

    KEYWORDS.forEach((keyword) => {
      if (lower.includes(keyword)) {
        keywordHits++;
      }
    });

    const unique = new Set(
      words
        .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ""))
        .filter(Boolean),
    );

    const vocabRichness = wordCount ? (unique.size / wordCount) * 100 : 0;

    let politeHits = 0;

    POLITE.forEach((word) => {
      if (lower.includes(word)) {
        politeHits++;
      }
    });

    let harshHits = 0;

    HARSH.forEach((word) => {
      if (lower.includes(word)) {
        harshHits++;
      }
    });

    words.forEach((word) => {
      if (
        word.length > 2 &&
        word === word.toUpperCase() &&
        /[A-Z]/.test(word)
      ) {
        harshHits++;
      }
    });

    const exclamationCount = (raw.match(/!/g) || []).length;

    if (exclamationCount > 2) {
      harshHits += exclamationCount - 2;
    }

    let credits =
      wordCount * 0.45 +
      letters / 12 -
      keywordHits * 0.6 -
      (vocabRichness / 100) * 3 -
      politeHits * 0.8 +
      harshHits * 1.6;

    credits = Math.max(0, Math.round(credits * 10) / 10);

    const cpw = wordCount ? credits / wordCount : 0;

    let tier = "Wasteful — Needs Trimming";

    if (cpw <= 0.35) {
      tier = "Champion — Highly Efficient";
    } else if (cpw <= 0.6) {
      tier = "Efficient";
    } else if (cpw <= 0.9) {
      tier = "Average";
    }

    const notes = [];

    if (harshHits >= 2) {
      notes.push("Tone penalty applied (harshness ≥ 2).");

      if (tier === "Champion — Highly Efficient") {
        tier = "Efficient";
      } else if (tier === "Efficient") {
        tier = "Average";
      } else if (tier === "Average") {
        tier = "Wasteful — Needs Trimming";
      }
    }

    if (politeHits >= 1) {
      notes.push("Politeness bonus noted.");
    }

    return {
      words: wordCount,

      letters: letters,

      keywordHits: keywordHits,

      vocabRichness: Math.round(vocabRichness * 10) / 10,

      politeHits: politeHits,

      harshHits: harshHits,

      credits: credits,

      tier: tier,

      notes:
        notes.join(" ") ||
        "Keep prompts lean and purposeful for maximum efficiency.",
    };
  }

  function updateLiveScore() {
    const score = scorePrompt(promptArea.value);

    lastScore = score;

    $("live-credits").textContent = score.credits.toFixed(1);

    $("live-words").textContent = score.words;

    $("live-tier").textContent = score.tier.split("—")[0].trim();

    $("char-count").textContent = promptArea.value.length + " chars";

    scheduleFloatingWords();
  }

  promptArea.addEventListener("input", updateLiveScore);

  promptArea.addEventListener("change", updateLiveScore);

  promptArea.addEventListener("pointerdown", (event) => {
    if (isTouch && !sessionFinished && !eliminated) {
      event.preventDefault();

      showKeyboard(true);
    }
  });

  // ============================================================
  // ROLE
  // ============================================================

  function roleFromTier(tier) {
    if (!tier) {
      return "Participant";
    }

    if (tier.startsWith("Champion")) {
      return "Winner";
    }

    if (tier.startsWith("Efficient")) {
      return "Runner-up";
    }

    return "Participant";
  }

  // ============================================================
  // CHALLENGE IMAGE
  // ============================================================

  async function getChallengeImageAsFile() {
    const imageElement = document.querySelector(".challenge-image");

    if (!imageElement || !imageElement.src) {
      throw new Error("Challenge image element was not found.");
    }

    const response = await fetch(imageElement.src);

    if (!response.ok) {
      throw new Error("Unable to load the challenge image.");
    }

    const blob = await response.blob();

    const type = blob.type || "image/svg+xml";

    const extension = type.includes("png")
      ? "png"
      : type.includes("jpeg") || type.includes("jpg")
        ? "jpg"
        : type.includes("webp")
          ? "webp"
          : "svg";

    return new File([blob], "challenge-image." + extension, {
      type,
    });
  }

  // ============================================================
  // AI UI
  // ============================================================

  function setAIEvaluationLoading() {
    const panel = $("ai-evaluation");

    if (!panel) {
      return;
    }

    panel.classList.remove("hidden");

    if ($("ai-score")) {
      $("ai-score").textContent = "...";
    }

    if ($("ai-verdict")) {
      $("ai-verdict").textContent = "Evaluating image…";
    }

    if ($("ai-reason")) {
      $("ai-reason").textContent =
        "The image-reading LLM is comparing your prompt with the challenge image.";
    }

    [
      "ai-relevance",
      "ai-visual",
      "ai-clarity",
      "ai-completeness",
      "ai-generation",
    ].forEach((id) => {
      if ($(id)) {
        $(id).textContent = "...";
      }
    });
  }

  function showAIEvaluation(evaluation) {
    const panel = $("ai-evaluation");

    if (!panel || !evaluation) {
      return;
    }

    panel.classList.remove("hidden");

    const score = Number(evaluation.overallScore ?? evaluation.score ?? 0);

    if ($("ai-score")) {
      $("ai-score").textContent = score.toFixed(1);
    }

    if ($("ai-verdict")) {
      $("ai-verdict").textContent = evaluation.verdict || "—";
    }

    if ($("ai-reason")) {
      $("ai-reason").textContent =
        evaluation.reason || "No explanation returned.";
    }

    const values = {
      "ai-relevance": evaluation.relevance,

      "ai-visual": evaluation.visualMatch ?? evaluation.visualElementCoverage,

      "ai-clarity": evaluation.promptClarity ?? evaluation.specificity,

      "ai-completeness":
        evaluation.promptCompleteness ?? evaluation.completeness,

      "ai-generation": evaluation.generationPotential,
    };

    Object.entries(values).forEach(([id, value]) => {
      if ($(id)) {
        const number = Number(value);

        $(id).textContent = Number.isFinite(number) ? number.toFixed(1) : "0.0";
      }
    });
  }

  // ============================================================
  // OFFICIAL SUBMISSION
  // ============================================================

  async function submitPromptForImageEvaluation(promptText) {
    /*
     * ========================================================
     * AUTHENTICATION CHECK
     * ========================================================
     */

    if (!currentUserId) {
      throw new Error("Authenticated user ID is missing.");
    }

    /*
     * ========================================================
     * SESSION CHECK
     * ========================================================
     */

    if (!sessionId) {
      throw new Error("Competition session ID is missing.");
    }

    /*
     * ========================================================
     * API
     * ========================================================
     */

    const apiBase = API_BASE;

    /*
     * ========================================================
     * PROMPT
     * ========================================================
     */

    const cleanPrompt = String(promptText || "").trim();

    if (!cleanPrompt) {
      throw new Error("Prompt cannot be empty.");
    }

    /*
     * ========================================================
     * NORMALIZED IDENTITY
     * ========================================================
     */

    const cleanRegistration = String(registrationNumber || "").trim();

    const cleanEmail = String(userEmail || "")
      .trim()
      .toLowerCase();

    /*
     * ========================================================
     * BACKEND PAYLOAD
     *
     * IMPORTANT:
     *
     * Do not send the old local score.
     *
     * Do not send the image.
     *
     * Do not send credits.
     *
     * Backend calculates the official score.
     * ========================================================
     */

    const payload = {
      userId: currentUserId,

      sessionId: sessionId,

      name: userName,

      registrationNumber: cleanRegistration,

      email: cleanEmail,

      prompt: cleanPrompt,
    };

    console.log("[SUBMISSION] Sending:", {
      userId: payload.userId,

      sessionId: payload.sessionId,

      registrationNumber: payload.registrationNumber,

      email: payload.email,

      promptLength: payload.prompt.length,
    });

    /*
     * ========================================================
     * SEND
     * ========================================================
     */

    const response = await fetch(apiBase + "/submissions", {
      method: "POST",

      headers: {
        "Content-Type": "application/json",
      },

      body: JSON.stringify(payload),
    });

    /*
     * ========================================================
     * RESPONSE
     * ========================================================
     */

    const contentType = response.headers.get("content-type") || "";

    const data = contentType.includes("application/json")
      ? await response.json()
      : {
          message: await response.text(),
        };

    /*
     * ========================================================
     * ERROR
     * ========================================================
     */

    if (!response.ok) {
      console.error("[SUBMISSION] Backend rejected:", {
        status: response.status,

        data: data,
      });

      const message = Array.isArray(data.message)
        ? data.message.join(", ")
        : data.message || "Submission could not be processed.";

      throw new Error(message);
    }

    /*
     * ========================================================
     * SUCCESS
     * ========================================================
     */

    console.log("[SUBMISSION] Saved successfully:", data);

    currentRequestId = data.submissionId || data.id || null;

    /*
     * Official final score.
     *
     * arenaScore is the competition score.
     */

    if (data.arenaScore !== undefined && data.arenaScore !== null) {
      const officialScore = Number(data.arenaScore);

      if (Number.isFinite(officialScore)) {
        console.log("[SUBMISSION] Official Arena Score:", officialScore);
      }
    }

    return data;
  }

  // ============================================================
  // COMPLETION SCREEN
  // ============================================================

  function escapeCompletionText(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  function showContestCompletionScreen() {
    if (resultModal) {
      resultModal.classList.add("hidden");
    }

    if (mainApp) {
      mainApp.classList.add("hidden");
    }

    let completion = document.getElementById("contest-completion-screen");

    if (!completion) {
      completion = document.createElement("div");

      completion.id = "contest-completion-screen";

      completion.className = "screen";

      completion.innerHTML = `

        <div class="login-card completion-card">

          <div class="brand">

            <div class="brand-title">

              TEST COMPLETED

              <span class="glow-dot"></span>

            </div>

          </div>


          <h2
            style="
              margin-top:24px;
              margin-bottom:12px;
            "
          >
            Your test is completed
          </h2>


          <p
            style="
              color:var(--text-dim);
              line-height:1.7;
              margin-bottom:20px;
            "
          >
            Thank you for participating
            in the Prompt Efficiency Arena.
          </p>


          <div
            style="
              padding:18px;
              border-radius:14px;
              background:rgba(255,255,255,0.04);
              border:1px solid rgba(255,255,255,0.08);
              line-height:1.7;
            "
          >

            Your prompt has been submitted successfully.

            <br><br>

            <strong>
              Your score and other details
              will be shared through your
              registered email.
            </strong>

            <br><br>

            <span
              style="
                color:var(--text-dim);
                font-size:0.9rem;
              "
            >
              If automated evaluation encounters
              an error, we will manually process
              your prompt.
            </span>

          </div>


          <div
            style="
              margin-top:24px;
              font-size:0.9rem;
              color:var(--text-dim);
            "
          >

            Registration No:

            <strong>
              ${escapeCompletionText(registrationNumber)}
            </strong>

          </div>


          <div
            style="
              margin-top:8px;
              font-size:0.9rem;
              color:var(--text-dim);
            "
          >

            Email:

            <strong>
              ${escapeCompletionText(userEmail)}
            </strong>

          </div>

        </div>
      `;

      document.body.appendChild(completion);
    }

    completion.classList.remove("hidden");
  }

  // ============================================================
  // FINISH SESSION
  // ============================================================

  async function finishSession() {
    if (sessionFinished || eliminated) {
      return;
    }

    const text = promptArea.value.trim();

    if (!text) {
      showToast("Write a prompt first.");

      return;
    }

    /*
     * ========================================================
     * LOCK SESSION FIRST
     * ========================================================
     */

    sessionFinished = true;

    contestStarted = false;

    stopTimer();

    /*
     * IMPORTANT:
     *
     * Stop integrity monitoring BEFORE
     * exiting fullscreen.
     *
     * Otherwise our own fullscreen exit
     * can look like malpractice.
     */

    if (integrityId) {
      clearInterval(integrityId);

      integrityId = null;
    }

    promptArea.setAttribute("readonly", "");

    finishBtn.disabled = true;

    finishBtn.textContent = "Submitting...";

    /*
     * Keep old local score only for
     * existing demo UI.
     *
     * NOT official competition score.
     */

    lastScore = scorePrompt(text);

    /*
     * ========================================================
     * EXIT FULLSCREEN AUTOMATICALLY
     * ========================================================
     */

    try {
      if (isFullscreen()) {
        await exitFS();
      }
    } catch (_) {}

    /*
     * ========================================================
     * SHOW COMPLETION SCREEN
     * ========================================================
     */

    showContestCompletionScreen();

    /*
     * ========================================================
     * SUBMIT
     *
     * Backend calculates official score.
     * ========================================================
     */

    try {
      const result = await submitPromptForImageEvaluation(text);

      console.log("[SUBMISSION] Official competition submission accepted:", {
        submissionId: result.submissionId,

        deterministicScore: result.deterministicScore,

        llmScore: result.llmScore,

        arenaScore: result.arenaScore,

        evaluationStatus: result.evaluationStatus,

        evaluationMethod: result.evaluationMethod,
      });

      finishBtn.textContent = "Session finished";
    } catch (error) {
      /*
       * Contestant remains completed.
       *
       * Technical backend / LLM error
       * is NOT shown to contestant.
       */

      console.error("[SUBMISSION] Background submission error:", error);

      finishBtn.textContent = "Session finished";
    }

    // Competition is one-attempt only. Do not expose the old local result screen.
    if (viewResultsBtn) {
      viewResultsBtn.classList.add("hidden");
    }

    if (creationTypes) {
      creationTypes.classList.add("visible");
    }

    if (certPanel) {
      certPanel.classList.add("visible");
    }

    if (typeof checkExistingRequest === "function") {
      checkExistingRequest();
    }
  }

  finishBtn.addEventListener("click", finishSession);

  // ============================================================
  // RESULTS
  // ============================================================

  // The old local result report is intentionally disabled.
  // Official score/details are communicated through email after evaluation.
  if (viewResultsBtn) {
    viewResultsBtn.classList.add("hidden");
    viewResultsBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
  }

  function openResultModal(score) {
    $("result-credits").textContent = score.credits.toFixed(1);

    $("s-words").textContent = score.words;

    $("s-letters").textContent = score.letters;

    $("s-keywords").textContent = score.keywordHits;

    $("s-vocab").textContent = score.vocabRichness + "%";

    $("s-polite").textContent = score.politeHits;

    $("s-harsh").textContent = score.harshHits;

    $("tier-name").textContent = score.tier;

    $("tier-note").textContent = score.notes;

    requestAnimationFrame(() => {
      $("b-words").style.width = Math.min(100, score.words * 4) + "%";

      $("b-letters").style.width = Math.min(100, score.letters / 3) + "%";

      $("b-keywords").style.width = Math.min(100, score.keywordHits * 12) + "%";

      $("b-vocab").style.width = Math.min(100, score.vocabRichness) + "%";

      $("b-polite").style.width = Math.min(100, score.politeHits * 25) + "%";

      $("b-harsh").style.width = Math.min(100, score.harshHits * 20) + "%";
    });

    resultModal.classList.remove("hidden");
  }

  $("close-modal-btn").addEventListener("click", () => {
    resultModal.classList.add("hidden");
  });

  // ============================================================
  // RESTART
  // ============================================================

  $("restart-btn").addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    // A finished competition cannot be restarted from the result UI.
    return;

    if (eliminated) {
      return;
    }

    /*
     * IMPORTANT:
     *
     * Restart here is only the existing
     * local result-preview behavior.
     *
     * The actual competition submission
     * has already been sent.
     */

    sessionFinished = false;

    promptArea.value = "";

    if (isTouch) {
      promptArea.setAttribute("readonly", "");

      promptArea.setAttribute("inputmode", "none");
    } else {
      promptArea.removeAttribute("readonly");
    }

    finishBtn.disabled = false;

    finishBtn.textContent = "Finish & rate this prompt";

    const aiPanel = $("ai-evaluation");

    if (aiPanel) {
      aiPanel.classList.add("hidden");
    }

    if ($("ai-score")) {
      $("ai-score").textContent = "0.0";
    }

    if ($("ai-verdict")) {
      $("ai-verdict").textContent = "—";
    }

    if ($("ai-reason")) {
      $("ai-reason").textContent = "";
    }

    viewResultsBtn.classList.add("hidden");

    creationTypes.classList.remove("visible");

    certPanel.classList.remove("visible");

    lastScore = null;

    currentRequestId = null;

    updateLiveScore();

    startTimer();

    resultModal.classList.add("hidden");

    if (isTouch) {
      showKeyboard(true);
    }
  });

  // ============================================================
  // CREATION TYPES
  // ============================================================

  creationTypes.addEventListener("click", (event) => {
    const button = event.target.closest(".create-btn");

    if (!button || !lastScore) {
      return;
    }

    const type = button.dataset.type;

    const base = parseInt(button.dataset.cost, 10) || 0;

    const total = (base + lastScore.credits).toFixed(1);

    showToast(
      type +
        " selected · Demo only · Total credits: " +
        total +
        " (base " +
        base +
        " + prompt " +
        lastScore.credits.toFixed(1) +
        ")",
    );
  });

  // ============================================================
  // CERTIFICATE
  // ============================================================

  function checkExistingRequest() {
    const requests = getRequests();

    const mine = requests
      .filter((request) => request.email === userEmail)
      .sort((a, b) => b.ts - a.ts)[0];

    if (!mine) {
      certStatus.className = "cert-status";

      certStatus.textContent =
        "After finishing, request an e-certificate. Admin reviews and issues it.";

      requestCertBtn.disabled = !sessionFinished;

      requestCertBtn.textContent = "Request E-Certificate";

      requestCertBtn.style.display = "";

      currentRequestId = null;

      return;
    }

    currentRequestId = mine.id;

    if (mine.status === "pending") {
      certStatus.className = "cert-status pending";

      certStatus.textContent =
        "Request pending · Admin has not reviewed yet. Login #" +
        mine.loginCount;

      requestCertBtn.disabled = true;

      requestCertBtn.textContent = "Request Pending…";
    } else if (mine.status === "accepted") {
      certStatus.className = "cert-status accepted";

      certStatus.textContent =
        "✅ Certificate issued & sent to " +
        userEmail +
        " (PDF downloaded). Role: " +
        mine.role +
        " · Login #" +
        mine.loginCount;

      requestCertBtn.style.display = "none";
    } else if (mine.status === "rejected") {
      certStatus.className = "cert-status rejected";

      certStatus.textContent =
        "Request was declined by admin. You may request again after a new session.";

      requestCertBtn.disabled = !sessionFinished;

      requestCertBtn.textContent = "Request Again";

      requestCertBtn.style.display = "";
    }
  }

  requestCertBtn.addEventListener("click", () => {
    if (!sessionFinished || !lastScore || eliminated) {
      showToast("Finish a prompt session first.");

      return;
    }

    const requests = getRequests();

    const pending = requests.find(
      (request) => request.email === userEmail && request.status === "pending",
    );

    if (pending) {
      showToast("You already have a pending request.");

      return;
    }

    const role = roleFromTier(lastScore.tier);

    const request = {
      id: "req_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7),

      name: userName,

      email: userEmail,

      credits: lastScore.credits,

      tier: lastScore.tier,

      role: role,

      loginCount: loginCount,

      status: "pending",

      ts: Date.now(),

      year: YEAR,
    };

    requests.unshift(request);

    setRequests(requests);

    currentRequestId = request.id;

    checkExistingRequest();

    showToast("Certificate request sent to admin.");
  });

  // ============================================================
  // ADMIN RESPONSIVE STYLES
  // ============================================================

  (function installAdminResponsiveStyles() {
    if (document.getElementById("ec-admin-responsive-styles")) return;

    const style = document.createElement("style");
    style.id = "ec-admin-responsive-styles";
    style.textContent = `
      #admin-app {
        width: 100%;
        max-width: 100vw;
        box-sizing: border-box;
      }
      #admin-app .admin-header,
      #admin-app .admin-content {
        width: 100%;
        max-width: 100%;
        box-sizing: border-box;
      }
      #admin-app .admin-content {
        overflow-x: hidden;
      }
      #admin-app .admin-section {
        width: 100%;
        max-width: 100%;
        min-width: 0;
        box-sizing: border-box;
      }
      #admin-app .admin-submission-table-wrap {
        width: 100%;
        max-width: 100%;
        overflow-x: auto;
        overflow-y: visible;
        -webkit-overflow-scrolling: touch;
        border-radius: 12px;
      }
      #admin-app .admin-submission-table {
        width: 100%;
        min-width: 980px;
        border-collapse: collapse;
      }
      #admin-app .admin-submission-table th,
      #admin-app .admin-submission-table td {
        box-sizing: border-box;
      }
      #admin-app .admin-submission-prompt {
        max-width: 360px;
        min-width: 220px;
        white-space: pre-wrap;
        overflow-wrap: anywhere;
        word-break: break-word;
      }
      #admin-app .admin-actions {
        display: flex;
        gap: 7px;
        justify-content: center;
        align-items: center;
        flex-wrap: wrap;
      }
      #admin-app .admin-actions .btn {
        width: auto;
        min-width: 72px;
        padding: 8px 10px;
      }
      @media (max-width: 700px) {
        #admin-app .admin-header {
          padding: 10px 12px;
          gap: 10px;
          align-items: flex-start;
        }
        #admin-app .admin-title { font-size: 1.05rem; }
        #admin-app .admin-content { padding: 10px; }
        #admin-app .stats-row {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 7px;
        }
        #admin-app .mini-stat { min-width: 0; padding: 9px 5px; }
        #admin-app .mini-stat .ms-val { font-size: 1.05rem; }
        #admin-app .mini-stat .ms-label { font-size: 0.62rem; }
        #admin-app .admin-section { padding: 10px; border-radius: 12px; }
        #admin-app .admin-section h3 { font-size: 0.95rem; }
        #admin-app .admin-submission-table-wrap {
          margin: 0;
          width: 100%;
          max-width: 100%;
        }
      }
    `;
    document.head.appendChild(style);
  })();

  // ============================================================
  // ADMIN DASHBOARD
  // ============================================================

  async function loadAdminDashboard() {
    const apiBase = API_BASE;

    const list = $("admin-submissions-list") || $("requests-list");

    if (!list) {
      return;
    }

    // Replace legacy certificate/login wording with the competition dashboard.
    const section = list.closest(".admin-section");
    if (section) {
      const heading = section.querySelector("h3");
      if (heading) heading.textContent = "📊 Competition Submissions";
    }
    const legacyLoginSection = document
      .getElementById("logins-list")
      ?.closest(".admin-section");
    if (legacyLoginSection) legacyLoginSection.style.display = "none";

    list.innerHTML = `
      <div class="empty-state">
        Loading submissions...
      </div>
    `;

    try {
      /*
       * Admin login receives a signed token.
       *
       * Store/use it for admin API calls.
       */

      try {
        adminToken = localStorage.getItem("ec_admin_token") || adminToken;
      } catch (_) {}

      if (!adminToken) {
        list.innerHTML = `
          <div class="empty-state">
            Admin authentication expired. Please login again.
          </div>
        `;
        return;
      }

      const headers = {
        Authorization: "Bearer " + adminToken,
      };

      const response = await fetch(apiBase + "/admin/submissions", {
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.message || "Unable to load admin data.");
      }

      if ($("stat-total")) {
        $("stat-total").textContent =
          data.stats?.total || data.submissions?.length || 0;
      }

      if ($("stat-accepted")) {
        $("stat-accepted").textContent = data.stats?.completed || 0;
      }

      if ($("stat-pending")) {
        $("stat-pending").textContent = data.stats?.evaluating || 0;
      }

      /*
       * Backend should already return
       * sorted data, but sort again here
       * to guarantee descending Arena Score.
       */

      const submissions = Array.isArray(data.submissions)
        ? [...data.submissions]
        : [];

      submissions.sort((a, b) => {
        const scoreA = Number(a.arenaScore);

        const scoreB = Number(b.arenaScore);

        return (
          (Number.isFinite(scoreB) ? scoreB : -Infinity) -
          (Number.isFinite(scoreA) ? scoreA : -Infinity)
        );
      });

      if (!submissions.length) {
        list.innerHTML = `
          <div class="empty-state">
            No submissions yet.
          </div>
        `;

        return;
      }

      list.innerHTML = `

  <div
    style="
      display:flex;
      justify-content:flex-end;
      align-items:center;
      margin-bottom:14px;
      gap:10px;
      flex-wrap:wrap;
    "
  >
    <button
      type="button"
      id="admin-export-excel-btn"
      class="btn btn-secondary"
      style="
        width:auto;
        padding:10px 16px;
        font-weight:800;
      "
    >
      📊 Export as Excel
    </button>
  </div>

  <div
    style="
      width:100%;
      max-width:100%;
      overflow-x:auto;
    "
    class="admin-submission-table-wrap"
  >

          <table
            style="
              width:100%;
              min-width:980px;
              border-collapse:collapse;
            "
            class="admin-submission-table"
          >

            <thead>

              <tr>

                <th
                  style="
                    text-align:center;
                    padding:12px;
                  "
                >
                  S.No
                </th>

                <th
                  style="
                    text-align:left;
                    padding:12px;
                  "
                >
                  Name
                </th>
                <th
  style="
    text-align:left;
    padding:12px;
  "
>
  Registration No.
</th>

<th
  style="
    text-align:left;
    padding:12px;
  "
>
  Email
</th>

                <th
                  style="
                    text-align:left;
                    padding:12px;
                  "
                >
                  Prompt
                </th>

                <th
                  style="
                    text-align:center;
                    padding:12px;
                  "
                >
                  Deterministic
                </th>

                <th
                  style="
                    text-align:center;
                    padding:12px;
                  "
                >
                  LLM
                </th>

                <th
                  style="
                    text-align:center;
                    padding:12px;
                  "
                >
                  Arena Score
                </th>

                <th
                  style="
                    text-align:center;
                    padding:12px;
                  "
                >
                  Status
                </th>

                <th
                  style="
                    text-align:center;
                    padding:12px;
                  "
                >
                  Action
                </th>

              </tr>

            </thead>


            <tbody>

              ${submissions
                .map((item, index) => {
                  const deterministic = Number(item.deterministicScore);

                  const llm = Number(item.llmScore);

                  const arena = Number(item.arenaScore);

                  const deterministicText = Number.isFinite(deterministic)
                    ? deterministic.toFixed(2)
                    : "—";

                  const llmText = Number.isFinite(llm) ? llm.toFixed(2) : "—";

                  const arenaText = Number.isFinite(arena)
                    ? arena.toFixed(2)
                    : "—";

                  const malpractice = Boolean(
                    item.malpractice || item.evaluationMethod === "malpractice",
                  );

                  let status = item.evaluationStatus || "queued";

                  if (malpractice) {
                    status = "🚨 MALPRACTICE";
                  } else if (status === "completed") {
                    status = "Completed";
                  } else if (status === "queued" || status === "evaluating") {
                    status = "Evaluating...";
                  } else if (status === "manual_review") {
                    status = "Manual Review";
                  }

                  const statusHtml = malpractice
                    ? `
                            <span
                              style="
                                color:#ff4d6d;
                                font-weight:800;
                              "
                            >
                              ${status}
                            </span>
                          `
                    : escapeHtml(status);

                  return `

                        <tr
                          style="
                            border-top:
                              1px solid
                              rgba(
                                255,
                                255,
                                255,
                                0.08
                              );

                            ${
                              malpractice
                                ? "background:rgba(255,60,90,0.08);"
                                : ""
                            }
                          "
                        >

                          <td
                            style="
                              padding:12px;
                              text-align:center;
                              font-weight:700;
                            "
                          >
                            ${index + 1}
                          </td>


                          <td
                            style="
                              padding:12px;
                              font-weight:700;
                            "
                          >
                            ${escapeHtml(item.name)}
                          </td>
                          <td
  style="
    padding:12px;
    word-break:break-word;
    white-space:nowrap;
  "
>
  ${escapeHtml(item.registrationNumber || "—")}
</td>

<td
  style="
    padding:12px;
    word-break:break-word;
  "
>
  ${escapeHtml(item.email || "—")}
</td>


                          <td
                            style="
                              padding:12px;
                              max-width:360px;
                              white-space:pre-wrap;
                              word-break:break-word;
                            "
                          >
                            ${escapeHtml(item.prompt)}
                          </td>


                          <td
                            style="
                              padding:12px;
                              text-align:center;
                            "
                          >
                            ${deterministicText}
                          </td>


                          <td
                            style="
                              padding:12px;
                              text-align:center;
                            "
                          >
                            ${llmText}
                          </td>


                          <td
                            style="
                              padding:12px;
                              text-align:center;
                              font-weight:900;
                              font-size:1.05rem;
                            "
                          >
                            ${arenaText}
                          </td>


                          <td
                            style="
                              padding:12px;
                              text-align:center;
                            "
                          >
                            ${statusHtml}
                          </td>


                          <td
                            style="
                              padding:12px;
                              text-align:center;
                            "
                          >

                            <div class="admin-actions">
                            <button
                              type="button"
                              class="btn btn-secondary admin-preview-submission"
                              data-id="${escapeHtml(item._id || item.id || "")}"
                            >
                              Preview
                            </button>
                            <button
                              type="button"
                              class="btn btn-secondary admin-download-submission"
                              data-id="${escapeHtml(item._id || item.id || "")}"
                            >
                              Download
                            </button>
                            <button
                              type="button"
                              class="btn btn-danger admin-delete-submission"
                              data-id="${escapeHtml(item._id || item.id || "")}"
                            >
                              Delete
                            </button>
                            </div>

                          </td>

                        </tr>

                      `;
                })
                .join("")}

            </tbody>

          </table>

        </div>
      `;

      const exportExcelBtn = $("admin-export-excel-btn");

      if (exportExcelBtn) {
        exportExcelBtn.addEventListener("click", () => {
          exportAdminSubmissionsToExcel(submissions);
        });
      }

      /*
       * Preview buttons.
       * Submissions are not certificate requests, so preview uses
       * the contestant result as a printable review page.
       */
      list.querySelectorAll(".admin-preview-submission").forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.dataset.id;
          const item = submissions.find(
            (entry) => String(entry._id || entry.id || "") === String(id),
          );
          if (!item) return;
          previewSubmission(item);
        });
      });

      /*
       * Download buttons.
       * Generate a self-contained HTML review file locally.
       */
      list.querySelectorAll(".admin-download-submission").forEach((button) => {
        button.addEventListener("click", () => {
          const id = button.dataset.id;
          const item = submissions.find(
            (entry) => String(entry._id || entry.id || "") === String(id),
          );
          if (!item) return;
          downloadSubmissionPreview(item);
        });
      });

      /*
       * Delete buttons.
       */

      list.querySelectorAll(".admin-delete-submission").forEach((button) => {
        button.addEventListener("click", async () => {
          const id = button.dataset.id;

          if (!id) {
            return;
          }

          const confirmed = window.confirm(
            "Delete this competition submission permanently from MongoDB?",
          );

          if (!confirmed) {
            return;
          }

          button.disabled = true;

          button.textContent = "Deleting...";

          try {
            const deleteHeaders = {
              Authorization: "Bearer " + adminToken,
            };

            const deleteResponse = await fetch(
              apiBase + "/admin/submissions/" + encodeURIComponent(id),
              {
                method: "DELETE",

                headers: deleteHeaders,
              },
            );

            const deleteData = await deleteResponse.json().catch(() => ({}));

            if (!deleteResponse.ok) {
              throw new Error(
                deleteData.message || "Unable to delete submission.",
              );
            }

            showToast("Submission deleted.");

            await loadAdminDashboard();
          } catch (error) {
            console.error("[ADMIN DELETE]", error);

            button.disabled = false;

            button.textContent = "Delete";

            alert("Unable to delete this submission.");
          }
        });
      });
    } catch (error) {
      console.error("[ADMIN] Dashboard error:", error);

      list.innerHTML = `
        <div class="empty-state">
          Unable to load admin data.
        </div>
      `;
    }
  }
  function exportAdminSubmissionsToExcel(submissions) {
    try {
      if (!Array.isArray(submissions) || !submissions.length) {
        showToast("No submissions available to export.");
        return;
      }

      /*
       * Excel-compatible workbook.
       *
       * The exported file contains the complete
       * competition table data.
       */

      const rows = submissions.map((item, index) => {
        const deterministic = Number(item.deterministicScore);
        const llm = Number(item.llmScore);
        const arena = Number(item.arenaScore);

        const malpractice = Boolean(
          item.malpractice || item.evaluationMethod === "malpractice",
        );

        let status = item.evaluationStatus || "queued";

        if (malpractice) {
          status = "MALPRACTICE";
        } else if (status === "completed") {
          status = "Completed";
        } else if (status === "queued" || status === "evaluating") {
          status = "Evaluating...";
        } else if (status === "manual_review") {
          status = "Manual Review";
        }

        return [
          index + 1,
          item.name || "",
          item.registrationNumber || "",
          item.email || "",
          item.prompt || "",

          Number.isFinite(deterministic) ? deterministic : "",

          Number.isFinite(llm) ? llm : "",

          Number.isFinite(arena) ? arena : "",

          status,
          item.evaluationMethod || "",
          malpractice ? "YES" : "NO",
          item.malpracticeReason || "",
          item.createdAt ? new Date(item.createdAt).toLocaleString() : "",
        ];
      });

      const headers = [
        "S.No",
        "Name",
        "Registration No.",
        "Email",
        "Prompt",
        "Deterministic Score",
        "LLM Score",
        "Arena Score",
        "Status",
        "Evaluation Method",
        "Malpractice",
        "Malpractice Reason",
        "Submitted At",
      ];

      /*
       * Build an Excel-compatible HTML table.
       *
       * Excel opens this format correctly while preserving
       * multiline prompts and Unicode characters.
       */

      const escapeExcel = (value) =>
        String(value ?? "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");

      const tableRows = [
        `
        <tr>
          ${headers.map((header) => `<th>${escapeExcel(header)}</th>`).join("")}
        </tr>
      `,
        ...rows.map(
          (row) => `
          <tr>
            ${row.map((value) => `<td>${escapeExcel(value)}</td>`).join("")}
          </tr>
        `,
        ),
      ].join("");

      const excelHtml = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          table {
            border-collapse: collapse;
            width: 100%;
          }

          th {
            background: #1f2937;
            color: #ffffff;
            font-weight: bold;
            padding: 8px;
            border: 1px solid #999999;
          }

          td {
            padding: 8px;
            border: 1px solid #cccccc;
            vertical-align: top;
            white-space: pre-wrap;
            word-break: break-word;
          }

          .number {
            mso-number-format: "0.00";
          }
        </style>
      </head>

      <body>

        <table>
          ${tableRows}
        </table>

      </body>
      </html>
    `;

      /*
       * UTF-8 BOM ensures Excel correctly displays:
       * - Tamil
       * - Emoji
       * - Other Unicode characters
       */

      const blob = new Blob(["\ufeff", excelHtml], {
        type: "application/vnd.ms-excel;charset=utf-8",
      });

      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");

      link.href = url;

      const date = new Date().toISOString().slice(0, 10);

      link.download = "Prompt_Efficiency_Arena_" + date + ".xls";

      document.body.appendChild(link);

      link.click();

      link.remove();

      setTimeout(() => {
        URL.revokeObjectURL(url);
      }, 1000);

      showToast(`${submissions.length} submission(s) exported to Excel.`);
    } catch (error) {
      console.error("[ADMIN EXCEL EXPORT]", error);

      showToast("Excel export failed.");
    }
  }

  function previewSubmission(item) {
    const popup = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=1100,height=800",
    );
    if (!popup) {
      showToast("Preview was blocked. Allow pop-ups for this site.");
      return;
    }

    const malpractice = Boolean(
      item?.malpractice || item?.evaluationMethod === "malpractice",
    );
    const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt Submission Preview</title><style>
      body{font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}.wrap{max-width:1000px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px;box-shadow:0 10px 35px rgba(15,23,42,.08)}h1{margin-top:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #e2e8f0;border-radius:12px;padding:14px}.label{font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700}.value{font-size:18px;font-weight:800;margin-top:6px}.prompt{white-space:pre-wrap;word-break:break-word;background:#f1f5f9;border-radius:12px;padding:18px;line-height:1.6}.danger{color:#dc2626;font-weight:800}@media(max-width:700px){.grid{grid-template-columns:1fr 1fr}}
    </style></head><body><main class="wrap"><h1>Prompt Submission Preview</h1><div class="grid">
      <div class="card"><div class="label">Name</div><div class="value">${escapeHtml(item?.name || "—")}</div></div>
      <div class="card"><div class="label">Registration</div><div class="value">${escapeHtml(item?.registrationNumber || "—")}</div></div>
      <div class="card"><div class="label">Email</div><div class="value">${escapeHtml(item?.email || "—")}</div></div>
      <div class="card"><div class="label">Deterministic Score</div><div class="value">${Number.isFinite(Number(item?.deterministicScore)) ? Number(item.deterministicScore).toFixed(2) : "—"}</div></div>
      <div class="card"><div class="label">LLM Score</div><div class="value">${Number.isFinite(Number(item?.llmScore)) ? Number(item.llmScore).toFixed(2) : "—"}</div></div>
      <div class="card"><div class="label">Arena Score</div><div class="value">${Number.isFinite(Number(item?.arenaScore)) ? Number(item.arenaScore).toFixed(2) : "—"}</div></div>
    </div><h2>Prompt</h2><div class="prompt">${escapeHtml(item?.prompt || "")}</div>${malpractice ? '<p class="danger">🚨 MALPRACTICE — This submission was recorded as an integrity violation.</p>' : ""}</main></body></html>`;
    popup.document.open();
    popup.document.write(html);
    popup.document.close();
  }

  function downloadSubmissionPreview(item) {
    try {
      const malpractice = Boolean(
        item?.malpractice || item?.evaluationMethod === "malpractice",
      );
      const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Prompt Submission - ${escapeHtml(item?.name || "Participant")}</title><style>body{font-family:Arial,Helvetica,sans-serif;background:#f8fafc;color:#0f172a;margin:0;padding:24px}.wrap{max-width:1000px;margin:auto;background:#fff;border:1px solid #e2e8f0;border-radius:16px;padding:24px}h1{margin-top:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.card{border:1px solid #e2e8f0;border-radius:12px;padding:14px}.label{font-size:12px;color:#64748b;text-transform:uppercase;font-weight:700}.value{font-size:18px;font-weight:800;margin-top:6px}.prompt{white-space:pre-wrap;overflow-wrap:anywhere;background:#f1f5f9;border-radius:12px;padding:18px;line-height:1.6}.danger{color:#dc2626;font-weight:800}@media(max-width:700px){.grid{grid-template-columns:1fr}}</style></head><body><main class="wrap"><h1>Prompt Submission</h1><div class="grid"><div class="card"><div class="label">Name</div><div class="value">${escapeHtml(item?.name || "—")}</div></div><div class="card"><div class="label">Registration</div><div class="value">${escapeHtml(item?.registrationNumber || "—")}</div></div><div class="card"><div class="label">Email</div><div class="value">${escapeHtml(item?.email || "—")}</div></div><div class="card"><div class="label">Deterministic Score</div><div class="value">${Number.isFinite(Number(item?.deterministicScore)) ? Number(item.deterministicScore).toFixed(2) : "—"}</div></div><div class="card"><div class="label">LLM Score</div><div class="value">${Number.isFinite(Number(item?.llmScore)) ? Number(item.llmScore).toFixed(2) : "—"}</div></div><div class="card"><div class="label">Arena Score</div><div class="value">${Number.isFinite(Number(item?.arenaScore)) ? Number(item.arenaScore).toFixed(2) : "—"}</div></div></div><h2>Prompt</h2><div class="prompt">${escapeHtml(item?.prompt || "")}</div>${malpractice ? '<p class="danger">MALPRACTICE — This submission was recorded as an integrity violation.</p>' : ""}</main></body></html>`;
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Prompt_Submission_${String(item?.name || "Participant").replace(/[^a-z0-9_-]+/gi, "_")}.html`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast("Submission downloaded.");
    } catch (error) {
      console.error("[ADMIN DOWNLOAD]", error);
      showToast("Download failed.");
    }
  }

  // ============================================================
  // ADMIN REFRESH
  // ============================================================

  const adminRefreshBtn = $("admin-refresh-btn");

  if (adminRefreshBtn) {
    adminRefreshBtn.addEventListener("click", loadAdminDashboard);
  }

  // ============================================================
  // ADMIN LEGACY DASHBOARD
  //
  // Kept for compatibility with existing HTML.
  // Competition submissions are loaded from MongoDB.
  // ============================================================

  function renderAdminDashboard() {
    loadAdminDashboard();
  }

  // ============================================================
  // ESCAPE HTML
  // ============================================================

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // ============================================================
  // CERTIFICATE PDF
  // ============================================================

  function certificateHtml(request) {
    const name = escapeHtml(request?.name || "Participant");
    const role = escapeHtml(request?.role || "Participant").toUpperCase();
    const tier = escapeHtml(request?.tier || "—");
    const email = escapeHtml(request?.email || "");
    const credits = escapeHtml(request?.credits ?? "0");
    const loginNumber = escapeHtml(request?.loginCount ?? "1");
    const year = escapeHtml(request?.year || YEAR);
    const issued = escapeHtml(new Date().toLocaleString());
    const admin = escapeHtml(ADMIN_NAME);
    const adminEmail = escapeHtml(ADMIN_EMAIL);

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Effective Credit Certificate - ${name}</title>
<style>
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100%;font-family:Arial,Helvetica,sans-serif;background:#eef2f7;color:#0f172a}
  body{padding:24px}
  .toolbar{max-width:1120px;margin:0 auto 16px;display:flex;gap:10px;justify-content:flex-end}
  button{border:0;border-radius:10px;padding:11px 18px;font-weight:700;cursor:pointer;background:#0ea5e9;color:#fff}
  button.secondary{background:#475569}
  .certificate{width:min(1120px,100%);aspect-ratio:1.414/1;margin:auto;background:#fff;border:10px solid #0ea5e9;outline:2px solid #cbd5e1;outline-offset:-22px;box-shadow:0 20px 60px rgba(15,23,42,.18);padding:70px;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center}
  .brand{font-size:34px;font-weight:800;letter-spacing:.06em}
  .sub{font-size:18px;color:#64748b;margin-top:10px}
  .line{width:160px;border-top:3px solid #f43f5e;margin:22px 0 28px}
  .intro{font-size:17px;color:#475569}
  .name{font-size:42px;font-weight:800;color:#0ea5e9;margin:18px 0}
  .role{font-size:26px;font-weight:800;color:#059669;margin:14px 0 24px;letter-spacing:.04em}
  .details{display:grid;grid-template-columns:repeat(5,1fr);gap:12px;width:100%;max-width:900px;margin-top:10px}
  .detail{padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc}
  .label{font-size:11px;text-transform:uppercase;color:#64748b;font-weight:700}
  .value{font-size:15px;font-weight:700;margin-top:5px;word-break:break-word}
  .footer{font-size:11px;color:#94a3b8;margin-top:28px;line-height:1.5}
  @media(max-width:800px){body{padding:10px}.certificate{aspect-ratio:auto;min-height:700px;padding:45px 25px}.name{font-size:30px}.details{grid-template-columns:1fr 1fr}.brand{font-size:27px}}
  @media print{body{padding:0;background:#fff}.toolbar{display:none}.certificate{width:100%;min-height:190mm;box-shadow:none;border:8px solid #0ea5e9;outline:2px solid #cbd5e1;outline-offset:-18px;page-break-inside:avoid}}
</style>
</head>
<body>
<div class="toolbar">
  <button class="secondary" onclick="window.close()">Close</button>
  <button onclick="window.print()">Print / Save as PDF</button>
</div>
<section class="certificate">
  <div class="brand">EFFECTIVE CREDIT</div>
  <div class="sub">Prompt Efficiency Arena — E-Certificate</div>
  <div class="line"></div>
  <div class="intro">This is to certify that</div>
  <div class="name">${name}</div>
  <div class="intro">has successfully participated in the Prompt Efficiency Arena</div>
  <div class="intro" style="margin-top:8px">and is recognized as</div>
  <div class="role">${role}</div>
  <div class="details">
    <div class="detail"><div class="label">Year</div><div class="value">${year}</div></div>
    <div class="detail"><div class="label">Efficiency Credits</div><div class="value">${credits}</div></div>
    <div class="detail"><div class="label">Tier</div><div class="value">${tier}</div></div>
    <div class="detail"><div class="label">Certificate #</div><div class="value">${loginNumber}</div></div>
    <div class="detail"><div class="label">Email</div><div class="value">${email}</div></div>
  </div>
  <div class="footer">Issued by Admin: ${admin} (${adminEmail})<br>Generated on ${issued} · Effective Credit Arena</div>
</section>
</body>
</html>`;
  }

  function previewCertificate(request) {
    const html = certificateHtml(request);
    const preview = window.open(
      "",
      "_blank",
      "noopener,noreferrer,width=1200,height=850",
    );

    if (!preview) {
      showToast(
        "Certificate preview was blocked. Allow pop-ups for this site.",
      );
      return false;
    }

    preview.document.open();
    preview.document.write(html);
    preview.document.close();
    return true;
  }

  function downloadCertificate(request) {
    try {
      if (window.jspdf && window.jspdf.jsPDF) {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({
          orientation: "landscape",
          unit: "mm",
          format: "a4",
        });
        const width = doc.internal.pageSize.getWidth();
        const height = doc.internal.pageSize.getHeight();

        doc.setDrawColor(14, 165, 233);
        doc.setLineWidth(1.5);
        doc.rect(8, 8, width - 16, height - 16);
        doc.setLineWidth(0.4);
        doc.rect(12, 12, width - 24, height - 24);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(22);
        doc.setTextColor(15, 23, 42);
        doc.text("EFFECTIVE CREDIT", width / 2, 32, { align: "center" });
        doc.setFontSize(12);
        doc.setTextColor(100, 116, 139);
        doc.text("Prompt Efficiency Arena — E-Certificate", width / 2, 42, {
          align: "center",
        });
        doc.setDrawColor(244, 63, 94);
        doc.setLineWidth(0.8);
        doc.line(width / 2 - 40, 48, width / 2 + 40, 48);
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        doc.text("This is to certify that", width / 2, 62, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(26);
        doc.setTextColor(14, 165, 233);
        doc.text(String(request?.name || "Participant"), width / 2, 78, {
          align: "center",
        });
        doc.setFont("helvetica", "normal");
        doc.setFontSize(12);
        doc.setTextColor(51, 65, 85);
        doc.text(
          "has successfully participated in the Prompt Efficiency Arena",
          width / 2,
          92,
          { align: "center" },
        );
        doc.text("and is recognized as", width / 2, 100, { align: "center" });
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.setTextColor(5, 150, 105);
        doc.text(
          String(request?.role || "Participant").toUpperCase(),
          width / 2,
          114,
          { align: "center" },
        );
        doc.setFont("helvetica", "normal");
        doc.setFontSize(11);
        doc.setTextColor(71, 85, 105);
        const details = [
          "Year: " + (request?.year || YEAR),
          "Efficiency Credits: " + (request?.credits ?? 0),
          "Tier: " + (request?.tier || "—"),
          "Certificate #: " + (request?.loginCount ?? 1),
          "Email: " + (request?.email || ""),
        ];
        let y = 130;
        details.forEach((line) => {
          doc.text(line, width / 2, y, { align: "center" });
          y += 8;
        });
        doc.setFontSize(9);
        doc.setTextColor(148, 163, 184);
        doc.text(
          "Issued by Admin: " + ADMIN_NAME + " (" + ADMIN_EMAIL + ")",
          width / 2,
          height - 28,
          { align: "center" },
        );
        doc.text(
          "Generated on " +
            new Date().toLocaleString() +
            " · Effective Credit Arena",
          width / 2,
          height - 20,
          { align: "center" },
        );
        const filename =
          "EC_Certificate_" +
          String(request?.name || "Participant").replace(
            /[^a-z0-9_-]+/gi,
            "_",
          ) +
          "_" +
          (request?.loginCount ?? 1) +
          ".pdf";
        doc.save(filename);
        return true;
      }

      const html = certificateHtml(request);
      const blob = new Blob([html], { type: "text/html;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download =
        "EC_Certificate_" +
        String(request?.name || "Participant").replace(/[^a-z0-9_-]+/gi, "_") +
        ".html";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast(
        "PDF library unavailable. Certificate HTML downloaded; open it and choose Print / Save as PDF.",
      );
      return true;
    } catch (error) {
      console.error("[CERTIFICATE DOWNLOAD]", error);
      showToast(
        "Certificate download failed. Use Preview, then Print / Save as PDF.",
      );
      return false;
    }
  }

  function generateAndSendCertificate(request) {
    const downloaded = downloadCertificate(request);
    if (!downloaded) {
      previewCertificate(request);
    }
  }

  // ============================================================
  // TOAST
  // ============================================================

  function showToast(message) {
    toastEl.textContent = message;

    toastEl.classList.add("show");

    clearTimeout(showToast._t);

    showToast._t = setTimeout(() => toastEl.classList.remove("show"), 3400);
  }

  // ============================================================
  // FLOATING KEYBOARD
  // ============================================================

  const LETTER_ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],

    ["q", "w", "e", "r", "t", "y", "u", "i", "o", "p"],

    ["a", "s", "d", "f", "g", "h", "j", "k", "l"],

    ["⇧", "z", "x", "c", "v", "b", "n", "m", "⌫"],
  ];

  const SYMBOL_ROWS = [
    ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],

    ["@", "#", "£", "_", "&", "-", "+", "(", ")", "/"],

    ["=", "*", '"', "'", ":", ";", "!", "?", "<", ">"],

    ["ABC", ".", ",", "?", "!", "⌫"],
  ];

  function buildKeyboard() {
    kbRows.innerHTML = "";

    const rows = kbMode === "letters" ? LETTER_ROWS : SYMBOL_ROWS;

    rows.forEach((row) => {
      const rowElement = document.createElement("div");

      rowElement.className = "kb-row";

      row.forEach((key) => {
        const button = document.createElement("button");

        button.type = "button";

        button.className = "kb-key";

        if (key === "⇧" || key === "⌫" || key === "ABC" || key === "123") {
          button.classList.add("special", "wide");
        }

        if (key === "⇧" && kbShift) {
          button.classList.add("pressed");
        }

        let label = key;

        if (
          kbMode === "letters" &&
          kbShift &&
          key.length === 1 &&
          /[a-z]/.test(key)
        ) {
          label = key.toUpperCase();
        }

        button.textContent = label;

        button.dataset.key = key;

        button.addEventListener("pointerdown", (event) => {
          event.preventDefault();

          event.stopPropagation();

          handleKey(key);

          button.classList.add("pressed");
        });

        button.addEventListener("pointerup", () =>
          button.classList.remove("pressed"),
        );

        button.addEventListener("pointerleave", () =>
          button.classList.remove("pressed"),
        );

        rowElement.appendChild(button);
      });

      kbRows.appendChild(rowElement);
    });

    const bottom = document.createElement("div");

    bottom.className = "kb-row";

    const modeKey = document.createElement("button");

    modeKey.type = "button";

    modeKey.className = "kb-key special wide";

    modeKey.textContent = kbMode === "letters" ? "123" : "ABC";

    modeKey.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      kbMode = kbMode === "letters" ? "symbols" : "letters";

      kbShift = false;

      buildKeyboard();
    });

    bottom.appendChild(modeKey);

    const space = document.createElement("button");

    space.type = "button";

    space.className = "kb-key space";

    space.textContent = "space";

    space.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      handleKey(" ");
    });

    bottom.appendChild(space);

    const enter = document.createElement("button");

    enter.type = "button";

    enter.className = "kb-key special wide";

    enter.textContent = "↵";

    enter.addEventListener("pointerdown", (event) => {
      event.preventDefault();

      handleKey("\n");
    });

    bottom.appendChild(enter);

    kbRows.appendChild(bottom);
  }

  function handleKey(key) {
    if (sessionFinished || eliminated) {
      return;
    }

    let value = promptArea.value;

    let start = promptArea.selectionStart ?? value.length;

    let end = promptArea.selectionEnd ?? value.length;

    if (key === "⇧") {
      kbShift = !kbShift;

      buildKeyboard();

      return;
    }

    if (key === "⌫") {
      if (start === end && start > 0) {
        value = value.slice(0, start - 1) + value.slice(end);

        start--;
      } else {
        value = value.slice(0, start) + value.slice(end);
      }

      end = start;
    } else if (key === "ABC" || key === "123") {
      return;
    } else {
      let character = key;

      if (kbMode === "letters" && kbShift && character.length === 1) {
        character = character.toUpperCase();
      }

      value = value.slice(0, start) + character + value.slice(end);

      start = end = start + character.length;

      if (kbShift && kbMode === "letters" && key.length === 1) {
        kbShift = false;

        buildKeyboard();
      }
    }

    promptArea.value = value;

    try {
      promptArea.setSelectionRange(start, end);
    } catch (_) {}

    updateLiveScore();

    if (isTouch) {
      promptArea.blur();
    }
  }

  function showKeyboard(show) {
    kbVisible = !!show;

    floatingKb.classList.toggle("visible", kbVisible);

    if (kbVisible) {
      buildKeyboard();
    }
  }

  let kbToggleLock = false;

  function toggleKb(event) {
    if (event) {
      event.preventDefault();

      event.stopPropagation();
    }

    if (eliminated || kbToggleLock) {
      return;
    }

    kbToggleLock = true;

    showKeyboard(!kbVisible);

    setTimeout(() => {
      kbToggleLock = false;
    }, 280);
  }

  kbToggle.addEventListener("pointerup", toggleKb);

  kbToggle.addEventListener("click", (event) => {
    event.preventDefault();
  });

  document.addEventListener("keydown", (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();

      toggleKb();
    }
  });

  // ============================================================
  // KEYBOARD DRAG
  // ============================================================

  (function enableDrag() {
    const handle = $("kb-handle");

    let dragging = false;

    let startX;
    let startY;

    let originalX;
    let originalY;

    handle.addEventListener("pointerdown", (event) => {
      dragging = true;

      startX = event.clientX;

      startY = event.clientY;

      const rect = floatingKb.getBoundingClientRect();

      originalX = rect.left;

      originalY = rect.top;

      floatingKb.style.left = originalX + "px";

      floatingKb.style.top = originalY + "px";

      floatingKb.style.bottom = "auto";

      floatingKb.style.transform = "none";

      handle.setPointerCapture(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!dragging) {
        return;
      }

      const dx = event.clientX - startX;

      const dy = event.clientY - startY;

      floatingKb.style.left =
        Math.max(0, Math.min(window.innerWidth - 80, originalX + dx)) + "px";

      floatingKb.style.top =
        Math.max(0, Math.min(window.innerHeight - 80, originalY + dy)) + "px";
    });

    handle.addEventListener("pointerup", () => {
      dragging = false;
    });
  })();

  // ============================================================
  // FLOATING WORDS
  // ============================================================

  function getPromptWords() {
    const text = promptArea.value || "";

    const set = new Set();

    text
      .trim()
      .split(/\s+/)
      .forEach((word) => {
        const clean = word.replace(/[^a-zA-Z0-9]/g, "");

        if (clean.length > 2) {
          set.add(clean);
        }
      });

    return Array.from(set);
  }

  function scheduleFloatingWords() {
    if (eliminated || document.hidden) {
      return;
    }

    try {
      const words = getPromptWords();

      const hash = words.slice(0, 20).join("|");

      if (hash === lastFwHash && fwWords.length >= 13) {
        return;
      }

      lastFwHash = hash;

      rebuildFloatingWords(words);
    } catch (_) {}
  }

  function rebuildFloatingWords(promptWords) {
    try {
      const pool = [...promptWords];

      KEYWORDS.forEach((word) => {
        if (!pool.includes(word)) {
          pool.push(word);
        }
      });

      FALLBACK_WORDS.forEach((word) => {
        if (!pool.includes(word)) {
          pool.push(word);
        }
      });

      while (pool.length < 20) {
        pool.push(FALLBACK_WORDS[pool.length % FALLBACK_WORDS.length]);
      }

      floatingWordsEl.innerHTML = "";

      fwWords = [];

      const placed = [];

      const width = window.innerWidth;

      const height = window.innerHeight;

      const margin = 40;

      const maxAttempts = 80;

      for (let i = 0; i < 16; i++) {
        const word = pool[i % pool.length];

        let x;
        let y;

        let ok = false;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
          x = margin + Math.random() * (width - margin * 2 - 100);

          y = margin + Math.random() * (height - margin * 2 - 30);

          ok = true;

          for (const position of placed) {
            if (
              Math.abs(position.x - x) < 110 &&
              Math.abs(position.y - y) < 28
            ) {
              ok = false;

              break;
            }
          }

          if (ok) {
            break;
          }
        }

        if (!ok) {
          continue;
        }

        placed.push({
          x,
          y,
        });

        const element = document.createElement("span");

        element.className = "fw-word";

        element.textContent = word;

        element.style.left = x + "px";

        element.style.top = y + "px";

        element.style.opacity = (0.06 + Math.random() * 0.08).toFixed(3);

        floatingWordsEl.appendChild(element);

        fwWords.push({
          el: element,

          x: x,

          y: y,

          vx: (Math.random() - 0.5) * 0.15,

          vy: (Math.random() - 0.5) * 0.12,
        });
      }

      if (!fwAnimId) {
        animateFloatingWords();
      }
    } catch (_) {}
  }

  function animateFloatingWords() {
    if (eliminated || document.hidden) {
      fwAnimId = null;

      return;
    }

    try {
      const width = window.innerWidth;

      const height = window.innerHeight;

      for (const word of fwWords) {
        word.x += word.vx;

        word.y += word.vy;

        if (word.x < 20 || word.x > width - 120) {
          word.vx *= -1;
        }

        if (word.y < 20 || word.y > height - 40) {
          word.vy *= -1;
        }

        for (const other of fwWords) {
          if (other === word) {
            continue;
          }

          const dx = word.x - other.x;

          const dy = word.y - other.y;

          if (Math.abs(dx) < 100 && Math.abs(dy) < 24) {
            word.vx += dx > 0 ? 0.02 : -0.02;

            word.vy += dy > 0 ? 0.015 : -0.015;
          }
        }

        word.vx = Math.max(-0.25, Math.min(0.25, word.vx));

        word.vy = Math.max(-0.2, Math.min(0.2, word.vy));

        word.el.style.transform =
          "translate(" +
          (word.x - parseFloat(word.el.style.left)) +
          "px, " +
          (word.y - parseFloat(word.el.style.top)) +
          "px)";
      }
    } catch (_) {}

    fwAnimId = requestAnimationFrame(animateFloatingWords);
  }

  function initFloatingWords() {
    scheduleFloatingWords();
  }

  // ============================================================
  // MALPRACTICE / INTEGRITY
  // ============================================================

  async function reportMalpractice(reason) {
    if (malpracticeReported || !currentUserId || !sessionId) {
      return;
    }

    malpracticeReported = true;

    const apiBase = API_BASE;

    const payload = {
      userId: currentUserId,
      sessionId,
      name: userName,
      registrationNumber: String(registrationNumber || "").trim(),
      email: String(userEmail || "")
        .trim()
        .toLowerCase(),
      reason: String(reason || "Integrity violation detected."),
    };

    try {
      await fetch(apiBase + "/submissions/malpractice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        keepalive: true,
      });
    } catch (error) {
      console.error("[MALPRACTICE] Failed to report:", error);
    }
  }

  function eliminate() {
    if (eliminated || !contestStarted) {
      return;
    }

    eliminated = true;

    reportMalpractice(
      "Fullscreen was exited or an integrity violation was detected before the prompt was finished.",
    );

    contestStarted = false;

    sessionFinished = false;

    stopTimer();

    if (integrityId) {
      clearInterval(integrityId);

      integrityId = null;
    }

    promptArea.setAttribute("readonly", "");

    finishBtn.disabled = true;

    viewResultsBtn.classList.add("hidden");

    creationTypes.classList.remove("visible");

    certPanel.classList.remove("visible");

    showKeyboard(false);

    kbToggle.classList.add("hidden");

    resultModal.classList.add("hidden");

    nudgeOverlay.classList.add("hidden");

    elimScreen.classList.remove("hidden");

    if (fwAnimId) {
      cancelAnimationFrame(fwAnimId);

      fwAnimId = null;
    }
  }

  function checkIntegrity() {
    if (!contestStarted || eliminated || sessionFinished) {
      return;
    }

    if (!isFullscreen()) {
      eliminate();

      return;
    }

    const widthRatio = window.innerWidth / screen.width;

    const heightRatio = window.innerHeight / screen.height;

    if (widthRatio < 0.85 || heightRatio < 0.8) {
      eliminate();

      return;
    }
  }

  function startIntegrityChecks() {
    if (integrityId) {
      clearInterval(integrityId);
    }

    integrityId = setInterval(checkIntegrity, 2000);
  }

  /*
   * Fullscreen change.
   *
   * IMPORTANT:
   * sessionFinished is checked.
   *
   * Therefore our automatic exitFullscreen()
   * after Finish is NOT malpractice.
   */

  document.addEventListener("fullscreenchange", () => {
    if (contestStarted && !sessionFinished && !isFullscreen()) {
      eliminate();
    }
  });

  document.addEventListener("webkitfullscreenchange", () => {
    if (contestStarted && !sessionFinished && !isFullscreen()) {
      eliminate();
    }
  });

  /*
   * Visibility.
   */

  document.addEventListener("visibilitychange", () => {
    if (contestStarted && !sessionFinished && document.hidden) {
      eliminate();
    }
  });

  window.addEventListener("resize", () => {
    if (contestStarted) {
      checkIntegrity();
    }

    scheduleFloatingWords();
  });

  window.addEventListener("orientationchange", () => {
    if (contestStarted) {
      setTimeout(checkIntegrity, 400);
    }
  });

  window.addEventListener("beforeunload", (event) => {
    if (contestStarted && !eliminated && !sessionFinished) {
      event.preventDefault();

      event.returnValue = "";
    }
  });

  // ============================================================
  // ANTI-COPY
  // ============================================================

  document.addEventListener("contextmenu", (event) => event.preventDefault());

  document.addEventListener("copy", (event) => {
    if (!contestStarted || eliminated || sessionFinished) {
      return;
    }

    event.preventDefault();
    eliminate();
  });

  document.addEventListener("cut", (event) => {
    if (!contestStarted || eliminated || sessionFinished) {
      return;
    }

    event.preventDefault();
    eliminate();
  });

  document.addEventListener("paste", (event) => {
    if (!contestStarted || eliminated || sessionFinished) {
      return;
    }

    event.preventDefault();
    eliminate();
  });

  // document.addEventListener("cut", (event) => event.preventDefault());

  // document.addEventListener("paste", (event) => {
  //   if (isTouch || sessionFinished) {
  //     event.preventDefault();
  //   }
  // });

  document.addEventListener("dragstart", (event) => event.preventDefault());

  document.addEventListener("keydown", (event) => {
    if (!contestStarted || eliminated || sessionFinished) {
      return;
    }

    const key = event.key.toLowerCase();

    /*
     * Print Screen
     *
     * We cannot guarantee that the operating system will not
     * capture the screen, but we can block the browser event
     * when the browser exposes it.
     */
    if (event.key === "PrintScreen") {
      event.preventDefault();

      eliminate();
      return;
    }

    /*
     * F12
     */
    if (event.key === "F12") {
      event.preventDefault();
      eliminate();
      return;
    }

    /*
     * Ctrl / Cmd shortcuts
     */
    if (event.ctrlKey || event.metaKey) {
      /*
       * Copy
       */
      if (key === "c") {
        event.preventDefault();
        eliminate();
        return;
      }

      /*
       * Paste
       */
      if (key === "v") {
        event.preventDefault();
        eliminate();
        return;
      }

      /*
       * Cut
       */
      if (key === "x") {
        event.preventDefault();
        eliminate();
        return;
      }

      /*
       * Save / Print / View Source / DevTools /
       * Page Source / other browser shortcuts.
       */
      if (["u", "s", "p", "i", "j"].includes(key)) {
        event.preventDefault();
        eliminate();
        return;
      }

      /*
       * Developer-tools shortcuts:
       * Ctrl/Cmd + Shift + I
       * Ctrl/Cmd + Shift + J
       * Ctrl/Cmd + Shift + C
       * Ctrl/Cmd + Shift + K
       */
      if (event.shiftKey && ["i", "j", "c", "k"].includes(key)) {
        event.preventDefault();
        eliminate();
        return;
      }
    }
  });
  document.addEventListener("selectstart", (event) => {
    if (!event.target.closest("#prompt-area, input, textarea")) {
      event.preventDefault();
    }
  });

  // ============================================================
  // INITIALIZATION
  // ============================================================

  updateLoginState();

  updateLiveScore();
}
