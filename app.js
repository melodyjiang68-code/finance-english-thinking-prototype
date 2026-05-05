const app = document.getElementById("app");
const STORAGE_KEY = "finance-english-thinking-progress-v1";

const state = {
  data: null,
  screen: "home",
  selectedModuleId: null,
  selectedLessonId: null,
  questionIndex: 0,
  answerState: {},
  lessonScore: {},
  progress: loadProgress(),
};

init();

async function init() {
  const res = await fetch("./data/questions.json");
  state.data = await res.json();
  render();
}

function loadProgress() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { lessons: {} };
  } catch {
    return { lessons: {} };
  }
}

function saveProgress() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
}

function render() {
  if (!state.data) return;
  if (state.screen === "home") return renderHome();
  if (state.screen === "modules") return renderModules();
  if (state.screen === "lessons") return renderLessons();
  if (state.screen === "question") return renderQuestion();
  if (state.screen === "lesson-complete") return renderLessonComplete();
}

function renderHome() {
  const moduleCards = state.data.modules
    .map((module) => {
      const completedLessons = module.lessons.filter((lesson) => isLessonCompleted(lesson.id)).length;
      const totalLessons = module.lessons.length;
      const pct = Math.round((completedLessons / totalLessons) * 100);
      return `
        <article class="list-item">
          <div class="row">
            <h3>${module.name}</h3>
            <span class="badge">${completedLessons}/${totalLessons} lessons</span>
          </div>
          <small>${module.title}</small>
          <div class="progress-wrap">
            <div class="progress-track">
              <div class="progress-fill" style="width:${pct}%"></div>
            </div>
          </div>
          <small>${pct}% completed</small>
          <button class="btn btn-primary home-module-btn" data-home-module="${module.id}">Practice ${module.name}</button>
        </article>
      `;
    })
    .join("");

  app.innerHTML = `
    <section class="card hero">
      <div class="badge">Finance English Thinking｜講得像金融人</div>
      <h1>Finance English Thinking</h1>
      <p>Don’t just understand finance.<br />Say it like a finance professional.</p>
      <p>用互動練習，把金融概念變成說得出口的英文。</p>
      <h3 class="section-title">Module Progress</h3>
      <div class="list">${moduleCards}</div>
      <button id="start-btn" class="btn btn-primary">Start Practice</button>
    </section>
  `;
  document.getElementById("start-btn").onclick = () => {
    state.screen = "modules";
    render();
  };
  app.querySelectorAll("[data-home-module]").forEach((el) => {
    el.onclick = () => {
      state.selectedModuleId = el.dataset.homeModule;
      state.screen = "lessons";
      render();
    };
  });
}

function renderModules() {
  const modules = state.data.modules;
  app.innerHTML = `
    <section class="card">
      <h2 class="section-title">Choose a Module</h2>
      <div class="list">
      ${modules
        .map(
          (m) => `
          <article class="list-item">
            <h3>${m.title}</h3>
            <p>${m.subtitle}</p>
            <button class="btn btn-primary" data-module="${m.id}">Open ${m.name}</button>
          </article>
      `
        )
        .join("")}
      </div>
      <button id="back-home" class="btn btn-secondary">Back</button>
    </section>
  `;
  app.querySelectorAll("[data-module]").forEach((el) => {
    el.onclick = () => {
      state.selectedModuleId = el.dataset.module;
      state.screen = "lessons";
      render();
    };
  });
  document.getElementById("back-home").onclick = () => {
    state.screen = "home";
    render();
  };
}

