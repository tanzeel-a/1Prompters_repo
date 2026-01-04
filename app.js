/**
 * Learn C Programming - Application Code
 * --------------------------------------
 * This file contains the main logic for the C Learning App.
 * It is organized into "Modules" (sections) to make it easier to understand.
 * 
 * STRUCTURE:
 * 1. App Core (State & Configuration)
 * 2. Localization (Text strings)
 * 3. Utilities (Helper functions)
 * 4. Storage (Saving data to the browser)
 * 5. Spaced Repetition (Smart review algorithm)
 * 6. Questions Engine (Loading and managing questions)
 * 7. UI Controller (Handling user clicks and screens)
 */

'use strict'; // Enforce strict JavaScript mode for better error catching

// ============================================
// 1. APP CORE & STATE
// ============================================
const App = {
  // The 'state' holds all the changing data of the app
  state: {
    // Which screen is currently visible? (Default: dashboard)
    currentView: 'dashboard',

    // List of all loaded questions
    questions: [],

    // List of units (topics) in the course
    units: [],

    // User's progress map: { questionId: { completed: true, ... } }
    progress: {},

    // Spaced repetition data: { questionId: { nextReview: date, ... } }
    spacedRep: {},

    // User settings and preferences
    settings: {
      name: 'Student',      // Display name
      reducedMotion: false, // Accessibility: Disable animations
      sound: true           // Enable sound effects
    },

    // The question currently being viewed
    currentQuestion: null,

    // A queue of questions for Practice Mode
    practiceQueue: [],
  },

  // Constants: Values that don't change
  DB_NAME: 'CLearnDB',  // Name of the database
  DB_VERSION: 1         // Database version
};

// Expose 'App' to the window so other files (like auth.js) can see it
window.App = App;

// ============================================
// 2. LOCALIZATION STRINGS
// ============================================
// We keep text in one place to make it easier to change later
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

  // Labels for different question types
  questionTypes: {
    mcq: 'Multiple Choice',
    tf: 'True/False',
    fill: 'Fill in Blank',
    output: 'Code Output',
    code: 'Coding',
    debug: 'Debugging'
  },

  // Labels for difficulty levels
  difficulties: {
    1: 'Introductory',
    2: 'Easy',
    3: 'Medium',
    4: 'Hard',
    5: 'Challenge'
  }
};

