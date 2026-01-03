/**
 * Learn C Programming - Application
 * A learning app for Class 10 UP Board students
 * 
 * Data Models:
 * - Question: {id, unit, lesson, type, difficulty, body, options, correctAnswer, hints, explanation, points}
 * - Progress: {questionId, completed, correct, attempts, hintsUsed, lastAttempt}
 * - SpacedRep: {questionId, easeFactor, interval, repetitions, nextReview}
 * - Settings: {name, highContrast, reducedMotion, sound}
 */

'use strict';

// ============================================
// APP NAMESPACE
// ============================================
const App = {
  state: {
    currentView: 'dashboard',
    questions: [],
    units: [],
    progress: {},
    spacedRep: {},
    settings: { name: 'Student', highContrast: false, reducedMotion: false, sound: true },
    currentQuestion: null,
    practiceQueue: [],
    teacherAuthenticated: false
  },

  TEACHER_PIN: '1234',
  DB_NAME: 'CLearnDB',
  DB_VERSION: 1
};

// ============================================
// LOCALIZATION STRINGS
// ============================================
App.Strings = {
  welcome: 'Welcome to Learn C!',
  continueJourney: 'Continue Learning',
  startPractice: 'Start Practice',
  correct: 'Correct! Well done!',
  incorrect: 'Not quite right. Let\'s learn from this.',
  hintWarning: 'Using a hint will reduce your maximum points.',
  saveSuccess: 'Progress saved!',
  exportSuccess: 'Progress exported successfully!',
  importSuccess: 'Progress imported successfully!',
  resetConfirm: 'Are you sure? This cannot be undone.',
  teacherAccess: 'Teacher Mode accessed',
  invalidPin: 'Invalid PIN. Please try again.',
  questionTypes: { mcq: 'Multiple Choice', tf: 'True/False', fill: 'Fill in Blank', output: 'Code Output', code: 'Coding', debug: 'Debugging' },
  difficulties: { 1: 'Introductory', 2: 'Easy', 3: 'Medium', 4: 'Hard', 5: 'Challenge' }
};