function renderLessons() {
  const module = getSelectedModule();
  app.innerHTML = `
    <section class="card">
      <h2 class="section-title">${module.title}</h2>
      <div class="list">
        ${module.lessons
          .map((lesson) => {
            const p = state.progress.lessons[lesson.id];
            const status = p ? `${p.correct}/${lesson.questions.length} completed` : "Not started";
            return `
            <article class="list-item">
              <h3>${lesson.title}</h3>
              <p>Focus: ${lesson.focusWords.join(", ")}</p>
              <div class="row">
                <span class="badge">${status}</span>
                <button class="btn btn-primary" data-lesson="${lesson.id}">Start Lesson</button>
              </div>
            </article>
            `;
          })
          .join("")}
      </div>
      <button id="back-modules" class="btn btn-secondary">Back to Modules</button>
    </section>
  `;
  app.querySelectorAll("[data-lesson]").forEach((el) => {
    el.onclick = () => startLesson(el.dataset.lesson);
  });
  document.getElementById("back-modules").onclick = () => {
    state.screen = "modules";
    render();
  };
}

function startLesson(lessonId) {
  state.selectedLessonId = lessonId;
  state.questionIndex = 0;
  state.answerState = {};
  state.lessonScore = {
    total: 0,
    correct: 0,
    skills: {
      Clarity: { total: 0, correct: 0 },
      Precision: { total: 0, correct: 0 },
      Authority: { total: 0, correct: 0 },
      Tone: { total: 0, correct: 0 },
    },
  };
  state.screen = "question";
  render();
}

function renderQuestion() {
  const lesson = getSelectedLesson();
  const q = lesson.questions[state.questionIndex];
  state.answerState = {};
  const progressPct = Math.round((state.questionIndex / lesson.questions.length) * 100);
  const promptZh = getPromptZh(q.id);
  app.innerHTML = `
    <section class="card question-card">
      <div class="row"><strong>${lesson.title}</strong><span>Q${state.questionIndex + 1}/${lesson.questions.length}</span></div>
      <div class="progress-wrap">
        <div class="progress-track"><div class="progress-fill" style="width:${progressPct}%"></div></div>
      </div>
      <h2>${q.prompt}</h2>
      ${promptZh ? `<p class="muted-zh">${promptZh}</p>` : ""}
      <div class="skill-tags">${q.skill.map((s) => `<span class="tag">${s}</span>`).join("")}</div>
      <div id="interaction"></div>
      <button id="check-btn" class="btn btn-primary">Check Answer</button>
      <button id="back-lessons" class="btn btn-secondary">Exit Lesson</button>
      <div id="feedback"></div>
    </section>
  `;

  renderInteraction(q);

  document.getElementById("check-btn").onclick = () => {
    const result = evaluateAnswer(q);
    renderFeedback(result, q.feedback);
    updateScore(q, result.status === "Correct");
    if (result.status === "Correct" || result.status === "Almost") {
      document.getElementById("check-btn").textContent = state.questionIndex === lesson.questions.length - 1 ? "Finish Lesson" : "Next Question";
      document.getElementById("check-btn").onclick = () => {
        state.questionIndex += 1;
        if (state.questionIndex >= lesson.questions.length) {
          finalizeLesson();
          state.screen = "lesson-complete";
        }
        render();
      };
    }
  };

  document.getElementById("back-lessons").onclick = () => {
    state.screen = "lessons";
    render();
  };
}

