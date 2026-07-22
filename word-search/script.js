(() => {
  "use strict";

  const data = window.PUZZLE_DATA;

  const elements = {
    grid: document.getElementById("letterGrid"),
    title: document.getElementById("gameTitle"),
    subtitle: document.getElementById("gameSubtitle"),
    instructions: document.getElementById("gameInstructions"),
    progress: document.getElementById("progressText"),
    status: document.getElementById("statusText"),
    reset: document.getElementById("resetButton"),
    successPanel: document.getElementById("successPanel"),
    successTitle: document.getElementById("successTitle"),
    successMessage: document.getElementById("successMessage"),
    errorPanel: document.getElementById("errorPanel"),
    errorMessage: document.getElementById("errorMessage")
  };

  const state = {
    rows: 0,
    cols: 0,
    cells: [],
    words: [],
    foundWordIds: new Set(),
    foundCellKeys: new Set(),
    pointerId: null,
    start: null,
    path: [],
    completed: false,
    statusTimer: null
  };

  try {
    prepareGame();
  } catch (error) {
    showDataError(error);
  }

  function prepareGame() {
    validateBaseData();

    state.rows = data.grid.length;
    state.cols = data.grid[0].length;
    state.words = data.words.map((word, index) => prepareWord(word, index));

    validateExpectedRemainingText();
    fillHeadings();
    buildGrid();
    bindEvents();
    updateProgress();
    setupLogoFallback();
  }

  function validateBaseData() {
    if (!data || typeof data !== "object") {
      throw new Error("לא נמצא הקובץ puzzle-data.js.");
    }

    if (!Array.isArray(data.grid) || data.grid.length === 0) {
      throw new Error("רשת האותיות חסרה או ריקה.");
    }

    const width = Array.isArray(data.grid[0]) ? data.grid[0].length : 0;
    if (!width || !data.grid.every(row => Array.isArray(row) && row.length === width)) {
      throw new Error("כל שורות הרשת חייבות להכיל אותו מספר אותיות.");
    }

    if (!Array.isArray(data.words) || data.words.length === 0) {
      throw new Error("רשימת המילים חסרה או ריקה.");
    }
  }

  function prepareWord(word, index) {
    if (!word || !Array.isArray(word.start) || !Array.isArray(word.end)) {
      throw new Error(`חסרות נקודות התחלה וסיום במילה מספר ${index + 1}.`);
    }

    const start = pointFromArray(word.start);
    const end = pointFromArray(word.end);
    const path = makeExactPath(start, end);
    const answer = normalizeText(word.answer || word.display || "");
    const gridText = normalizeText(path.map(getLetter).join(""));

    if (!answer) {
      throw new Error(`המילה מספר ${index + 1} ריקה.`);
    }

    if (gridText !== answer && reverseText(gridText) !== answer) {
      throw new Error(`המיקום שהוגדר עבור „${word.display || answer}” אינו תואם לאותיות ברשת.`);
    }

    return {
      id: index,
      display: word.display || word.answer,
      answer,
      path,
      pathKey: canonicalPathKey(path)
    };
  }

  function validateExpectedRemainingText() {
    if (!data.expectedRemainingText) return;

    const solutionCells = new Set();
    state.words.forEach(word => {
      word.path.forEach(point => solutionCells.add(cellKey(point)));
    });

    const actual = normalizeText(readRemainingLetters(solutionCells));
    const expected = normalizeText(data.expectedRemainingText);

    if (actual !== expected) {
      throw new Error("האותיות שנותרו אינן תואמות למשפט שהוגדר בקובץ הנתונים.");
    }
  }

  function fillHeadings() {
    elements.title.textContent = data.title || "תפזורת";
    elements.subtitle.textContent = data.subtitle || "";
    elements.instructions.textContent = data.instructions || "";
    elements.successTitle.textContent = data.successTitle || "כל הכבוד!";
    elements.successMessage.textContent = data.successMessage || "סיימתם את התפזורת.";
  }

  function buildGrid() {
    elements.grid.innerHTML = "";
    elements.grid.style.setProperty("--rows", state.rows);
    elements.grid.style.setProperty("--cols", state.cols);
    elements.grid.setAttribute("aria-rowcount", String(state.rows));
    elements.grid.setAttribute("aria-colcount", String(state.cols));

    data.grid.forEach((row, rowIndex) => {
      row.forEach((letter, colIndex) => {
        const cell = document.createElement("div");
        cell.className = "letter-cell";
        cell.textContent = letter;
        cell.dataset.row = String(rowIndex);
        cell.dataset.col = String(colIndex);
        cell.setAttribute("role", "gridcell");
        cell.setAttribute("aria-rowindex", String(rowIndex + 1));
        cell.setAttribute("aria-colindex", String(colIndex + 1));
        cell.setAttribute("aria-label", `שורה ${rowIndex + 1}, עמודה ${colIndex + 1}, ${letter}`);
        elements.grid.appendChild(cell);
        state.cells.push(cell);
      });
    });
  }

  function bindEvents() {
    elements.grid.addEventListener("pointerdown", onPointerDown, { passive: false });
    elements.grid.addEventListener("pointermove", onPointerMove, { passive: false });
    elements.grid.addEventListener("pointerup", onPointerUp, { passive: false });
    elements.grid.addEventListener("pointercancel", cancelSelection, { passive: false });
    elements.grid.addEventListener("lostpointercapture", cancelSelection);
    elements.grid.addEventListener("contextmenu", event => event.preventDefault());
    elements.reset.addEventListener("click", resetGame);
  }

  function onPointerDown(event) {
    if (state.completed) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const cell = cellFromEvent(event);
    if (!cell) return;

    event.preventDefault();
    clearStatusSoon(0);

    state.pointerId = event.pointerId;
    state.start = pointFromCell(cell);
    state.path = [state.start];

    elements.grid.setPointerCapture?.(event.pointerId);
    paintSelection();
  }

  function onPointerMove(event) {
    if (state.pointerId === null || event.pointerId !== state.pointerId) return;
    event.preventDefault();

    const cell = cellFromCoordinates(event.clientX, event.clientY);
    if (!cell) return;

    const end = pointFromCell(cell);
    state.path = makeSnappedPath(state.start, end);
    paintSelection();
  }

  function onPointerUp(event) {
    if (state.pointerId === null || event.pointerId !== state.pointerId) return;
    event.preventDefault();

    const cell = cellFromCoordinates(event.clientX, event.clientY);
    if (cell) {
      state.path = makeSnappedPath(state.start, pointFromCell(cell));
    }

    evaluateSelection();
    endPointerSession();
  }

  function cancelSelection(event) {
    if (state.pointerId === null) return;
    if (event?.pointerId !== undefined && event.pointerId !== state.pointerId) return;
    clearSelectionPaint();
    endPointerSession();
  }

  function evaluateSelection() {
    if (state.path.length < 2) {
      clearSelectionPaint();
      return;
    }

    const selectedKey = canonicalPathKey(state.path);
    const match = state.words.find(word =>
      !state.foundWordIds.has(word.id) && word.pathKey === selectedKey
    );

    if (match) {
      acceptWord(match);
    } else {
      rejectSelection();
    }
  }

  function acceptWord(word) {
    state.foundWordIds.add(word.id);

    word.path.forEach(point => {
      state.foundCellKeys.add(cellKey(point));
      getCell(point).classList.add("is-found");
    });

    showStatus(`נכון! מצאתם את ${word.display}`, "success");
    updateProgress();

    if (state.foundWordIds.size === state.words.length) {
      completeGame();
    }
  }

  function rejectSelection() {
    const selectedCells = state.path.map(getCell);
    selectedCells.forEach(cell => cell.classList.add("is-wrong"));
    showStatus("זו אינה אחת המדינות. נסו שוב.", "error");

    window.setTimeout(() => {
      selectedCells.forEach(cell => cell.classList.remove("is-wrong"));
    }, 420);
  }

  function completeGame() {
    state.completed = true;
    clearSelectionPaint();

    state.cells.forEach((cell, index) => {
      const point = { row: Math.floor(index / state.cols), col: index % state.cols };
      if (state.foundCellKeys.has(cellKey(point))) {
        cell.classList.add("is-complete-found");
      } else {
        cell.classList.add("is-remaining");
      }
    });

    elements.successPanel.classList.remove("hidden");
    elements.successPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function resetGame() {
    state.foundWordIds.clear();
    state.foundCellKeys.clear();
    state.completed = false;
    state.pointerId = null;
    state.start = null;
    state.path = [];

    clearStatusSoon(0);
    elements.successPanel.classList.add("hidden");

    state.cells.forEach(cell => {
      cell.classList.remove(
        "is-selecting",
        "is-found",
        "is-wrong",
        "is-complete-found",
        "is-remaining"
      );
    });

    updateProgress();
  }

  function makeExactPath(start, end) {
    assertPointInsideGrid(start);
    assertPointInsideGrid(end);

    const rowDelta = end.row - start.row;
    const colDelta = end.col - start.col;
    const rowStep = Math.sign(rowDelta);
    const colStep = Math.sign(colDelta);

    const isStraight = rowDelta === 0 || colDelta === 0 || Math.abs(rowDelta) === Math.abs(colDelta);
    if (!isStraight) {
      throw new Error("כל מילה חייבת להופיע בקו ישר: אופקי, אנכי או אלכסוני.");
    }

    const steps = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
    return Array.from({ length: steps + 1 }, (_, index) => ({
      row: start.row + rowStep * index,
      col: start.col + colStep * index
    }));
  }

  function makeSnappedPath(start, hovered) {
    const rowDelta = hovered.row - start.row;
    const colDelta = hovered.col - start.col;

    if (rowDelta === 0 && colDelta === 0) return [start];

    const directions = [
      { dr: 0, dc: 1 },
      { dr: 1, dc: 1 },
      { dr: 1, dc: 0 },
      { dr: 1, dc: -1 },
      { dr: 0, dc: -1 },
      { dr: -1, dc: -1 },
      { dr: -1, dc: 0 },
      { dr: -1, dc: 1 }
    ];

    const angle = Math.atan2(rowDelta, colDelta);
    let bestDirection = directions[0];
    let smallestDifference = Infinity;

    directions.forEach(direction => {
      const directionAngle = Math.atan2(direction.dr, direction.dc);
      let difference = Math.abs(angle - directionAngle);
      difference = Math.min(difference, Math.PI * 2 - difference);

      if (difference < smallestDifference) {
        smallestDifference = difference;
        bestDirection = direction;
      }
    });

    const distance = Math.max(Math.abs(rowDelta), Math.abs(colDelta));
    const maxDistance = maximumDistance(start, bestDirection);
    const steps = Math.min(distance, maxDistance);

    return Array.from({ length: steps + 1 }, (_, index) => ({
      row: start.row + bestDirection.dr * index,
      col: start.col + bestDirection.dc * index
    }));
  }

  function maximumDistance(start, direction) {
    let distance = 0;
    let row = start.row + direction.dr;
    let col = start.col + direction.dc;

    while (isInsideGrid({ row, col })) {
      distance += 1;
      row += direction.dr;
      col += direction.dc;
    }

    return distance;
  }

  function paintSelection() {
    clearSelectionPaint();
    state.path.forEach(point => getCell(point).classList.add("is-selecting"));
  }

  function clearSelectionPaint() {
    state.cells.forEach(cell => cell.classList.remove("is-selecting"));
  }

  function endPointerSession() {
    if (state.pointerId !== null && elements.grid.hasPointerCapture?.(state.pointerId)) {
      elements.grid.releasePointerCapture?.(state.pointerId);
    }
    state.pointerId = null;
    state.start = null;
    state.path = [];
  }

  function updateProgress() {
    const noun = data.progressNoun || "מדינות";
    elements.progress.textContent = `נמצאו ${state.foundWordIds.size} מתוך ${state.words.length} ${noun}`;
  }

  function showStatus(message, type) {
    window.clearTimeout(state.statusTimer);
    elements.status.textContent = message;
    elements.status.className = `status-text ${type === "success" ? "message-success" : "message-error"}`;
    state.statusTimer = window.setTimeout(() => clearStatusSoon(0), 1800);
  }

  function clearStatusSoon(delay) {
    window.clearTimeout(state.statusTimer);
    state.statusTimer = window.setTimeout(() => {
      elements.status.textContent = "";
      elements.status.className = "status-text";
    }, delay);
  }

  function readRemainingLetters(solutionCells) {
    const letters = [];
    const order = data.remainingReadingOrder || "rtl-top-down";

    for (let row = 0; row < state.rows; row += 1) {
      if (order === "ltr-top-down") {
        for (let col = 0; col < state.cols; col += 1) pushIfRemaining(row, col);
      } else {
        for (let col = state.cols - 1; col >= 0; col -= 1) pushIfRemaining(row, col);
      }
    }

    return letters.join("");

    function pushIfRemaining(row, col) {
      const point = { row, col };
      if (!solutionCells.has(cellKey(point))) letters.push(getLetter(point));
    }
  }

  function canonicalPathKey(path) {
    const forward = path.map(cellKey).join("|");
    const backward = [...path].reverse().map(cellKey).join("|");
    return forward < backward ? forward : backward;
  }

  function normalizeText(value) {
    return String(value)
      .trim()
      .replace(/[\s\-–—]/g, "")
      .replace(/["׳״']/g, "")
      .replace(/ך/g, "כ")
      .replace(/ם/g, "מ")
      .replace(/ן/g, "נ")
      .replace(/ף/g, "פ")
      .replace(/ץ/g, "צ");
  }

  function reverseText(value) {
    return Array.from(value).reverse().join("");
  }

  function pointFromArray(value) {
    return { row: Number(value[0]), col: Number(value[1]) };
  }

  function pointFromCell(cell) {
    return { row: Number(cell.dataset.row), col: Number(cell.dataset.col) };
  }

  function cellFromEvent(event) {
    const target = event.target.closest?.(".letter-cell");
    return target && elements.grid.contains(target) ? target : null;
  }

  function cellFromCoordinates(x, y) {
    const target = document.elementFromPoint(x, y)?.closest?.(".letter-cell");
    return target && elements.grid.contains(target) ? target : null;
  }

  function getLetter(point) {
    return data.grid[point.row][point.col];
  }

  function getCell(point) {
    return state.cells[point.row * state.cols + point.col];
  }

  function cellKey(point) {
    return `${point.row}:${point.col}`;
  }

  function assertPointInsideGrid(point) {
    if (!isInsideGrid(point)) {
      throw new Error("אחת מנקודות ההתחלה או הסיום נמצאת מחוץ לרשת.");
    }
  }

  function isInsideGrid(point) {
    return Number.isInteger(point.row) && Number.isInteger(point.col) &&
      point.row >= 0 && point.row < state.rows &&
      point.col >= 0 && point.col < state.cols;
  }

  function showDataError(error) {
    console.error(error);
    elements.grid?.classList.add("hidden");
    elements.reset?.classList.add("hidden");
    elements.progress.textContent = "";
    elements.errorMessage.textContent = error instanceof Error ? error.message : "שגיאה לא ידועה.";
    elements.errorPanel.classList.remove("hidden");
  }

  function setupLogoFallback() {
    const logo = document.getElementById("brandLogo");
    if (!logo) return;

    const fallbacks = (logo.dataset.fallbacks || "")
      .split(",")
      .map(value => value.trim())
      .filter(Boolean);

    let index = 0;
    logo.addEventListener("error", () => {
      if (index < fallbacks.length) {
        logo.src = fallbacks[index];
        index += 1;
      } else {
        logo.style.visibility = "hidden";
      }
    });
  }
})();
