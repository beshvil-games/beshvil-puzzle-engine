(() => {
  "use strict";

  const data = window.PUZZLE_DATA;

  const ui = {
    title: document.getElementById("gameTitle"),
    subtitle: document.getElementById("gameSubtitle"),
    instructions: document.getElementById("gameInstructions"),
    body: document.getElementById("questionsBody"),
    check: document.getElementById("checkButton"),
    reset: document.getElementById("resetButton"),
    status: document.getElementById("statusText"),
    successPanel: document.getElementById("successPanel"),
    successTitle: document.getElementById("successTitle"),
    successMessage: document.getElementById("successMessage"),
    dataError: document.getElementById("dataError"),
    dataErrorText: document.getElementById("dataErrorText")
  };

  const finalLetters = {
    "ך": "כ",
    "ם": "מ",
    "ן": "נ",
    "ף": "פ",
    "ץ": "צ"
  };

  try {
    initialise();
  } catch (error) {
    showDataError(error);
  }

  function initialise() {
    validateData();
    fillText();
    buildTable();
    bindEvents();
  }

  function validateData() {
    if (!data || typeof data !== "object") {
      throw new Error("לא נמצא קובץ הנתונים puzzle-data.js.");
    }

    if (!Array.isArray(data.questions) || data.questions.length === 0) {
      throw new Error("רשימת השאלות חסרה או ריקה.");
    }

    data.questions.forEach((question, index) => {
      if (!question || !String(question.text || "").trim()) {
        throw new Error(`חסר נוסח בשאלה מספר ${index + 1}.`);
      }

      if (question.numberAnswer === undefined || question.numberAnswer === null) {
        throw new Error(`חסרה תשובה מספרית בשאלה מספר ${index + 1}.`);
      }

      if (!String(question.letterAnswer || "").trim()) {
        throw new Error(`חסרה אות בשאלה מספר ${index + 1}.`);
      }
    });
  }

  function fillText() {
    ui.title.textContent = data.title || "חידת גימטריה";
    ui.subtitle.textContent = data.subtitle || "";
    ui.instructions.textContent = data.instructions || "";
    ui.successTitle.textContent = data.successTitle || "כל הכבוד!";
    ui.successMessage.textContent = data.successMessage || "פתרתם את החידה.";

    ui.subtitle.hidden = !ui.subtitle.textContent;
    ui.instructions.hidden = !ui.instructions.textContent;
  }

  function buildTable() {
    const fragment = document.createDocumentFragment();

    data.questions.forEach((question, index) => {
      const row = document.createElement("tr");
      row.dataset.index = String(index);

      const questionCell = document.createElement("td");
      questionCell.className = "question-cell";
      questionCell.textContent = question.text;

      const numberCell = document.createElement("td");
      const numberInput = document.createElement("input");
      numberInput.className = "answer-input number-input";
      numberInput.type = "text";
      numberInput.inputMode = "numeric";
      numberInput.autocomplete = "off";
      numberInput.spellcheck = false;
      numberInput.setAttribute("aria-label", `תשובה מספרית לשאלה ${index + 1}`);
      numberInput.dataset.role = "number";
      numberCell.appendChild(numberInput);

      const letterCell = document.createElement("td");
      const letterInput = document.createElement("input");
      letterInput.className = "answer-input letter-input";
      letterInput.type = "text";
      letterInput.inputMode = "text";
      letterInput.autocomplete = "off";
      letterInput.spellcheck = false;
      letterInput.maxLength = 1;
      letterInput.setAttribute("aria-label", `אות עברית לשאלה ${index + 1}`);
      letterInput.dataset.role = "letter";
      letterCell.appendChild(letterInput);

      row.append(questionCell, numberCell, letterCell);
      fragment.appendChild(row);
    });

    ui.body.replaceChildren(fragment);
  }

  function bindEvents() {
    ui.check.addEventListener("click", checkAll);
    ui.reset.addEventListener("click", resetPuzzle);

    ui.body.addEventListener("input", event => {
      const input = event.target.closest(".answer-input");
      if (!input) return;

      clearInputState(input);
      clearStatus();
      hideSuccess();

      if (input.dataset.role === "number") {
        input.value = input.value.replace(/[^0-9-]/g, "");
      } else {
        input.value = normalizeLetter(input.value);
      }
    });

    ui.body.addEventListener("keydown", event => {
      if (event.key !== "Enter") return;

      const inputs = [...ui.body.querySelectorAll(".answer-input")];
      const currentIndex = inputs.indexOf(event.target);
      const next = inputs[currentIndex + 1];

      if (next) {
        event.preventDefault();
        next.focus();
      } else {
        checkAll();
      }
    });
  }

  function checkAll() {
    const rows = [...ui.body.querySelectorAll("tr")];
    let hasEmpty = false;
    let hasWrong = false;

    rows.forEach((row, index) => {
      const question = data.questions[index];
      const numberInput = row.querySelector('[data-role="number"]');
      const letterInput = row.querySelector('[data-role="letter"]');

      const numberValue = normalizeNumber(numberInput.value);
      const letterValue = normalizeLetter(letterInput.value);
      const expectedNumber = normalizeNumber(question.numberAnswer);
      const expectedLetter = normalizeLetter(question.letterAnswer);

      const numberEmpty = numberValue === "";
      const letterEmpty = letterValue === "";

      if (numberEmpty || letterEmpty) hasEmpty = true;

      const numberCorrect = !numberEmpty && numberValue === expectedNumber;
      const letterCorrect = !letterEmpty && letterValue === expectedLetter;

      setInputState(numberInput, numberCorrect, numberEmpty);
      setInputState(letterInput, letterCorrect, letterEmpty);

      const rowCorrect = numberCorrect && letterCorrect;
      row.classList.toggle("is-correct", rowCorrect);
      row.classList.toggle("has-error", !rowCorrect && (!numberEmpty || !letterEmpty));

      if (!rowCorrect && !numberEmpty && !letterEmpty) hasWrong = true;
    });

    if (!hasEmpty && !hasWrong) {
      ui.status.textContent = data.feedback?.correct || "כל התשובות נכונות!";
      ui.status.className = "status-text is-good";
      ui.successPanel.classList.remove("hidden");
      ui.successPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
      return;
    }

    hideSuccess();

    if (hasEmpty) {
      ui.status.textContent = data.feedback?.incomplete || "מלאו את כל התאים לפני הבדיקה.";
    } else {
      ui.status.textContent = data.feedback?.wrong || "יש עדיין תשובות שצריך לתקן.";
    }

    ui.status.className = "status-text is-bad";

    const firstProblem = ui.body.querySelector(".answer-input.is-wrong, .answer-input.is-empty");
    firstProblem?.focus({ preventScroll: true });
  }

  function setInputState(input, isCorrect, isEmpty) {
    input.classList.toggle("is-correct", isCorrect);
    input.classList.toggle("is-wrong", !isCorrect && !isEmpty);
    input.classList.toggle("is-empty", isEmpty);
    input.setAttribute("aria-invalid", String(!isCorrect && !isEmpty));
  }

  function clearInputState(input) {
    input.classList.remove("is-correct", "is-wrong", "is-empty");
    input.removeAttribute("aria-invalid");
    input.closest("tr")?.classList.remove("is-correct", "has-error");
  }

  function normalizeNumber(value) {
    const raw = String(value ?? "").trim();
    if (raw === "") return "";

    const number = Number(raw);
    return Number.isFinite(number) ? String(number) : raw;
  }

  function normalizeLetter(value) {
    const raw = String(value ?? "")
      .trim()
      .replace(/[^א-תךםןףץ]/g, "")
      .slice(0, 1);

    return finalLetters[raw] || raw;
  }

  function resetPuzzle() {
    ui.body.querySelectorAll(".answer-input").forEach(input => {
      input.value = "";
      clearInputState(input);
    });

    ui.body.querySelectorAll("tr").forEach(row => {
      row.classList.remove("is-correct", "has-error");
    });

    clearStatus();
    hideSuccess();
    ui.body.querySelector(".answer-input")?.focus();
  }

  function clearStatus() {
    ui.status.textContent = "";
    ui.status.className = "status-text";
  }

  function hideSuccess() {
    ui.successPanel.classList.add("hidden");
  }

  function showDataError(error) {
    console.error(error);
    ui.dataErrorText.textContent = error?.message || "אירעה שגיאה לא ידועה.";
    ui.dataError.classList.remove("hidden");
    ui.check.disabled = true;
    ui.reset.disabled = true;
  }
})();