// ============================================
// UTILITY FUNCTIONS
// ============================================
App.Utils = {
  // Sanitize HTML to prevent XSS
  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  },

  // Format time in minutes/hours
  formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`;
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  },

  // Debounce function
  debounce(fn, delay) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn.apply(this, args), delay);
    };
  },

  // Generate unique ID
  generateId() {
    return 'id_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },

  // Shuffle array
  shuffle(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  // Get element safely
  $(selector) {
    return document.querySelector(selector);
  },

  // Get all elements
  $$(selector) {
    return document.querySelectorAll(selector);
  }
};

// ============================================
// STORAGE (IndexedDB with localStorage fallback)
// ============================================
App.Storage = {
  db: null,
  useIndexedDB: true,

  async init() {
    if (!window.indexedDB) {
      this.useIndexedDB = false;
      console.log('IndexedDB not available, using localStorage');
      return;
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(App.DB_NAME, App.DB_VERSION);

      request.onerror = () => {
        console.warn('IndexedDB error, falling back to localStorage');
        this.useIndexedDB = false;
        resolve();
      };

      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('progress')) {
          db.createObjectStore('progress', { keyPath: 'questionId' });
        }
        if (!db.objectStoreNames.contains('spacedRep')) {
          db.createObjectStore('spacedRep', { keyPath: 'questionId' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
        if (!db.objectStoreNames.contains('analytics')) {
          db.createObjectStore('analytics', { keyPath: 'id', autoIncrement: true });
        }
      };
    });
  },

  async get(store, key) {
    if (!this.useIndexedDB) {
      const data = localStorage.getItem(`${App.DB_NAME}_${store}_${key}`);
      return data ? JSON.parse(data) : null;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction(store, 'readonly');
      const request = tx.objectStore(store).get(key);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  },

  async set(store, data) {
    if (!this.useIndexedDB) {
      const key = data.questionId || data.key || data.id;
      localStorage.setItem(`${App.DB_NAME}_${store}_${key}`, JSON.stringify(data));
      return;
    }

    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).put(data);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAll(store) {
    if (!this.useIndexedDB) {
      const prefix = `${App.DB_NAME}_${store}_`;
      const results = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(prefix)) {
          results.push(JSON.parse(localStorage.getItem(key)));
        }
      }
      return results;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction(store, 'readonly');
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  },

  async clear(store) {
    if (!this.useIndexedDB) {
      const prefix = `${App.DB_NAME}_${store}_`;
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key.startsWith(prefix)) keysToRemove.push(key);
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
      return;
    }

    return new Promise((resolve) => {
      const tx = this.db.transaction(store, 'readwrite');
      tx.objectStore(store).clear();
      tx.oncomplete = () => resolve();
    });
  },

  async exportAll() {
    const progress = await this.getAll('progress');
    const spacedRep = await this.getAll('spacedRep');
    const settings = await this.getAll('settings');
    return { progress, spacedRep, settings, exportDate: new Date().toISOString() };
  },

  async importAll(data) {
    if (data.progress) {
      for (const item of data.progress) await this.set('progress', item);
    }
    if (data.spacedRep) {
      for (const item of data.spacedRep) await this.set('spacedRep', item);
    }
    if (data.settings) {
      for (const item of data.settings) await this.set('settings', item);
    }
  }
};

// ============================================
// SPACED REPETITION (SM-2 Algorithm)
// ============================================
App.SpacedRep = {
  DEFAULT_EASE: 2.5,
  MIN_EASE: 1.3,

  // Calculate next review based on SM-2
  calculate(current, grade) {
    // grade: 0-5 (0-2 = fail, 3-5 = pass)
    let { easeFactor = this.DEFAULT_EASE, interval = 1, repetitions = 0 } = current || {};

    if (grade < 3) {
      // Failed - reset
      repetitions = 0;
      interval = 1;
    } else {
      // Passed
      if (repetitions === 0) {
        interval = 1;
      } else if (repetitions === 1) {
        interval = 6;
      } else {
        interval = Math.round(interval * easeFactor);
      }
      repetitions++;
    }

    // Update ease factor
    easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (easeFactor < this.MIN_EASE) easeFactor = this.MIN_EASE;

    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return { easeFactor, interval, repetitions, nextReview: nextReview.toISOString(), lastGrade: grade };
  },

  // Get questions due for review
  async getDueQuestions() {
    const allRep = await App.Storage.getAll('spacedRep');
    const now = new Date();
    return allRep.filter(item => new Date(item.nextReview) <= now).map(item => item.questionId);
  },

  // Update a question's spaced rep data
  async update(questionId, grade) {
    const current = await App.Storage.get('spacedRep', questionId);
    const newData = this.calculate(current, grade);
    newData.questionId = questionId;
    await App.Storage.set('spacedRep', newData);
    return newData;
  }
};

// ============================================
// QUESTIONS ENGINE
// ============================================
App.Questions = {
  async load() {
    try {
      const response = await fetch('data/questions-1000.json');
      const data = await response.json();
      App.state.questions = data.questions || [];
      App.state.units = data.manifest?.units || [];
      console.log(`Loaded ${App.state.questions.length} questions`);
    } catch (error) {
      console.error('Failed to load questions:', error);
      App.state.questions = [];
      App.UI.showToast('Failed to load questions', 'error');
    }
  },

  getById(id) {
    return App.state.questions.find(q => q.id === id);
  },

  getByUnit(unitId) {
    return App.state.questions.filter(q => q.unit === unitId);
  },

  filter({ unit, difficulty, type }) {
    return App.state.questions.filter(q => {
      if (unit && unit !== 'all' && q.unit !== parseInt(unit)) return false;
      if (difficulty && difficulty !== 'all' && q.difficulty !== parseInt(difficulty)) return false;
      if (type && type !== 'all' && q.type !== type) return false;
      return true;
    });
  },

  getNextInJourney() {
    const progress = App.state.progress;
    // Find first unanswered question in order
    for (const q of App.state.questions) {
      if (!progress[q.id] || !progress[q.id].completed) {
        return q;
      }
    }
    return null; // All complete
  },

  // Validate code answer (static pattern matching)
  validateCode(userCode, testCases) {
    const results = [];
    for (const tc of testCases) {
      // Simple output matching
      const expectedOutput = tc.expected.trim();
      // Check if code contains expected patterns
      const passed = this.checkCodeOutput(userCode, tc);
      results.push({ ...tc, passed, userOutput: passed ? expectedOutput : 'Check your code' });
    }
    return results;
  },

  checkCodeOutput(code, testCase) {
    // Static validation - check for expected patterns
    if (testCase.type === 'contains') {
      return code.includes(testCase.pattern);
    }
    if (testCase.type === 'regex') {
      return new RegExp(testCase.pattern).test(code);
    }
    // Default: check if expected keywords exist
    const keywords = testCase.expected.split(/\s+/);
    return keywords.some(kw => code.toLowerCase().includes(kw.toLowerCase()));
  }
};

// ============================================
// UI CONTROLLER
// ============================================
App.UI = {
  init() {
    this.bindEvents();
    this.renderUnits();
    this.updateProgress();
    this.applySettings();
  },

  bindEvents() {
    const $ = App.Utils.$;
    const $$ = App.Utils.$$;

    // Navigation
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showView(btn.dataset.view));
    });

    // Dashboard actions
    $('[data-action="continue-journey"]')?.addEventListener('click', () => {
      this.showView('journey');
      this.loadNextQuestion();
    });

    $('[data-action="start-practice"]')?.addEventListener('click', () => this.showView('practice'));
    $('[data-action="review-due"]')?.addEventListener('click', () => this.startReview());

    // Settings
    $('#settings-toggle')?.addEventListener('click', () => this.toggleModal('settings-modal'));
    $('#settings-name')?.addEventListener('change', (e) => this.updateSetting('name', e.target.value));
    $('#settings-high-contrast')?.addEventListener('change', (e) => this.updateSetting('highContrast', e.target.checked));
    $('#settings-reduced-motion')?.addEventListener('change', (e) => this.updateSetting('reducedMotion', e.target.checked));
    $('#reset-progress')?.addEventListener('click', () => this.resetProgress());

    // Sidebar toggle (works on desktop now too)
    $('#sidebar-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
      $('#sidebar')?.classList.toggle('sidebar--open'); // For mobile specific
    });

    // Practice
    $('#start-practice')?.addEventListener('click', () => this.startPractice());

    // Teacher mode
    $('#teacher-mode-link')?.addEventListener('click', () => this.showView('teacher'));
    $('#teacher-login-btn')?.addEventListener('click', () => this.authenticateTeacher());
    $('#exit-teacher-mode')?.addEventListener('click', () => {
      App.state.teacherAuthenticated = false;
      App.Utils.$('#teacher-login').hidden = false;
      App.Utils.$('#teacher-dashboard').hidden = true;
      App.Utils.$('#exit-teacher-mode').hidden = true;
      this.showView('dashboard');
      this.showToast('Returned to Student Mode', 'info');
    });

    // Profile Button (Stub)
    $('#profile-btn')?.addEventListener('click', () => {
      // Just reuse settings name input for now as a simple profile edit
      this.toggleModal('settings-modal');
      setTimeout(() => $('#settings-name')?.focus(), 100);
    });

    // Thunder/Turbo Toggle
    $('#thunder-toggle')?.addEventListener('click', () => {
      const isTurbo = document.body.classList.toggle('turbo-mode');
      const container = App.Utils.$('#toast-container');
      const toast = document.createElement('div');
      toast.className = `toast toast--info`;
      toast.textContent = isTurbo ? '⚡ Turbo Mode Activated!' : 'Turbo Mode Deactivated';
      container.appendChild(toast);
      setTimeout(() => toast.remove(), 2000);

      if (isTurbo) {
        document.body.style.animation = 'shake 0.5s cubic-bezier(.36,.07,.19,.97) both';
        setTimeout(() => document.body.style.animation = '', 500);
      }
    });

    // Contrast toggle
    $('#toggle-contrast')?.addEventListener('click', () => {
      const current = App.state.settings.highContrast;
      this.updateSetting('highContrast', !current);
    });

    // Export/Import
    $('#export-progress')?.addEventListener('click', () => this.exportProgress());
    $('#import-progress')?.addEventListener('click', () => $('#import-file').click());
    $('#import-file')?.addEventListener('change', (e) => this.importProgress(e));

    // Modal close
    $$('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => this.closeAllModals());
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllModals();
    });
  },

  showView(viewId) {
    const $ = App.Utils.$;
    const $$ = App.Utils.$$;

    // Sidebar auto-collapse on mobile when navigating
    if (window.innerWidth <= 768) {
      $('#sidebar')?.classList.remove('sidebar--open');
    }

    // Update nav
    $$('.nav-btn').forEach(btn => {
      btn.classList.toggle('nav-btn--active', btn.dataset.view === viewId);
      btn.setAttribute('aria-current', btn.dataset.view === viewId ? 'page' : 'false');
    });

    // Show view
    $$('.view').forEach(view => {
      view.classList.remove('view--active');
      view.hidden = true;
    });

    const activeView = $(`#view-${viewId}`);
    if (activeView) {
      activeView.classList.add('view--active');
      activeView.hidden = false;
    }

    App.state.currentView = viewId;

    // View-specific init
    if (viewId === 'journey') this.loadNextQuestion();
    if (viewId === 'progress') this.renderProgressDashboard();
  },

  toggleModal(modalId) {
    const modal = App.Utils.$(`#${modalId}`);
    if (modal) {
      const isHidden = modal.hidden;
      modal.hidden = !isHidden;
      if (!isHidden) {
        modal.querySelector('button, input')?.focus();
      }
    }
  },

  closeAllModals() {
    App.Utils.$$('.modal').forEach(m => m.hidden = true);
  },

  showToast(message, type = 'info') {
    const container = App.Utils.$('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `
      <span class="toast__message">${App.Utils.sanitizeHTML(message)}</span>
      <button class="toast__close btn-icon" aria-label="Close">×</button>
    `;
    toast.querySelector('.toast__close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
  },

  renderUnits() {
    const list = App.Utils.$('#unit-list');
    if (!list) return;

    list.innerHTML = App.state.units.map(unit => `
      <li class="unit-list__item" data-unit="${unit.id}">
        <svg class="unit-list__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span class="unit-list__name">${App.Utils.sanitizeHTML(unit.name)}</span>
        <span class="unit-list__progress">0%</span>
      </li>
    `).join('');

    // Unit selector for practice
    const select = App.Utils.$('#practice-unit');
    if (select) {
      select.innerHTML = '<option value="all">All Units</option>' +
        App.state.units.map(u => `<option value="${u.id}">${App.Utils.sanitizeHTML(u.name)}</option>`).join('');
    }
  },

  async updateProgress() {
    const progress = await App.Storage.getAll('progress');
    App.state.progress = {};
    progress.forEach(p => App.state.progress[p.questionId] = p);

    const total = App.state.questions.length;
    const completed = progress.filter(p => p.completed).length;
    const correct = progress.filter(p => p.correct).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Update UI
    const $ = App.Utils.$;
    $('#progress-percent').textContent = `${percent}%`;
    $('#stat-total-answered').textContent = completed;
    $('#stat-accuracy').textContent = completed > 0 ? `${Math.round((correct / completed) * 100)}%` : '0%';

    // Update progress ring
    const circle = $('#progress-circle');
    if (circle) {
      const circumference = 2 * Math.PI * 52;
      circle.style.strokeDashoffset = circumference - (percent / 100) * circumference;
    }

    // Review count
    const dueCount = (await App.SpacedRep.getDueQuestions()).length;
    $('#review-count').textContent = dueCount;
  },

  applySettings() {
    const { highContrast, reducedMotion, name } = App.state.settings;
    document.documentElement.classList.toggle('high-contrast', highContrast);
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);

    const $ = App.Utils.$;
    $('#user-name').textContent = name || 'Student';
    $('#settings-name').value = name || '';
    $('#settings-high-contrast').checked = highContrast;
    $('#settings-reduced-motion').checked = reducedMotion;
  },

  async updateSetting(key, value) {
    App.state.settings[key] = value;
    await App.Storage.set('settings', { key: 'user', ...App.state.settings });
    this.applySettings();
    // this.showToast('Settings saved!', 'success'); // Disabled per user request
  },

  async loadNextQuestion() {
    const question = App.Questions.getNextInJourney();
    if (question) {
      App.state.currentQuestion = question;
      this.renderQuestion(question, '#question-container');
    } else {
      App.Utils.$('#question-container').innerHTML = `
        <div class="question-placeholder">
          <h3>🎉 Congratulations!</h3>
          <p>You've completed all questions in the journey!</p>
        </div>
      `;
    }
  },

  renderQuestion(question, containerSelector) {
    const container = App.Utils.$(containerSelector);
    if (!container || !question) return;

    const difficultyClass = `question-card__tag--difficulty-${question.difficulty}`;
    const typeLabel = App.Strings.questionTypes[question.type] || question.type;
    const diffLabel = App.Strings.difficulties[question.difficulty] || '';

    let optionsHTML = '';
    let inputHTML = '';

    if (question.type === 'mcq' || question.type === 'tf') {
      optionsHTML = `
        <div class="options-list">
          ${question.options.map((opt, i) => `
            <button class="option-btn" data-index="${i}">
              <span class="option-btn__marker">${String.fromCharCode(65 + i)}</span>
              <span class="option-btn__text">${App.Utils.sanitizeHTML(opt)}</span>
            </button>
          `).join('')}
        </div>
      `;
    } else if (question.type === 'fill' || question.type === 'output') {
      inputHTML = `
        <div class="fill-input">
          <input type="text" class="text-input" id="answer-input" placeholder="Type your answer here..." autocomplete="off">
        </div>
      `;
    } else if (question.type === 'code' || question.type === 'debug') {
      inputHTML = `
        <div class="code-editor">
          <div class="code-editor__header">
            <span class="code-editor__title">Your Code</span>
          </div>
          <textarea class="code-editor__textarea" id="code-input" placeholder="// Write your C code here...">${question.type === 'debug' ? App.Utils.sanitizeHTML(question.buggyCode || '') : ''}</textarea>
        </div>
        <div class="test-results" id="test-results" hidden></div>
      `;
    }

    container.innerHTML = `
      <div class="question-card" data-question-id="${question.id}">
        <div class="question-card__header">
          <div class="question-card__meta">
            <span class="question-card__tag">${typeLabel}</span>
            <span class="question-card__tag ${difficultyClass}">${diffLabel}</span>
          </div>
          <span class="question-card__points">${question.points || 10} pts</span>
        </div>
        <div class="question-card__body">${this.formatQuestionBody(question.body)}</div>
        ${optionsHTML}
        ${inputHTML}
        <div class="feedback" id="feedback" hidden></div>
        <div class="question-card__actions">
          <button class="question-card__hint-btn btn-text" id="hint-btn">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
              <line x1="12" y1="17" x2="12.01" y2="17"/>
            </svg>
            Get Hint (${question.hints?.length || 0} available)
          </button>
          <div>
            <button class="btn btn--secondary" id="skip-btn">Skip</button>
            <button class="btn btn--primary" id="submit-btn">Submit</button>
          </div>
        </div>
      </div>
    `;

    // Bind question events
    this.bindQuestionEvents(question);
  },

  formatQuestionBody(body) {
    // Handle code blocks
    let formatted = body.replace(/```c?\n?([\s\S]*?)```/g, '<pre>$1</pre>');
    // Handle inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    return formatted;
  },

  bindQuestionEvents(question) {
    const $ = App.Utils.$;
    const $$ = App.Utils.$$;
    let selectedOption = null;
    let hintsUsed = 0;

    // Option selection
    $$('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        $$('.option-btn').forEach(b => b.classList.remove('option-btn--selected'));
        btn.classList.add('option-btn--selected');
        selectedOption = parseInt(btn.dataset.index);
      });
    });

    // Submit
    $('#submit-btn')?.addEventListener('click', async () => {
      let answer, isCorrect = false;

      if (question.type === 'mcq' || question.type === 'tf') {
        answer = selectedOption;
        isCorrect = answer === question.correctAnswer;

        // Show correct/incorrect on options
        $$('.option-btn').forEach((btn, i) => {
          if (i === question.correctAnswer) btn.classList.add('option-btn--correct');
          if (i === answer && !isCorrect) btn.classList.add('option-btn--incorrect');
          btn.disabled = true;
        });
      } else if (question.type === 'fill' || question.type === 'output') {
        answer = $('#answer-input')?.value.trim();
        isCorrect = answer.toLowerCase() === String(question.correctAnswer).toLowerCase();
      } else if (question.type === 'code' || question.type === 'debug') {
        answer = $('#code-input')?.value;
        const results = App.Questions.validateCode(answer, question.testCases || []);
        isCorrect = results.every(r => r.passed);
        this.showTestResults(results);
      }

      // Show feedback
      const feedback = $('#feedback');
      feedback.hidden = false;
      feedback.className = `feedback feedback--${isCorrect ? 'correct' : 'incorrect'}`;
      feedback.innerHTML = `
        <div class="feedback__title">${isCorrect ? '✓ Correct!' : '✗ Not quite right'}</div>
        <p class="feedback__explanation">${App.Utils.sanitizeHTML(question.explanation || '')}</p>
      `;

      // Calculate points (reduce for hints used)
      const maxPoints = question.points || 10;
      const earnedPoints = isCorrect ? Math.max(maxPoints - (hintsUsed * 3), 1) : 0;

      // Save progress
      await this.saveQuestionProgress(question.id, isCorrect, earnedPoints, hintsUsed);

      // Update spaced rep
      const grade = isCorrect ? (hintsUsed === 0 ? 5 : 4) : 2;
      await App.SpacedRep.update(question.id, grade);

      // Update button
      $('#submit-btn').textContent = 'Next Question';
      $('#submit-btn').onclick = () => this.loadNextQuestion();
    });

    // Skip
    $('#skip-btn')?.addEventListener('click', () => this.loadNextQuestion());

    // Hint
    $('#hint-btn')?.addEventListener('click', () => {
      if (question.hints && hintsUsed < question.hints.length) {
        const hint = question.hints[hintsUsed];
        $('#hint-content').textContent = hint;
        this.toggleModal('hint-modal');
        hintsUsed++;
        $('#hint-btn').innerHTML = `
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="12" cy="12" r="10"/>
            <path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          Hint used (${question.hints.length - hintsUsed} left)
        `;
      }
    });
  },

  showTestResults(results) {
    const container = App.Utils.$('#test-results');
    if (!container) return;
    container.hidden = false;

    const passed = results.filter(r => r.passed).length;
    container.innerHTML = `
      <div class="test-results__header">
        <span class="test-results__title">Test Results</span>
        <span class="test-results__summary">${passed}/${results.length} passed</span>
      </div>
      ${results.map((r, i) => `
        <div class="test-case test-case--${r.passed ? 'passed' : 'failed'}">
          <span class="test-case__icon">${r.passed ? '✓' : '✗'}</span>
          <span>Test ${i + 1}: ${r.passed ? 'Passed' : 'Failed'}</span>
        </div>
      `).join('')}
    `;
  },

  async saveQuestionProgress(questionId, correct, points, hintsUsed) {
    const existing = App.state.progress[questionId] || { questionId, attempts: 0 };
    const progress = {
      ...existing,
      completed: true,
      correct,
      points: correct ? points : 0,
      hintsUsed,
      attempts: existing.attempts + 1,
      lastAttempt: new Date().toISOString()
    };
    await App.Storage.set('progress', progress);
    App.state.progress[questionId] = progress;
    this.updateProgress();
    // this.showToast('Progress saved!', 'success'); // Disabled per user request
  },

  startPractice() {
    const unit = App.Utils.$('#practice-unit')?.value;
    const difficulty = App.Utils.$('#practice-difficulty')?.value;
    const type = App.Utils.$('#practice-type')?.value;

    const questions = App.Questions.filter({ unit, difficulty, type });
    if (questions.length === 0) {
      this.showToast('No questions match your filters', 'info');
      return;
    }

    App.state.practiceQueue = App.Utils.shuffle(questions);
    App.state.currentQuestion = App.state.practiceQueue.shift();

    const container = App.Utils.$('#practice-question-container');
    container.hidden = false;
    this.renderQuestion(App.state.currentQuestion, '#practice-question-container');
  },

  async startReview() {
    const dueIds = await App.SpacedRep.getDueQuestions();
    if (dueIds.length === 0) {
      this.showToast('No reviews due!', 'info');
      return;
    }

    const questions = dueIds.map(id => App.Questions.getById(id)).filter(Boolean);
    App.state.practiceQueue = App.Utils.shuffle(questions);
    this.showView('practice');
    App.state.currentQuestion = App.state.practiceQueue.shift();
    this.renderQuestion(App.state.currentQuestion, '#practice-question-container');
    App.Utils.$('#practice-question-container').hidden = false;
  },

  renderProgressDashboard() {
    // Unit progress grid
    const grid = App.Utils.$('#unit-progress-grid');
    if (grid) {
      grid.innerHTML = App.state.units.map(unit => {
        const questions = App.Questions.getByUnit(unit.id);
        const completed = questions.filter(q => App.state.progress[q.id]?.completed).length;
        const percent = questions.length > 0 ? Math.round((completed / questions.length) * 100) : 0;
        return `
          <div class="unit-progress-card">
            <div class="unit-progress-card__name">${App.Utils.sanitizeHTML(unit.name)}</div>
            <div class="progress-bar">
              <div class="progress-bar__fill" style="width: ${percent}%"></div>
            </div>
            <div class="unit-progress-card__stats">${completed}/${questions.length} completed</div>
          </div>
        `;
      }).join('');
    }

    // Simple chart (bar chart using SVG)
    const chart = App.Utils.$('#progress-chart');
    if (chart && App.state.units.length > 0) {
      const maxQuestions = Math.max(...App.state.units.map(u => u.count || 100));
      chart.innerHTML = `
        <svg width="100%" height="250" viewBox="0 0 400 250">
          <text x="200" y="20" text-anchor="middle" fill="var(--color-text)" font-size="14" font-weight="600">Progress by Unit</text>
          ${App.state.units.slice(0, 8).map((unit, i) => {
        const questions = App.Questions.getByUnit(unit.id);
        const completed = questions.filter(q => App.state.progress[q.id]?.completed).length;
        const height = (completed / maxQuestions) * 150;
        const x = 30 + i * 45;
        return `
              <rect x="${x}" y="${200 - height}" width="35" height="${height}" fill="var(--color-primary)" rx="4"/>
              <text x="${x + 17}" y="220" text-anchor="middle" fill="var(--color-text-light)" font-size="10">U${unit.id}</text>
            `;
      }).join('')}
        </svg>
      `;
    }
  },

  authenticateTeacher() {
    const pin = App.Utils.$('#teacher-pin')?.value;
    if (pin === App.TEACHER_PIN) {
      App.state.teacherAuthenticated = true;
      App.Utils.$('#teacher-login').hidden = true;
      App.Utils.$('#teacher-dashboard').hidden = false;
      this.showToast(App.Strings.teacherAccess, 'success');
      this.renderTeacherDashboard();
    } else {
      this.showToast(App.Strings.invalidPin, 'error');
    }
  },

  renderTeacherDashboard() {
    const list = App.Utils.$('#question-list');
    if (list) {
      list.innerHTML = App.state.questions.slice(0, 20).map(q => `
        <div class="question-list-item">
          <span class="question-list-item__id">${q.id}</span>
          <span class="question-list-item__body">${App.Utils.sanitizeHTML(q.body.substring(0, 60))}...</span>
          <div class="question-list-item__actions">
            <button class="btn-icon btn--sm" title="Edit">✎</button>
            <button class="btn-icon btn--sm" title="Delete">×</button>
          </div>
        </div>
      `).join('');
    }

    // Stats
    const stats = App.Utils.$('#teacher-stats');
    const progress = Object.values(App.state.progress);
    if (stats) {
      stats.innerHTML = `
        <div class="stat-card">
          <span class="stat-card__value">${App.state.questions.length}</span>
          <span class="stat-card__label">Total Questions</span>
        </div>
        <div class="stat-card">
          <span class="stat-card__value">${progress.length}</span>
          <span class="stat-card__label">Questions Attempted</span>
        </div>
        <div class="stat-card">
          <span class="stat-card__value">${progress.filter(p => p.correct).length}</span>
          <span class="stat-card__label">Correct Answers</span>
        </div>
      `;
    }
  },

  async exportProgress() {
    const data = await App.Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `learn-c-progress-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    this.showToast(App.Strings.exportSuccess, 'success');
  },

  async importProgress(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);
      await App.Storage.importAll(data);
      await this.updateProgress();
      this.showToast(App.Strings.importSuccess, 'success');
    } catch (error) {
      this.showToast('Failed to import: Invalid file', 'error');
    }
  },

  async resetProgress() {
    if (!confirm(App.Strings.resetConfirm)) return;
    await App.Storage.clear('progress');
    await App.Storage.clear('spacedRep');
    App.state.progress = {};
    this.updateProgress();
    this.showToast('Progress reset!', 'info');
  }
};

// ============================================
// ANALYTICS (Local only)
// ============================================
App.Analytics = {
  async track(event, data) {
    await App.Storage.set('analytics', {
      event,
      data,
      timestamp: new Date().toISOString()
    });
  }
};

// ============================================
// INITIALIZATION
// ============================================
async function initApp() {
  try {
    // Initialize storage
    await App.Storage.init();

    // Load settings
    const savedSettings = await App.Storage.get('settings', 'user');
    if (savedSettings) {
      App.state.settings = { ...App.state.settings, ...savedSettings };
    }

    // Load questions
    await App.Questions.load();

    // Initialize UI
    App.UI.init();

    console.log('Learn C App initialized successfully!');
  } catch (error) {
    console.error('Failed to initialize app:', error);
  }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = App;
}
