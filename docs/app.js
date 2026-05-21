const sampleFiles = [
  "sample_data/alan_turing.json",
  "sample_data/ada_lovelace.json",
  "sample_data/marie_curie.json",
];

let samples = [];
const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

init();

async function init() {
  samples = await Promise.all(sampleFiles.map((file) => fetch(file).then((response) => response.json())));
  const select = qs("#wiki-url");
  select.innerHTML = samples.map((item, index) => `<option value="${index}">${escapeHtml(item.url)}</option>`).join("");
  renderQuiz(samples[0], qs("#latest-result"), { includeTakeMode: true });
  setStatus("This is a static GitHub Pages demo using saved sample outputs.");
  loadHistory();
}

qsa(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    qsa(".tab-button").forEach((item) => item.classList.remove("active"));
    qsa(".tab-panel").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    qs(`#${button.dataset.tab}`).classList.add("active");
  });
});

qs("#quiz-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const selected = samples[Number(qs("#wiki-url").value)];
  renderQuiz(selected, qs("#latest-result"), { includeTakeMode: true });
  setStatus(`Loaded saved demo quiz for ${selected.title}.`);
});

qs("#refresh-history").addEventListener("click", loadHistory);
qs("#close-modal").addEventListener("click", () => qs("#details-modal").close());

function loadHistory() {
  const body = qs("#history-body");
  body.innerHTML = samples.map((item, index) => `
    <tr>
      <td><strong>${escapeHtml(item.title)}</strong></td>
      <td class="url-cell">${escapeHtml(item.url)}</td>
      <td>${item.quiz.length}</td>
      <td>${formatDate(item.created_at)}</td>
      <td><button class="secondary" data-details="${index}">Details</button></td>
    </tr>
  `).join("");
  qsa("[data-details]").forEach((button) => {
    button.addEventListener("click", () => openDetails(Number(button.dataset.details)));
  });
}

function openDetails(index) {
  const quiz = samples[index];
  qs("#modal-title").textContent = quiz.title;
  renderQuiz(quiz, qs("#modal-content"), { includeTakeMode: true });
  qs("#details-modal").showModal();
}

function groupQuestionsBySection(quiz, articleSections = []) {
  const buckets = new Map();
  for (const item of quiz) {
    const key = item.section || "General";
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(item);
  }

  const order = [];
  for (const section of articleSections) {
    if (buckets.has(section)) order.push(section);
  }
  if (buckets.has("General") && !order.includes("General")) order.push("General");
  for (const section of buckets.keys()) {
    if (!order.includes(section)) order.push(section);
  }

  return order.map((section) => ({ section, questions: buckets.get(section) }));
}

function renderQuiz(data, container, options = {}) {
  const groups = groupQuestionsBySection(data.quiz, data.sections);
  let questionNumber = 0;
  const groupedCards = groups
    .map(({ section, questions }) => {
      const cards = questions
        .map((item) => {
          questionNumber += 1;
          return renderQuestionCard(item, questionNumber);
        })
        .join("");
      return `
        <section class="quiz-section-group">
          <h3 class="quiz-section-title">${escapeHtml(section)}</h3>
          ${cards}
        </section>
      `;
    })
    .join("");

  container.innerHTML = `
    <article class="article-summary">
      <h2>${escapeHtml(data.title)}</h2>
      <p>${escapeHtml(data.summary)}</p>
      <ul class="meta-list">
        ${renderEntityPills("People", data.key_entities.people)}
        ${renderEntityPills("Organizations", data.key_entities.organizations)}
        ${renderEntityPills("Locations", data.key_entities.locations)}
      </ul>
      <ul class="topics">${data.related_topics.map((topic) => `<li class="pill">${escapeHtml(topic)}</li>`).join("")}</ul>
    </article>
    ${groupedCards}
    ${options.includeTakeMode ? renderTakeQuiz(data.quiz) : ""}
  `;
  const submit = container.querySelector("[data-submit-quiz]");
  if (submit) submit.addEventListener("click", () => scoreQuiz(container, data.quiz));
}

function renderEntityPills(label, values = []) {
  return values.slice(0, 5).map((value) => `<li class="pill">${label}: ${escapeHtml(value)}</li>`).join("");
}

function renderQuestionCard(item, index) {
  return `
    <article class="quiz-card">
      <div class="section-heading">
        <h4>${index}. ${escapeHtml(item.question)}</h4>
        <span class="difficulty">${escapeHtml(item.difficulty)}</span>
      </div>
      <div class="options">
        ${item.options.map((option, optionIndex) => `<div class="option">${String.fromCharCode(65 + optionIndex)}. ${escapeHtml(option)}</div>`).join("")}
      </div>
      <details class="answer-details">
        <summary>Show answer</summary>
        <p class="answer">Answer: ${escapeHtml(item.answer)}</p>
        <p>${escapeHtml(item.explanation)}</p>
      </details>
    </article>
  `;
}

function renderTakeQuiz(quiz) {
  return `
    <section class="take-quiz">
      <div class="section-heading">
        <h2>Take Quiz</h2>
        <button data-submit-quiz>Submit Answers</button>
      </div>
      ${quiz.map((item, index) => `
        <div class="take-question">
          <h3>${index + 1}. ${escapeHtml(item.question)}</h3>
          ${item.options.map((option) => `
            <label class="take-option">
              <input type="radio" name="question-${index}" value="${escapeHtml(option)}">
              ${escapeHtml(option)}
            </label>
          `).join("")}
        </div>
      `).join("")}
      <div class="score" aria-live="polite"></div>
    </section>
  `;
}

function scoreQuiz(container, quiz) {
  let score = 0;
  quiz.forEach((item, index) => {
    const selected = container.querySelector(`input[name="question-${index}"]:checked`);
    if (selected && selected.value === item.answer) score += 1;
  });
  container.querySelector(".score").textContent = `Score: ${score} / ${quiz.length}`;
}

function setStatus(message) {
  qs("#status").textContent = message;
}

function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
