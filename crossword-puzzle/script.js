(() => {
  "use strict";

  const puzzle = window.CROSSWORD_PUZZLE;
  const grid = document.getElementById("crosswordGrid");
  const cluesList = document.getElementById("cluesList");
  const checkButton = document.getElementById("checkButton");
  const clearButton = document.getElementById("clearButton");
  const message = document.getElementById("message");
  const successPanel = document.getElementById("successPanel");
  const revealedAnswer = document.getElementById("revealedAnswer");

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
  let activeEntryNumber = null;

  grid.style.gridTemplateColumns = `repeat(${puzzle.columns}, var(--cell-size))`;
  grid.style.gridTemplateRows = `repeat(${rowCount}, var(--cell-size))`;

  renderGrid();
  renderClues();
  resizeBoard();

  window.addEventListener("resize", resizeBoard);
  window.addEventListener("orientationchange", () => setTimeout(resizeBoard, 120));

  function renderGrid() {
    const occupied = new Map();

    puzzle.entries.forEach(entry => {
      [...entry.answer].forEach((letter, index) => {
        occupied.set(`${entry.row}-${entry.start + index}`, {entry, index, letter});
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

        input.addEventListener("focus", () => activateEntry(info.entry.number, false));
        input.addEventListener("click", () => activateEntry(info.entry.number, false));
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
    puzzle.entries.forEach(entry => {
      const item = document.createElement("li");
      item.className = "clue-item";
      item.dataset.number = entry.number;
      item.tabIndex = 0;
      item.setAttribute("role", "button");
      item.setAttribute("aria-label", `הגדרה ${entry.number}: ${entry.clue}`);

      const number = document.createElement("span");
      number.className = "clue-number";
      number.textContent = entry.number;

      const text = document.createElement("span");
      text.className = "clue-text";
      text.textContent = entry.clue;

      item.append(number, text);
      item.addEventListener("click", () => activateEntry(entry.number, true));
      item.addEventListener("keydown", event => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          activateEntry(entry.number, true);
        }
      });

      cluesList.appendChild(item);
    });
  }

  function resizeBoard() {
    const frame = document.querySelector(".board-frame");
    if (!frame) return;

    const availableWidth = Math.max(250, frame.clientWidth - 14);
    const availableHeight = window.matchMedia("(orientation: landscape) and (max-height: 620px)").matches
      ? Math.max(220, window.innerHeight * .67)
      : 620;

    const byWidth = Math.floor(availableWidth / puzzle.columns);
    const byHeight = Math.floor(availableHeight / rowCount);
    const cellSize = Math.max(24, Math.min(44, byWidth, byHeight));

    grid.style.setProperty("--cell-size", `${cellSize}px`);
  }

  function activateEntry(number, focusFirstEmpty) {
    activeEntryNumber = number;

    document.querySelectorAll(".crossword-cell").forEach(cell => {
      cell.classList.toggle("active-entry", Number(cell.dataset.entry) === number);
    });

    document.querySelectorAll(".clue-item").forEach(item => {
      item.classList.toggle("active", Number(item.dataset.number) === number);
    });

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
    const letters = normalizeLetters(event.target.value);
    clearEntryFeedback(entry.number);

    if (!letters) {
      event.target.value = "";
      return;
    }

    fillFrom(entry, index, letters);
  }

  function handlePaste(event, entry, index) {
    const letters = normalizeLetters(event.clipboardData?.getData("text") || "");
    if (!letters) return;

    event.preventDefault();
    clearEntryFeedback(entry.number);
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

    const nextIndex = Math.min(lastIndex + 1, entry.answer.length - 1);
    focusCell(entry.number, nextIndex, false);
  }

  function handleKeydown(event, entry, index) {
    const current = getCell(entry.number, index);

    if (event.key === "Backspace") {
      clearEntryFeedback(entry.number);

      if (current.input.value) {
        current.input.value = "";
      } else if (index > 0) {
        event.preventDefault();
        const previous = getCell(entry.number, index - 1);
        previous.input.value = "";
        previous.input.focus();
      }
      return;
    }

    if (event.key === "Delete") {
      current.input.value = "";
      clearEntryFeedback(entry.number);
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
      const currentPosition = puzzle.entries.findIndex(item => item.number === entry.number);
      const next = puzzle.entries[(currentPosition + 1) % puzzle.entries.length];
      activateEntry(next.number, true);
    }
  }

  function focusCell(number, index, scroll) {
    const cell = getCell(number, index);
    if (!cell) return;

    cell.input.focus({preventScroll:true});

    if (scroll) {
      cell.wrapper.scrollIntoView({
        behavior:"smooth",
        block:"nearest",
        inline:"nearest"
      });
    }
  }

  function getCell(number, index) {
    return cellMap.get(`${number}-${index}`);
  }

  function getTypedAnswer(entry) {
    return [...entry.answer].map((_, index) => getCell(entry.number, index)?.input.value || "").join("");
  }

  function checkAnswers() {
    let correctCount = 0;
    let incompleteCount = 0;
    let wrongCount = 0;

    puzzle.entries.forEach(entry => {
      const typed = getTypedAnswer(entry);
      const isComplete = typed.length === entry.answer.length;
      const isCorrect = isComplete && typed === entry.answer;

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
      const hiddenMessage = puzzle.entries
        .map(entry => entry.answer[entry.highlightIndex] || "")
        .join("");

      showMessage("כל התשובות נכונות!", "success");
      revealedAnswer.textContent = hiddenMessage;
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
      const firstWrong = puzzle.entries.find(entry => getTypedAnswer(entry).length === entry.answer.length && getTypedAnswer(entry) !== entry.answer);
      if (firstWrong) activateEntry(firstWrong.number, false);
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

    activeEntryNumber = null;
    successPanel.classList.add("hidden");
    revealedAnswer.textContent = "";
    showMessage("", "");
  }

  function normalizeLetters(value) {
    return [...String(value).replace(/[^\u0590-\u05FF]/g, "")].join("");
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
