/* ==========================================================
   LAYERS SHIFT — Download Center
   app.js

   Responsibilities:
   - Detect the visitor's OS (Windows / macOS / other)
   - Fetch release metadata from releases.json
   - Populate the Windows / macOS cards with that data
   - Highlight whichever card matches the visitor's OS
   - Show a brief loading state on click, then redirect
     to the actual installer URL

   Expected releases.json shape:
   {
     "windows": {
       "version": "2.4.1",
       "url": "https://cdn.layersshift.app/downloads/LayersShift-Setup-2.4.1.exe",
       "size": "86 MB",
       "requirement": "Windows 10 64-bit or later",
       "releaseDate": "2026-06-12"
     },
     "macos": {
       "version": "2.4.1",
       "url": "https://cdn.layersshift.app/downloads/LayersShift-2.4.1.dmg",
       "size": "74 MB",
       "requirement": "macOS 12 Monterey or later",
       "arch": "Universal (Apple Silicon + Intel)",
       "releaseDate": "2026-06-12"
     }
   }
   ========================================================== */

(function () {
  "use strict";

  var RELEASES_URL = "releases.json";
  var REDIRECT_DELAY_MS = 1100;

  // Used only if releases.json can't be fetched (e.g. opened via file://),
  // so the page still functions during local testing.
  var FALLBACK_RELEASES = {
    latest: "2.4.1",
    channel: "stable",
    windows: {
      version: "2.4.1",
      url: "#",
      size: "86 MB",
      requirement: "Windows 10 64-bit or later",
      releaseDate: "2026-06-12"
    },
    macos: {
      version: "2.4.1",
      url: "#",
      size: "74 MB",
      requirement: "macOS 12 Monterey or later",
      arch: "Universal (Apple Silicon + Intel)",
      releaseDate: "2026-06-12"
    }
  };

  document.addEventListener("DOMContentLoaded", init);

  function init() {
    initProgressBar();
    initScrollReveal();
    initRippleEffect();
    initCardSpotlight();

    fetchReleases()
      .then(function (releases) {
        var os = detectOS();
        renderCard("windows", releases.windows, releases);
        renderCard("macos", releases.macos, releases);
        highlightRecommended(os);
        reorderRecommendedOnMobile(os);
        lockNonRecommendedCard(os);
        wireHeroPrimaryAction(os, releases);
      })
      .catch(function (err) {
        console.warn("[LayersShift] Falling back to bundled release data:", err);
        var os = detectOS();
        renderCard("windows", FALLBACK_RELEASES.windows, FALLBACK_RELEASES);
        renderCard("macos", FALLBACK_RELEASES.macos, FALLBACK_RELEASES);
        highlightRecommended(os);
        reorderRecommendedOnMobile(os);
        lockNonRecommendedCard(os);
        wireHeroPrimaryAction(os, FALLBACK_RELEASES);
      });
  }

  /* -----------------------------------------------------------
     DATA
  ----------------------------------------------------------- */

  function fetchReleases() {
    return fetch(RELEASES_URL, { cache: "no-store" })
      .then(function (res) {
        if (!res.ok) {
          throw new Error("releases.json responded with " + res.status);
        }
        return res.json();
      })
      .then(function (data) {
        if (!data || !data.windows || !data.macos) {
          throw new Error("releases.json is missing windows/macos entries");
        }
        return data;
      });
  }

  /* -----------------------------------------------------------
     OS DETECTION
  ----------------------------------------------------------- */

  function detectOS() {
    var platform =
      (navigator.userAgentData && navigator.userAgentData.platform) ||
      navigator.platform ||
      "";
    var ua = navigator.userAgent || "";

    if (/mac/i.test(platform) || /Macintosh/i.test(ua)) {
      return "macos";
    }
    if (/win/i.test(platform) || /Windows/i.test(ua)) {
      return "windows";
    }
    return "other";
  }

  /* -----------------------------------------------------------
     CARD RENDERING
  ----------------------------------------------------------- */

  function renderCard(platformKey, release, releasesData) {
    if (!release) return;

    var card = document.querySelector(".platform-card--" + platformKey);
    if (!card) return;

    card.dataset.version = release.version || "";
    card.dataset.url = release.url || "#";

    renderTitle(card, platformKey);
    renderBadges(card, release, releasesData);
    renderSpecs(card, release);
    renderActions(card, platformKey, release);
  }

  function renderTitle(card, platformKey) {
    var titleEl = card.querySelector(".platform-card__title");
    if (!titleEl) return;
    titleEl.textContent = platformKey === "windows" ? "Windows" : "macOS";
  }

  function renderBadges(card, release, releasesData) {
    var existing = card.querySelector(".platform-card__tags");
    if (existing) existing.remove();

    var wrap = document.createElement("div");
    wrap.className = "platform-card__tags";

    var isLatestStable =
      releasesData &&
      releasesData.channel === "stable" &&
      release.version === releasesData.latest;

    if (isLatestStable) {
      wrap.appendChild(makeTag("Latest Stable"));
    }
    wrap.appendChild(makeTag("Lifetime License"));

    var titleEl = card.querySelector(".platform-card__title");
    if (titleEl && titleEl.parentNode) {
      titleEl.parentNode.insertBefore(wrap, titleEl.nextSibling);
    } else {
      card.appendChild(wrap);
    }
  }

  function makeTag(text) {
    var tag = document.createElement("span");
    tag.className = "platform-card__tag";
    tag.textContent = text;
    return tag;
  }

  function renderSpecs(card, release) {
    var specsEl = card.querySelector(".platform-card__specs");
    if (!specsEl) return;

    var rows = [
      { label: "Latest Version", value: release.version },
      { label: "Build Number", value: release.build },
      { label: "Release Date", value: release.releaseDate },
      { label: "File Size", value: release.size },
      { label: "System Requirement", value: release.requirement },
      { label: "Architecture", value: release.arch }
    ];

    specsEl.textContent = "";
    rows.forEach(function (row) {
      if (!row.value) return;
      var li = document.createElement("li");
      li.className = "platform-card__spec";
      li.textContent = row.label + ": " + row.value;
      specsEl.appendChild(li);
    });
  }

  function renderActions(card, platformKey, release) {
    var actionsEl = card.querySelector(".platform-card__actions");
    if (!actionsEl) return;

    actionsEl.textContent = "";

    var downloadBtn = document.createElement("button");
    downloadBtn.type = "button";
    downloadBtn.className = "js-download-btn";
    downloadBtn.dataset.defaultLabel =
      "Download for " + (platformKey === "windows" ? "Windows" : "macOS");
    downloadBtn.textContent = downloadBtn.dataset.defaultLabel;
    downloadBtn.addEventListener("click", function () {
      startDownload(downloadBtn, release.url);
    });

    var notesBtn = document.createElement("button");
    notesBtn.type = "button";
    notesBtn.className = "js-release-notes-btn";
    notesBtn.textContent = "Release Notes";
    notesBtn.addEventListener("click", function () {
      openReleaseNotesModal(platformKey, release);
    });

    actionsEl.appendChild(downloadBtn);
    actionsEl.appendChild(notesBtn);
  }

  /* -----------------------------------------------------------
     RELEASE NOTES MODAL
  ----------------------------------------------------------- */

  function openReleaseNotesModal(platformKey, release) {
    closeReleaseNotesModal();

    var platformLabel = platformKey === "windows" ? "Windows" : "macOS";

    var overlay = document.createElement("div");
    overlay.className = "lsn-modal-overlay";
    overlay.setAttribute("data-lsn-overlay", "true");

    var modal = document.createElement("div");
    modal.className = "lsn-modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-label", platformLabel + " release notes");

    var header = document.createElement("div");
    header.className = "lsn-modal__header";

    var title = document.createElement("h3");
    title.className = "lsn-modal__title";
    title.textContent = platformLabel + " Release Notes";

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "lsn-modal__close";
    closeBtn.setAttribute("aria-label", "Close");
    closeBtn.textContent = "\u00D7";
    closeBtn.addEventListener("click", closeReleaseNotesModal);

    header.appendChild(title);
    header.appendChild(closeBtn);

    var meta = document.createElement("div");
    meta.className = "lsn-modal__meta";
    meta.textContent =
      "Version " + (release.version || "") +
      (release.build ? " (Build " + release.build + ")" : "") +
      (release.releaseDate ? " \u00B7 " + release.releaseDate : "");

    var list = document.createElement("ul");
    list.className = "lsn-modal__list";

    var notes = Array.isArray(release.releaseNotes) ? release.releaseNotes : [];
    if (notes.length) {
      notes.forEach(function (note) {
        if (!note) return;
        var li = document.createElement("li");
        li.textContent = note;
        list.appendChild(li);
      });
    } else {
      var emptyLi = document.createElement("li");
      emptyLi.textContent = "No release notes available for this version.";
      list.appendChild(emptyLi);
    }

    modal.appendChild(header);
    modal.appendChild(meta);
    modal.appendChild(list);
    overlay.appendChild(modal);

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) closeReleaseNotesModal();
    });

    document.addEventListener("keydown", handleModalKeydown);
    document.body.appendChild(overlay);
  }

  function handleModalKeydown(event) {
    if (event.key === "Escape") closeReleaseNotesModal();
  }

  function closeReleaseNotesModal() {
    var overlay = document.querySelector("[data-lsn-overlay]");
    if (overlay) overlay.remove();
    document.removeEventListener("keydown", handleModalKeydown);
  }

  /* -----------------------------------------------------------
     RECOMMENDED HIGHLIGHT
  ----------------------------------------------------------- */

  function highlightRecommended(os) {
    var cards = document.querySelectorAll(".platform-card");
    cards.forEach(function (card) {
      card.classList.remove("platform-card--recommended");
      var existingBadge = card.querySelector(".platform-card__badge");
      if (existingBadge) existingBadge.remove();
    });

    if (os !== "windows" && os !== "macos") return;

    var recommendedCard = document.querySelector(".platform-card--" + os);
    if (!recommendedCard) return;

    recommendedCard.classList.add("platform-card--recommended");

    var badge = document.createElement("span");
    badge.className = "platform-card__badge";
    badge.textContent = "Recommended for your device";
    recommendedCard.insertBefore(badge, recommendedCard.firstChild);
  }

  /* -----------------------------------------------------------
     MOBILE REORDER — recommended card moves to the top
  ----------------------------------------------------------- */

  function reorderRecommendedOnMobile(os) {
    if (os !== "windows" && os !== "macos") return;

    var grid = document.querySelector(".downloads__grid");
    if (!grid) return;

    var recommendedCard = grid.querySelector(".platform-card--" + os);
    var naturalFirstCard = grid.querySelector(".platform-card--windows");
    if (!recommendedCard || !naturalFirstCard) return;

    var mql = window.matchMedia("(max-width: 640px)");

    function apply() {
      var targetFirst = mql.matches ? recommendedCard : naturalFirstCard;
      if (grid.firstElementChild !== targetFirst) {
        grid.insertBefore(targetFirst, grid.firstElementChild);
      }
    }

    apply();
    if (mql.addEventListener) {
      mql.addEventListener("change", apply);
    } else if (mql.addListener) {
      mql.addListener(apply); // older Safari fallback
    }
  }

  /* -----------------------------------------------------------
     LOCK OPPOSITE PLATFORM — disabled until the user expands it
  ----------------------------------------------------------- */

  function lockNonRecommendedCard(os) {
    if (os !== "windows" && os !== "macos") return;

    var oppositeOS = os === "windows" ? "macos" : "windows";
    var oppositeCard = document.querySelector(".platform-card--" + oppositeOS);
    if (!oppositeCard) return;

    var actionsEl = oppositeCard.querySelector(".platform-card__actions");
    var downloadBtn = oppositeCard.querySelector(".js-download-btn");
    if (!actionsEl || !downloadBtn) return;

    downloadBtn.disabled = true;
    downloadBtn.classList.add("is-locked");
    downloadBtn.setAttribute("aria-disabled", "true");

    var expandBtn = document.createElement("button");
    expandBtn.type = "button";
    expandBtn.className = "js-expand-btn";
    expandBtn.textContent =
      "Not on " + (os === "windows" ? "Windows" : "macOS") + "? Show this download";

    expandBtn.addEventListener("click", function () {
      downloadBtn.disabled = false;
      downloadBtn.classList.remove("is-locked");
      downloadBtn.removeAttribute("aria-disabled");
      expandBtn.remove();
    });

    actionsEl.appendChild(expandBtn);
  }

  /* -----------------------------------------------------------
     HERO PRIMARY CTA — downloads the recommended build directly
  ----------------------------------------------------------- */

  function wireHeroPrimaryAction(os, releases) {
    var heroActions = document.querySelector(".hero__actions");
    if (!heroActions) return;

    var primaryBtn = heroActions.querySelector("a, button");
    if (!primaryBtn) return;

    var targetOS = os === "macos" || os === "windows" ? os : "windows";
    var release = releases[targetOS];

    primaryBtn.dataset.defaultLabel =
      "Download for " + (targetOS === "windows" ? "Windows" : "macOS");
    primaryBtn.textContent = primaryBtn.dataset.defaultLabel;

    primaryBtn.addEventListener("click", function (event) {
      event.preventDefault();
      startDownload(primaryBtn, release.url);
    });
  }

  /* -----------------------------------------------------------
     LOADING STATE + REDIRECT
  ----------------------------------------------------------- */

  function buildLoadingContent(label) {
    var fragment = document.createDocumentFragment();

    var spinner = document.createElement("span");
    spinner.className = "btn-spinner";
    spinner.setAttribute("aria-hidden", "true");

    var text = document.createElement("span");
    text.className = "btn-loading-label";
    text.textContent = label;

    fragment.appendChild(spinner);
    fragment.appendChild(text);
    return fragment;
  }

  function startDownload(triggerEl, url) {
    if (!url || triggerEl.classList.contains("is-loading")) return;

    var defaultLabel = triggerEl.dataset.defaultLabel || triggerEl.textContent;
    triggerEl.classList.add("is-loading");
    triggerEl.setAttribute("aria-busy", "true");
    triggerEl.disabled = true;

    triggerEl.textContent = "";
    triggerEl.appendChild(buildLoadingContent("Preparing download"));

    setTimeout(function () {
      var loadingLabel = triggerEl.querySelector(".btn-loading-label");
      if (loadingLabel) loadingLabel.textContent = "Redirecting\u2026";

      setTimeout(function () {
        window.location.href = url;

        // Reset control shortly after, in case redirect opens
        // in a new context and the user stays on this page.
        setTimeout(function () {
          triggerEl.classList.remove("is-loading");
          triggerEl.removeAttribute("aria-busy");
          triggerEl.disabled = false;
          triggerEl.textContent = defaultLabel;
        }, 1500);
      }, 200);
    }, REDIRECT_DELAY_MS);
  }

  /* -----------------------------------------------------------
     SCROLL ANIMATIONS
  ----------------------------------------------------------- */

  function initScrollReveal() {
    var selectors = [
      ".section-heading",
      ".platform-card",
      ".install__step",
      ".support-card"
    ];
    var targets = document.querySelectorAll(selectors.join(","));
    if (!targets.length) return;

    targets.forEach(function (el) {
      el.classList.add("reveal");
    });

    if (!("IntersectionObserver" in window)) {
      // No IO support: just show everything immediately.
      targets.forEach(function (el) {
        el.classList.add("is-visible");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -40px 0px" }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });

    // Stagger siblings within the same grid so reveals cascade
    // slightly rather than popping in all at once.
    [
      ".downloads__grid",
      ".install__steps",
      ".support__grid"
    ].forEach(function (gridSelector) {
      var grid = document.querySelector(gridSelector);
      if (!grid) return;
      Array.prototype.forEach.call(grid.children, function (child, index) {
        child.style.transitionDelay = index * 80 + "ms";
      });
    });
  }

  /* -----------------------------------------------------------
     MICRO-INTERACTION: click ripple on buttons/links
  ----------------------------------------------------------- */

  function initRippleEffect() {
    var rippleTargets = ".hero__actions a, .hero__actions button, " +
      ".platform-card__actions a, .platform-card__actions button, " +
      ".install__tabs a, .install__tabs button";

    document.addEventListener("pointerdown", function (event) {
      var el = event.target.closest(rippleTargets);
      if (!el) return;

      var rect = el.getBoundingClientRect();
      var ripple = document.createElement("span");
      ripple.className = "ripple";
      ripple.style.left = (event.clientX - rect.left) + "px";
      ripple.style.top = (event.clientY - rect.top) + "px";

      el.appendChild(ripple);
      ripple.addEventListener("animationend", function () {
        ripple.remove();
      });
    });
  }

  /* -----------------------------------------------------------
     TOP PROGRESS BAR — reflects real asset loading
  ----------------------------------------------------------- */

  function initProgressBar() {
    var bar = document.createElement("div");
    bar.className = "page-progress";
    document.body.appendChild(bar);

    var pct = 0;
    var ticker = setInterval(function () {
      pct += (90 - pct) * 0.1;
      bar.style.width = pct.toFixed(1) + "%";
    }, 150);

    function finish() {
      clearInterval(ticker);
      bar.style.width = "100%";
      setTimeout(function () {
        bar.classList.add("is-done");
        setTimeout(function () { bar.remove(); }, 400);
      }, 200);
    }

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish, { once: true });
    }
  }

  /* -----------------------------------------------------------
     PREMIUM HOVER: cursor-tracked spotlight on platform cards
  ----------------------------------------------------------- */

  function initCardSpotlight() {
    var cards = document.querySelectorAll(".platform-card");
    cards.forEach(function (card) {
      card.addEventListener("pointermove", function (event) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", (event.clientX - rect.left) + "px");
        card.style.setProperty("--my", (event.clientY - rect.top) + "px");
      });
    });
  }
})();