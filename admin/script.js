(() => {
  "use strict";

  const STORAGE_KEY = "beshvilGameAdminV2";
  const OLD_STORAGE_KEY = "beshvilGameAdminV1";
  const BASE_URL = "https://beshvil-games.github.io/beshvil-puzzle-engine/";

  const defaultPuzzles = [
    { id: "acrostic-puzzle", type: "אקרוסטיכון", path: "acrostic-puzzle/", active: true },
    { id: "crossword-puzzle", type: "תשבץ", path: "crossword-puzzle/", active: true },
    { id: "gematria-puzzle", type: "גימטריה", path: "gematria-puzzle/", active: true },
    { id: "music-puzzle", type: "מנגינה", path: "music-puzzle/", active: true },
    { id: "timeline-puzzle", type: "ציר זמן", path: "timeline-puzzle/", active: true },
    { id: "word-search", type: "תפזורת", path: "word-search/", active: true }
  ].map(item => ({
    ...item,
    destination: "",
    qrLocation: ""
  }));

  const elements = {
    gameName: document.querySelector("#gameName"),
    finalLocation: document.querySelector("#finalLocation"),
    finalMessage: document.querySelector("#finalMessage"),
    puzzleList: document.querySelector("#puzzleList"),
    template: document.querySelector("#puzzleItemTemplate"),
    saveButton: document.querySelector("#saveButton"),
    generateButton: document.querySelector("#generateButton"),
    resetButton: document.querySelector("#resetButton"),
    statusMessage: document.querySelector("#statusMessage"),
    qrSection: document.querySelector("#qrSection"),
    qrGrid: document.querySelector("#qrGrid"),
    printButton: document.querySelector("#printButton"),
    productionPrintButton: document.querySelector("#productionPrintButton"),
    productionSection: document.querySelector("#productionSection"),
    productionBody: document.querySelector("#productionBody"),
    productionGameName: document.querySelector("#productionGameName"),
    productionFinalLocation: document.querySelector("#productionFinalLocation")
  };

  let state = loadState();
  let draggedId = null;

  function cloneDefaults() {
    return defaultPuzzles.map(puzzle => ({ ...puzzle }));
  }

  function loadState() {
    try {
      let saved = JSON.parse(localStorage.getItem(STORAGE_KEY));

      if (!saved) {
        const oldSaved = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY));
        if (oldSaved && Array.isArray(oldSaved.puzzles)) {
          saved = {
            gameName: oldSaved.gameName || "יום הולדת 50 לרונית",
            finalLocation: "",
            finalMessage: oldSaved.finalMessage || "",
            puzzles: oldSaved.puzzles.map(item => ({
              id: item.id,
              destination: item.title || "",
              qrLocation: "",
              active: item.active !== false
            }))
          };
        }
      }

      if (!saved || !Array.isArray(saved.puzzles)) throw new Error("No saved state");

      const knownById = new Map(defaultPuzzles.map(item => [item.id, item]));
      const restored = saved.puzzles
        .filter(item => knownById.has(item.id))
        .map(item => ({
          ...knownById.get(item.id),
          ...item,
          destination: item.destination || "",
          qrLocation: item.qrLocation || "",
          active: item.active !== false
        }));

      defaultPuzzles.forEach(item => {
        if (!restored.some(savedItem => savedItem.id === item.id)) restored.push({ ...item });
      });

      return {
        gameName: saved.gameName || "יום הולדת 50 לרונית",
        finalLocation: saved.finalLocation || "",
        finalMessage: saved.finalMessage || "",
        puzzles: restored
      };
    } catch {
      return {
        gameName: "יום הולדת 50 לרונית",
        finalLocation: "",
        finalMessage: "",
        puzzles: cloneDefaults()
      };
    }
  }

  function saveState(showMessage = true) {
    syncInputsToState();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (showMessage) setStatus("הסדר והפרטים נשמרו במחשב הזה.");
  }

  function resetState() {
    if (!window.confirm("לאפס את סדר התחנות ואת כל הפרטים?")) return;

    state = {
      gameName: "יום הולדת 50 לרונית",
      finalLocation: "",
      finalMessage: "",
      puzzles: cloneDefaults()
    };

    localStorage.removeItem(STORAGE_KEY);
    renderAll();
    elements.qrSection.hidden = true;
    elements.productionSection.hidden = true;
    setStatus("המסך אופס.");
  }

  function renderAll() {
    elements.gameName.value = state.gameName;
    elements.finalLocation.value = state.finalLocation;
    elements.finalMessage.value = state.finalMessage;
    renderPuzzleList();
  }

  function renderPuzzleList() {
    elements.puzzleList.replaceChildren();

    state.puzzles.forEach((puzzle, index) => {
      const fragment = elements.template.content.cloneNode(true);
      const item = fragment.querySelector(".puzzle-item");
      const destinationInput = fragment.querySelector(".destination-input");
      const qrLocationInput = fragment.querySelector(".qr-location-input");
      const activeToggle = fragment.querySelector(".active-toggle");
      const link = fragment.querySelector(".puzzle-link");
      const upButton = fragment.querySelector(".move-up");
      const downButton = fragment.querySelector(".move-down");

      item.dataset.id = puzzle.id;
      item.classList.toggle("inactive", !puzzle.active);
      fragment.querySelector(".station-number").textContent = String(index + 1);
      fragment.querySelector(".puzzle-type").textContent = puzzle.type;
      destinationInput.value = puzzle.destination;
      qrLocationInput.value = puzzle.qrLocation;
      activeToggle.checked = puzzle.active;
      link.href = BASE_URL + puzzle.path;

      upButton.disabled = index === 0;
      downButton.disabled = index === state.puzzles.length - 1;

      destinationInput.addEventListener("input", event => {
        puzzle.destination = event.target.value;
        saveState(false);
      });

      qrLocationInput.addEventListener("input", event => {
        puzzle.qrLocation = event.target.value;
        saveState(false);
      });

      activeToggle.addEventListener("change", event => {
        puzzle.active = event.target.checked;
        item.classList.toggle("inactive", !puzzle.active);
        saveState(false);
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

    const fromIndex = state.puzzles.findIndex(item => item.id === draggedId);
    const toIndex = state.puzzles.findIndex(item => item.id === targetId);
    if (fromIndex === -1 || toIndex === -1) return;

    const [moved] = state.puzzles.splice(fromIndex, 1);
    state.puzzles.splice(toIndex, 0, moved);
    saveState(false);
    renderPuzzleList();
  }

  function handleDragEnd(event) {
    draggedId = null;
    event.currentTarget.classList.remove("dragging");
    document.querySelectorAll(".drag-over").forEach(item => item.classList.remove("drag-over"));
  }

  async function waitForQrLibrary(timeoutMs = 5000) {
    const started = Date.now();
    while (typeof window.QRCode === "undefined") {
      if (Date.now() - started > timeoutMs) {
        throw new Error("ספריית ה־QR לא נטענה. בדקי את החיבור לאינטרנט ונסי שוב.");
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  function validateActivePuzzles(activePuzzles) {
    const missing = activePuzzles.filter(puzzle => !puzzle.qrLocation.trim());
    if (missing.length) {
      const names = missing.map(puzzle => puzzle.type).join(", ");
      throw new Error(`חסר מיקום הדבקת QR בחידות: ${names}`);
    }
  }

  async function generateQrCodes() {
    saveState(false);
    const activePuzzles = state.puzzles.filter(puzzle => puzzle.active);

    if (!activePuzzles.length) {
      setStatus("צריך להפעיל לפחות תחנה אחת.", true);
      return;
    }

    try {
      validateActivePuzzles(activePuzzles);
      setStatus("יוצרת את קודי ה־QR…");
      await waitForQrLibrary();

      elements.qrGrid.replaceChildren();
      activePuzzles.forEach((puzzle, index) => {
        elements.qrGrid.appendChild(createQrCard(puzzle, index + 1));
      });

      buildProductionSheet(activePuzzles);
      elements.qrSection.hidden = false;
      elements.productionSection.hidden = false;
      setStatus(`נוצרו ${activePuzzles.length} קודי QR.`);
      elements.qrSection.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      setStatus(error.message || "לא ניתן היה ליצור את קודי ה־QR.", true);
    }
  }

  function createQrCard(puzzle, stationNumber) {
    const card = document.createElement("article");
    card.className = "qr-card";

    const location = document.createElement("h3");
    location.className = "qr-location";
    location.textContent = puzzle.qrLocation.trim();

    const qrContainer = document.createElement("div");
    qrContainer.className = "qr-code";

    const details = document.createElement("div");
    details.className = "qr-admin-details";
    details.innerHTML = `
      <p><strong>סוג החידה:</strong> ${escapeHtml(puzzle.type)}</p>
      <p><strong>לאן היא מובילה:</strong> ${escapeHtml(puzzle.destination || "לא הוזן")}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "qr-card-actions";

    const downloadButton = document.createElement("button");
    downloadButton.type = "button";
    downloadButton.className = "small-button";
    downloadButton.textContent = "הורדת PNG";
    downloadButton.addEventListener("click", () => {
      downloadQrImage(qrContainer, puzzle.qrLocation);
    });

    actions.append(downloadButton);
    card.append(location, qrContainer, details, actions);

    const url = BASE_URL + puzzle.path;
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

  function buildProductionSheet(activePuzzles) {
    elements.productionGameName.textContent = state.gameName || "לא הוזן";
    elements.productionFinalLocation.textContent = state.finalLocation || "לא הוזן";
    elements.productionBody.replaceChildren();

    activePuzzles.forEach((puzzle, index) => {
      const row = document.createElement("tr");
      [index + 1, puzzle.type, puzzle.destination || "—", puzzle.qrLocation || "—"].forEach(value => {
        const cell = document.createElement("td");
        cell.textContent = String(value);
        row.appendChild(cell);
      });
      elements.productionBody.appendChild(row);
    });
  }

  function downloadQrImage(container, qrLocation) {
    const canvas = container.querySelector("canvas");
    const image = container.querySelector("img");
    let dataUrl = "";

    if (canvas) dataUrl = canvas.toDataURL("image/png");
    else if (image) dataUrl = image.src;

    if (!dataUrl) {
      setStatus("קוד ה־QR עדיין לא מוכן. נסי שוב בעוד רגע.", true);
      return;
    }

    const safeName = String(qrLocation)
      .trim()
      .replace(/[\\/:*?"<>|]+/g, "-")
      .replace(/\s+/g, "-")
      .slice(0, 60) || "qr";

    const link = document.createElement("a");
    link.href = dataUrl;
    link.download = `${safeName}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  function syncInputsToState() {
    state.gameName = elements.gameName.value.trim();
    state.finalLocation = elements.finalLocation.value.trim();
    state.finalMessage = elements.finalMessage.value.trim();

    document.querySelectorAll(".puzzle-item").forEach(item => {
      const puzzle = state.puzzles.find(entry => entry.id === item.dataset.id);
      if (!puzzle) return;
      puzzle.destination = item.querySelector(".destination-input").value.trim();
      puzzle.qrLocation = item.querySelector(".qr-location-input").value.trim();
      puzzle.active = item.querySelector(".active-toggle").checked;
    });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function setStatus(message, isError = false) {
    elements.statusMessage.textContent = message;
    elements.statusMessage.style.color = isError ? "var(--admin-danger)" : "";
  }

  function printMode(mode) {
    document.body.classList.remove("print-qr", "print-production");
    document.body.classList.add(mode);
    window.print();
    setTimeout(() => document.body.classList.remove(mode), 500);
  }

  elements.saveButton.addEventListener("click", () => saveState(true));
  elements.generateButton.addEventListener("click", generateQrCodes);
  elements.resetButton.addEventListener("click", resetState);
  elements.printButton.addEventListener("click", () => printMode("print-qr"));
  elements.productionPrintButton.addEventListener("click", () => printMode("print-production"));

  window.addEventListener("beforeunload", () => saveState(false));
  window.addEventListener("afterprint", () => {
    document.body.classList.remove("print-qr", "print-production");
  });

  renderAll();
})();
