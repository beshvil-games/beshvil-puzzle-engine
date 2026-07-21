(() => {
  "use strict";

  const form = document.getElementById("answerForm");
  const input = document.getElementById("answerInput");
  const message = document.getElementById("message");
  const successPanel = document.getElementById("successPanel");

  const acceptedAnswers = new Set([
    "מדפסת",
    "המדפסת"
  ]);

  function normalizeAnswer(value) {
    return value
      .trim()
      .replace(/[״"'׳`.,!?;:()\[\]{}\-–—]/g, "")
      .replace(/\s+/g, "");
  }

  function showError(text) {
    successPanel.classList.remove("show");
    message.textContent = text;
    message.className = "message message-error";

    input.classList.remove("shake");
    void input.offsetWidth;
    input.classList.add("shake");
    input.focus();
    input.select();
  }

  function showSuccess() {
    message.textContent = "";
    message.className = "message message-success";
    successPanel.classList.add("show");
    input.setAttribute("disabled", "");
    form.querySelector("button").setAttribute("disabled", "");
    successPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();

    const answer = normalizeAnswer(input.value);

    if (!answer) {
      showError("כתבו תשובה לפני הבדיקה.");
      return;
    }

    if (acceptedAnswers.has(answer)) {
      showSuccess();
    } else {
      showError("עדיין לא. נסו להתבונן שוב בטקסט.");
    }
  });
})();
