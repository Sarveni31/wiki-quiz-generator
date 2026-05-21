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
    ${options.includeTakeMode ? renderTakeQuiz(groups) : renderReviewOnly(groups)}
  `;
  if (options.includeTakeMode) wireTakeQuiz(container, groups);
}

function renderEntityPills(label, values = []) {
  return values.slice(0, 5).map((value) => `<li class="pill">${label}: ${escapeHtml(value)}</li>`).join("");
}

function renderReviewOnly(groups) {
  let questionNumber = 0;
  return groups
    .map(({ section, questions }) => {
      const cards = questions
        .map((item) => {
          questionNumber += 1;
          return `
            <article class="quiz-card">
              <h4>${questionNumber}. ${escapeHtml(item.question)}</h4>
              <p class="answer">Answer: ${escapeHtml(item.answer)}</p>
            </article>
          `;
        })
        .join("");
      return `<section class="quiz-section-group"><h3 class="quiz-section-title">${escapeHtml(section)}</h3>${cards}</section>`;
    })
    .join("");
}

function renderTakeQuestion(item, globalIndex, localIndex) {
  return `
    <div class="take-question" data-question-index="${globalIndex}">
      <div class="take-question-head">
        <h4>${localIndex}. ${escapeHtml(item.question)}</h4>
        <span class="difficulty">${escapeHtml(item.difficulty)}</span>
      </div>
      ${item.options
        .map(
          (option) => `
        <label class="take-option">
          <input type="radio" name="question-${globalIndex}" value="${escapeHtml(option)}">
          ${escapeHtml(option)}
        </label>
      `
        )
        .join("")}
    </div>
  `;
}

function renderTakeQuiz(groups) {
  if (!groups.length) return "";

  let globalIndex = 0;
  const panels = groups
    .map((group, sectionIndex) => {
      const isLast = sectionIndex === groups.length - 1;
      let localIndex = 0;
      const questionsHtml = group.questions
        .map((item) => {
          localIndex += 1;
          const html = renderTakeQuestion(item, globalIndex, localIndex);
          globalIndex += 1;
          return html;
        })
        .join("");
      const actionButton = isLast
        ? `<button type="button" data-submit-quiz>Submit quiz</button>`
        : `<button type="button" data-take-next>Next section</button>`;

      return `
        <div class="take-section-panel${sectionIndex === 0 ? " active" : ""}" data-section-index="${sectionIndex}">
          <h3 class="take-section-heading">${escapeHtml(group.section)}</h3>
          ${questionsHtml}
          <div class="take-actions">${actionButton}</div>
        </div>
      `;
    })
    .join("");

  const firstSection = groups[0].section;
  return `
    <section class="take-quiz" data-take-quiz-root>
      <div class="take-quiz-header">
        <h2>Quiz</h2>
        <p class="take-hint">Answer each question. Answers are hidden until you submit the full quiz.</p>
        <p class="take-progress" data-take-progress>Section 1 of ${groups.length}: ${escapeHtml(firstSection)}</p>
      </div>
      <div class="take-section-panels" data-take-panels>${panels}</div>
      <p class="take-message" data-take-message aria-live="polite"></p>
      <div class="take-score-panel hidden" data-take-score-panel>
        <p class="score" data-take-score aria-live="polite"></p>
        <div class="quiz-results" data-quiz-results></div>
      </div>
    </section>
  `;
}

function wireTakeQuiz(container, groups) {
  const root = container.querySelector("[data-take-quiz-root]");
  if (!root || !groups.length) return;

  const flatQuiz = groups.flatMap((group) => group.questions);
  const panels = Array.from(root.querySelectorAll(".take-section-panel"));
  const progress = root.querySelector("[data-take-progress]");
  const message = root.querySelector("[data-take-message]");
  let currentSection = 0;

  const showSection = (index) => {
    panels.forEach((panel, panelIndex) => {
      panel.classList.toggle("active", panelIndex === index);
    });
    const sectionName = groups[index]?.section || "General";
    progress.textContent = `Section ${index + 1} of ${groups.length}: ${sectionName}`;
    message.textContent = "";
  };

  const sectionIsComplete = (panel) => {
    const names = new Set(
      Array.from(panel.querySelectorAll('input[type="radio"]')).map((input) => input.name)
    );
    for (const name of names) {
      if (!panel.querySelector(`input[name="${CSS.escape(name)}"]:checked`)) return false;
    }
    return names.size > 0;
  };

  panels.forEach((panel) => {
    const nextButton = panel.querySelector("[data-take-next]");
    if (nextButton) {
      nextButton.addEventListener("click", () => {
        if (!sectionIsComplete(panel)) {
          message.textContent = "Answer every question in this section before continuing.";
          return;
        }
        if (currentSection < groups.length - 1) {
          currentSection += 1;
          showSection(currentSection);
          panel.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      });
    }

    const submitButton = panel.querySelector("[data-submit-quiz]");
    if (submitButton) {
      submitButton.addEventListener("click", () => {
        if (!sectionIsComplete(panel)) {
          message.textContent = "Answer every question in this section before submitting.";
          return;
        }
        scoreQuiz(container, flatQuiz, groups, root);
      });
    }
  });
}

function scoreQuiz(container, quiz, groups, takeRoot) {
  let score = 0;
  quiz.forEach((item, index) => {
    const selected = container.querySelector(`input[name="question-${index}"]:checked`);
    if (selected && selected.value === item.answer) score += 1;
  });

  const messageEl = takeRoot.querySelector("[data-take-message]");
  const progressEl = takeRoot.querySelector("[data-take-progress]");
  const scorePanel = takeRoot.querySelector("[data-take-score-panel]");
  const scoreEl = takeRoot.querySelector("[data-take-score]");
  const resultsEl = takeRoot.querySelector("[data-quiz-results]");

  if (messageEl) messageEl.textContent = "";
  if (progressEl) progressEl.textContent = "Quiz complete";
  if (scoreEl) scoreEl.textContent = `Your score: ${score} / ${quiz.length}`;
  if (scorePanel) scorePanel.classList.remove("hidden");

  const panelsWrap = takeRoot.querySelector("[data-take-panels]");
  if (panelsWrap) panelsWrap.classList.add("hidden");

  container.querySelectorAll(".take-quiz input[type='radio']").forEach((input) => {
    input.disabled = true;
  });
  container.querySelectorAll(".take-actions").forEach((block) => {
    block.remove();
  });

  if (resultsEl) {
    let globalIndex = 0;
    resultsEl.innerHTML = groups
      .map((group) => {
        const items = group.questions
          .map((item) => {
            const index = globalIndex;
            globalIndex += 1;
            const selected = container.querySelector(`input[name="question-${index}"]:checked`);
            const picked = selected?.value || "No answer";
            const correct = picked === item.answer;
            return `
              <article class="quiz-result ${correct ? "is-correct" : "is-wrong"}">
                <p class="quiz-result-status">${correct ? "Correct" : "Incorrect"}</p>
                <h4>${escapeHtml(item.question)}</h4>
                <p>Your answer: ${escapeHtml(picked)}</p>
                ${correct ? "" : `<p class="answer">Correct answer: ${escapeHtml(item.answer)}</p>`}
                <p>${escapeHtml(item.explanation)}</p>
              </article>
            `;
          })
          .join("");
        return `
          <section class="quiz-results-section">
            <h3>${escapeHtml(group.section)}</h3>
            ${items}
          </section>
        `;
      })
      .join("");
  }

  scorePanel?.scrollIntoView({ behavior: "smooth", block: "start" });
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
      : typeof detail === "string"
        ? detail
        : detail
          ? JSON.stringify(detail)
          : "Request failed.";
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