function renderInteraction(q) {
  const node = document.getElementById("interaction");
  if (q.type === "multiple_choice" || q.type === "scenario_choice") {
    node.innerHTML = `<div class="options">${q.options.map((o) => `<button class="option-btn" data-opt="${encodeURIComponent(o)}">${o}</button>`).join("")}</div>`;
    node.querySelectorAll(".option-btn").forEach((btn) => {
      btn.onclick = () => {
        node.querySelectorAll(".option-btn").forEach((x) => x.classList.remove("selected"));
        btn.classList.add("selected");
        state.answerState.selected = decodeURIComponent(btn.dataset.opt);
      };
    });
  }

  if (q.type === "matching_drag") {
    state.answerState.matching = {};
    node.innerHTML = `
      <p><small>Drag a meaning to each term. On mobile, tap a meaning first, then tap a target box.</small></p>
      <div class="pair-grid">
        ${q.pairs
          .map(
            (pair, idx) => `
          <div class="pair-row">
            <div class="drop-zone" data-key="${pair.term}" data-slot="${idx}">${pair.term}</div>
            <div class="drop-zone match-target" data-drop="${idx}" data-assigned="">Drop meaning here</div>
          </div>`
          )
          .join("")}
      </div>
      <div class="pair-grid">
        ${shuffle(q.pairs.map((p) => p.meaning))
          .map((m) => `<div class="draggable meaning-option" draggable="true" data-meaning="${encodeURIComponent(m)}">${m}</div>`)
          .join("")}
      </div>
    `;

    let activeMeaning = null;
    node.querySelectorAll(".meaning-option").forEach((item) => {
      item.addEventListener("dragstart", () => {
        activeMeaning = decodeURIComponent(item.dataset.meaning);
      });
      item.addEventListener("click", () => {
        node.querySelectorAll(".meaning-option").forEach((x) => x.classList.remove("selected"));
        item.classList.add("selected");
        activeMeaning = decodeURIComponent(item.dataset.meaning);
      });
    });

    node.querySelectorAll(".match-target").forEach((target) => {
      target.addEventListener("dragover", (e) => e.preventDefault());
      target.addEventListener("drop", (e) => {
        e.preventDefault();
        if (!activeMeaning) return;
        assignMeaningToTarget(node, target, activeMeaning);
      });
      target.addEventListener("click", () => {
        if (!activeMeaning) return;
        assignMeaningToTarget(node, target, activeMeaning);
      });
    });
  }

  if (q.type === "ranking") {
    node.innerHTML = `
      <div class="sortable">
        ${q.items.map((i) => `<div class="sortable-item" draggable="true" data-value="${encodeURIComponent(i)}">${i}</div>`).join("")}
      </div>`;
    enableSortDnD(node.querySelector(".sortable"));
  }

  if (q.type === "sentence_drag") {
    node.innerHTML = `
      <div class="sentence-zone" id="sentence-zone"></div>
      <div class="sentence-bank" id="sentence-bank">
      ${shuffle(q.chunks).map((c) => `<button class="chip" data-chunk="${encodeURIComponent(c)}">${c}</button>`).join("")}
      </div>
    `;
    node.querySelectorAll(".chip").forEach((chip) => {
      chip.onclick = () => {
        chip.remove();
        document.getElementById("sentence-zone").append(chip);
      };
    });
  }

  if (q.type === "tap_replace") {
    node.innerHTML = `
      <p><strong>Original:</strong> ${q.original}</p>
      <div class="options">
      ${q.replacements.map((r) => `<button class="option-btn" data-opt="${encodeURIComponent(r)}">${r}</button>`).join("")}
      </div>
    `;
    node.querySelectorAll(".option-btn").forEach((btn) => {
      btn.onclick = () => {
        node.querySelectorAll(".option-btn").forEach((x) => x.classList.remove("selected"));
        btn.classList.add("selected");
        state.answerState.selected = decodeURIComponent(btn.dataset.opt);
      };
    });
  }

  if (q.type === "tone_slider") {
    node.innerHTML = `
      <p>${q.instruction}</p>
      <div class="slider-wrap">
        <div class="row"><small>Direct</small><small>Soft</small></div>
        <input id="tone-slider" type="range" min="0" max="100" value="50" />
      </div>
    `;
    document.getElementById("tone-slider").oninput = (e) => {
      state.answerState.tone = Number(e.target.value);
    };
    state.answerState.tone = 50;
  }
}

