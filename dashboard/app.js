(() => {
  'use strict';

  const STORAGE_KEY = 'zecquiz.dashboard.credentials';
  const state = {
    token: null,
    credentials: readCredentials(),
    quizzes: [],
    runs: [],
    ranking: [],
    rankingCursor: null,
    selectedQuiz: null,
    status: '',
    authenticating: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  function readCredentials() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || null; } catch { return null; }
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>'"]/g, (character) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;',
    })[character]);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(date);
  }

  function shortId(value) { return value ? `${String(value).slice(0, 8)}…` : '—'; }

  function idempotencyKey(prefix) {
    return `${prefix}-${globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`}`;
  }

  function notice(message, error = false) {
    const element = $('#notice');
    element.textContent = message;
    element.classList.toggle('error', error);
    element.hidden = false;
    clearTimeout(notice.timer);
    notice.timer = setTimeout(() => { element.hidden = true; }, 5000);
  }

  function setConnection(status, label) {
    const container = $('#connection-label').parentElement;
    container.classList.remove('online', 'offline');
    if (status) container.classList.add(status);
    $('#connection-label').textContent = label;
  }

  async function readResponse(response) {
    if (response.status === 204) return null;
    const text = await response.text();
    if (!text) return null;
    try { return JSON.parse(text); } catch { return text; }
  }

  function errorMessage(payload, response) {
    if (payload && typeof payload === 'object') return payload.detail || payload.title || payload.message || `Request failed (${response.status})`;
    return typeof payload === 'string' && payload ? payload : `Request failed (${response.status})`;
  }

  async function authenticate(forceLogin = false) {
    if (state.authenticating) return state.authenticating;
    state.authenticating = (async () => {
      let response;
      if (!forceLogin) {
        response = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' });
        if (response.ok) {
          const session = await response.json();
          state.token = session.accessToken;
          setConnection('online', `Connected as ${session.user.username}`);
          renderCredentialStatus(session.user.username);
          return state.token;
        }
      }
      if (!state.credentials?.username || !state.credentials?.password) {
        state.token = null;
        setConnection('offline', 'Credentials required');
        renderCredentialStatus();
        throw new Error('Management credentials are not configured. Add them under Credentials.');
      }
      response = await fetch('/api/v1/auth/login', {
        method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' },
        body: JSON.stringify(state.credentials),
      });
      const payload = await readResponse(response);
      if (!response.ok) {
        state.token = null;
        setConnection('offline', 'Authentication failed');
        renderCredentialStatus(null, errorMessage(payload, response));
        throw new Error(errorMessage(payload, response));
      }
      state.token = payload.accessToken;
      setConnection('online', `Connected as ${payload.user.username}`);
      renderCredentialStatus(payload.user.username);
      return state.token;
    })().finally(() => { state.authenticating = null; });
    return state.authenticating;
  }

  async function api(path, options = {}, protectedEndpoint = true, retried = false) {
    const headers = new Headers(options.headers || {});
    if (protectedEndpoint) {
      if (!state.token) await authenticate();
      headers.set('authorization', `Bearer ${state.token}`);
    }
    if (options.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
    const response = await fetch(path, { ...options, headers, credentials: 'same-origin' });
    if (response.status === 401 && protectedEndpoint && !retried) {
      state.token = null;
      await authenticate();
      return api(path, options, protectedEndpoint, true);
    }
    const payload = await readResponse(response);
    if (!response.ok) throw new Error(errorMessage(payload, response));
    return payload;
  }

  function showView(view) {
    $$('.view').forEach((element) => element.classList.toggle('active', element.id === `view-${view}`));
    $$('.nav-item').forEach((element) => element.classList.toggle('active', element.dataset.view === view));
    $('#page-title').textContent = ({ overview: 'Overview', quizzes: 'Quizzes', rankings: 'Participants & ranking', settings: 'Credentials' })[view];
    $('#header-action').hidden = view === 'settings';
    $('#header-action').textContent = view === 'rankings' ? 'Refresh ranking' : 'New quiz';
  }

  function renderCredentialStatus(username, error) {
    $('#credential-username').value = state.credentials?.username || '';
    $('#credential-password').value = state.credentials?.password || '';
    const status = $('#credential-status');
    if (error) status.textContent = `Connection failed: ${error}`;
    else if (username) status.textContent = `Connected as ${username}.`;
    else if (state.credentials) status.textContent = 'Credentials saved. Connection has not been verified.';
    else status.textContent = 'No credentials configured.';
  }

  async function loadOverview() {
    const publicRequests = Promise.all([
      api('/api/v1/public/trivia-runs?limit=10', {}, false),
      api('/api/v1/public/rankings/overall?limit=10', {}, false),
    ]);
    const managementRequest = loadQuizzes(false).catch((error) => {
      renderQuizList(error.message);
      return null;
    });
    try {
      const [runsResponse, rankingResponse] = await publicRequests;
      state.runs = runsResponse.data.items;
      state.ranking = rankingResponse.data.items;
      $('#stat-runs').textContent = runsResponse.data.total;
      $('#stat-participants').textContent = rankingResponse.data.total;
      renderTopRanking();
      populateRankingTargets();
    } catch (error) {
      setConnection('offline', 'API unavailable');
      notice(error.message, true);
    }
    await managementRequest;
    renderOverviewQuizzes();
  }

  async function loadQuizzes(selectFirst = true) {
    const query = new URLSearchParams({ limit: '100' });
    if (state.status) query.set('status', state.status);
    const response = await api(`/api/v1/trivias?${query}`);
    state.quizzes = response.data.items;
    $('#stat-quizzes').textContent = response.data.total;
    $('#stat-published').textContent = state.quizzes.filter((quiz) => quiz.status === 'published').length;
    renderQuizList();
    renderOverviewQuizzes();
    populateRankingTargets();
    if (selectFirst && state.quizzes.length && !state.selectedQuiz) await selectQuiz(state.quizzes[0].id);
    if (state.selectedQuiz && !state.quizzes.some((quiz) => quiz.id === state.selectedQuiz.id)) {
      state.selectedQuiz = null;
      $('#quiz-detail').className = 'detail empty';
      $('#quiz-detail').textContent = 'Select a quiz to manage it.';
    }
    return response;
  }

  function renderOverviewQuizzes() {
    const container = $('#recent-quizzes');
    if (!state.quizzes.length) { container.className = 'list empty'; container.textContent = 'No quizzes available.'; return; }
    container.className = 'list';
    container.innerHTML = state.quizzes.slice(0, 5).map((quiz) => `<div class="list-row"><div><strong>${escapeHtml(quiz.name)}</strong><p>${formatDate(quiz.updatedAt)}</p></div><span class="badge ${escapeHtml(quiz.status)}">${escapeHtml(quiz.status)}</span></div>`).join('');
  }

  function renderTopRanking() {
    const container = $('#top-ranking');
    if (!state.ranking.length) { container.className = 'list empty'; container.textContent = 'No completed participant scores yet.'; return; }
    container.className = 'list';
    container.innerHTML = state.ranking.slice(0, 5).map((row) => `<div class="list-row"><span class="rank-number">${row.rank}</span><div class="rank-user"><strong>${escapeHtml(row.displayName)}</strong><p>${row.correctAnswers} correct · ${row.wrongAnswers} wrong</p></div><strong>${row.totalPoints} pts</strong></div>`).join('');
  }

  function renderQuizList(error) {
    const container = $('#quiz-list');
    if (error) { container.className = 'cards empty'; container.textContent = error; return; }
    if (!state.quizzes.length) { container.className = 'cards empty'; container.textContent = 'No quizzes match this filter.'; return; }
    container.className = 'cards';
    container.innerHTML = state.quizzes.map((quiz) => `<article class="quiz-card ${state.selectedQuiz?.id === quiz.id ? 'active' : ''}" data-id="${escapeHtml(quiz.id)}"><div class="quiz-card-head"><strong>${escapeHtml(quiz.name)}</strong><span class="badge ${escapeHtml(quiz.status)}">${escapeHtml(quiz.status)}</span></div><p>${escapeHtml(quiz.description)}</p><p>${escapeHtml(quiz.language)} · v${quiz.version} · ${formatDate(quiz.updatedAt)}</p></article>`).join('');
  }

  async function selectQuiz(id) {
    try {
      const response = await api(`/api/v1/trivias/${encodeURIComponent(id)}`);
      state.selectedQuiz = response.data;
      renderQuizList();
      renderQuizDetail();
    } catch (error) { notice(error.message, true); }
  }

  function renderQuizDetail() {
    const quiz = state.selectedQuiz;
    const container = $('#quiz-detail');
    if (!quiz) { container.className = 'detail empty'; container.textContent = 'Select a quiz to manage it.'; return; }
    const questions = [...(quiz.questions || [])].sort((a, b) => a.position - b.position);
    container.className = 'detail';
    container.innerHTML = `<div class="detail-header"><div><div class="question-heading"><h2>${escapeHtml(quiz.name)}</h2><span class="badge ${escapeHtml(quiz.status)}">${escapeHtml(quiz.status)}</span></div><p>${escapeHtml(quiz.description)}</p><small class="muted">${escapeHtml(quiz.language)} · ${quiz.defaultQuestionDurationSeconds}s default · v${quiz.version} · ${shortId(quiz.id)}</small></div><div class="actions"><button class="secondary" data-action="edit-quiz">Edit</button><button class="secondary" data-action="duplicate">Duplicate</button>${quiz.status === 'draft' ? '<button class="primary" data-action="publish">Publish</button>' : ''}<button class="danger-text" data-action="delete-quiz">${quiz.status === 'draft' ? 'Delete' : 'Archive'}</button></div></div><div class="panel-title"><h2>Questions (${questions.length})</h2>${quiz.status !== 'archived' ? '<button class="primary" data-action="add-question">Add question</button>' : ''}</div><div class="question-list">${questions.length ? questions.map((question, index) => `<article class="question-item" data-question-id="${escapeHtml(question.id)}"><span class="position">${index + 1}</span><div><strong>${escapeHtml(question.prompt)}</strong><p>${question.options?.length || 0} options · ${question.points} pt${question.points === 1 ? '' : 's'} · ${Number(question.prize || 0)} $ZEC${question.durationSeconds ? ` · ${question.durationSeconds}s` : ''}</p></div><div class="question-actions"><button title="Move up" data-question-action="up" ${index === 0 ? 'disabled' : ''}>↑</button><button title="Move down" data-question-action="down" ${index === questions.length - 1 ? 'disabled' : ''}>↓</button><button title="Edit" data-question-action="edit">✎</button><button title="Delete" data-question-action="delete">×</button></div></article>`).join('') : '<div class="list empty">No questions yet. Add at least one before publishing.</div>'}</div>`;
  }

  function openQuizDialog(quiz = null) {
    $('#quiz-dialog-title').textContent = quiz ? 'Edit quiz' : 'New quiz';
    $('#quiz-id').value = quiz?.id || '';
    $('#quiz-version').value = quiz?.version || '';
    $('#quiz-name').value = quiz?.name || '';
    $('#quiz-description').value = quiz?.description || '';
    $('#quiz-language').value = quiz?.language || 'en';
    $('#quiz-duration').value = quiz?.defaultQuestionDurationSeconds || 40;
    $('#quiz-dialog').showModal();
  }

  function renderOptionFields(options = []) {
    const normalized = Array.from({ length: 4 }, (_, index) => options[index] || { text: '', isCorrect: index === 0 });
    $('#option-fields').innerHTML = normalized.map((option, index) => `<label class="option-row"><input type="radio" name="correct-option" value="${index}" ${option.isCorrect ? 'checked' : ''} aria-label="Mark option ${index + 1} correct"><input type="text" maxlength="500" value="${escapeHtml(option.text)}" placeholder="Option ${index + 1}${index > 1 ? ' (optional)' : ''}" ${index < 2 ? 'required' : ''}></label>`).join('');
  }

  function openQuestionDialog(question = null) {
    $('#question-dialog-title').textContent = question ? 'Edit question' : 'Add question';
    $('#question-id').value = question?.id || '';
    $('#question-version').value = question?.version || '';
    $('#question-prompt').value = question?.prompt || '';
    $('#question-duration').value = question?.durationSeconds || '';
    $('#question-points').value = question?.points || 1;
    $('#question-prize').value = Number(question?.prize || 0);
    renderOptionFields(question?.options?.slice().sort((a, b) => a.position - b.position));
    $('#question-dialog').showModal();
  }

  async function saveQuiz(event) {
    event.preventDefault();
    const id = $('#quiz-id').value;
    const payload = {
      name: $('#quiz-name').value.trim(), description: $('#quiz-description').value.trim(),
      language: $('#quiz-language').value.trim(), defaultQuestionDurationSeconds: Number($('#quiz-duration').value),
    };
    try {
      let response;
      if (id) response = await api(`/api/v1/trivias/${id}`, { method: 'PATCH', body: JSON.stringify({ ...payload, version: Number($('#quiz-version').value) }) });
      else response = await api('/api/v1/trivias', { method: 'POST', headers: { 'idempotency-key': idempotencyKey('dashboard-create') }, body: JSON.stringify({ ...payload, questions: [] }) });
      $('#quiz-dialog').close();
      state.selectedQuiz = response.data;
      await loadQuizzes(false);
      renderQuizDetail();
      notice(id ? 'Quiz updated.' : 'Quiz created.');
    } catch (error) { notice(error.message, true); }
  }

  async function saveQuestion(event) {
    event.preventDefault();
    const id = $('#question-id').value;
    const optionRows = $$('#option-fields .option-row');
    const correctIndex = Number($('#option-fields input[type=radio]:checked')?.value);
    const options = optionRows.map((row, index) => ({ text: row.querySelector('input[type=text]').value.trim(), isCorrect: index === correctIndex })).filter((option) => option.text);
    if (options.length < 2) return notice('A question needs at least two options.', true);
    if (!options.some((option) => option.isCorrect)) return notice('The correct option cannot be empty.', true);
    const payload = {
      prompt: $('#question-prompt').value.trim(), durationSeconds: $('#question-duration').value ? Number($('#question-duration').value) : null,
      points: Number($('#question-points').value), prize: Number($('#question-prize').value), options,
    };
    try {
      if (id) await api(`/api/v1/trivias/${state.selectedQuiz.id}/questions/${id}`, { method: 'PUT', body: JSON.stringify({ ...payload, version: Number($('#question-version').value) }) });
      else await api(`/api/v1/trivias/${state.selectedQuiz.id}/questions`, { method: 'POST', body: JSON.stringify(payload) });
      $('#question-dialog').close();
      await selectQuiz(state.selectedQuiz.id);
      notice(id ? 'Question updated.' : 'Question added.');
    } catch (error) { notice(error.message, true); }
  }

  async function quizAction(action) {
    const quiz = state.selectedQuiz;
    if (!quiz) return;
    try {
      if (action === 'edit-quiz') return openQuizDialog(quiz);
      if (action === 'add-question') return openQuestionDialog();
      if (action === 'duplicate') {
        const response = await api(`/api/v1/trivias/${quiz.id}/duplicate`, { method: 'POST' });
        state.selectedQuiz = response.data;
        await loadQuizzes(false); renderQuizDetail(); notice('Editable copy created.'); return;
      }
      if (action === 'publish') {
        if (!confirm(`Publish “${quiz.name}”?`)) return;
        const response = await api(`/api/v1/trivias/${quiz.id}/publish`, { method: 'POST', headers: { 'idempotency-key': idempotencyKey('dashboard-publish') } });
        state.selectedQuiz = response.data;
        await loadQuizzes(false); renderQuizDetail(); notice('Quiz published.'); return;
      }
      if (action === 'delete-quiz') {
        if (!confirm(`${quiz.status === 'draft' ? 'Delete' : 'Archive'} “${quiz.name}”?`)) return;
        await api(`/api/v1/trivias/${quiz.id}`, { method: 'DELETE' });
        state.selectedQuiz = null; await loadQuizzes(); notice(quiz.status === 'draft' ? 'Quiz deleted.' : 'Quiz archived.');
      }
    } catch (error) { notice(error.message, true); }
  }

  async function questionAction(questionId, action) {
    const questions = [...state.selectedQuiz.questions].sort((a, b) => a.position - b.position);
    const index = questions.findIndex((question) => question.id === questionId);
    if (index < 0) return;
    if (action === 'edit') return openQuestionDialog(questions[index]);
    try {
      if (action === 'delete') {
        if (!confirm('Delete this question?')) return;
        await api(`/api/v1/trivias/${state.selectedQuiz.id}/questions/${questionId}`, { method: 'DELETE' });
        await selectQuiz(state.selectedQuiz.id); notice('Question deleted.'); return;
      }
      const target = action === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= questions.length) return;
      [questions[index], questions[target]] = [questions[target], questions[index]];
      const response = await api(`/api/v1/trivias/${state.selectedQuiz.id}/questions/order`, { method: 'PUT', body: JSON.stringify({ questionIds: questions.map((question) => question.id) }) });
      state.selectedQuiz = response.data; renderQuizDetail(); notice('Question order updated.');
    } catch (error) { notice(error.message, true); }
  }

  function populateRankingTargets() {
    const scope = $('#ranking-scope').value;
    const select = $('#ranking-target');
    const items = scope === 'run' ? state.runs : state.quizzes.filter((quiz) => quiz.status === 'published');
    select.innerHTML = items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(scope === 'run' ? `${item.trivia?.name || 'Quiz'} — ${formatDate(item.completedAt)}` : item.name)}</option>`).join('');
    $('#ranking-target-wrap').hidden = scope === 'overall';
  }

  function rankingPath(cursor) {
    const scope = $('#ranking-scope').value;
    const target = $('#ranking-target').value;
    let path = '/api/v1/public/rankings/overall';
    if (scope === 'run' && target) path = `/api/v1/public/trivia-runs/${encodeURIComponent(target)}/rankings`;
    if (scope === 'trivia' && target) path = `/api/v1/public/trivias/${encodeURIComponent(target)}/rankings`;
    const query = new URLSearchParams({ limit: '50' });
    if (cursor) query.set('cursor', cursor);
    return `${path}?${query}`;
  }

  async function loadRanking(append = false) {
    const scope = $('#ranking-scope').value;
    if (scope !== 'overall' && !$('#ranking-target').value) {
      state.ranking = []; state.rankingCursor = null; renderRanking(0); return;
    }
    try {
      const response = await api(rankingPath(append ? state.rankingCursor : null), {}, false);
      state.ranking = append ? [...state.ranking, ...response.data.items] : response.data.items;
      state.rankingCursor = response.data.nextCursor;
      renderRanking(response.data.total);
    } catch (error) { notice(error.message, true); }
  }

  function renderRanking(total) {
    const body = $('#ranking-body');
    body.innerHTML = state.ranking.length ? state.ranking.map((row) => `<tr><td><strong>${row.rank}</strong></td><td>${escapeHtml(row.displayName)}<br><small class="muted">${shortId(row.publicUserId)}</small></td><td><strong>${row.totalPoints}</strong></td><td>${row.correctAnswers}</td><td>${row.wrongAnswers}</td><td>${row.answeredQuestions}</td></tr>`).join('') : '<tr><td colspan="6" class="muted">No participants found for this scope.</td></tr>';
    $('#ranking-summary').textContent = `${total ?? 0} participant${total === 1 ? '' : 's'} in this ranking.`;
    $('#ranking-more').hidden = !state.rankingCursor;
    renderTopRanking();
  }

  async function saveCredentials(event) {
    event.preventDefault();
    state.credentials = { username: $('#credential-username').value.trim(), password: $('#credential-password').value };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.credentials));
    state.token = null;
    try { await authenticate(true); notice('Credentials saved and verified.'); await loadQuizzes(); }
    catch (error) { notice(error.message, true); }
  }

  async function clearCredentials() {
    try { await fetch('/api/v1/auth/logout', { method: 'POST', credentials: 'same-origin' }); } catch { /* local cleanup still proceeds */ }
    localStorage.removeItem(STORAGE_KEY);
    state.credentials = null; state.token = null; state.quizzes = []; state.selectedQuiz = null;
    $('#credentials-form').reset(); renderCredentialStatus(); renderQuizList('Management credentials are not configured.'); renderQuizDetail();
    setConnection('offline', 'Credentials required'); notice('Stored credentials cleared.');
  }

  function bindEvents() {
    $$('.nav-item').forEach((button) => button.addEventListener('click', () => showView(button.dataset.view)));
    $$('[data-go]').forEach((button) => button.addEventListener('click', () => showView(button.dataset.go)));
    $('#header-action').addEventListener('click', () => $('#header-action').textContent === 'Refresh ranking' ? loadRanking() : openQuizDialog());
    $('#refresh-quizzes').addEventListener('click', () => loadQuizzes().catch((error) => notice(error.message, true)));
    $('#quiz-filters').addEventListener('click', (event) => {
      const button = event.target.closest('[data-status]'); if (!button) return;
      state.status = button.dataset.status; $$('#quiz-filters button').forEach((item) => item.classList.toggle('active', item === button));
      state.selectedQuiz = null; loadQuizzes().catch((error) => notice(error.message, true));
    });
    $('#quiz-list').addEventListener('click', (event) => { const card = event.target.closest('[data-id]'); if (card) selectQuiz(card.dataset.id); });
    $('#quiz-detail').addEventListener('click', (event) => {
      const action = event.target.closest('[data-action]'); if (action) return quizAction(action.dataset.action);
      const questionActionButton = event.target.closest('[data-question-action]');
      if (questionActionButton) questionAction(questionActionButton.closest('[data-question-id]').dataset.questionId, questionActionButton.dataset.questionAction);
    });
    $('#quiz-form').addEventListener('submit', saveQuiz);
    $('#question-form').addEventListener('submit', saveQuestion);
    $('#ranking-scope').addEventListener('change', () => { populateRankingTargets(); loadRanking(); });
    $('#ranking-target').addEventListener('change', () => loadRanking());
    $('#refresh-ranking').addEventListener('click', () => loadRanking());
    $('#ranking-more').addEventListener('click', () => loadRanking(true));
    $('#credentials-form').addEventListener('submit', saveCredentials);
    $('#clear-credentials').addEventListener('click', clearCredentials);
  }

  async function initialize() {
    bindEvents(); renderCredentialStatus();
    try {
      const health = await fetch('/health/live');
      if (!health.ok) throw new Error('API health check failed');
      setConnection('', 'API available');
    } catch { setConnection('offline', 'API unavailable'); }
    await loadOverview();
    populateRankingTargets();
    await loadRanking();
  }

  initialize();
})();
