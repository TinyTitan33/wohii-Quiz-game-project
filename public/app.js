let isRegisterMode = false;

function getCurrentUserId() {
  const token = getToken();
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    return payload.userId;
  } catch {
    return null;
  }
}

function getToken() {
  return localStorage.getItem(CONFIG.STORAGE_KEY);
}

function setToken(token) {
  localStorage.setItem(CONFIG.STORAGE_KEY, token);
}

function removeToken() {
  localStorage.removeItem(CONFIG.STORAGE_KEY);
}

async function apiFetch(route, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = { ...options.headers };
  if (!isFormData) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const res = await fetch(`${CONFIG.API_URL}${route}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || data.error || data.msg || "Request failed");
  return data;
}

function showAuth() {
  document.getElementById("auth-section").style.display = "block";
  document.getElementById("app-section").style.display = "none";
  document.getElementById("logout-btn").style.display = "none";
  document.getElementById("leaderboard-btn").style.display = "none";
  renderAuthForm();
}

function renderAuthForm() {
  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const title = isRegisterMode ? "Sign Up" : "Log In";
  const switchText = isRegisterMode
    ? 'Already have an account? <a href="#" id="switch-mode">Log in</a>'
    : 'Don\'t have an account? <a href="#" id="switch-mode">Sign up</a>';

  const formHTML = `
    <h2>${title}</h2>
    <form id="auth-form">
      ${fields
        .map((f) => {
          const type = f === "password" ? "password" : f === "email" ? "email" : "text";
          const label = f.charAt(0).toUpperCase() + f.slice(1);
          return `
          <div class="form-group">
            <label for="${f}">${label}</label>
            <input type="${type}" id="${f}" name="${f}" required />
          </div>`;
        })
        .join("")}
      <button type="submit">${title}</button>
    </form>
    <p class="switch-text">${switchText}</p>
    <p id="auth-error" class="error"></p>
  `;

  document.getElementById("auth-section").innerHTML = formHTML;
  document.getElementById("auth-form").addEventListener("submit", handleAuth);
  document.getElementById("switch-mode").addEventListener("click", (e) => {
    e.preventDefault();
    isRegisterMode = !isRegisterMode;
    renderAuthForm();
  });
}

async function handleAuth(e) {
  e.preventDefault();
  const errorEl = document.getElementById("auth-error");
  errorEl.textContent = "";

  const fields = isRegisterMode ? CONFIG.FIELDS.REGISTER : CONFIG.FIELDS.LOGIN;
  const route = isRegisterMode ? CONFIG.ROUTES.REGISTER : CONFIG.ROUTES.LOGIN;

  const body = {};
  fields.forEach((f) => {
    body[f] = document.getElementById(f).value;
  });

  try {
    const data = await apiFetch(route, {
      method: "POST",
      body: JSON.stringify(body),
    });
    setToken(data.token);
    showApp();
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

async function showApp() {
  document.getElementById("auth-section").style.display = "none";
  document.getElementById("app-section").style.display = "block";
  document.getElementById("logout-btn").style.display = "inline-block";
  document.getElementById("leaderboard-btn").style.display = "inline-block";
  await loadQuestions();
}

async function loadQuestions(keyword = "", page = 1, difficulty = "") {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading questions...</p>';

  try {
    const params = new URLSearchParams({ page, limit: CONFIG.QUESTIONS_PER_PAGE });
    if (keyword) params.set("search", keyword);
    if (difficulty) params.set("difficulty", difficulty);
    const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}?${params}`);
    const { data: questions, total, totalPages } = result;
    const currentUserId = getCurrentUserId();

    const solvedCount = questions.filter((q) => q[CONFIG.API_FIELDS.SOLVED]).length;

    let html = `
      <div class="score-bar">
        <div class="score-item">
          <div class="score-value">${total}</div>
          <div class="score-label">Questions</div>
        </div>
        <div class="score-item">
          <div class="score-value">${solvedCount}/${questions.length}</div>
          <div class="score-label">Solved (this page)</div>
        </div>
      </div>
      <div class="toolbar">
        <div style="display:flex; gap:0.5rem; flex-wrap: wrap;">
          <button class="btn btn-primary" id="new-question-btn" style="margin:0">+ New Question</button>
          <button class="btn btn-play" id="generate-quiz-btn" style="margin:0; font-size: 0.9rem; padding: 0.65rem 1.4rem; border-radius: 12px;">Generate Quiz</button>
        </div>
        <div class="search-bar">
          <select id="diff-filter">
            <option value="">All Difficulties</option>
            <option value="easy" ${difficulty === "easy" ? "selected" : ""}>Easy</option>
            <option value="medium" ${difficulty === "medium" ? "selected" : ""}>Medium</option>
            <option value="hard" ${difficulty === "hard" ? "selected" : ""}>Hard</option>
          </select>
          <input type="text" id="keyword-input" placeholder="Search by keyword..." value="${keyword}" />
          <button class="btn btn-search" id="search-btn">Search</button>
          ${keyword || difficulty ? `<button class="btn btn-clear" id="clear-btn">Clear</button>` : ""}
        </div>
      </div>`;

    if (questions.length === 0) {
      html += '<p class="empty-state">No questions found. Create one to get started!</p>';
    } else {
      html += questions
        .map(
          (q) => `
        <article class="question-card ${q[CONFIG.API_FIELDS.SOLVED] ? "solved-card" : ""}">
          <h3>
            <a href="#" class="question-link" data-id="${q.id}">${q.question}</a>
            ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""}
            ${q.difficulty ? `<span class="badge-diff diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span>` : ""}
          </h3>
          ${
            q.keywords && q.keywords.length
              ? `<div class="question-keywords">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
              : ""
          }
          <div class="question-actions">
            <span>
              <button class="btn btn-play" data-id="${q.id}">Play</button>
              <a href="#" class="read-more" data-id="${q.id}">See answer</a>
            </span>
            ${
              q.userId === currentUserId
                ? `<span class="owner-actions">
                    <button class="btn btn-edit" data-id="${q.id}">Edit</button>
                    <button class="btn btn-delete" data-id="${q.id}">Delete</button>
                  </span>`
                : ""
            }
          </div>
        </article>`
        )
        .join("");
    }

    if (totalPages > 1) {
      html += `
        <div class="pagination">
          <button class="btn btn-page" id="prev-btn" ${page <= 1 ? "disabled" : ""}>Previous</button>
          <span class="page-info">Page ${page} of ${totalPages}</span>
          <button class="btn btn-page" id="next-btn" ${page >= totalPages ? "disabled" : ""}>Next</button>
        </div>`;
    }

    container.innerHTML = html;

    document.getElementById("new-question-btn").addEventListener("click", () => showQuestionForm());
    document.getElementById("generate-quiz-btn").addEventListener("click", () => loadQuiz(document.getElementById("diff-filter").value));

    const performSearch = () => {
      const currentKeyword = document.getElementById("keyword-input").value.trim();
      const currentDiff = document.getElementById("diff-filter").value;
      loadQuestions(currentKeyword, 1, currentDiff);
    };

    document.getElementById("search-btn").addEventListener("click", performSearch);
    document.getElementById("diff-filter").addEventListener("change", performSearch);
    document.getElementById("keyword-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter") performSearch();
    });

    const clearBtn = document.getElementById("clear-btn");
    if (clearBtn) clearBtn.addEventListener("click", () => loadQuestions());

    const prevBtn = document.getElementById("prev-btn");
    if (prevBtn) prevBtn.addEventListener("click", () => loadQuestions(keyword, page - 1, difficulty));

    const nextBtn = document.getElementById("next-btn");
    if (nextBtn) nextBtn.addEventListener("click", () => loadQuestions(keyword, page + 1, difficulty));

    container.querySelectorAll(".question-link, .read-more").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        loadQuestionDetail(el.dataset.id);
      });
    });

    container.querySelectorAll(".btn-edit").forEach((el) => {
      el.addEventListener("click", () => showQuestionForm(el.dataset.id));
    });

    container.querySelectorAll(".btn-delete").forEach((el) => {
      el.addEventListener("click", () => deleteQuestion(el.dataset.id));
    });

    container.querySelectorAll(".btn-play").forEach((el) => {
      el.addEventListener("click", () => playQuestion(el.dataset.id));
    });
  } catch (err) {
    if (err.message === "No token provided" || err.message === "Invalid or expired token") {
      removeToken();
      showAuth();
      return;
    }
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadQuestionDetail(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    const currentUserId = getCurrentUserId();
    const isOwner = q.userId === currentUserId;

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <article class="question-card question-detail">
        <h3>${q.question} ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""} ${q.difficulty ? `<span class="badge-diff diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span>` : ""}</h3>
        <p class="question-meta">by ${q.userName || "Unknown"}</p>
        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="">` : ""}
        <p class="question-answer">${q.answer}</p>
        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        ${
          isOwner
            ? `<div class="question-actions detail-actions">
                <button class="btn btn-edit" id="detail-edit-btn">Edit</button>
                <button class="btn btn-delete" id="detail-delete-btn">Delete</button>
              </div>`
            : ""
        }
      </article>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    if (isOwner) {
      document.getElementById("detail-edit-btn").addEventListener("click", () => showQuestionForm(qId));
      document.getElementById("detail-delete-btn").addEventListener("click", () => deleteQuestion(qId));
    }
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function showQuestionForm(qId) {
  const container = document.getElementById("questions-container");
  const isEdit = !!qId;
  let q = { question: "", answer: "", keywords: [], difficulty: "medium" };

  if (isEdit) {
    try {
      q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);
    } catch (err) {
      container.innerHTML = `<p class="error">${err.message}</p>`;
      return;
    }
  }

  container.innerHTML = `
    <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
    <div class="question-form-wrapper">
      <h2>${isEdit ? "Edit Question" : "New Question"}</h2>
      <form id="question-form" enctype="multipart/form-data">
        <div class="form-group">
          <label for="q-question">Question</label>
          <input type="text" id="q-question" value="${q.question}" required />
        </div>
        <div class="form-group">
          <label for="q-answer">Answer</label>
          <textarea id="q-answer" rows="4" required>${q.answer}</textarea>
        </div>
        <div class="form-group">
          <label for="q-difficulty">Difficulty</label>
          <select id="q-difficulty">
            <option value="easy" ${q.difficulty === "easy" ? "selected" : ""}>Easy</option>
            <option value="medium" ${!q.difficulty || q.difficulty === "medium" ? "selected" : ""}>Medium</option>
            <option value="hard" ${q.difficulty === "hard" ? "selected" : ""}>Hard</option>
          </select>
        </div>
        <div class="form-group">
          <label for="q-keywords">Keywords (comma-separated)</label>
          <input type="text" id="q-keywords" value="${q.keywords ? q.keywords.join(", ") : ""}" />
        </div>
        <div class="form-group">
          <label for="q-image">Image ${isEdit ? "(leave blank to keep current)" : "(optional)"}</label>
          <input type="file" id="q-image" accept="image/*" />
          ${isEdit && q.imageUrl ? `<img src="${q.imageUrl}" alt="" style="max-width:200px;margin-top:0.5rem;border-radius:4px" />` : ""}
        </div>
        <button type="submit" class="btn btn-primary">${isEdit ? "Save Changes" : "Create Question"}</button>
      </form>
      <p id="question-form-error" class="error"></p>
    </div>`;

  document.getElementById("back-btn").addEventListener("click", (e) => {
    e.preventDefault();
    loadQuestions();
  });

  document.getElementById("question-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const errorEl = document.getElementById("question-form-error");
    errorEl.textContent = "";

    const body = new FormData();
    body.append("question", document.getElementById("q-question").value);
    body.append("answer", document.getElementById("q-answer").value);
    body.append("difficulty", document.getElementById("q-difficulty").value);
    body.append("keywords", document.getElementById("q-keywords").value);
    const imageFile = document.getElementById("q-image").files[0];
    if (imageFile) body.append("image", imageFile);

    try {
      if (isEdit) {
        await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "PUT", body });
      } else {
        await apiFetch(CONFIG.ROUTES.QUESTIONS, { method: "POST", body });
      }
      loadQuestions();
    } catch (err) {
      errorEl.textContent = err.message;
    }
  });
}

async function playQuestion(qId) {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading...</p>';

  try {
    const q = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`);

    container.innerHTML = `
      <a href="#" id="back-btn" class="back-link">&larr; Back to questions</a>
      <div class="question-form-wrapper" style="text-align:center">
        <div class="play-question-text">${q.question}</div>
        ${q.imageUrl ? `<img class="question-image" src="${q.imageUrl}" alt="" style="margin:0 auto 1rem">` : ""}
        ${
          q.keywords && q.keywords.length
            ? `<div class="question-keywords" style="justify-content:center;margin-bottom:1.5rem">${q.keywords.map((k) => `<span class="keyword">${k}</span>`).join("")}</div>`
            : ""
        }
        <form id="play-form" style="text-align:left">
          <div class="form-group">
            <label for="play-answer">Your answer</label>
            <textarea id="play-answer" rows="3" required></textarea>
          </div>
          <div style="text-align:center">
            <button type="submit" class="btn btn-play" style="padding:0.7rem 2.5rem;font-size:1rem">Submit</button>
          </div>
        </form>
        <div id="play-result"></div>
        <p id="play-error" class="error"></p>
      </div>`;

    document.getElementById("back-btn").addEventListener("click", (e) => {
      e.preventDefault();
      loadQuestions();
    });

    document.getElementById("play-form").addEventListener("submit", async (e) => {
      e.preventDefault();
      const errorEl = document.getElementById("play-error");
      const resultEl = document.getElementById("play-result");
      errorEl.textContent = "";
      resultEl.innerHTML = "";

      const submittedAnswer = document.getElementById("play-answer").value;

      try {
        const result = await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}/play`, {
          method: "POST",
          body: JSON.stringify({ submittedAnswer }),
        });

        if (result.correct) {
          resultEl.innerHTML = `<div class="play-result correct">Correct!</div>`;
        } else {
          resultEl.innerHTML = `
            <div class="play-result incorrect">
              Incorrect! The answer was: <strong>${result.correctAnswer}</strong>
            </div>`;
        }
      } catch (err) {
        errorEl.textContent = err.message;
      }
    });
  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p>`;
  }
}

