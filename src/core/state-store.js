/**
 * HTOS State Store Architecture - Extracted from HTOS1
 * 
 * Reactive state management system with collections, adapters, and templates.
 * Mirrors HTOS1's battle-tested sharedState patterns for distributed cognitive architecture.
 */

// Build-phase safe: emitted to dist/core/*

/**
 * Observable Collection - maps with reactive behaviors
 */
export class HTOSObservableCollection {
  constructor() {
    this._items = new Map();
    this._observers = [];
  }

  /**
   * Get item by ID
   * @param {string} id - Item identifier
   * @returns {Object|null} Item or null if not found
   */
  get(id) {
    return this._items.get(id) || null;
  }

  /**
   * Check if item exists
   * @param {string} id - Item identifier  
   * @returns {boolean} True if exists
   */
  has(id) {
    return this._items.has(id);
  }

  /**
   * Set item in collection
   * @param {string} id - Item identifier
   * @param {Object} item - Item to store
   */
  set(id, item) {
    this._items.set(id, item);
    this._notifyObservers('set', id, item);
  }

  /**
   * Delete item from collection
   * @param {string} id - Item identifier
   * @returns {boolean} True if deleted
   */
  delete(id) {
    const deleted = this._items.delete(id);
    if (deleted) {
      this._notifyObservers('delete', id);
    }
    return deleted;
  }

  /**
   * Get all items as array
   * @returns {Array} Array of items
   */
  all() {
    return Array.from(this._items.values());
  }

  /**
   * Get sorted items by timestamp
   * @returns {Array} Sorted array of items
   */
  sorted() {
    return this.all().sort((a, b) => (b.ts || 0) - (a.ts || 0));
  }

  /**
   * Find item by predicate
   * @param {Function} predicate - Search function
   * @returns {Object|null} Found item or null
   */
  find(predicate) {
    return this.all().find(predicate) || null;
  }

  /**
   * Filter items by predicate
   * @param {Function} predicate - Filter function
   * @returns {Array} Filtered items
   */
  filter(predicate) {
    return this.all().filter(predicate);
  }

  /**
   * Clear all items
   */
  clear() {
    this._items.clear();
    this._notifyObservers('clear');
  }

  /**
   * Subscribe to collection changes
   * @param {Function} observer - Observer function
   */
  subscribe(observer) {
    this._observers.push(observer);
  }

  /**
   * Unsubscribe from changes
   * @param {Function} observer - Observer to remove
   */
  unsubscribe(observer) {
    const index = this._observers.indexOf(observer);
    if (index > -1) {
      this._observers.splice(index, 1);
    }
  }

  /**
   * Notify all observers of changes
   * @private
   */
  _notifyObservers(action, id, item) {
    this._observers.forEach(observer => {
      try {
        observer({ action, id, item, collection: this });
      } catch (error) {
        console.error('Observer error:', error);
      }
    });
  }
}

/**
 * Chat Collection with specialized methods
 */
export class HTOSChatCollection extends HTOSObservableCollection {
  constructor() {
    super();
    this._tabIdMap = new Map(); // Maps tab IDs to chat IDs
  }

  /**
   * Get chat by tab ID
   * @param {string} tabId - Tab identifier
   * @returns {Object|null} Chat or null
   */
  getByTabId(tabId) {
    const chatId = this._tabIdMap.get(tabId);
    return chatId ? this.get(chatId) : null;
  }

  /**
   * Set chat with tab mapping
   * @param {string} id - Chat identifier
   * @param {Object} chat - Chat object
   */
  set(id, chat) {
    super.set(id, chat);
    
    // Update tab mappings
    if (chat.tabs) {
      chat.tabs.forEach(tab => {
        this._tabIdMap.set(tab.id, id);
      });
    }
  }

  /**
   * Delete chat and clean up tab mappings
   * @param {string} id - Chat identifier
   * @returns {boolean} True if deleted
   */
  delete(id) {
    const chat = this.get(id);
    if (chat && chat.tabs) {
      // Clean up tab mappings
      chat.tabs.forEach(tab => {
        this._tabIdMap.delete(tab.id);
      });
    }
    return super.delete(id);
  }

  /**
   * Update tab mapping for chat
   * @param {string} chatId - Chat identifier
   * @param {string} tabId - Tab identifier
   */
  updateTabMapping(chatId, tabId) {
    this._tabIdMap.set(tabId, chatId);
  }
}

/**
 * Chat adapter with reactive properties
 */
