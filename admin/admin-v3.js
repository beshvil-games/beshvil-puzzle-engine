(() => {
  "use strict";

  const STORAGE_KEY = "beshvilGameAdminV3";
  const PREVIOUS_KEYS = ["beshvilGameAdminV2", "beshvilGameAdminV1"];
  const BASE_URL = "https://beshvil-games.github.io/beshvil-puzzle-engine/";
  const FINAL_URL = BASE_URL + "admin/final.html";

  const defaultPuzzles = [
    { id: "acrostic-puzzle", type: "אקרוסטיכון", path: "acrostic-puzzle/", active: true },
    { id: "crossword-puzzle", type: "תשבץ", path: "crossword-puzzle/", active: true },
    { id: "gematria-puzzle", type: "גימטריה", path: "gematria-puzzle/", active: true },
    { id: "music-puzzle", type: "מנגינה", path: "music-puzzle/", active: true },
    { id: "timeline-puzzle", type: "ציר זמן", path: "timeline-puzzle/", active: true },
    { id: "word-search", type: "תפזורת", path: "word-search/", active: true }
  ].map(item => ({
    ...item,
    solution: "",
    destination: "",
    qrTitle: "",
    qrPlacement: ""
  }));

  const e = {
    gameName: document.querySelector("#gameName"),
    finalQrTitle: document.querySelector("#finalQrTitle"),
    finalQrPlacement: document.querySelector("#finalQrPlacement"),
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
    return defaultPuzzles.map(p => ({ ...p }));
  }

  function loadState() {
    let saved = null;
    try {
      saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (!saved) {
        for (const key of PREVIOUS_KEYS) {
          const candidate = JSON.parse(localStorage.getItem(key));
          if (candidate) { saved = candidate; break; }
        }
      }
    } catch {}

    if (!saved || !Array.isArray(saved.puzzles)) {
      return {
        gameName: "יום הולדת 50 לרונית",
        finalQrTitle: "סיום",
        finalQrPlacement: "",
        finalLocation: "",
        finalMessage: "",
        puzzles: cloneDefaults()
      };
    }

    const byId = new Map(defaultPuzzles.map(p => [p.id, p]));
    const restored = saved.puzzles
      .filter(p => byId.has(p.id))
      .map(p => ({
        ...byId.get(p.id),
        ...p,
        solution: p.solution || "",
        destination: p.destination || "",
        qrTitle: p.qrTitle || "",
        qrPlacement: p.qrPlacement || p.qrLocation || "",
        active: p.active !== false
      }));

    defaultPuzzles.forEach(p => {
      if (!restored.some(x => x.id === p.id)) restored.push({ ...p });
    });

    return {
      gameName: saved.gameName || "יום הולדת 50 לרונית",
      finalQrTitle: saved.finalQrTitle || "סיום",
      finalQrPlacement: saved.finalQrPlacement || "",
      finalLocation: saved.finalLocation || "",
      finalMessage: saved.finalMessage || "",
      puzzles: restored
    };
  }

  function sync() {
    state.gameName = e.gameName.value.trim();
    state.finalQrTitle = e.finalQrTitle.value.trim();
    state.finalQrPlacement = e.finalQrPlacement.value.trim();
    state.finalLocation = e.finalLocation.value.trim();
    state.finalMessage = e.finalMessage.value.trim();

    document.querySelectorAll(".puzzle-item").forEach(item => {
      const p = state.puzzles.find(x => x.id === item.dataset.id);
      if (!p) return;
      p.solution = item.querySelector(".solution-input").value.trim();
      p.destination = item.querySelector(".destination-input").value.trim();
      p.qrTitle = item.querySelector(".qr-title-input").value.trim();
      p.qrPlacement = item.querySelector(".qr-placement-input").value.trim();
      p.active = item.querySelector(".active-toggle").checked;
    });
  }

  function save(show = true) {
    sync();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    if (show) status("הסדר והפרטים נשמרו במחשב הזה.");
  }

  function render() {
    e.gameName.value = state.gameName;
    e.finalQrTitle.value = state.finalQrTitle;
    e.finalQrPlacement.value = state.finalQrPlacement;
    e.finalLocation.value = state.finalLocation;
    e.finalMessage.value = state.finalMessage;
    e.puzzleList.replaceChildren();

    state.puzzles.forEach((p, index) => {
      const f = e.template.content.cloneNode(true);
      const item = f.querySelector(".puzzle-item");
      item.dataset.id = p.id;
      item.classList.toggle("inactive", !p.active);
      f.querySelector(".station-number").textContent = index + 1;
      f.querySelector(".puzzle-type").textContent = p.type;
      f.querySelector(".solution-input").value = p.solution;
      f.querySelector(".destination-input").value = p.destination;
      f.querySelector(".qr-title-input").value = p.qrTitle;
      f.querySelector(".qr-placement-input").value = p.qrPlacement;
      f.querySelector(".active-toggle").checked = p.active;
      f.querySelector(".puzzle-link").href = BASE_URL + p.path;

      const up = f.querySelector(".move-up");
      const down = f.querySelector(".move-down");
      up.disabled = index === 0;
      down.disabled = index === state.puzzles.length - 1;
      up.addEventListener("click", () => move(index, index - 1));
      down.addEventListener("click", () => move(index, index + 1));

      f.querySelectorAll("input").forEach(input => input.addEventListener("input", () => save(false)));
      f.querySelector(".active-toggle").addEventListener("change", ev => {
        p.active = ev.target.checked;
        item.classList.toggle("inactive", !p.active);
        save(false);
      });

      item.addEventListener("dragstart", ev => {
        draggedId = item.dataset.id;
        item.classList.add("dragging");
        ev.dataTransfer.setData("text/plain", draggedId);
      });
      item.addEventListener("dragover", ev => {
        ev.preventDefault();
        item.classList.add("drag-over");
      });
      item.addEventListener("dragleave", () => item.classList.remove("drag-over"));
      item.addEventListener("drop", ev => {
        ev.preventDefault();
        item.classList.remove("drag-over");
        const targetId = item.dataset.id;
        if (!draggedId || draggedId === targetId) return;
        const from = state.puzzles.findIndex(x => x.id === draggedId);
        const to = state.puzzles.findIndex(x => x.id === targetId);
        const [moved] = state.puzzles.splice(from, 1);
        state.puzzles.splice(to, 0, moved);
        save(false);
        render();
      });
      item.addEventListener("dragend", () => {
        draggedId = null;
        document.querySelectorAll(".drag-over,.dragging").forEach(x => x.classList.remove("drag-over","dragging"));
      });

      e.puzzleList.appendChild(f);
    });
  }

  function move(from, to) {
    if (to < 0 || to >= state.puzzles.length) return;
    const [moved] = state.puzzles.splice(from, 1);
    state.puzzles.splice(to, 0, moved);
    save(false);
    render();
  }

  async function waitQr() {
    const start = Date.now();
    while (typeof window.QRCode === "undefined") {
      if (Date.now() - start > 5000) throw new Error("ספריית ה־QR לא נטענה.");
      await new Promise(r => setTimeout(r, 100));
    }
  }

  function validate(active) {
    const missing = active.filter(p => !p.qrTitle.trim());
    if (missing.length) throw new Error("חסר שם שיודפס על ה־QR בחלק מהתחנות.");
    if (!state.finalQrTitle.trim()) throw new Error("חסר שם ל־QR הסיום.");
  }

  async function generate() {
    save(false);
    const active = state.puzzles.filter(p => p.active);

    try {
      validate(active);
      await waitQr();
      e.qrGrid.replaceChildren();

      active.forEach(p => e.qrGrid.appendChild(qrCard(p.qrTitle, BASE_URL + p.path, p)));
      e.qrGrid.appendChild(qrCard(state.finalQrTitle, FINAL_URL, {
        type: "סיום",
        solution: state.finalMessage || "—",
        destination: state.finalLocation || "—",
        qrPlacement: state.finalQrPlacement || "—"
      }));

      buildProduction(active);
      e.qrSection.hidden = false;
      e.productionSection.hidden = false;
      status(`נוצרו ${active.length + 1} קודי QR, כולל קוד הסיום.`);
      e.qrSection.scrollIntoView({ behavior: "smooth" });
    } catch (err) {
      status(err.message || "לא ניתן ליצור את הקודים.", true);
    }
  }

  function qrCard(titleText, url, detailsData) {
    const card = document.createElement("article");
    card.className = "qr-card";

    const title = document.createElement("h3");
    title.className = "qr-location";
    title.textContent = titleText;

    const box = document.createElement("div");
    box.className = "qr-code";

    const details = document.createElement("div");
    details.className = "qr-admin-details";
    details.innerHTML = `
      <p><strong>סוג:</strong> ${esc(detailsData.type)}</p>
      <p><strong>פתרון:</strong> ${esc(detailsData.solution || "—")}</p>
      <p><strong>מוביל אל:</strong> ${esc(detailsData.destination || "—")}</p>
      <p><strong>מיקום הדבקה:</strong> ${esc(detailsData.qrPlacement || "—")}</p>
    `;

    const actions = document.createElement("div");
    actions.className = "qr-card-actions";
    const btn = document.createElement("button");
    btn.className = "small-button";
    btn.type = "button";
    btn.textContent = "הורדת PNG";
    btn.addEventListener("click", () => download(box, titleText));
    actions.appendChild(btn);

    card.append(title, box, details, actions);

    requestAnimationFrame(() => {
      new QRCode(box, { text: url, width: 180, height: 180, correctLevel: QRCode.CorrectLevel.H });
    });

    return card;
  }

  function buildProduction(active) {
    e.productionGameName.textContent = state.gameName || "לא הוזן";
    e.productionFinalLocation.textContent = state.finalLocation || "לא הוזן";
    e.productionBody.replaceChildren();

    active.forEach((p, i) => addRow([i + 1, p.type, p.solution || "—", p.destination || "—", p.qrTitle || "—", p.qrPlacement || "—"]));
    addRow(["סיום", "QR סיום", state.finalMessage || "—", state.finalLocation || "—", state.finalQrTitle || "—", state.finalQrPlacement || "—"]);
  }

  function addRow(values) {
    const tr = document.createElement("tr");
    values.forEach(v => {
      const td = document.createElement("td");
      td.textContent = String(v);
      tr.appendChild(td);
    });
    e.productionBody.appendChild(tr);
  }

  function download(container, title) {
    const canvas = container.querySelector("canvas");
    const img = container.querySelector("img");
    const data = canvas ? canvas.toDataURL("image/png") : img?.src;
    if (!data) return status("הקוד עדיין לא מוכן.", true);

    const safe = String(title).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "-").slice(0,60) || "qr";
    const a = document.createElement("a");
    a.href = data;
    a.download = `${safe}.png`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function esc(v) {
    return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
  }

  function status(msg, error = false) {
    e.statusMessage.textContent = msg;
    e.statusMessage.style.color = error ? "var(--admin-danger)" : "";
  }

  function printMode(mode) {
    document.body.classList.remove("print-qr", "print-production");
    document.body.classList.add(mode);
    window.print();
    setTimeout(() => document.body.classList.remove(mode), 500);
  }

  e.saveButton.addEventListener("click", () => save(true));
  e.generateButton.addEventListener("click", generate);
  e.printButton.addEventListener("click", () => printMode("print-qr"));
  e.productionPrintButton.addEventListener("click", () => printMode("print-production"));
  e.resetButton.addEventListener("click", () => {
    if (!confirm("לאפס את כל הנתונים?")) return;
    localStorage.removeItem(STORAGE_KEY);
    state = {
      gameName: "יום הולדת 50 לרונית",
      finalQrTitle: "סיום",
      finalQrPlacement: "",
      finalLocation: "",
      finalMessage: "",
      puzzles: cloneDefaults()
    };
    render();
    e.qrSection.hidden = true;
    e.productionSection.hidden = true;
  });

  window.addEventListener("beforeunload", () => save(false));
  window.addEventListener("afterprint", () => document.body.classList.remove("print-qr","print-production"));

  render();
})();
