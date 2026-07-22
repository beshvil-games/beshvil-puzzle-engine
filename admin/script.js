(() => {
  "use strict";

  const STORAGE_KEY = "beshvilGameAdminV1";
  const BASE_URL = "https://beshvil-games.github.io/beshvil-puzzle-engine/";

  const defaultPuzzles = [
    {
      id: "acrostic-puzzle",
      type: "אקרוסטיכון",
      title: "תחנת האקרוסטיכון",
      path: "acrostic-puzzle/",
      active: true
    },
    {
      id: "crossword-puzzle",
      type: "תשבץ",
      title: "תחנת התשבץ",
      path: "crossword-puzzle/",
      active: true
    },
    {
      id: "gematria-puzzle",
      type: "גימטריה",
      title: "תחנת הגימטריה",
      path: "gematria-puzzle/",
      active: true
    },
    {
      id: "music-puzzle",
      type: "מנגינה",
      title: "תחנת המנגינה",
      path: "music-puzzle/",
      active: true
    },
    {
      id: "timeline-puzzle",
      type: "ציר זמן",
      title: "תחנת ציר הזמן",
      path: "timeline-puzzle/",
      active: true
    },
    {
      id: "word-search",
      type: "תפזורת",
      title: "תחנת התפזורת",
      path: "word-search/",
      active: true
    }
  ];

  const elements = {
    gameName: document.querySelector("#gameName"),
    finalMessage: document.querySelector("#finalMessage"),
    puzzleList: document.querySelector("#puzzleList"),
    template: document.querySelector("#puzzleItemTemplate"),
    saveButton: document.querySelector("#saveButton"),
    generateButton: document.querySelector("#generateButton"),
    resetButton: document.querySelector("#resetButton"),
    statusMessage: document.querySelector("#statusMessage"),
    qrSection: document.querySelector("#qrSection"),
    qrGrid: document.querySelector("#qrGrid"),
    printButton: document.querySelector("#printButton")
  };

  let state = loadState();
  let draggedId = null;

  function cloneDefaults() {
    return defaultPuzzles.map((puzzle) => ({ ...puzzle }));
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved || !Array.isArray(saved.puzzles)) {
        throw new Error("No saved state");
      }

      const knownById = new Map(defaultPuzzles.map((item) => [item.id, item]));
      const restored = saved.puzzles
        .filter((item) => knownById.has(item.id))
        .map((item) => ({
          ...knownById.get(item.id),
          ...item,
          active: item.active !== false
        }));

      defaultPuzzles.forEach((item) => {
        if (!restored.some((savedItem) => savedItem.id === item.id)) {
          restored.push({ ...item });
        }
      });

      return {
        gameName: saved.gameName || "יום הולדת 50 לרונית",
        finalMessage: saved.finalMessage || "",
        puzzles: restored
      };
    } catch {
      return {
        gameName: "יום הולדת 50 לרונית",
        finalMessage: "",
        puzzles: cloneDefaults()
      };
    }
  }

  function saveState(showMessage = true) {
    state.gameName = elements.gameName.value.trim();
    state.finalMessage = elements.finalMessage.value.trim();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));

    if (showMessage) {
      setStatus("הסדר נשמר במחשב הזה.");
    }
  }

  function resetState() {
    const confirmed = window.confirm("לאפס את סדר התחנות והשמות לברירת המחדל?");
    if (!confirmed) return;

    state = {
      gameName: "יום הולדת 50 לרונית",
      finalMessage: "",
      puzzles: cloneDefaults()
    };

    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    elements.qrSection.hidden = true;
    setStatus("המסך אופס.");
  }

  function renderAll() {
    elements.gameName.value = state.gameName;
    elements.finalMessage.value = state.finalMessage;
    renderPuzzleList();
  }

  function renderPuzzleList() {
    elements.puzzleList.replaceChildren();

    state.puzzles.forEach((puzzle, index) => {
      const fragment = elements.template.content.cloneNode(true);
      const item = fragment.querySelector(".puzzle-item");
      const titleInput = fragment.querySelector(".station-title");
      const activeToggle = fragment.querySelector(".active-toggle");
      const link = fragment.querySelector(".puzzle-link");
      const upButton = fragment.querySelector(".move-up");
      const downButton = fragment.querySelector(".move-down");

      item.dataset.id = puzzle.id;
      item.classList.toggle("inactive", !puzzle.active);
      fragment.querySelector(".station-number").textContent = String(index + 1);
      fragment.querySelector(".puzzle-type").textContent = puzzle.type;
      titleInput.value = puzzle.title;
      activeToggle.checked = puzzle.active;
      link.href = BASE_URL + puzzle.path;

      upButton.disabled = index === 0;
      downButton.disabled = index === state.puzzles.length - 1;

      titleInput.addEventListener("input", (event) => {
        puzzle.title = event.target.value;
        saveState(false);
      });

      activeToggle.addEventListener("change", (event) => {
        puzzle.active = event.target.checked;
        item.classList.toggle("inactive", !puzzle.active);
        saveState(false);
        updateNumbers();
      });

      upButton.addEventListener("click", () => movePuzzle(index, index - 1));
      downButton.addEventListener("click", () => movePuzzle(index, index + 1));

      item.addEventListener("dragstart", handleDragStart);
      item.addEventListener("dragover", handleDragOver);
      item.addEventListener("dragleave", handleDragLeave);
      item.addEventListener("drop", handleDrop);
      item.addEventListener("dragend", handleDragEnd);

      elements.puzzleList.appendChild(fragment);
    });
  }

  function movePuzzle(fromIndex, toIndex) {
    if (toIndex < 0 || toIndex >= state.puzzles.length) return;

    const [moved] = state.puzzles.splice(fromIndex, 1);
    state.puzzles.splice(toIndex, 0, moved);
    saveState(false);
    renderPuzzleList();
  }

  function handleDragStart(event) {
    draggedId = event.currentTarget.dataset.id;
    event.currentTarget.classList.add("dragging");
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedId);
  }

  function handleDragOver(event) {
    event.preventDefault();
    event.currentTarget.classList.add("drag-over");
    event.dataTransfer.dropEffect = "move";
  }

  function handleDragLeave(event) {
    event.currentTarget.classList.remove("drag-over");
  }

  function handleDrop(event) {
    event.preventDefault();
    const targetId = event.currentTarget.dataset.id;
    event.currentTarget.classList.remove("drag-over");

    if (!draggedId || draggedId === targetId) return;

    const fromIndex = state.puzzles.findIndex((item) => item.id === draggedId);
    const toIndex = state.puzzles.findIndex((item) => item.id === targetId);

    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = state.puzzles.splice(fromIndex, 1);
    state.puzzles.splice(toIndex, 0, moved);
    saveState(false);
    renderPuzzleList();
  }

  function handleDragEnd(event) {
    draggedId = null;
    event.currentTarget.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach((item) => {
      item.classList.remove("drag-over");
    });
  }

  function updateNumbers() {
    document.querySelectorAll(".puzzle-item").forEach((item, index) => {
      item.querySelector(".station-number").textContent = String(index + 1);
    });
  }

  async function waitForQrLibrary(timeoutMs = 5000) {
    const started = Date.now();

    while (typeof window.QRCode === "undefined") {
      if (Date.now() - started > timeoutMs) {
        throw new Error("ספריית ה־QR לא נטענה. בדקי את החיבור לאינטרנט ונסי שוב.");
      }
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  async function generateQrCodes() {
    syncInputsToState();
    saveState(false);

    const activePuzzles = state.puzzles.filter((puzzle) => puzzle.active);
    if (activePuzzles.length === 0) {
      setStatus("צריך להפעיל לפחות תחנה אחת.", true);
      return;
    }

    try {
      setStatus("יוצרת את קודי ה־QR…");
      await waitForQrLibrary();
      elements.qrGrid.replaceChildren();

      activePuzzles.forEach((puzzle, index) => {
        elements.qrGrid.appendChild(createQrCard(puzzle, index + 1));
      });

      elements.qrSection.hidden = false;
      setStatus(`נוצרו ${activePuzzles.length} קודי QR.`);
      elements.qrSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setStatus(error.message || "לא ניתן היה ליצור את קודי ה־QR.", true);
    }
  }

  function createQrCard(puzzle, stationNumber) {
    const card = document.createElement("article");
    card.className = "qr-card";

    const station = document.createElement("strong");
    station.textContent = `תחנה ${stationNumber}`;

    const title = document.createElement("h3");
    title.textContent = puzzle.title.trim() || puzzle.type;

    const type = document.createElement("p");
    type.className = "qr-type";
    type.textContent = puzzle.type;

    const qrContainer = document.createElement("div");
    qrContainer.className = "qr-code";
    qrContainer.id = `qr-${puzzle.id}`;

    const url = BASE_URL + puzzle.path;

    const urlText = document.createElement("div");
    urlText.className = "qr-url";
    urlText.textContent = url;

    const buttons = document.createElement("div");
    buttons.className = "qr-card-actions";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "small-button";
    downloadButton.textContent = "הורדת PNG";
    downloadButton.addEventListener("click", () => {
      downloadQrImage(qrContainer, stationNumber, puzzle.title || puzzle.type);
    });

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.className = "small-button";
    copyButton.textContent = "העתקת קישור";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(url);
        setStatus(`הקישור של תחנה ${stationNumber} הועתק.`);
      } catch {
        window.prompt("העתיקי את הקישור:", url);
      }
    });

    buttons.append(downloadButton, copyButton);
    card.append(station, title, type, qrContainer, urlText, buttons);

    requestAnimationFrame(() => {
      new QRCode(qrContainer, {
        text: url,
        width: 180,
        height: 180,
        correctLevel: QRCode.CorrectLevel.H
      });
    });

    return card;
  }

  function downloadQrImage(container, stationNumber, title) {
    const canvas = container.querySelector("canvas");
    const image = container.querySelector("img");
    let dataUrl = "";

    if (canvas) {
      dataUrl = canvas.toDataURL("image/png");
    } else if (image) {
      dataUrl = image.src;
    }

    if (!dataUrl) {
      setStatus("קוד ה־QR עדיין לא מוכן. נסי שוב בעוד רגע.", true);
      return;
    }

    const safeTitle = String(title)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 50) || "station";

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `תחנה-${stationNumber}-${safeTitle}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function syncInputsToState() {
    state.gameName = elements.gameName.value.trim();
    state.finalMessage = elements.finalMessage.value.trim();

    document.querySelectorAll(".puzzle-item").forEach((item) => {
      const puzzle = state.puzzles.find((entry) => entry.id === item.dataset.id);
      if (!puzzle) return;
      puzzle.title = item.querySelector(".station-title").value.trim();
      puzzle.active = item.querySelector(".active-toggle").checked;
    });
  }

  function setStatus(message, isError = false) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.style.color = isError ? "var(--admin-danger)" : "";
  }

  elements.saveButton.addEventListener("click", () => {
    syncInputsToState();
    saveState(true);
  });

  elements.generateButton.addEventListener("click", generateQrCodes);
  elements.resetButton.addEventListener("click", resetState);
  elements.printButton.addEventListener("click", () => window.print());

  window.addEventListener("beforeunload", () => {
    syncInputsToState();
    saveState(false);
  });

  renderAll();
})();