export class HTOSChatAdapter {
  constructor(chat, stateManager) {
    this._chat = chat;
    this._stateManager = stateManager;
  }

  // Core properties
  get id() { return this._chat.id; }
  get title() { return this._chat.title; }
  get emoji() { return this._chat.emoji; }
  get ts() { return this._chat.ts; }
  get running() { return this._chat.running; }
  get connectionId() { return this._chat.connectionId; }

  set running(value) { 
    this._chat.running = value;
    this._stateManager._notifyChange('chat.running', this.id, value);
  }

  set connectionId(value) {
    this._chat.connectionId = value;
    this._stateManager._notifyChange('chat.connectionId', this.id, value);
  }

  // Provider state
  get openaiChatId() { return this._chat.openaiChatId; }
  get openaiLastAnswerId() { return this._chat.openaiLastAnswerId; }
  get geminiCursor() { return this._chat.geminiCursor; }
  get claudeChatId() { return this._chat.claudeChatId; }

  set openaiChatId(value) {
    this._chat.openaiChatId = value;
    this._stateManager._notifyChange('chat.openaiChatId', this.id, value);
  }

  set openaiLastAnswerId(value) {
    this._chat.openaiLastAnswerId = value;
    this._stateManager._notifyChange('chat.openaiLastAnswerId', this.id, value);
  }

  set geminiCursor(value) {
    this._chat.geminiCursor = value;
    this._stateManager._notifyChange('chat.geminiCursor', this.id, value);
  }

  set claudeChatId(value) {
    this._chat.claudeChatId = value;
    this._stateManager._notifyChange('chat.claudeChatId', this.id, value);
  }

  // Questions and answers
  get lastQuestion() { return this._chat.questions?.[this._chat.questions.length - 1] || null; }
  get lastAnswer() { return this._chat.answers?.[this._chat.answers.length - 1] || null; }

  /**
   * Get connection object from state manager
   */
  get connection() {
    return this._stateManager.ai.connections.get(this.connectionId);
  }

  /**
   * Add new answer to chat
   * @param {Object} answer - Answer object
   */
  addAnswer(answer) {
    if (!this._chat.answers) this._chat.answers = [];
    
    const answerWithDefaults = {
      id: `answer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ts: Date.now(),
      done: false,
      ...answer
    };

    this._chat.answers.push(answerWithDefaults);
    this._stateManager._notifyChange('chat.addAnswer', this.id, answerWithDefaults);
  }

  /**
   * Update last question
   * @param {Object} updates - Question updates
   */
  updateLastQuestion(updates) {
    if (!this._chat.questions) this._chat.questions = [];
    
    const lastQuestion = this.lastQuestion;
    if (lastQuestion) {
      Object.assign(lastQuestion, updates);
    } else {
      const newQuestion = {
        id: `question-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        ts: Date.now(),
        ...updates
      };
      this._chat.questions.push(newQuestion);
    }
    
    this._stateManager._notifyChange('chat.updateLastQuestion', this.id, updates);
  }

  /**
   * Update last answer
   * @param {Object} updates - Answer updates
   */
  updateLastAnswer(updates) {
    const lastAnswer = this.lastAnswer;
    if (lastAnswer) {
      Object.assign(lastAnswer, updates);
      this._stateManager._notifyChange('chat.updateLastAnswer', this.id, updates);
    }
  }

  /**
   * Update specific answer by ID
   * @param {string} answerId - Answer identifier
   * @param {Object} updates - Answer updates
   */
  updateAnswer(answerId, updates) {
    if (!this._chat.answers) return;
    
    const answer = this._chat.answers.find(a => a.id === answerId);
    if (answer) {
      Object.assign(answer, updates);
      this._stateManager._notifyChange('chat.updateAnswer', this.id, { answerId, updates });
    }
  }

  /**
   * Remove last answer
   */
  removeLastAnswer() {
    if (this._chat.answers && this._chat.answers.length > 0) {
      const removed = this._chat.answers.pop();
      this._stateManager._notifyChange('chat.removeLastAnswer', this.id, removed);
    }
  }
}

/**
 * Connection adapter with provider-specific properties
 */
export class HTOSConnectionAdapter {
  constructor(connection, stateManager) {
    this._connection = connection;
    this._stateManager = stateManager;
  }

