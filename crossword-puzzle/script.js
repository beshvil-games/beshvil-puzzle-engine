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

  if (!puzzle || !Array.isArray(puzzle.entries)) {
    message.textContent = "קובץ נתוני התשבץ לא נטען.";
    message.className = "message message-error";
    return;
  }

  document.getElementById("gameTitle").textContent = puzzle.title;
  document.getElementById("instructions").innerHTML =
    puzzle.instructions.map(line => `<div>${escapeHtml(line)}</div>`).join("");

  const rowCount = Math.max(...puzzle.entries.map(entry => entry.row)) + 1;
  const cellMap = new Map();
  let activeEntryNumber = null;

  grid.style.gridTemplateColumns = `repeat(${puzzle.columns}, var(--cell-size))`;
  grid.style.gridTemplateRows = `repeat(${rowCount}, var(--cell-size))`;

  const entryByNumber = new Map(
    puzzle.entries.map(entry => [entry.number, entry])
  );

  renderGrid();
  renderClues();

  function renderGrid() {
    const occupied = new Map();

    puzzle.entries.forEach(entry => {
      [...entry.answer].forEach((letter, index) => {
        occupied.set(`${entry.row}-${entry.start + index}`, {
          entry,
          index,
          letter
        });
      });
    });

    for (let row = 0; row < rowCount; row += 1) {
      for (let col = 0; col < puzzle.columns; col += 1) {
        const key = `${row}-${col}`;
        const info = occupied.get(key);

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

        if (col === puzzle.highlightColumn) {
          wrapper.classList.add("highlighted");
        }

        if (info.index === info.entry.answer.length - 1) {
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
        input.maxLength = 1;
        input.setAttribute(
          "aria-label",
          `תשובה ${info.entry.number}, אות ${info.index + 1}`
        );

        input.addEventListener("focus", () => activateEntry(info.entry.number, false));
        input.addEventListener("click", () => activateEntry(info.entry.number, false));
        input.addEventListener("input", event => handleInput(event, info.entry, info.index));
        input.addEventListener("keydown", event => handleKeydown(event, info.entry, info.index));

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

      const text = document.createElement("span");
      text.className = "clue-text";
      text.textContent = entry.clue;
      item.appendChild(text);

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

  function activateEntry(number, focusFirstEmpty) {
    activeEntryNumber = number;

    document.querySelectorAll(".crossword-cell").forEach(cell => {
      cell.classList.toggle("active-entry", Number(cell.dataset.entry) === number);
    });

    document.querySelectorAll(".clue-item").forEach(item => {
      item.classList.toggle("active", Number(item.dataset.number) === number);
    });

    if (focusFirstEmpty) {
      const entry = entryByNumber.get(number);
      let targetIndex = 0;

      for (let index = 0; index < entry.answer.length; index += 1) {
        const cell = cellMap.get(`${number}-${index}`);
        if (cell && !cell.input.value) {
          targetIndex = index;
          break;
        }
      }

      cellMap.get(`${number}-${targetIndex}`)?.input.focus({preventScroll:true});
      cellMap.get(`${number}-${targetIndex}`)?.wrapper.scrollIntoView({
        behavior:"smooth",
        block:"nearest",
        inline:"nearest"
      });
    }
  }

  function handleInput(event, entry, index) {
    const input = event.target;
    input.value = normalizeLetter(input.value);

    clearEntryFeedback(entry.number);

    if (input.value && index < entry.answer.length - 1) {
      cellMap.get(`${entry.number}-${index + 1}`)?.input.focus();
    }
  }

  function handleKeydown(event, entry, index) {
    if (event.key === "Backspace") {
      const current = cellMap.get(`${entry.number}-${index}`);
      if (!current.input.value && index > 0) {
        event.preventDefault();
        const previous = cellMap.get(`${entry.number}-${index - 1}`);
        previous.input.value = "";
        previous.input.focus();
      }
      clearEntryFeedback(entry.number);
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      cellMap.get(`${entry.number}-${index - 1}`)?.input.focus();
    }

    if (event.key === "ArrowRight" && index < entry.answer.length - 1) {
      event.preventDefault();
      cellMap.get(`${entry.number}-${index + 1}`)?.input.focus();
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const next = puzzle.entries.find(item => item.number === entry.number + 1);
      if (next) activateEntry(next.number, true);
    }
  }

  function getTypedAnswer(entry) {
    return [...entry.answer].map((_, index) => {
      return cellMap.get(`${entry.number}-${index}`)?.input.value || "";
    }).join("");
  }

  function checkAnswers() {
    let correctCount = 0;
    let emptyCount = 0;

    puzzle.entries.forEach(entry => {
      const typed = getTypedAnswer(entry);
      const isEmpty = typed.length === 0;
      const isCorrect = typed === entry.answer;

      if (isEmpty) emptyCount += 1;
      if (isCorrect) correctCount += 1;

      setEntryFeedback(entry.number, isCorrect ? "correct" : "incorrect");
    });

    if (correctCount === puzzle.entries.length) {
      const hiddenMessage = puzzle.entries.map(entry => {
        return entry.answer[entry.highlightIndex] || "";
      }).join("");

      message.textContent = "כל התשובות נכונות!";
      message.className = "message message-success";
      revealedAnswer.textContent = hiddenMessage;
      successPanel.classList.add("show");
      successPanel.scrollIntoView({behavior:"smooth", block:"nearest"});
      return;
    }

    successPanel.classList.remove("show");
    message.textContent = emptyCount
      ? `יש עוד תשובות להשלים. ${correctCount} מתוך ${puzzle.entries.length} נכונות.`
      : `${correctCount} מתוך ${puzzle.entries.length} תשובות נכונות. נסו שוב.`;
    message.className = "message message-error";

    const firstWrong = puzzle.entries.find(entry => getTypedAnswer(entry) !== entry.answer);
    if (firstWrong) activateEntry(firstWrong.number, false);
  }

  function setEntryFeedback(number, state) {
    document.querySelectorAll(`.crossword-cell[data-entry="${number}"]`)
      .forEach(cell => {
        cell.classList.remove("correct", "incorrect");
        cell.classList.add(state);
      });

    const clue = document.querySelector(`.clue-item[data-number="${number}"]`);
    clue?.classList.remove("correct", "incorrect");
    clue?.classList.add(state);
  }

  function clearEntryFeedback(number) {
    document.querySelectorAll(`.crossword-cell[data-entry="${number}"]`)
      .forEach(cell => cell.classList.remove("correct", "incorrect"));

    const clue = document.querySelector(`.clue-item[data-number="${number}"]`);
    clue?.classList.remove("correct", "incorrect");

    successPanel.classList.remove("show");
    message.textContent = "";
    message.className = "message";
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
    message.textContent = "";
    message.className = "message";
    successPanel.classList.remove("show");
    cellMap.get(`${puzzle.entries[0].number}-0`)?.input.focus();
  }

  function normalizeLetter(value) {
    const lettersOnly = value.replace(/[^\u0590-\u05FF]/g, "");
    return [...lettersOnly].slice(-1)[0] || "";
  }

  function escapeHtml(value) {
    return String(value)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  checkButton.addEventListener("click", checkAnswers);
  clearButton.addEventListener("click", clearPuzzle);

  cellMap.get(`${puzzle.entries[0].number}-0`)?.input.focus();
})();