// ============================================
// 3. UTILITY FUNCTIONS
// ============================================
App.Utils = {
  // Safe way to get one element from the HTML
  // Example: App.Utils.$('#my-id')
  $(selector) {
    return document.querySelector(selector);
  },

  // Safe way to get ALL matching elements from HTML
  // Example: App.Utils.$$('.my-class')
  $$(selector) {
    return document.querySelectorAll(selector);
  },

  // Sanitize HTML: Prevents hackers from inserting malicious scripts
  sanitizeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str; // Browser handles escaping automatically here
    return div.innerHTML;
  },

  // Check if a string contains valid HTML safe content
  formatTime(seconds) {
    if (seconds < 60) return `${seconds}s`; // Less than a minute
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m`; // Less than an hour
    // Hours and minutes
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  },

  // Shuffle Array: Randomizes the order of a list (Fisher-Yates algorithm)
  shuffle(array) {
    const arr = [...array]; // Create a copy so we don't mess up the original
    for (let i = arr.length - 1; i > 0; i--) {
      // Pick a random index
      const j = Math.floor(Math.random() * (i + 1));
      // Swap elements
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
};

// ============================================
// 4. STORAGE (Database)
// ============================================
// Handles saving data. Uses IndexedDB (powerful) with localStorage (simple) as backup.
App.Storage = {
  db: null,             // The database connection
  useIndexedDB: true,   // Flag: Are we using the powerful DB?

  // Initialize the database connection
  async init() {
    // Check if browser supports IndexedDB
    if (!window.indexedDB) {
      this.useIndexedDB = false;
      console.log('IndexedDB not available, using localStorage');
      return;
    }

    // Open connection
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(App.DB_NAME, App.DB_VERSION);

      // Error handler
      request.onerror = () => {
        console.warn('IndexedDB error, falling back to localStorage');
        this.useIndexedDB = false;
        resolve();
      };

      // Success! Connection open.
      request.onsuccess = (e) => {
        this.db = e.target.result;
        resolve();
      };

      // First time setup (Schema creation)
      request.onupgradeneeded = (e) => {
        const db = e.target.result;
        // Create tables (Object Stores) if they don't exist
        if (!db.objectStoreNames.contains('progress')) db.createObjectStore('progress', { keyPath: 'questionId' });
        if (!db.objectStoreNames.contains('spacedRep')) db.createObjectStore('spacedRep', { keyPath: 'questionId' });
        if (!db.objectStoreNames.contains('settings')) db.createObjectStore('settings', { keyPath: 'key' });
      };
    });
  },

  // SAVE data to storage
  async set(store, data) {
    // Fallback mode
    if (!this.useIndexedDB) {
      const key = data.questionId || data.key || data.id;
      localStorage.setItem(`${App.DB_NAME}_${store}_${key}`, JSON.stringify(data));
      return;
    }

    // IndexedDB mode
    return new Promise((resolve, reject) => {
      const tx = this.db.transaction(store, 'readwrite'); // Open transaction
      tx.objectStore(store).put(data); // Put data
      tx.oncomplete = () => resolve(); // Done!
      tx.onerror = () => reject(tx.error); // Fail
    });
  },

  // GET ALL data from a store
  async getAll(store) {
    // Fallback mode
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

    // IndexedDB mode
    return new Promise((resolve) => {
      const tx = this.db.transaction(store, 'readonly');
      const request = tx.objectStore(store).getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => resolve([]);
    });
  },

  // EXPORT all user data (for backup)
  async exportAll() {
    const progress = await this.getAll('progress');
    const spacedRep = await this.getAll('spacedRep');
    const settings = await this.getAll('settings');
    // Return everything as a single object with a timestamp
    return { progress, spacedRep, settings, exportDate: new Date().toISOString() };
  },

  // IMPORT data (restore backup)
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
  },

  // DELETE ALL data
  async clear() {
    // Logic for full reset would go here
    // Typically used when user clicks "Reset Progress"
    const stores = ['progress', 'spacedRep', 'settings'];
    if (!this.useIndexedDB) {
      localStorage.clear();
    } else {
      const tx = this.db.transaction(stores, 'readwrite');
      stores.forEach(store => tx.objectStore(store).clear());
      return new Promise(resolve => {
        tx.oncomplete = () => resolve();
      });
    }
  }
};

// ============================================
// 5. SPACED REPETITION (SM-2 Algorithm)
// ============================================
// This determines when you should review a question again based on how well you answered.
App.SpacedRep = {
  DEFAULT_EASE: 2.5, // Start difficulty factor
  MIN_EASE: 1.3,     // Minimum difficulty factor

  // Calculate next review date
  calculate(current, grade) {
    // Grade is 0-5 (0=Fail, 5=Perfect)
    let { easeFactor = this.DEFAULT_EASE, interval = 1, repetitions = 0 } = current || {};

    if (grade < 3) {
      // If user failed, reset progress for this card
      repetitions = 0;
      interval = 1;
    } else {
      // If user passed
      if (repetitions === 0) {
        interval = 1;      // Next day
      } else if (repetitions === 1) {
        interval = 6;      // 6 days later
      } else {
        interval = Math.round(interval * easeFactor); // Multiply by ease factor
      }
      repetitions++;
    }

    // Adjust difficulty based on performance (SM-2 formula)
    easeFactor = easeFactor + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
    if (easeFactor < this.MIN_EASE) easeFactor = this.MIN_EASE;

    // Set the date
    const nextReview = new Date();
    nextReview.setDate(nextReview.getDate() + interval);

    return { easeFactor, interval, repetitions, nextReview: nextReview.toISOString() };
  },

  // Find questions that are due for review TODAY
  async getDueQuestions() {
    const allRep = await App.Storage.getAll('spacedRep');
    const now = new Date();
    // Filter items where 'nextReview' date is in the past
    return allRep.filter(item => new Date(item.nextReview) <= now).map(item => item.questionId);
  },

  // Save the result of a review
  async update(questionId, grade) {
    const allData = await App.Storage.getAll('spacedRep');
    const current = allData.find(i => i.questionId === questionId);

    // Calculate new stats
    const newData = this.calculate(current, grade);
    newData.questionId = questionId;

    // Save to DB
    await App.Storage.set('spacedRep', newData);
    return newData;
  }
};

// ============================================
// 6. QUESTIONS ENGINE
// ============================================
App.Questions = {
  // Load questions from JSON file
  async load() {
    try {
      const response = await fetch('data/questions-1000.json');
      const data = await response.json();

      App.state.questions = data.questions || [];
      App.state.units = data.manifest?.units || [];
      console.log(`Loaded ${App.state.questions.length} questions`);
    } catch (error) {
      console.error('Failed to load questions:', error);
      App.UI.showToast('Failed to load questions', 'error');
    }
  },

  // Get next question in the main "Journey"
  getNextInJourney() {
    const progress = App.state.progress;
    // Look through all questions in order
    for (const q of App.state.questions) {
      // Check if not completed
      if (!progress[q.id] || !progress[q.id].completed) {
        return q;
      }
    }
    return null; // All done!
  },

  // Filter questions for Practice Mode
  filter({ unit, difficulty, type }) {
    return App.state.questions.filter(q => {
      // Apply filters if they are not 'all'
      if (unit && unit !== 'all' && q.unit !== parseInt(unit)) return false;
      if (difficulty && difficulty !== 'all' && q.difficulty !== parseInt(difficulty)) return false;
      if (type && type !== 'all' && q.type !== type) return false;
      return true;
    });
  },

  // Validate Code Answers (Basic Logic)
  validateCode(userCode, testCases) {
    const results = [];
    for (const tc of testCases) {
      // Check if user's code matches expected patterns
      let passed = false;
      if (tc.type === 'contains') {
        passed = userCode.includes(tc.pattern);
      } else if (tc.type === 'regex') {
        passed = new RegExp(tc.pattern).test(userCode);
      } else {
        // Default: Simple keyword check
        const keywords = tc.expected.split(/\s+/);
        passed = keywords.some(kw => userCode.toLowerCase().includes(kw.toLowerCase()));
      }

      results.push({ ...tc, passed });
    }
    return results;
  }
};

// ============================================
// 7. UI CONTROLLER
// ============================================
// Handles all user interaction
App.UI = {
  // Start up the UI
  init() {
    this.bindEvents();       // Setup button clicks
    this.renderUnits();      // Draw the unit list
    this.updateProgress();   // Update stats
    this.applySettings();    // Apply theme/sounds
  },

  // Setup all event listeners (Clicks, Keys, etc.)
  bindEvents() {
    const $ = App.Utils.$;
    const $$ = App.Utils.$$;

    // 1. Navigation Buttons (Bottom Bar & Headers)
    $$('.nav-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showView(btn.dataset.view));
    });

    // 2. Dashboard Actions
    $('[data-action="continue-journey"]')?.addEventListener('click', () => {
      this.showView('journey');
      this.loadNextQuestion();
    });
    $('[data-action="start-practice"]')?.addEventListener('click', () => this.showView('practice'));
    $('[data-action="review-due"]')?.addEventListener('click', () => this.startReview());

    // 3. User Authentication (Google Login)
    $('#login-btn-main')?.addEventListener('click', () => {
      if (App.Auth) App.Auth.signInWithGoogle();
      else App.Utils.showToast('Auth not initialized', 'error');
    });

    // 4. Settings & Account
    $('#logout-btn')?.addEventListener('click', () => {
      if (App.Auth) {
        App.Auth.signOut();
        this.closeAllModals();
      }
    });

    // Update Name Setting
    $('#settings-name')?.addEventListener('change', (e) => this.updateSetting('name', e.target.value));

    // Update Reduced Motion Setting
    $('#settings-reduced-motion')?.addEventListener('change', (e) => this.updateSetting('reducedMotion', e.target.checked));

    // Reset Progress Button
    $('#reset-progress')?.addEventListener('click', () => this.resetProgress());

    // Open Settings Modal (via Profile Picture)
    $('#profile-btn')?.addEventListener('click', () => {
      this.toggleModal('settings-modal');
      setTimeout(() => $('#settings-name')?.focus(), 100);
    });

    // Sidebar toggle (Desktop Only)
    $('#sidebar-toggle')?.addEventListener('click', () => {
      document.body.classList.toggle('sidebar-collapsed');
    });

    // 5. Practice Mode Controls
    $('#start-practice')?.addEventListener('click', () => this.startPractice());

    // 6. Data Export/Import
    $('#export-progress')?.addEventListener('click', () => this.exportProgress());
    $('#import-progress')?.addEventListener('click', () => $('#import-file').click());
    $('#import-file')?.addEventListener('change', (e) => this.importProgress(e));

    // 7. Global: Close Modals on close button click
    $$('[data-close-modal]').forEach(el => {
      el.addEventListener('click', () => this.closeAllModals());
    });

    // 8. Global: Keyboard functionality
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeAllModals(); // ESC to close modal
    });

    // 9. Global: Sound Effects (Typewriter Click)
    document.addEventListener('click', (e) => {
      // Only play sound for specific important buttons
      const target = e.target.closest('.nav-btn, #login-btn, #login-btn-main, #logout-btn, #reset-progress');
      if (target) {
        this.playClickSound();
      }
    });
  },

  // Play the "Click" sound effect
  playClickSound() {
    // Check if sound is enabled in settings
    if (!App.state.settings.sound) return;

    // Load sound file if not already loaded
    if (!this.clickSound) {
      this.clickSound = new Audio('assets/sounds/click.wav');
      this.clickSound.volume = 0.5;
    }

    // Clone the sound to allow overlapping plays (for fast clicking)
    const sound = this.clickSound.cloneNode();
    sound.volume = 0.4;
    sound.play().catch(() => { }); // Catch error if browser blocks autoplay
  },

  // Switch between different screens (Dashboard, Journey, Practice)
  showView(viewId) {
    const $ = App.Utils.$;
    const $$ = App.Utils.$$;

    // Update Navigation Bar State
    $$('.nav-btn').forEach(btn => {
      // Toggle 'active' class if this button matches the view
      btn.classList.toggle('nav-btn--active', btn.dataset.view === viewId);
    });

    // Hide ALL views first
    $$('.view').forEach(view => {
      view.classList.remove('view--active');
      view.hidden = true;
    });

    // Show ONLY the requested view
    const activeView = $(`#view-${viewId}`);
    if (activeView) {
      activeView.classList.add('view--active');
      activeView.hidden = false;
    }

    // Update state
    App.state.currentView = viewId;

    // Run specific logic for the view
    if (viewId === 'journey') this.loadNextQuestion();          // Start/Resume Journey
    if (viewId === 'progress') this.renderProgressDashboard();  // Draw Charts
  },

  // Open/Close a modal (Pop-up)
  toggleModal(modalId) {
    const modal = App.Utils.$(`#${modalId}`);
    if (modal) {
      const isHidden = modal.hidden;
      modal.hidden = !isHidden; // Toggle hidden state
      // Focus first input if opening
      if (!isHidden) {
        modal.querySelector('button, input')?.focus();
      }
    }
  },

  // Force close all modals
  closeAllModals() {
    App.Utils.$$('.modal').forEach(m => m.hidden = true);
  },

  // Show a notification toast
  showToast(message, type = 'info') {
    const container = App.Utils.$('#toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`; // Add type class (error/success)
    toast.innerHTML = `
      <span class="toast__message">${App.Utils.sanitizeHTML(message)}</span>
      <button class="toast__close btn-icon" aria-label="Close">×</button>
    `;

    // Remove toast when clicked
    toast.querySelector('.toast__close').addEventListener('click', () => toast.remove());
    container.appendChild(toast);

    // Auto-remove after 4 seconds
    setTimeout(() => toast.remove(), 4000);
  },

  // Render the list of Units on the Dashboard
  renderUnits() {
    const list = App.Utils.$('#unit-list');
    if (!list) return;

    // Create HTML for each unit
    list.innerHTML = App.state.units.map(unit => `
      <li class="unit-list__item" data-unit="${unit.id}">
        <svg class="unit-list__icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span class="unit-list__name">${App.Utils.sanitizeHTML(unit.name)}</span>
        <span class="unit-list__progress">0%</span>
      </li>
    `).join('');

    // Populate "Practice Unit" dropdown
    const select = App.Utils.$('#practice-unit');
    if (select) {
      select.innerHTML = '<option value="all">All Units</option>' +
        App.state.units.map(u => `<option value="${u.id}">${App.Utils.sanitizeHTML(u.name)}</option>`).join('');
    }
  },

  // Update Progress Stats (Numbers, Charts, Rings)
  async updateProgress() {
    // 1. Fetch data from storage
    const progress = await App.Storage.getAll('progress');

    // 2. Put it into App state
    App.state.progress = {};
    progress.forEach(p => App.state.progress[p.questionId] = p);

    // 3. Calculate Stats
    const total = App.state.questions.length;
    const completed = progress.filter(p => p.completed).length;
    const correct = progress.filter(p => p.correct).length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

    // 4. Update UI Elements
    const $ = App.Utils.$;
    $('#progress-percent').textContent = `${percent}%`;
    $('#stat-total-answered').textContent = completed;
    // Avoid division by zero
    $('#stat-accuracy').textContent = completed > 0 ? `${Math.round((correct / completed) * 100)}%` : '0%';

    // Update SVG Circle (Progress Ring)
    const circle = $('#progress-circle');
    if (circle) {
      const circumference = 2 * Math.PI * 52; // 2 * PI * r
      circle.style.strokeDashoffset = circumference - (percent / 100) * circumference;
    }

    // Update Review Counter
    const dueCount = (await App.SpacedRep.getDueQuestions()).length;
    $('#review-count').textContent = dueCount;
  },

  // Apply visual settings (Theme, Motion)
  applySettings() {
    const { highContrast, reducedMotion, name } = App.state.settings;
    // Since High Contrast toggle is removed, we force it false, or just ignore.
    // Assuming user wants normal mode.
    document.documentElement.classList.toggle('reduced-motion', reducedMotion);

    const $ = App.Utils.$;
    $('#user-name').textContent = name || 'Student';
    $('#settings-name').value = name || '';
    $('#settings-reduced-motion').checked = reducedMotion;
  },

  // Save a changed setting
  async updateSetting(key, value) {
    App.state.settings[key] = value;
    await App.Storage.set('settings', { key: 'user', ...App.state.settings });
    this.applySettings();
  },

  // Reset ALL user progress (Danger Zone)
  async resetProgress() {
    if (confirm(App.Strings.resetConfirm)) {
      await App.Storage.clear(); // Clear DB
      location.reload();         // Reload page to reset state
    }
  },

  // Load the next question (Context-Aware)
  async loadNextQuestion() {
    // Determine context (Journey or Practice)
    const isPractice = App.UI.state.currentView === 'practice';
    const containerId = isPractice ? '#practice-question-container' : '#question-container';

    // Get Next Question based on context
    let question;
    if (isPractice) {
      // In practice, we use the queue
      question = App.state.practiceQueue.shift();
    } else {
      // In journey, we calculate the next one
      question = App.Questions.getNextInJourney();
    }

    if (question) {
      // Found a question? Show it.
      App.state.currentQuestion = question;
      this.renderQuestion(question, containerId);
    } else {
      // No questions left?
      const container = App.Utils.$(containerId);
      if (container) {
        container.innerHTML = `
            <div class="question-placeholder">
              <h3>🎉 Session Complete!</h3>
              <p>${isPractice ? 'You have finished this practice set.' : "You've completed all questions in the journey!"}</p>
              ${isPractice ? '<button class="btn btn--primary" onclick="App.UI.showView(\'dashboard\')">Back to Dashboard</button>' : ''}
            </div>
          `;
      }
    }
  },

  // Render a Question Card into a container
  renderQuestion(question, containerSelector) {
    const container = App.Utils.$(containerSelector);
    if (!container || !question) return;

    // 1. Prepare Metadata Labels
    const typeLabel = App.Strings.questionTypes[question.type] || question.type;
    const diffLabel = App.Strings.difficulties[question.difficulty] || '';
    const difficultyClass = `question-card__tag--difficulty-${question.difficulty}`;

    // 2. Prepare Input Area based on Type
    let optionsHTML = '';
    let inputHTML = '';

    if (question.type === 'mcq' || question.type === 'tf') {
      // Multiple Choice / True False
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
    } else if (question.type === 'code' || question.type === 'debug') {
      // Code Editor
      inputHTML = `
        <div class="code-editor">
          <div class="code-editor__header"><span>Change Code below:</span></div>
          <textarea class="code-editor__textarea" id="code-input" placeholder="// Write C code...">${question.type === 'debug' ? App.Utils.sanitizeHTML(question.buggyCode || '') : ''}</textarea>
        </div>
        <div class="test-results" id="test-results" hidden></div>
      `;
    } else {
      // Standard Text Input
      inputHTML = `
        <div class="fill-input">
          <input type="text" class="text-input" id="answer-input" placeholder="Type answer..." autocomplete="off">
        </div>
      `;
    }

    // 3. Assemble the Card HTML
    container.innerHTML = `
      <div class="question-card" data-question-id="${question.id}">
        <!-- Header -->
        <div class="question-card__header">
          <div class="question-card__meta">
            <span class="question-card__tag">${typeLabel}</span>
            <span class="question-card__tag ${difficultyClass}">${diffLabel}</span>
          </div>
          <span class="question-card__points">${question.points || 10} pts</span>
        </div>
        
        <!-- Question Text -->
        <div class="question-card__body">${this.formatQuestionBody(question.body)}</div>
        
        <!-- Inputs -->
        ${optionsHTML}
        ${inputHTML}
        
        <!-- Feedback Area -->
        <div class="feedback" id="feedback" hidden></div>
        
        <!-- Actions (Hint, Submit) -->
        <div class="question-card__actions">
          <button class="question-card__hint-btn btn-text" id="hint-btn">
            Get Hint (${question.hints?.length || 0})
          </button>
          <div>
            <button class="btn btn--secondary" id="skip-btn">Skip</button>
            <button class="btn btn--info" id="submit-btn">Submit Question</button>
            <button class="btn btn--primary" id="next-btn" hidden>Next Question</button>
          </div>
        </div>
      </div>
    `;

    // 4. Attach Event Listeners to the new HTML
    this.bindQuestionEvents(question, container);
  },

  // Helper to format code blocks inside question text
  formatQuestionBody(body) {
    // Replace markdown style ```code``` with <pre> tags
    return body
      .replace(/```c?\n?([\s\S]*?)```/g, '<pre>$1</pre>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  },

  // Handle Logic inside a Question (Checking answers, etc.)
  bindQuestionEvents(question, container) {
    // Helper for scoped selection
    const find = (selector) => container.querySelector(selector);
    const findAll = (selector) => container.querySelectorAll(selector);

    let selectedOption = null; // Track user choice for MCQ
    let hintsUsed = 0;         // Track hints

    // Option Click Handler
    findAll('.option-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        // Deselect others
        findAll('.option-btn').forEach(b => b.classList.remove('option-btn--selected'));
        // Select this one
        btn.classList.add('option-btn--selected');
        selectedOption = parseInt(btn.dataset.index);

        // Enable submit button
        const submitBtn = find('#submit-btn');
        if (submitBtn) submitBtn.disabled = false;
      });
    });

    // Initial State: Disable submit if MCQ
    if (question.type === 'mcq' || question.type === 'tf') {
      const submitBtn = find('#submit-btn');
      // if (submitBtn) submitBtn.disabled = true; // Optional: Enforce selection first
    }

    // SUBMIT Handler
    find('#submit-btn')?.addEventListener('click', async () => {
      let isCorrect = false;

      // Check MCQ/TF
      if (question.type === 'mcq' || question.type === 'tf') {
        if (selectedOption === null && (question.type === 'mcq' || question.type === 'tf')) {
          this.showToast('Please select an option!', 'info');
          return;
        }

        isCorrect = (selectedOption === question.correctAnswer);

        // Show Visual Feedback on buttons
        findAll('.option-btn').forEach((btn, i) => {
          if (i === question.correctAnswer) btn.classList.add('option-btn--correct'); // Green
          if (i === selectedOption && !isCorrect) btn.classList.add('option-btn--incorrect'); // Red
          btn.disabled = true; // Lock buttons
        });
      }
      // Check Code
      else if (question.type === 'code' || question.type === 'debug') {
        const userCode = find('#code-input')?.value;
        const results = App.Questions.validateCode(userCode, question.testCases || []);
        isCorrect = results.every(r => r.passed); // All tests must pass
        this.showTestResults(results, container); // Display Table
      }
      // Check Text Input
      else {
        const answer = find('#answer-input')?.value.trim();
        if (!answer) {
          this.showToast('Please type an answer!', 'info');
          return;
        }
        isCorrect = (answer.toLowerCase() === String(question.correctAnswer).toLowerCase());
      }

      // Display Feedback Message
      const feedback = find('#feedback');
      if (feedback) {
        feedback.hidden = false;
        feedback.className = `feedback feedback--${isCorrect ? 'correct' : 'incorrect'}`;
        feedback.innerHTML = `
            <div class="feedback__title">${isCorrect ? '✓ Correct!' : '✗ Not quite right'}</div>
            <p class="feedback__explanation">${App.Utils.sanitizeHTML(question.explanation || '')}</p>
          `;
      }

      // Save Data
      const maxPts = question.points || 10;
      const earned = isCorrect ? Math.max(maxPts - (hintsUsed * 3), 1) : 0;

      // 1. Save Progress
      await this.saveQuestionProgress(question.id, isCorrect, earned, hintsUsed);

      // 2. Schedule Next Review (Spaced Repetion)
      const grade = isCorrect ? (hintsUsed === 0 ? 5 : 4) : 2;
      await App.SpacedRep.update(question.id, grade);

      // Hide Submit, Show Next
      const subBtn = find('#submit-btn');
      const nextBtn = find('#next-btn');

      if (subBtn) subBtn.hidden = true;
      if (nextBtn) {
        nextBtn.hidden = false;
        nextBtn.focus();
      }
    });

    // NEXT Handler
    find('#next-btn')?.addEventListener('click', () => this.loadNextQuestion());

    // SKIP Handler
    find('#skip-btn')?.addEventListener('click', () => this.loadNextQuestion());

    // HINT Handler
    find('#hint-btn')?.addEventListener('click', () => {
      if (question.hints && hintsUsed < question.hints.length) {
        // Show hint in modal
        const hint = question.hints[hintsUsed];
        App.Utils.$('#hint-content').textContent = hint; // Modal IDs are unique globally
        this.toggleModal('hint-modal');

        hintsUsed++;
        const hintBtn = find('#hint-btn');
        if (hintBtn) hintBtn.textContent = `Hint used (${question.hints.length - hintsUsed} left)`;
      }
    });
  },

  // Display Code Test Results
  showTestResults(results, container) {
    const outputDiv = container ? container.querySelector('#test-results') : App.Utils.$('#test-results');
    if (!outputDiv) return;

    outputDiv.hidden = false;
    const passed = results.filter(r => r.passed).length;

    outputDiv.innerHTML = `
        <div class="test-results__header">
            <span>Result: ${passed}/${results.length} passed</span>
        </div>
        ${results.map((r, i) => `
            <div class="test-case test-case--${r.passed ? 'passed' : 'failed'}">
                <span>Test ${i + 1}: ${r.passed ? 'Passed' : 'Failed'}</span>
            </div>
        `).join('')}
      `;
  },

  // Save Progress to Storage helper
  async saveQuestionProgress(qId, correct, points, hints) {
    // Get existing record or create new
    const existing = App.state.progress[qId] || { questionId: qId, attempts: 0 };

    // Update data
    const progress = {
      ...existing,
      completed: true,
      correct,
      points: correct ? points : 0,
      hintsUsed: hints,
      attempts: existing.attempts + 1,
      lastAttempt: new Date().toISOString()
    };

    // Save
    await App.Storage.set('progress', progress);
    App.state.progress[qId] = progress;
    this.updateProgress(); // Refresh stats UI
  },

  // Start a Practice Session
  startPractice() {
    // Get filters
    const unit = App.Utils.$('#practice-unit')?.value;
    const difficulty = App.Utils.$('#practice-difficulty')?.value;
    const type = App.Utils.$('#practice-type')?.value;

    const questions = App.Questions.filter({ unit, difficulty, type });

    if (questions.length === 0) {
      this.showToast('No questions match your filters', 'info');
      return;
    }

    // Shuffle and load
    App.state.practiceQueue = App.Utils.shuffle(questions);
    App.state.currentQuestion = App.state.practiceQueue.shift();

    const container = App.Utils.$('#practice-question-container');
    container.hidden = false;
    this.renderQuestion(App.state.currentQuestion, '#practice-question-container');
  },

  // Start Spaced Repetition Review
  async startReview() {
    const dueIds = await App.SpacedRep.getDueQuestions();

    if (dueIds.length === 0) {
      this.showToast('No reviews due right now!', 'info');
      return;
    }

    // Load actual question objects
    const questions = dueIds.map(id => App.Questions.getById(id)).filter(Boolean);

    // Shuffle and start
    App.state.practiceQueue = App.Utils.shuffle(questions);
    App.UI.showView('practice');

    const firstQ = App.state.practiceQueue.shift();
    App.state.currentQuestion = firstQ;

    App.Utils.$('#practice-question-container').hidden = false;
    this.renderQuestion(firstQ, '#practice-question-container');
  },

  // Render Stats on Progress Page
  renderProgressDashboard() {
    // 1. Draw Units Grid
    const grid = App.Utils.$('#unit-progress-grid');
    if (grid) {
      grid.innerHTML = App.state.units.map(unit => {
        const qs = App.Questions.getByUnit(unit.id);
        const done = qs.filter(q => App.state.progress[q.id]?.completed).length;
        const pct = qs.length ? Math.round((done / qs.length) * 100) : 0;
        return `
                <div class="unit-progress-card">
                    <div class="unit-progress-card__name">${App.Utils.sanitizeHTML(unit.name)}</div>
                    <div class="progress-bar"><div class="progress-bar__fill" style="width:${pct}%"></div></div>
                    <div class="unit-progress-card__stats">${done}/${qs.length}</div>
                </div>
              `;
      }).join('');
    }
  },

  // Export Data to JSON file
  async exportProgress() {
    const data = await App.Storage.exportAll();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `clearn_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    this.showToast(App.Strings.exportSuccess, 'success');
  },

  // Import Data from JSON file
  async importProgress(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);
        await App.Storage.importAll(data);
        this.showToast(App.Strings.importSuccess, 'success');
        setTimeout(() => location.reload(), 1000);
      } catch (err) {
        console.error(err);
        this.showToast('Invalid backup file', 'error');
      }
    };
    reader.readAsText(file);
  }
};

// ============================================
// MAIN INITIALIZATION
// ============================================
// Logic to run when the page finishes loading
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Database
  await App.Storage.init();

  // 2. Load Content
  await App.Questions.load();

  // 3. Initialize UI (Binds events, renders lists)
  App.UI.init();

  // 4. Initialize Auth (if available) - See auth.js
  if (window.App.Auth) {
    // Auth will handle its own init
    App.Auth.init();
  }
});