  // Core properties
  get id() { return this._connection.id; }
  get type() { return this._connection.type; }
  get customTitle() { return this._connection.customTitle; }
  get title() { return this._connection.title; }
  get apiKey() { return this._connection.apiKey; }
  get orgId() { return this._connection.orgId; }
  get token() { return this._connection.token; }
  get selectedModelId() { return this._connection.selectedModelId; }
  get maxTokens() { return this._connection.maxTokens; }

  set orgId(value) {
    this._connection.orgId = value;
    this._stateManager._notifyChange('connection.orgId', this.id, value);
  }

  set token(value) {
    this._connection.token = value;
    this._stateManager._notifyChange('connection.token', this.id, value);
  }

  // Computed properties following HTOS1 patterns
  get label() {
    if (this.customTitle) {
      return this.customTitle;
    } else if (this.title) {
      return this.title;
    } else if (this.type === "cloudgpt") {
      return this.selectedModel?.name || "CloudGPT";
    } else if (this.type === "gemini-session") {
      return "GEMINI";
    } else if (this.type === "claude-session") {
      return "CLAUDE AI";
    } else if (this.type === "openai-license") {
      return `API KEY ${(this.apiKey || "").slice(-4)}`;
    } else {
      return this.type?.toUpperCase() || "UNKNOWN";
    }
  }

  get icon() {
    if (this.type === "cloudgpt") {
      return this.selectedModel?.icon || "cloudgpt-htos";
    } else {
      return this.type;
    }
  }

  get labelUpper() {
    return this.label.toUpperCase();
  }

  get modelMaxTokens() {
    switch (this.type) {
      case "openai-session":
        return this.maxTokens || 4096;
      case "openai-license":
        return this.maxTokens || 4096;
      case "claude-session":
        return this.maxTokens ? this.maxTokens - 1 : 99998;
      case "gemini-session":
        return 9999;
      case "cloudgpt":
        return this.selectedModel?.limits?.maxTokens || 4096;
      default:
        return 4096;
    }
  }

  get supportsVision() {
    if (this.type === "cloudgpt") {
      return this.selectedModel?.features?.includes("vision") || false;
    } else if (this.type === "openai-session") {
      return this.selectedModelId === "gpt-4o";
    } else {
      return this.type === "openai-license";
    }
  }

  get selectedModel() {
    if (this.type !== "cloudgpt") return null;
    // Would need models collection from state manager
    return this._stateManager.ai.cloudgptModels?.find(m => m.id === this.selectedModelId);
  }

  isCloud() {
    return this.type === "cloudgpt";
  }

  isWeb() {
    return !["cloudgpt", "openai-license"].includes(this.type);
  }

  isApi() {
    return this.type === "openai-license";
  }
}

/**
 * Chat template factory
 */
export class HTOSChatTemplate {
  constructor(utils, stateManager) {
    this.utils = utils;
    this.stateManager = stateManager;
  }

  /**
   * Create new chat template
   * @param {Object} options - Chat creation options
   * @returns {Object} Chat template
   */
  create({
    id = null,
    title = null,
    emoji = null,
    connectionId = null,
    taskId = null
  } = {}) {
    return {
      updatedAt: null,
      id: id || this.utils.id.nano(),
      title,
      emoji: emoji || this._getChatEmoji(),
      ts: Date.now(),
      taskId: taskId || null,
      hidden: false,
      connectionId: connectionId || this.stateManager.settings?.spaceConnectionId,
      connectionShow: false,
      
      // Provider state
      geminiCursor: null,
      claudeChatId: null,
      openaiChatId: null,
      openaiLastAnswerId: null,
      
      // Runtime state
      running: false,
      input: "",
      selectedSuggestionIndex: null,
      attachments: [],
      command: null,
      params: {},
      
      // Questions and answers
      questions: [],
      answers: [],
      
      // Mode configuration
      mode: {
        show: false,
        page: {
          enabled: false
        },
        web: {
          enabled: false
        },
        file: {
          enabled: false,
          ids: null
        },
        think: {
          enabled: false
        }
      },
      
      // Explorer state
      explorer: {
        show: false,
        screen: null,
        category: null,
        commandName: null,
        editCommandName: null
      },
      
      // Tab associations
      tabs: []
    };
  }

  _getChatEmoji() {
    const emojis = ['🤖', '💬', '🧠', '⚡', '🌟', '🔥', '💡', '🚀'];
    return emojis[Math.floor(Math.random() * emojis.length)];
  }
}

/**
 * Connection template factory  
 */
export class HTOSConnectionTemplate {
  constructor(utils) {
    this.utils = utils;
  }