function evaluateAnswer(q) {
  if (q.type === "multiple_choice" || q.type === "scenario_choice" || q.type === "tap_replace") {
    return { status: state.answerState.selected === q.answer ? "Correct" : "Try again" };
  }

  if (q.type === "sentence_drag") {
    const selected = [...document.querySelectorAll("#sentence-zone .chip")].map((c) => decodeURIComponent(c.dataset.chunk));
    if (selected.join(" ") === q.answer.join(" ")) return { status: "Correct" };
    return selected.length >= q.answer.length - 1 ? { status: "Almost" } : { status: "Try again" };
  }

  if (q.type === "ranking") {
    const current = [...document.querySelectorAll(".sortable-item")].map((n) => decodeURIComponent(n.dataset.value));
    if (JSON.stringify(current) === JSON.stringify(q.order)) return { status: "Correct" };
    return { status: "Try again" };
  }

  if (q.type === "matching_drag") {
    const answer = state.answerState.matching || {};
    const isCorrect = q.pairs.every((pair) => answer[pair.term] === pair.meaning);
    return { status: isCorrect ? "Correct" : "Try again" };
  }

  if (q.type === "tone_slider") {
    const value = state.answerState.tone ?? 50;
    const [min, max] = q.targetRange;
    if (value >= min && value <= max) return { status: "Correct" };
    return value >= min - 15 && value <= max + 15 ? { status: "Almost" } : { status: "Try again" };
  }

  return { status: "Try again" };
}

function renderFeedback(result, feedback) {
  const css = result.status === "Correct" ? "ok" : result.status === "Almost" ? "almost" : "fail";
  document.getElementById("feedback").innerHTML = `
    <div class="feedback">
      <h4 class="${css}">✅ ${result.status}</h4>
      <p><strong>Better version:</strong><br />${feedback.betterVersion}</p>
      <p><strong>Why:</strong><br />${feedback.why}</p>
    </div>
  `;
}

function updateScore(question, isCorrect) {
  state.lessonScore.total += 1;
  if (isCorrect) state.lessonScore.correct += 1;
  question.skill.forEach((s) => {
    state.lessonScore.skills[s].total += 1;
    if (isCorrect) state.lessonScore.skills[s].correct += 1;
  });
}

function finalizeLesson() {
  const lesson = getSelectedLesson();
  state.progress.lessons[lesson.id] = {
    correct: state.lessonScore.correct,
    total: state.lessonScore.total,
    skills: state.lessonScore.skills,
  };
  saveProgress();
}

function renderLessonComplete() {
  const stats = state.lessonScore.skills;
  app.innerHTML = `
    <section class="card">
      <h2>Lesson Completed</h2>
      <p>You practiced:</p>
      <ul>
        <li>clearer financial wording</li>
        <li>more precise sentence structure</li>
        <li>more professional tone</li>
      </ul>
      <ul class="summary-list">
        ${["Clarity", "Precision", "Authority", "Tone"]
          .map((k) => {
            const t = stats[k].total || 1;
            const pct = Math.round((stats[k].correct / t) * 100);
            return `<li><span>${k}:</span><strong>${pct}%</strong></li>`;
          })
          .join("")}
      </ul>
      <button id="continue-btn" class="btn btn-primary">Continue</button>
    </section>
  `;
  document.getElementById("continue-btn").onclick = () => {
    state.screen = "lessons";
    render();
  };
}

function getSelectedModule() {
  return state.data.modules.find((m) => m.id === state.selectedModuleId);
}

function getSelectedLesson() {
  const module = getSelectedModule();
  return module.lessons.find((l) => l.id === state.selectedLessonId);
}

function isLessonCompleted(lessonId) {
  const entry = state.progress.lessons[lessonId];
  return Boolean(entry && entry.total > 0 && entry.correct >= entry.total);
}

