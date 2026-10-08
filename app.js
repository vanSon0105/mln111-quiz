const questions = Array.isArray(window.QUIZ_QUESTIONS) ? window.QUIZ_QUESTIONS : [];
const questionById = new Map(questions.map((question) => [question.id, question]));
const storageKey = "mln111-quiz-progress-v2";

const elements = {
  studyStatus: document.querySelector(".study-status"),
  quizPanel: document.querySelector("#quiz-panel"),
  resultsPanel: document.querySelector("#results-panel"),
  questionNumber: document.querySelector("#question-number"),
  questionType: document.querySelector("#question-type"),
  questionText: document.querySelector("#question-text"),
  options: document.querySelector("#options"),
  feedback: document.querySelector("#feedback"),
  feedbackIcon: document.querySelector("#feedback-icon"),
  feedbackTitle: document.querySelector("#feedback-title"),
  correctAnswer: document.querySelector("#correct-answer"),
  explanation: document.querySelector("#explanation"),
  explanationText: document.querySelector("#explanation-text"),
  multiActions: document.querySelector("#multi-actions"),
  checkButton: document.querySelector("#check-button"),
  nextButton: document.querySelector("#next-button"),
  restartButton: document.querySelector("#restart-button"),
  orderMode: document.querySelector("#order-mode"),
  progressLabel: document.querySelector("#progress-label"),
  progressPercent: document.querySelector("#progress-percent"),
  progressFill: document.querySelector("#progress-fill"),
  correctCount: document.querySelector("#correct-count"),
  wrongCount: document.querySelector("#wrong-count"),
  streakCount: document.querySelector("#streak-count"),
  studyMistakesButton: document.querySelector("#study-mistakes-button"),
  mistakesButtonCount: document.querySelector("#mistakes-button-count"),
  resultsKicker: document.querySelector("#results-kicker"),
  resultPercent: document.querySelector("#result-percent"),
  resultCopy: document.querySelector("#result-copy"),
  resultCorrectBar: document.querySelector("#result-correct-bar"),
  resultWrongBar: document.querySelector("#result-wrong-bar"),
  resumeSessionButton: document.querySelector("#resume-session-button"),
  retryWrongButton: document.querySelector("#retry-wrong-button"),
  retryAllButton: document.querySelector("#retry-all-button"),
  dataNote: document.querySelector("#data-note"),
};

function readSavedState() {
  try {
    return localStorage.getItem(storageKey);
  } catch {
    return null;
  }
}

function writeSavedState(value) {
  try {
    localStorage.setItem(storageKey, value);
  } catch {
    // The quiz still works when browser privacy settings block local storage.
  }
}

function shuffle(items) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[randomIndex]] = [copy[randomIndex], copy[index]];
  }
  return copy;
}

function createFreshState(mode = "shuffle", sourceIds = questions.map((question) => question.id)) {
  return {
    mode,
    order: mode === "shuffle" ? shuffle(sourceIds) : [...sourceIds],
    index: 0,
    selected: [],
    answered: false,
    correct: 0,
    wrong: 0,
    streak: 0,
    roundCorrect: 0,
    roundWrong: 0,
    wrongIds: [],
    finished: false,
    sessionType: "main",
    resumeState: null,
  };
}

function normalizeSavedState(saved, includeResumeState = true) {
  const hasRoundCounters =
    Number.isInteger(saved.roundCorrect) && Number.isInteger(saved.roundWrong);
  const resumeState =
    includeResumeState && saved.resumeState
      ? normalizeSavedState(saved.resumeState, false)
      : null;
  const normalized = {
    ...createFreshState(saved.mode),
    ...saved,
    selected: Array.isArray(saved.selected) ? saved.selected : [],
    wrongIds: Array.isArray(saved.wrongIds) ? saved.wrongIds : [],
    roundCorrect: hasRoundCounters ? saved.roundCorrect : Number(saved.correct) || 0,
    roundWrong: hasRoundCounters ? saved.roundWrong : Number(saved.wrong) || 0,
    resumeState,
  };

  // Migrate mistake sessions saved by the previous version, whose counters started at zero.
  if (!hasRoundCounters && normalized.sessionType === "mistakes" && resumeState) {
    normalized.correct = resumeState.correct + normalized.roundCorrect;
    normalized.wrong = resumeState.wrong + normalized.roundWrong;
    normalized.streak =
      normalized.roundCorrect + normalized.roundWrong > 0
        ? normalized.streak
        : resumeState.streak;
    resumeState.correct = normalized.correct;
    resumeState.wrong = normalized.wrong;
    resumeState.streak = normalized.streak;
  }

  return normalized;
}

function loadState() {
  try {
    const saved = JSON.parse(readSavedState());
    const validOrder =
      Array.isArray(saved?.order) &&
      saved.order.length > 0 &&
      saved.order.every((id) => questionById.has(id));

    if (validOrder && Number.isInteger(saved.index) && saved.index >= 0) {
      return normalizeSavedState(saved);
    }
  } catch {}

  return createFreshState();
}