  /**
   * Create OpenAI license connection template
   */
  createOpenAILicense({
    apiKey = "",
    customTitle = "",
    proxyUrl = null,
    maxTokens = 4096
  } = {}) {
    return {
      id: `api-${this.utils.id.nano()}`,
      type: "openai-license",
      customTitle,
      proxyUrl,
      proxyPath: "/v1/chat/completions",
      provider: "openai",
      headers: null,
      slug: "gpt-3.5-turbo",
      apiKey,
      showAdvanced: false,
      maxTokens,
      maxResponseTokens: maxTokens,
      temperature: null,
      presencePenalty: null,
      frequencyPenalty: null,
      systemPrompt: null,
      stream: true,
      flag: null,
      detail: "high",
      superpowers: {
        page: true,
        web: true,
        commands: true
      }
    };
  }

  /**
   * Create Gemini session connection template
   */
  createGeminiSession() {
    return {
      id: "gemini-session",
      type: "gemini-session",
      token: null,
      flag: "g",
      superpowers: {
        page: true,
        web: true,
        commands: true
      }
    };
  }

  /**
   * Create Claude session connection template
   */
  createClaudeSession() {
    return {
      id: "claude-session",
      type: "claude-session",
      orgId: null,
      flag: "c",
      superpowers: {
        page: true,
        web: true,
        commands: true
      }
    };
  }
}

/**
 * Main State Manager - coordinates all state components
 */
export class HTOSStateManager {
  constructor(utils) {
    this.utils = utils;
    this._observers = [];
    
    // Initialize collections
    this.chats = new HTOSChatCollection();
    this.ai = {
      connections: new HTOSObservableCollection(),
      cloudgptModels: [],
      openaiSession: {
        accessToken: null,
        maxTokenFactor: 1
      }
    };
    
    // Templates
    this.templates = {
      chat: new HTOSChatTemplate(utils, this),
      connection: new HTOSConnectionTemplate(utils)
    };
    
    // Settings
    this.settings = {
      spaceConnectionId: null
    };

    // Initialize default connections
    this._initializeDefaultConnections();
  }

  /**
   * Create a new chat with adapter
   * @param {Object} options - Chat creation options
   * @returns {HTOSChatAdapter} Chat adapter
   */
  createChat(options = {}) {
    const chatTemplate = this.templates.chat.create(options);
    const chatAdapter = new HTOSChatAdapter(chatTemplate, this);
    this.chats.set(chatTemplate.id, chatAdapter);
    return chatAdapter;
  }

  /**
   * Get chat adapter by ID
   * @param {string} chatId - Chat identifier
   * @returns {HTOSChatAdapter|null} Chat adapter or null
   */
  getChat(chatId) {
    const chat = this.chats.get(chatId);
    return chat instanceof HTOSChatAdapter ? chat : null;
  }

  /**
   * Create a new connection with adapter
   * @param {Object} connectionData - Connection data
   * @returns {HTOSConnectionAdapter} Connection adapter
   */
  createConnection(connectionData) {
    const connectionAdapter = new HTOSConnectionAdapter(connectionData, this);
    this.ai.connections.set(connectionData.id, connectionAdapter);
    return connectionAdapter;
  }

  /**
   * Transaction wrapper for batched updates
   * @param {Function} fn - Transaction function
   */
  transaction(fn) {
    try {
      fn();
    } catch (error) {
      console.error('Transaction error:', error);
      throw error;
    }
  }

  /**
   * Subscribe to state changes
   * @param {Function} observer - Observer function
   */
  subscribe(observer) {
    this._observers.push(observer);
  }

  /**
   * Internal change notification
   * @private
   */
  _notifyChange(type, id, data) {
    this._observers.forEach(observer => {
      try {
        observer({ type, id, data });
      } catch (error) {
        console.error('State observer error:', error);
      }
    });
  }

  /**
   * Initialize default connections
   * @private
   */
  _initializeDefaultConnections() {
    // Add default session connections
    this.createConnection(this.templates.connection.createGeminiSession());
    this.createConnection(this.templates.connection.createClaudeSession());
  }
}

/**
 * Factory function for HTOS State Manager
 * @param {Object} utils - Utility functions
 * @returns {HTOSStateManager} Configured state manager
 */
export function createHTOSStateManager(utils) {
  return new HTOSStateManager(utils);
}

// Build verification snippet
/*
@("dist/core/sw.js", "dist/icons/icon16.svg") | % { if (!(Test-Path $_)) { throw "Missing $_" } }
*/