function getPromptZh(questionId) {
  const zh = {
    l1q1: "市場價格因投資人不確定而上下波動，請選最精準動詞。",
    l1q2: "請配對字詞與意思。",
    l1q3: "請把句子從最弱到最強排序。",
    l1q4: "請拖拉或點選語塊完成句子。",
    l1q5: "情境：央行意外升息，哪句最像市場分析？",
    l2q1: "請配對市場參與者與角色。",
    l2q2: "股價上漲且投資人樂觀，這是什麼市場？",
    l2q3: "很多散戶進場，哪句最精準？",
    l2q4: "請組合句子。",
    l2q5: "請從弱到強排序。",
    l3q1: "請選出正確因果連接詞。",
    l3q2: "請配對經濟指標與意思。",
    l3q3: "請選出最完整的專業句子。",
    l3q4: "請組合因果句。",
    l3q5: "情境判斷：哪句最像分析？",
    l4q1: "請選出更精準說法。",
    l4q2: "請配對企業金融詞彙。",
    l4q3: "請選出正確搭配詞。",
    l4q4: "請組合句子。",
    l4q5: "請從弱到強排序。",
    l5q1: "請配對投資銀行詞彙。",
    l5q2: "情境：公司要上市，選最佳句。",
    l5q3: "請選出更專業的詞。",
    l5q4: "請組合句子。",
    l5q5: "情境：被大型競爭者收購，選最佳句。",
    l6q1: "請配對財富管理詞彙。",
    l6q2: "請選出精準說法。",
    l6q3: "請選出正確比較句。",
    l6q4: "請組合句子。",
    l6q5: "請從弱到強排序。",
    l7q1: "情境：客戶擔心波動，選最柔和建議。",
    l7q2: "請把語氣滑到較柔和區間。",
    l7q3: "這句的 would 在這裡是什麼功能？",
    l7q4: "請點選替換成較柔和版本。",
    l7q5: "要提出機會但不過度自信，選最佳句。",
    l8q1: "請配對商業策略詞彙。",
    l8q2: "請選出最自然商業表達。",
    l8q3: "提醒看整體策略時，選正確句。",
    l8q4: "請組合句子。",
    l8q5: "請從弱到強排序。",
    l9q1: "請選出主動語態。",
    l9q2: "請選出更有主導性的句子。",
    l9q3: "請替換成更直接版本。",
    l9q4: "請組合句子。",
    l9q5: "請從弱到強排序。",
    l10q1: "請配對監管詞彙。",
    l10q2: "請選出最正式說法。",
    l10q3: "mandatory 的意思是什麼？",
    l10q4: "請組合句子。",
    l10q5: "要表達這是規定不是建議，選最佳句。",
    l11q1: "請配對 AML/KYC 詞彙。",
    l11q2: "情境：交易可疑，選最佳處置。",
    l11q3: "請選出最自然說法。",
    l11q4: "請組合句子。",
    l11q5: "請排序 AML/KYC 流程。",
    l12q1: "請配對資安與資料風險詞彙。",
    l12q2: "請選出最精準句子。",
    l12q3: "請組合 If...then... 句型。",
    l12q4: "情境：系統弱點可能外洩資料，選最佳句。",
    l12q5: "請從弱到強排序。"
  };
  return zh[questionId] || "";
}


function assignMeaningToTarget(root, target, meaning) {
  target.textContent = meaning;
  target.dataset.assigned = meaning;
  const idx = Number(target.dataset.drop);
  const term = root.querySelector(`[data-slot="${idx}"]`)?.dataset.key;
  if (!term) return;
  state.answerState.matching[term] = meaning;
}

function shuffle(list) {
  const arr = [...list];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function enableSimpleDnD(root) {
  let dragged = null;
  root.querySelectorAll(".draggable").forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragged = item;
    });
  });
  root.querySelectorAll("[data-drop]").forEach((zone) => {
    zone.addEventListener("dragover", (e) => e.preventDefault());
    zone.addEventListener("drop", (e) => {
      e.preventDefault();
      if (!dragged) return;
      zone.innerHTML = "";
      zone.appendChild(dragged);
    });
  });
}

function enableSortDnD(container) {
  let dragged = null;
  [...container.children].forEach((item) => {
    item.addEventListener("dragstart", () => {
      dragged = item;
    });
    item.addEventListener("dragover", (e) => e.preventDefault());
    item.addEventListener("drop", (e) => {
      e.preventDefault();
      if (dragged && dragged !== item) {
        const children = [...container.children];
        const draggedIndex = children.indexOf(dragged);
        const targetIndex = children.indexOf(item);
        if (draggedIndex < targetIndex) container.insertBefore(dragged, item.nextSibling);
        else container.insertBefore(dragged, item);
      }
    });
  });
}
