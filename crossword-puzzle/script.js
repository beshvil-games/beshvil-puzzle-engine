(() => {
  "use strict";

  const puzzle = window.CROSSWORD_PUZZLE;
  const grid = document.getElementById("crosswordGrid");
  const cluesList = document.getElementById("cluesList");
  const checkButton = document.getElementById("checkButton");
  const clearButton = document.getElementById("clearButton");
  const message = document.getElementById("message");
  const successPanel = document.getElementById("successPanel");

  const mobileClueCard = document.getElementById("mobileClueCard");
  const mobileCluePosition = document.getElementById("mobileCluePosition");
  const prevClueButton = document.getElementById("prevClueButton");
  const nextClueButton = document.getElementById("nextClueButton");

  if (!puzzle || !Array.isArray(puzzle.entries) || !puzzle.entries.length) {
    showMessage("קובץ נתוני התשבץ לא נטען.", "error");
    return;
  }

  document.getElementById("gameTitle").textContent = puzzle.title;
  document.getElementById("instructions").innerHTML =
    puzzle.instructions.map(line => `<div>${escapeHtml(line)}</div>`).join("");

  const rowCount = Math.max(...puzzle.entries.map(entry => entry.row)) + 1;
  const entryByNumber = new Map(puzzle.entries.map(entry => [entry.number, entry]));
  const cellMap = new Map();

  let activeEntryNumber = puzzle.entries[0].number;
  let activeEntryIndex = 0;
  let replaceMode = false;

  grid.style.gridTemplateColumns = `repeat(${puzzle.columns}, var(--cell-size))`;
  grid.style.gridTemplateRows = `repeat(${rowCount}, var(--cell-size))`;

  renderGrid();
  renderClues();
  resizeBoard();
  activateEntry(activeEntryNumber, false);

  window.addEventListener("resize", resizeBoard);
  window.addEventListener("orientationchange", () => setTimeout(resizeBoard, 140));
  window.visualViewport?.addEventListener("resize", handleViewportResize);

  function renderGrid() {
    const occupied = new Map();

    puzzle.entries.forEach(entry => {
      [...entry.answer].forEach((letter, index) => {
        occupied.set(`${entry.row}-${entry.start + index}`, {entry, index});
      });
    });

    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < puzzle.columns; col += 1) {
        const info = occupied.get(`${row}-${col}`);

        if (!info) {
          const blank = document.createElement("div");
          blank.className = "crossword-blank";
          blank.setAttribute("aria-hidden", "true");
          grid.appendChild(blank);
          continue;
        }

        const wrapper = document.createElement("label");
        wrapper.className = "crossword-cell";
        wrapper.dataset.entry = info.entry.number;
        wrapper.dataset.index = info.index;

        if (col === puzzle.highlightColumn) wrapper.classList.add("highlighted");

        if (info.index === 0) {
          const number = document.createElement("span");
          number.className = "cell-number";
          number.textContent = info.entry.number;
          wrapper.appendChild(number);
        }

        const input = document.createElement("input");
        input.type = "text";
        input.inputMode = "text";
        input.autocomplete = "off";
        input.autocapitalize = "off";
        input.spellcheck = false;
        input.maxLength = info.entry.answer.length;
        input.setAttribute("aria-label", `תשובה ${info.entry.number}, אות ${info.index + 1}`);

        input.addEventListener("focus", () => {
          activeEntryIndex = puzzle.entries.findIndex(item => item.number === info.entry.number);
          activateEntry(info.entry.number, false);
          replaceMode = Boolean(input.value);
          keepFocusedCellVisible(wrapper);
        });

        input.addEventListener("pointerdown", () => {
          replaceMode = Boolean(input.value);
        });

        input.addEventListener("input", event => handleInput(event, info.entry, info.index));
        input.addEventListener("keydown", event => handleKeydown(event, info.entry, info.index));
        input.addEventListener("paste", event => handlePaste(event, info.entry, info.index));

        wrapper.appendChild(input);
        grid.appendChild(wrapper);
        cellMap.set(`${info.entry.number}-${info.index}`, {wrapper, input});
      }
    }
  }

  function renderClues() {
    puzzle.entries.forEach((entry, position) => {
      const item = document.createElement("li");
      item.className = "clue-item";
      item.dataset.number = entry.number;
      item.tabIndex = 0;
      item.setAttribute("role", "button");

      const number = document.createElement("span");
      number.className = "clue-number";
      number.textContent = entry.number;

      const text = document.createElement("span");
      text.className = "clue-text";
      text.textContent = entry.clue;

      item.append(number, text);

      const choose = () => {
        activeEntryIndex = position;
        activateEntry(entry.number, true);
      };

      item.addEventListener("click", choose);
      item.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          choose();
        }
      });

      cluesList.appendChild(item);
    });

    prevClueButton?.addEventListener("click", () => moveClue(-1));
    nextClueButton?.addEventListener("click", () => moveClue(1));
    mobileClueCard?.addEventListener("click", () => activateEntry(activeEntryNumber, true));
    updateMobileClue();
  }

  function moveClue(direction) {
    activeEntryIndex =
      (activeEntryIndex + direction + puzzle.entries.length) % puzzle.entries.length;

    const entry = puzzle.entries[activeEntryIndex];
    activateEntry(entry.number, true);
  }

  function updateMobileClue() {
    const entry = puzzle.entries[activeEntryIndex];
    if (!entry || !mobileClueCard || !mobileCluePosition) return;

    mobileCluePosition.textContent = `${activeEntryIndex + 1} מתוך ${puzzle.entries.length}`;
    mobileClueCard.textContent = `${entry.number}. ${entry.clue}`;
  }

  function resizeBoard() {
    const frame = document.querySelector(".board-frame");
    if (!frame) return;

    const landscapePhone =
      window.matchMedia("(orientation: landscape) and (max-height: 620px)").matches;

    const availableWidth = landscapePhone
      ? Math.max(250, frame.clientWidth - 4)
      : Math.max(250, frame.clientWidth - 14);

    const availableHeight = landscapePhone
      ? Math.max(170, (window.visualViewport?.height || window.innerHeight) - 32)
      : 620;

    const byWidth = Math.floor(availableWidth / puzzle.columns);
    const byHeight = Math.floor(availableHeight / rowCount);
    const maxSize = landscapePhone ? 34 : 44;
    const minSize = landscapePhone ? 22 : 24;
    const cellSize = Math.max(minSize, Math.min(maxSize, byWidth, byHeight));

    grid.style.setProperty("--cell-size", `${cellSize}px`);
  }

  function handleViewportResize() {
    resizeBoard();

    const focused = document.activeElement;
    if (focused?.matches(".crossword-cell input")) {
      const wrapper = focused.closest(".crossword-cell");
      setTimeout(() => keepFocusedCellVisible(wrapper), 80);
    }
  }

  function activateEntry(number, focusFirstEmpty) {
    activeEntryNumber = number;
    activeEntryIndex = puzzle.entries.findIndex(entry => entry.number === number);

    document.querySelectorAll(".crossword-cell").forEach(cell => {
      cell.classList.toggle("active-entry", Number(cell.dataset.entry) === number);
    });

    document.querySelectorAll(".clue-item").forEach(item => {
      item.classList.toggle("active", Number(item.dataset.number) === number);
    });

    updateMobileClue();

    if (!focusFirstEmpty) return;

    const entry = entryByNumber.get(number);
    let targetIndex = 0;

    for (let index = 0; index < entry.answer.length; index += 1) {
      const cell = getCell(number, index);
      if (cell && !cell.input.value) {
        targetIndex = index;
        break;
      }
    }

    focusCell(number, targetIndex, true);
  }

  function handleInput(event, entry, index) {
    const input = event.target;
    const letters = normalizeLetters(input.value);
    clearEntryFeedback(entry.number);

    if (!letters) {
      input.value = "";
      replaceMode = false;
      return;
    }

    if (replaceMode) {
      input.value = letters.at(-1);
      replaceMode = false;
      return;
    }

    fillFrom(entry, index, letters);
  }

  function handlePaste(event, entry, index) {
    const letters = normalizeLetters(event.clipboardData?.getData("text") || "");
    if (!letters) return;

    event.preventDefault();
    clearEntryFeedback(entry.number);
    replaceMode = false;
    fillFrom(entry, index, letters);
  }

  function fillFrom(entry, startIndex, letters) {
    let lastIndex = startIndex;

    [...letters].forEach((letter, offset) => {
      const index = startIndex + offset;
      if (index >= entry.answer.length) return;

      const cell = getCell(entry.number, index);
      if (cell) {
        cell.input.value = letter;
        lastIndex = index;
      }
    });

    if (lastIndex < entry.answer.length - 1) {
      focusCell(entry.number, lastIndex + 1, false);
    } else {
      focusCell(entry.number, lastIndex, false);
    }
  }

  function handleKeydown(event, entry, index) {
    const current = getCell(entry.number, index);

    if (event.key === "Backspace") {
      clearEntryFeedback(entry.number);

      if (current.input.value) {
        current.input.value = "";
        replaceMode = false;
      } else if (index > 0) {
        event.preventDefault();
        const previous = getCell(entry.number, index - 1);
        previous.input.value = "";
        previous.input.focus();
        replaceMode = false;
      }
      return;
    }

    if (event.key === "Delete") {
      current.input.value = "";
      clearEntryFeedback(entry.number);
      replaceMode = false;
      return;
    }

    if (event.key === "ArrowLeft" && index < entry.answer.length - 1) {
      event.preventDefault();
      focusCell(entry.number, index + 1, false);
    }

    if (event.key === "ArrowRight" && index > 0) {
      event.preventDefault();
      focusCell(entry.number, index - 1, false);
    }

    if (event.key === "Home") {
      event.preventDefault();
      focusCell(entry.number, 0, false);
    }

    if (event.key === "End") {
      event.preventDefault();
      focusCell(entry.number, entry.answer.length - 1, false);
    }

    if (event.key === "Enter") {
      event.preventDefault();
      moveClue(1);
    }
  }

  function focusCell(number, index, scroll) {
    const cell = getCell(number, index);
    if (!cell) return;

    replaceMode = Boolean(cell.input.value);
    cell.input.focus({preventScroll:true});

    if (scroll) keepFocusedCellVisible(cell.wrapper);
  }

  function keepFocusedCellVisible(wrapper) {
    if (!wrapper) return;

    const landscapePhone =
      window.matchMedia("(orientation: landscape) and (max-height: 620px)").matches;

    wrapper.scrollIntoView({
      behavior:"smooth",
      block:landscapePhone ? "center" : "nearest",
      inline:"nearest"
    });
  }

  function getCell(number, index) {
    return cellMap.get(`${number}-${index}`);
  }

  function getTypedAnswer(entry) {
    return [...entry.answer]
      .map((_, index) => getCell(entry.number, index)?.input.value || "")
      .join("");
  }

  function checkAnswers() {
    let correctCount = 0;
    let incompleteCount = 0;
    let wrongCount = 0;

    puzzle.entries.forEach(entry => {
      const typed = getTypedAnswer(entry);
      const isComplete = typed.length === entry.answer.length;
      const isCorrect = isComplete &&
        normalizeFinalLetters(typed) === normalizeFinalLetters(entry.answer);

      if (isCorrect) {
        correctCount += 1;
        setEntryFeedback(entry.number, "correct");
      } else if (!isComplete) {
        incompleteCount += 1;
        setEntryFeedback(entry.number, "");
      } else {
        wrongCount += 1;
        setEntryFeedback(entry.number, "incorrect");
      }
    });

    if (correctCount === puzzle.entries.length) {
      showMessage("כל התשובות נכונות!", "success");
      successPanel.classList.remove("hidden");
      successPanel.scrollIntoView({behavior:"smooth", block:"nearest"});
      return;
    }

    successPanel.classList.add("hidden");

    if (wrongCount > 0) {
      showMessage(
        `${correctCount} תשובות נכונות. יש ${wrongCount} תשובות שצריך לבדוק שוב.`,
        "error"
      );

      const firstWrong = puzzle.entries.find(entry => {
        const typed = getTypedAnswer(entry);
        return typed.length === entry.answer.length &&
          normalizeFinalLetters(typed) !== normalizeFinalLetters(entry.answer);
      });

      if (firstWrong) {
        activeEntryIndex = puzzle.entries.findIndex(entry => entry.number === firstWrong.number);
        activateEntry(firstWrong.number, false);
      }
    } else {
      showMessage(
        `${correctCount} תשובות נכונות. נשארו ${incompleteCount} תשובות להשלים.`,
        ""
      );
    }
  }

  function setEntryFeedback(number, state) {
    document.querySelectorAll(`.crossword-cell[data-entry="${number}"]`).forEach(cell => {
      cell.classList.remove("correct", "incorrect");
      if (state) cell.classList.add(state);
    });

    const clue = document.querySelector(`.clue-item[data-number="${number}"]`);
    clue?.classList.remove("correct", "incorrect");
    if (state) clue?.classList.add(state);
  }

  function clearEntryFeedback(number) {
    setEntryFeedback(number, "");
    successPanel.classList.add("hidden");
    showMessage("", "");
  }

  function clearPuzzle() {
    const hasContent = [...cellMap.values()].some(cell => cell.input.value);
    if (hasContent && !window.confirm("לנקות את כל התשובות שהוקלדו?")) return;

    cellMap.forEach(({wrapper, input}) => {
      input.value = "";
      wrapper.classList.remove("correct", "incorrect", "active-entry");
    });

    document.querySelectorAll(".clue-item").forEach(item => {
      item.classList.remove("correct", "incorrect", "active");
    });

    activeEntryIndex = 0;
    activeEntryNumber = puzzle.entries[0].number;
    successPanel.classList.add("hidden");
    showMessage("", "");
    activateEntry(activeEntryNumber, false);
  }

  function normalizeLetters(value) {
    return [...String(value).replace(/[^\u0590-\u05FF]/g, "")]
      .map(normalizeSingleFinalLetter)
      .join("");
  }

  function normalizeSingleFinalLetter(letter) {
    return ({"ך":"כ","ם":"מ","ן":"נ","ף":"פ","ץ":"צ"})[letter] || letter;
  }

  function normalizeFinalLetters(value) {
    return [...String(value)].map(normalizeSingleFinalLetter).join("");
  }

  function showMessage(text, type) {
    message.textContent = text;
    message.className = "message";
    if (type === "success") message.classList.add("message-success");
    if (type === "error") message.classList.add("message-error");
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&","&amp;")
      .replaceAll("<","&lt;")
      .replaceAll(">","&gt;")
      .replaceAll('"',"&quot;")
      .replaceAll("'","&#039;");
  }

  checkButton.addEventListener("click", checkAnswers);
  clearButton.addEventListener("click", clearPuzzle);
})();
