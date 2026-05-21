const state = {
  latestQuiz: null,
  previewTimer: null,
};

const qs = (selector) => document.querySelector(selector);
const qsa = (selector) => Array.from(document.querySelectorAll(selector));

qsa(".tab-button").forEach((button) => {
  button.addEventListener("click", () => {
    qsa(".tab-button").forEach((item) => item.classList.remove("active"));
    qsa(".tab-panel").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    qs(`#${button.dataset.tab}`).classList.add("active");
    if (button.dataset.tab === "history") loadHistory();
  });
});

qs("#quiz-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const url = qs("#wiki-url").value.trim();
  setStatus("Generating quiz. This can take a moment while the article is scraped and Gemini responds.");
  qs("#latest-result").innerHTML = "";

  try {
    const response = await fetch("/api/quizzes/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url }),
    });
    const data = await readJson(response);
    state.latestQuiz = data;
    setStatus(
      data.cached
        ? `Loaded cached quiz for ${data.title} (skipped scraping and generation).`
        : `Generated quiz for ${data.title}.`
    );
    renderQuiz(data, qs("#latest-result"), { includeTakeMode: true });
  } catch (error) {
    setStatus(error.message, true);
  }
});

qs("#preview-button").addEventListener("click", () => loadPreview(false));

qs("#wiki-url").addEventListener("input", () => {
  clearTimeout(state.previewTimer);
  state.previewTimer = setTimeout(() => loadPreview(true), 450);
});

qs("#refresh-history").addEventListener("click", loadHistory);
qs("#close-modal").addEventListener("click", () => qs("#details-modal").close());

async function loadPreview(isAuto) {
  const url = qs("#wiki-url").value.trim();
  if (!looksLikeWikiUrl(url)) {
    qs("#preview").classList.add("hidden");
    if (!isAuto) setStatus("Enter a valid HTTPS Wikipedia article URL.", true);
    return;
  }

  if (!isAuto) setStatus("Fetching article preview.");
  try {
    const response = await fetch(`/api/articles/preview?url=${encodeURIComponent(url)}`);
    const data = await readJson(response);
    renderPreview(data);
    setStatus(isAuto ? `Preview: ${data.title}` : "Preview loaded.");
  } catch (error) {
    qs("#preview").classList.add("hidden");
    if (!isAuto) setStatus(error.message, true);
  }
}

function renderPreview(data) {
  qs("#preview").classList.remove("hidden");
  qs("#preview").innerHTML = `
    <h2>${escapeHtml(data.title)}</h2>
    <p>${escapeHtml(data.summary)}</p>
    <ul class="meta-list">${data.sections.slice(0, 8).map((section) => `<li class="pill">${escapeHtml(section)}</li>`).join("")}</ul>
  `;
}

async function loadHistory() {
  const body = qs("#history-body");
  body.innerHTML = `<tr><td colspan="5">Loading history...</td></tr>`;
  try {
    const response = await fetch("/api/quizzes");
    const rows = await readJson(response);
    if (!rows.length) {
      body.innerHTML = `<tr><td colspan="5">No quizzes generated yet.</td></tr>`;
      return;
    }
    body.innerHTML = rows.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.title)}</strong></td>
        <td class="url-cell">${escapeHtml(item.url)}</td>
        <td>${item.question_count}</td>
        <td>${formatDate(item.created_at)}</td>
        <td><button class="secondary" data-details="${item.id}">Details</button></td>
      </tr>
    `).join("");
    qsa("[data-details]").forEach((button) => {
      button.addEventListener("click", () => openDetails(button.dataset.details));
    });
  } catch (error) {
    body.innerHTML = `<tr><td colspan="5">${escapeHtml(error.message)}</td></tr>`;
  }
}

async function openDetails(id) {
  try {
    const response = await fetch(`/api/quizzes/${id}`);
    const quiz = await readJson(response);
    qs("#modal-title").textContent = quiz.title;
    renderQuiz(quiz, qs("#modal-content"), { includeTakeMode: true });
    qs("#details-modal").showModal();
  } catch (error) {
    setStatus(error.message, true);
  }
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

function looksLikeWikiUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.protocol === "https:" &&
      parsed.hostname.endsWith(".wikipedia.org") &&
      parsed.pathname.startsWith("/wiki/") &&
      !parsed.pathname.includes(":")
    );
  } catch {
    return false;
  }
}

async function readJson(response) {
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.detail;
    const message = Array.isArray(detail)
      ? detail.map((item) => item.msg || JSON.stringify(item)).join(" ")
      : detail || "Request failed.";
    throw new Error(message);
  }
  return data;
}

function setStatus(message, isError = false) {
  const status = qs("#status");
  status.textContent = message;
  status.classList.toggle("error", isError);
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

if (looksLikeWikiUrl(qs("#wiki-url").value.trim())) {
  loadPreview(true);
}