let state = loadState();

function saveState() {
  writeSavedState(JSON.stringify(state));
}

function currentQuestion() {
  return questionById.get(state.order[state.index]);
}

function answersMatch(selected, answer) {
  if (selected.length !== answer.length) return false;
  return [...selected].sort().every((value, index) => value === [...answer].sort()[index]);
}

function answerSummary(question) {
  return question.answer
    .map((answerId) => {
      const option = question.options.find((item) => item.id === answerId);
      return `${answerId}. ${option?.text || ""}`;
    })
    .join("; ");
}

function renderStatus() {
  const total = state.order.length;
  const completed = Math.min(state.index + (state.answered ? 1 : 0), total);
  const percent = total ? Math.round((completed / total) * 100) : 0;

  elements.progressLabel.textContent = state.finished
    ? `Đã hoàn thành ${total} câu`
    : `Câu ${Math.min(state.index + 1, total)} / ${total}`;
  elements.progressPercent.textContent = `${percent}%`;
  elements.progressFill.style.width = `${percent}%`;
  elements.correctCount.textContent = state.correct;
  elements.wrongCount.textContent = state.wrong;
  elements.streakCount.textContent = state.streak;
  elements.studyMistakesButton.hidden = state.wrongIds.length === 0;
  elements.mistakesButtonCount.textContent = state.wrongIds.length;
}

function renderOption(question, option) {
  const button = document.createElement("button");
  const selected = state.selected.includes(option.id);
  const isAnswer = question.answer.includes(option.id);

  button.type = "button";
  button.className = "option-button";
  button.dataset.option = option.id;
  button.setAttribute("aria-pressed", String(selected));
  button.innerHTML = `
    <span class="option-letter">${option.id}</span>
    <span class="option-text"></span>
    <span class="option-state"></span>
  `;
  button.querySelector(".option-text").textContent = option.text;

  if (selected) button.classList.add("is-selected");

  if (state.answered) {
    button.disabled = true;
    if (isAnswer) {
      button.classList.remove("is-selected");
      button.classList.add("is-correct");
      button.querySelector(".option-state").textContent = "Đáp án đúng";
    } else if (selected) {
      button.classList.remove("is-selected");
      button.classList.add("is-wrong");
      button.querySelector(".option-state").textContent = "Bạn đã chọn";
    }
  } else {
    button.addEventListener("click", () => selectOption(option.id));
  }

  return button;
}

function renderFeedback(question) {
  if (!state.answered) {
    elements.feedback.hidden = true;
    return;
  }

  const isCorrect = answersMatch(state.selected, question.answer);
  elements.feedback.hidden = false;
  elements.feedback.className = `feedback ${isCorrect ? "is-correct" : "is-wrong"}`;
  elements.feedbackIcon.textContent = isCorrect ? "✓" : "×";
  elements.feedbackTitle.textContent = isCorrect ? "Chính xác" : "Chưa đúng";
  elements.correctAnswer.textContent = `Đáp án đúng: ${answerSummary(question)}`;
  elements.explanation.hidden = !question.explanation;
  elements.explanationText.textContent = question.explanation;
  elements.nextButton.textContent =
    state.index === state.order.length - 1 ? "Xem kết quả" : "Câu tiếp theo";
}

function renderQuestion() {
  const question = currentQuestion();
  if (!question) {
    finishQuiz();
    return;
  }

  elements.quizPanel.hidden = false;
  elements.resultsPanel.hidden = true;
  elements.questionNumber.textContent = `Câu ${state.index + 1}`;
  elements.questionType.textContent =
    question.answer.length > 1
      ? `Chọn ${question.answer.length} đáp án`
      : "Chọn 1 đáp án";
  elements.questionText.textContent = question.question;
  elements.options.replaceChildren(...question.options.map((option) => renderOption(question, option)));

  const isMultiple = question.answer.length > 1;
  elements.multiActions.hidden = !isMultiple || state.answered;
  elements.checkButton.disabled = isMultiple && state.selected.length !== question.answer.length;
  renderFeedback(question);
  renderStatus();
}

function selectOption(optionId) {
  if (state.answered) return;
  const question = currentQuestion();

  if (question.answer.length === 1) {
    state.selected = [optionId];
    checkAnswer();
    return;
  }

  if (!state.selected.includes(optionId) && state.selected.length >= question.answer.length) return;

  state.selected = state.selected.includes(optionId)
    ? state.selected.filter((id) => id !== optionId)
    : [...state.selected, optionId];
  saveState();
  renderQuestion();
}

