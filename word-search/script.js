(() => {
  "use strict";

  const data = window.PUZZLE_DATA;

  const ui = {
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
    dataError: document.getElementById("dataError"),
    dataErrorText: document.getElementById("dataErrorText")
  };

  const state = {
    rows: 0,
    cols: 0,
    cells: [],
    words: [],
    foundIds: new Set(),
    foundCellUsage: new Map(),
    pointerId: null,
    start: null,
    path: [],
    completed: false,
    statusTimer: null
  };

  const directions = [
    { dr:-1, dc:-1 }, { dr:-1, dc:0 }, { dr:-1, dc:1 },
    { dr:0,  dc:-1 },                    { dr:0,  dc:1 },
    { dr:1,  dc:-1 }, { dr:1,  dc:0 },  { dr:1,  dc:1 }
  ];

  try {
    initialise();
  } catch (error) {
    showDataError(error);
  }

  function initialise() {
    validateData();

    state.rows = data.grid.length;
    state.cols = data.grid[0].length;
    state.words = data.words.map((entry, index) => prepareWord(entry, index));

    validateRemainingText();
    fillText();
    buildGrid();
    bindEvents();
    updateProgress();
  }

  function validateData() {
    if (!data || typeof data !== "object") {
      throw new Error("לא נמצא קובץ הנתונים puzzle-data.js.");
    }

    if (!Array.isArray(data.grid) || data.grid.length === 0) {
      throw new Error("רשת האותיות חסרה או ריקה.");
    }

    const width = Array.isArray(data.grid[0]) ? data.grid[0].length : 0;

    if (!width || !data.grid.every(row =>
      Array.isArray(row) &&
      row.length === width &&
      row.every(letter => String(letter).trim() !== "")
    )) {
      throw new Error("כל שורות הרשת חייבות להכיל אותו מספר אותיות, ללא תאים ריקים.");
    }

    if (!Array.isArray(data.words) || data.words.length === 0) {
      throw new Error("רשימת המילים חסרה או ריקה.");
    }
  }

  function prepareWord(entry, index) {
    const item = typeof entry === "string"
      ? { display:entry, answer:entry }
      : { ...entry };

    const display = item.display || item.answer;
    const answer = normalize(item.answer || item.display || "");

    if (!display || !answer) {
      throw new Error(`המילה מספר ${index + 1} ריקה.`);
    }

    let path;

    if (item.placement?.start && item.placement?.end) {
      path = exactPath(
        arrayToPoint(item.placement.start),
        arrayToPoint(item.placement.end)
      );

      const letters = normalize(path.map(getLetter).join(""));
      if (letters !== answer && reverse(letters) !== answer) {
        throw new Error(`המיקום שהוגדר עבור „${display}” אינו תואם לרשת.`);
      }
    } else {
      const matches = findWord(answer);

      if (matches.length === 0) {
        throw new Error(`לא מצאתי ברשת את „${display}”.`);
      }

      if (matches.length > 1) {
        throw new Error(
          `„${display}” מופיעה ברשת יותר מפעם אחת. יש להוסיף לה placement בקובץ הנתונים.`
        );
      }

      path = matches[0];
    }

    return {
      id:index,
      display:String(display),
      answer,
      path,
      pathKey:canonicalPathKey(path)
    };
  }

  function findWord(answer) {
    const matches = [];

    for (let row = 0; row < state.rows; row += 1) {
      for (let col = 0; col < state.cols; col += 1) {
        directions.forEach(direction => {
          const path = [];
          let text = "";

          for (let step = 0; step < answer.length; step += 1) {
            const point = {
              row:row + direction.dr * step,
              col:col + direction.dc * step
            };

            if (!inside(point)) return;

            path.push(point);
            text += normalize(getLetter(point));
          }

          if (text === answer) matches.push(path);
        });
      }
    }

    return matches;
  }

  function validateRemainingText() {
    if (!data.expectedRemainingText) return;

    const used = new Set();
    state.words.forEach(word =>
      word.path.forEach(point => used.add(cellKey(point)))
    );

    const actual = normalize(readRemainingLetters(used));
    const expected = normalize(data.expectedRemainingText);

    if (actual !== expected) {
      throw new Error(
        "האותיות שנותרו אינן תואמות למשפט שהוגדר בקובץ הנתונים."
      );
    }
  }

  function fillText() {
    ui.title.textContent = data.title || "תפזורת";
    ui.subtitle.textContent = data.subtitle || "";
    ui.instructions.textContent = data.instructions || "";
    ui.successTitle.textContent = data.successTitle || "כל הכבוד!";
    ui.successMessage.textContent =
      data.successMessage || "סיימתם את התפזורת.";
    document.title = `${data.title || "תפזורת"} | בשביל החוויה`;
  }

  function buildGrid() {
    ui.grid.innerHTML = "";
    state.cells = [];

    ui.grid.style.setProperty("--rows", state.rows);
    ui.grid.style.setProperty("--cols", state.cols);
    ui.grid.setAttribute("aria-rowcount", String(state.rows));
    ui.grid.setAttribute("aria-colcount", String(state.cols));

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
        cell.setAttribute(
          "aria-label",
          `שורה ${rowIndex + 1}, עמודה ${colIndex + 1}, ${letter}`
        );

        ui.grid.appendChild(cell);
        state.cells.push(cell);
      });
    });
  }

  function bindEvents() {
    ui.grid.addEventListener("pointerdown", pointerDown, { passive:false });
    ui.grid.addEventListener("pointermove", pointerMove, { passive:false });
    ui.grid.addEventListener("pointerup", pointerUp, { passive:false });
    ui.grid.addEventListener("pointercancel", cancelSelection, { passive:false });
    ui.grid.addEventListener("lostpointercapture", lostCapture);
    ui.grid.addEventListener("contextmenu", event => event.preventDefault());
    ui.reset.addEventListener("click", resetGame);
  }

  function pointerDown(event) {
    if (state.completed) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;

    const cell = event.target.closest?.(".letter-cell");
    if (!cell || !ui.grid.contains(cell)) return;

    event.preventDefault();
    clearStatus();

    state.pointerId = event.pointerId;
    state.start = pointFromCell(cell);
    state.path = [state.start];

    ui.grid.setPointerCapture?.(event.pointerId);
    paintPath();
  }

  function pointerMove(event) {
    if (event.pointerId !== state.pointerId || !state.start) return;

    event.preventDefault();

    const cell = cellAt(event.clientX, event.clientY);
    if (!cell) return;

    state.path = snappedPath(state.start, pointFromCell(cell));
    paintPath();
  }

  function pointerUp(event) {
    if (event.pointerId !== state.pointerId || !state.start) return;

    event.preventDefault();

    const cell = cellAt(event.clientX, event.clientY);
    if (cell) {
      state.path = snappedPath(state.start, pointFromCell(cell));
    }

    evaluatePath();
    finishPointer();
  }

  function cancelSelection(event) {
    if (state.pointerId === null) return;
    if (event?.pointerId !== undefined && event.pointerId !== state.pointerId) return;

    clearPathPaint();
    finishPointer();
  }

  function lostCapture(event) {
    if (event.pointerId !== state.pointerId) return;
    if (state.path.length > 1) evaluatePath();
    else clearPathPaint();
    finishPointer(false);
  }

  function evaluatePath() {
    if (state.path.length < 2) {
      clearPathPaint();
      return;
    }

    const selectedKey = canonicalPathKey(state.path);
    const word = state.words.find(item => item.pathKey === selectedKey);

    if (!word) {
      rejectPath();
      return;
    }

    if (state.foundIds.has(word.id)) {
      clearPathPaint();
      showStatus(
        data.feedback?.alreadyFound || "את המילה הזאת כבר מצאתם.",
        "error"
      );
      return;
    }

    acceptWord(word);
  }

  function acceptWord(word) {
    clearPathPaint();
    state.foundIds.add(word.id);

    word.path.forEach(point => {
      const key = cellKey(point);
      const useCount = (state.foundCellUsage.get(key) || 0) + 1;
      state.foundCellUsage.set(key, useCount);
      getCell(point).classList.add("is-found");
    });

    const template =
      data.feedback?.correct || "נכון! מצאתם את {word}";

    showStatus(template.replace("{word}", word.display), "success");
    updateProgress();

    if (state.foundIds.size === state.words.length) {
      completeGame();
    }
  }

  function rejectPath() {
    const selectedCells = state.path.map(getCell);

    clearPathPaint();
    selectedCells.forEach(cell => cell.classList.add("is-wrong"));

    showStatus(
      data.feedback?.wrong || "זו אינה אחת המילים. נסו שוב.",
      "error"
    );

    window.setTimeout(() => {
      selectedCells.forEach(cell => cell.classList.remove("is-wrong"));
    }, 430);
  }

  function completeGame() {
    state.completed = true;
    clearPathPaint();

    state.cells.forEach((cell, index) => {
      const point = {
        row:Math.floor(index / state.cols),
        col:index % state.cols
      };

      if (state.foundCellUsage.has(cellKey(point))) {
        cell.classList.add("is-complete-found");
      } else {
        cell.classList.add("is-remaining");
      }
    });

    ui.status.textContent = "";
    ui.status.className = "status-text";
    ui.successPanel.classList.remove("hidden");

    window.setTimeout(() => {
      ui.successPanel.scrollIntoView({
        behavior:"smooth",
        block:"nearest"
      });
    }, 60);
  }

  function resetGame() {
    window.clearTimeout(state.statusTimer);

    state.foundIds.clear();
    state.foundCellUsage.clear();
    state.pointerId = null;
    state.start = null;
    state.path = [];
    state.completed = false;

    ui.successPanel.classList.add("hidden");
    clearStatus();

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

  function snappedPath(start, hovered) {
    const rowDelta = hovered.row - start.row;
    const colDelta = hovered.col - start.col;

    if (rowDelta === 0 && colDelta === 0) return [start];

    const angle = Math.atan2(rowDelta, colDelta);
    let chosen = directions[0];
    let smallest = Infinity;

    directions.forEach(direction => {
      const directionAngle = Math.atan2(direction.dr, direction.dc);
      let difference = Math.abs(angle - directionAngle);
      difference = Math.min(difference, Math.PI * 2 - difference);

      if (difference < smallest) {
        smallest = difference;
        chosen = direction;
      }
    });

    const rawDistance = Math.max(
      Math.abs(rowDelta),
      Math.abs(colDelta)
    );

    const steps = Math.min(
      rawDistance,
      maximumSteps(start, chosen)
    );

    return Array.from({ length:steps + 1 }, (_, index) => ({
      row:start.row + chosen.dr * index,
      col:start.col + chosen.dc * index
    }));
  }

  function maximumSteps(start, direction) {
    let steps = 0;
    let point = {
      row:start.row + direction.dr,
      col:start.col + direction.dc
    };

    while (inside(point)) {
      steps += 1;
      point = {
        row:point.row + direction.dr,
        col:point.col + direction.dc
      };
    }

    return steps;
  }

  function exactPath(start, end) {
    assertInside(start);
    assertInside(end);

    const rowDelta = end.row - start.row;
    const colDelta = end.col - start.col;
    const straight =
      rowDelta === 0 ||
      colDelta === 0 ||
      Math.abs(rowDelta) === Math.abs(colDelta);

    if (!straight) {
      throw new Error("מיקום של מילה חייב להיות בקו ישר.");
    }

    const dr = Math.sign(rowDelta);
    const dc = Math.sign(colDelta);
    const steps = Math.max(Math.abs(rowDelta), Math.abs(colDelta));

    return Array.from({ length:steps + 1 }, (_, index) => ({
      row:start.row + dr * index,
      col:start.col + dc * index
    }));
  }

  function paintPath() {
    clearPathPaint();
    state.path.forEach(point =>
      getCell(point).classList.add("is-selecting")
    );
  }

  function clearPathPaint() {
    state.cells.forEach(cell =>
      cell.classList.remove("is-selecting")
    );
  }

  function finishPointer(releaseCapture = true) {
    if (
      releaseCapture &&
      state.pointerId !== null &&
      ui.grid.hasPointerCapture?.(state.pointerId)
    ) {
      ui.grid.releasePointerCapture?.(state.pointerId);
    }

    state.pointerId = null;
    state.start = null;
    state.path = [];
  }

  function updateProgress() {
    const noun = data.progressNoun || "מילים";
    ui.progress.textContent =
      `נמצאו ${state.foundIds.size} מתוך ${state.words.length} ${noun}`;
  }

  function showStatus(message, type) {
    window.clearTimeout(state.statusTimer);

    ui.status.textContent = message;
    ui.status.className =
      `status-text ${type === "success" ? "message-success" : "message-error"}`;

    state.statusTimer = window.setTimeout(clearStatus, 1800);
  }

  function clearStatus() {
    window.clearTimeout(state.statusTimer);
    ui.status.textContent = "";
    ui.status.className = "status-text";
  }

  function readRemainingLetters(usedCells) {
    const letters = [];
    const order = data.remainingReadingOrder || "rtl-top-down";

    for (let row = 0; row < state.rows; row += 1) {
      if (order === "ltr-top-down") {
        for (let col = 0; col < state.cols; col += 1) {
          appendIfRemaining(row, col);
        }
      } else {
        for (let col = state.cols - 1; col >= 0; col -= 1) {
          appendIfRemaining(row, col);
        }
      }
    }

    return letters.join("");

    function appendIfRemaining(row, col) {
      const point = { row, col };
      if (!usedCells.has(cellKey(point))) {
        letters.push(getLetter(point));
      }
    }
  }

  function canonicalPathKey(path) {
    const forward = path.map(cellKey).join("|");
    const backward = [...path].reverse().map(cellKey).join("|");
    return forward < backward ? forward : backward;
  }

  function normalize(value) {
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

  function reverse(value) {
    return Array.from(value).reverse().join("");
  }

  function arrayToPoint(value) {
    return { row:Number(value[0]), col:Number(value[1]) };
  }

  function pointFromCell(cell) {
    return {
      row:Number(cell.dataset.row),
      col:Number(cell.dataset.col)
    };
  }

  function cellAt(x, y) {
    const element = document.elementFromPoint(x, y);
    const cell = element?.closest?.(".letter-cell");
    return cell && ui.grid.contains(cell) ? cell : null;
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

  function inside(point) {
    return (
      Number.isInteger(point.row) &&
      Number.isInteger(point.col) &&
      point.row >= 0 &&
      point.row < state.rows &&
      point.col >= 0 &&
      point.col < state.cols
    );
  }

  function assertInside(point) {
    if (!inside(point)) {
      throw new Error("מיקום של מילה נמצא מחוץ לרשת.");
    }
  }

  function showDataError(error) {
    console.error(error);

    ui.grid?.classList.add("hidden");
    ui.reset?.classList.add("hidden");
    ui.progress.textContent = "";
    ui.status.textContent = "";
    ui.dataErrorText.textContent =
      error instanceof Error ? error.message : "שגיאה לא ידועה.";
    ui.dataError.classList.remove("hidden");
  }
})();