async function loadQuiz(difficulty = "") {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Generating random quiz...</p>';

  try {
    const url = difficulty ? `${CONFIG.ROUTES.QUESTIONS}/quiz?difficulty=${difficulty}` : `${CONFIG.ROUTES.QUESTIONS}/quiz`;
    const questions = await apiFetch(url);

    let html = `
      <div class="toolbar" style="justify-content: center; flex-direction: column; text-align: center; margin-bottom: 2rem;">
        <h2 style="font-weight: 800; color: #ffd200; font-size: 1.8rem;">Quiz Mode</h2>
        <p style="color:#aaa; margin-bottom: 1rem">Can you solve these random questions?</p>
        <button class="btn btn-edit" id="exit-quiz-btn">Exit Quiz</button>
      </div>
    `;

    if (!questions || questions.length === 0) {
      html += '<p class="empty-state">Not enough questions in the database to generate a quiz right now.</p>';
    } else {
      html += questions.map((q, index) => `
        <article class="question-card ${q[CONFIG.API_FIELDS.SOLVED] ? "solved-card" : ""}">
          <h3>
            <span style="color:#ffd200; margin-right: 0.5rem">#${index + 1}</span>
            <a href="#" class="question-link" data-id="${q.id}">${q.question}</a>
            ${q[CONFIG.API_FIELDS.SOLVED] ? `<span class="badge-solved">Solved</span>` : ""}
            ${q.difficulty ? `<span class="badge-diff diff-${q.difficulty.toLowerCase()}">${q.difficulty}</span>` : ""}
          </h3>
          <div class="question-actions">
            <span>
              <button class="btn btn-play" data-id="${q.id}">Play</button>
              <a href="#" class="read-more" data-id="${q.id}">See answer</a>
            </span>
          </div>
        </article>
      `).join("");
    }
    
    container.innerHTML = html;

    document.getElementById("exit-quiz-btn").addEventListener("click", () => loadQuestions());
    
    container.querySelectorAll(".btn-play").forEach((el) => {
      el.addEventListener("click", () => playQuestion(el.dataset.id));
    });
    
    container.querySelectorAll(".read-more, .question-link").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        loadQuestionDetail(el.dataset.id);
      });
    });

  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p><div style="text-align:center; margin-top:1rem;"><button class="btn btn-edit" id="error-back-btn">Go Back</button></div>`;
    document.getElementById("error-back-btn").addEventListener("click", () => loadQuestions());
  }
}

async function showLeaderboard() {
  const container = document.getElementById("questions-container");
  container.innerHTML = '<p class="loading">Loading leaderboard...</p>';

  try {
    const leaderboard = await apiFetch('/auth/leaderboard');

    let html = `
      <div class="question-form-wrapper" style="max-width: 500px; margin: 0 auto;">
        <h2 style="text-align: center; margin-bottom: 2rem; font-size: 1.8rem;">🏆 Leaderboard</h2>
        ${leaderboard.length === 0 ? '<p class="empty-state" style="padding: 1rem;">No scores yet. Be the first!</p>' : ""}
        ${leaderboard.map((user, index) => `
          <div class="leaderboard-row">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <span style="font-size: 1.5rem; font-weight: 800; color: ${index === 0 ? '#ffd200' : index === 1 ? '#e0e0e0' : index === 2 ? '#cd7f32' : '#888'}">#${index + 1}</span>
              <span style="font-weight: 700; font-size: 1.1rem;">${user.name}</span>
            </div>
            <div style="background: rgba(81, 207, 102, 0.2); color: #51cf66; padding: 0.3rem 0.8rem; border-radius: 20px; font-weight: 800; font-size: 0.9rem;">
              ${user.successfulAttempts} Solved
            </div>
          </div>
        `).join("")}
        <div style="text-align: center; margin-top: 2.5rem;">
          <button class="btn btn-edit" id="back-to-game-btn">Back to Game</button>
        </div>
      </div>
    `;
    
    container.innerHTML = html;
    document.getElementById("back-to-game-btn").addEventListener("click", () => loadQuestions());

  } catch (err) {
    container.innerHTML = `<p class="error">${err.message}</p><div style="text-align:center; margin-top:1rem;"><button class="btn btn-edit" id="error-back-btn">Go Back</button></div>`;
    document.getElementById("error-back-btn").addEventListener("click", () => loadQuestions());
  }
}

async function deleteQuestion(qId) {
  if (!confirm("Are you sure you want to delete this question?")) return;

  try {
    await apiFetch(`${CONFIG.ROUTES.QUESTIONS}/${qId}`, { method: "DELETE" });
    loadQuestions();
  } catch (err) {
    alert(err.message);
  }
}

function handleLogout() {
  removeToken();
  showAuth();
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("logout-btn").addEventListener("click", handleLogout);
  document.getElementById("leaderboard-btn").addEventListener("click", showLeaderboard);
  
  if (getToken()) {
    showApp();
  } else {
    showAuth();
  }
});