function checkAnswer() {
  if (state.answered || state.selected.length === 0) return;
  const question = currentQuestion();
  if (question.answer.length > 1 && state.selected.length !== question.answer.length) return;
  const isCorrect = answersMatch(state.selected, question.answer);

  state.answered = true;
  if (isCorrect) {
    state.correct += 1;
    state.roundCorrect += 1;
    state.streak += 1;
  } else {
    state.wrong += 1;
    state.roundWrong += 1;
    state.streak = 0;
    if (!state.wrongIds.includes(question.id)) state.wrongIds.push(question.id);
  }

  if (state.sessionType === "mistakes" && state.resumeState) {
    const unresolvedIds = new Set(state.resumeState.wrongIds || []);
    if (isCorrect) unresolvedIds.delete(question.id);
    else unresolvedIds.add(question.id);
    state.resumeState.wrongIds = [...unresolvedIds];
    state.resumeState.correct = state.correct;
    state.resumeState.wrong = state.wrong;
    state.resumeState.streak = state.streak;
  }

  saveState();
  renderQuestion();
  elements.feedback.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function nextQuestion() {
  if (!state.answered) return;

  if (state.index >= state.order.length - 1) {
    finishQuiz();
    return;
  }

  state.index += 1;
  state.selected = [];
  state.answered = false;
  saveState();
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function finishQuiz() {
  state.finished = true;
  saveState();

  const total = state.order.length;
  const percent = total ? Math.round((state.roundCorrect / total) * 100) : 0;
  elements.quizPanel.hidden = true;
  elements.resultsPanel.hidden = false;
  elements.resultPercent.textContent = `${percent}%`;
  elements.resultCopy.textContent = `${state.roundCorrect} / ${total} câu đúng`;
  elements.resultCorrectBar.style.width = `${percent}%`;
  elements.resultWrongBar.style.width = `${100 - percent}%`;
  const canResume =
    state.sessionType === "mistakes" && state.resumeState && !state.resumeState.finished;
  elements.resultsKicker.textContent =
    state.sessionType === "mistakes"
      ? "Hoàn thành lượt luyện câu sai"
      : "Hoàn thành lượt học";
  elements.resumeSessionButton.hidden = !canResume;
  elements.retryWrongButton.hidden = state.wrongIds.length === 0;
  renderStatus();
}

function restart(mode = elements.orderMode.value, sourceIds) {
  state = createFreshState(mode, sourceIds);
  elements.orderMode.value = mode === "sequential" ? "sequential" : "shuffle";
  saveState();
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function confirmRestart(mode = elements.orderMode.value) {
  const hasProgress = state.correct + state.wrong > 0;
  if (!hasProgress || window.confirm("Bắt đầu lại sẽ xóa tiến độ của lượt học hiện tại. Tiếp tục?")) {
    restart(mode);
    return true;
  }
  return false;
}

function startWrongPractice() {
  if (state.wrongIds.length === 0) return;
  const wrongIds = [...state.wrongIds];
  const resumeState =
    state.sessionType === "mistakes" && state.resumeState
      ? state.resumeState
      : JSON.parse(JSON.stringify(state));

  state = {
    ...createFreshState("shuffle", wrongIds),
    correct: resumeState.correct,
    wrong: resumeState.wrong,
    streak: resumeState.streak,
    sessionType: "mistakes",
    resumeState,
  };
  elements.orderMode.value = "shuffle";
  saveState();
  renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resumePreviousSession() {
  if (!state.resumeState) return;
  state = state.resumeState;
  elements.orderMode.value = state.mode === "sequential" ? "sequential" : "shuffle";
  saveState();
  state.finished ? finishQuiz() : renderQuestion();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

elements.checkButton.addEventListener("click", checkAnswer);
elements.nextButton.addEventListener("click", nextQuestion);
elements.restartButton.addEventListener("click", () => confirmRestart());
elements.retryAllButton.addEventListener("click", () => restart(elements.orderMode.value));
elements.resumeSessionButton.addEventListener("click", resumePreviousSession);
elements.studyMistakesButton.addEventListener("click", startWrongPractice);
elements.retryWrongButton.addEventListener("click", startWrongPractice);
elements.orderMode.addEventListener("change", (event) => {
  const previousMode = state.mode === "sequential" ? "sequential" : "shuffle";
  if (!confirmRestart(event.target.value)) event.target.value = previousMode;
});

document.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || event.target.matches("select, button")) return;

  if (event.key === "Enter") {
    if (state.answered) nextQuestion();
    else if (currentQuestion()?.answer.length > 1) checkAnswer();
    return;
  }

  const optionIndex = Number(event.key) - 1;
  const question = currentQuestion();
  if (!state.answered && question && optionIndex >= 0 && optionIndex < question.options.length) {
    selectOption(question.options[optionIndex].id);
  }
});

if (questions.length === 0) {
  elements.quizPanel.innerHTML = "<p>Không tải được dữ liệu câu hỏi.</p>";
  elements.studyStatus.hidden = true;
} else {
  elements.orderMode.value = state.mode === "sequential" ? "sequential" : "shuffle";
  elements.dataNote.textContent = `${questions.length} câu hỏi đã sẵn sàng`;
  state.finished ? finishQuiz() : renderQuestion();
}
