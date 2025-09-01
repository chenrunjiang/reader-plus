// 统一的本地存储管理

/**
 * 存储键名常量
 */
export const STORAGE_KEYS = {
  // 主题相关
  THEME: 'appTheme',
  
  // 阅读器设置
  READER_FONT_SIZE: 'reader:fontSize',
  READER_FONT_FAMILY: 'reader:fontFamily',
  READER_LINE_HEIGHT: 'reader:lineHeight',
  READER_SHOW_AI: 'reader:showAI',
  READER_LAYOUT_WIDE_REVERSE: 'reader:layoutWideReverse',
  READER_LAYOUT_MOBILE_REVERSE: 'reader:layoutMobileReverse',
  
  // AI配置
  AI_API_KEY: 'ai:apiKey',
  AI_BASE_URL: 'ai:baseUrl',
  AI_MODEL: 'ai:model',
  AI_USER_PROMPT: 'ai:userPrompt',
  
  // 数据存储
  BOOKS: 'books:v2',
} as const;

/**
 * 主题类型
 */
export type Theme = 'light' | 'dark';

/**
 * AI配置接口
 */
export interface AIConfig {
  apiKey: string;
  baseUrl: string;
  model: string;
  userPrompt?: string;
}

/**
 * 阅读器配置接口
 */
export interface ReaderConfig {
  fontSize: number;
  fontFamily: string;
  lineHeight: number;
  showAI: boolean;
  layoutWideReverse: boolean;
  layoutMobileReverse: boolean;
}

/**
 * 通用存储操作
 */
class Storage {
  /**
   * 获取存储项
   */
  getItem(key: string, defaultValue: string = ''): string {
    try {
      return localStorage.getItem(key) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * 设置存储项
   */
  setItem(key: string, value: string): void {
    try {
      localStorage.setItem(key, value);
    } catch {
      // ignore storage errors
    }
  }

  /**
   * 删除存储项
   */
  removeItem(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // ignore storage errors
    }
  }

  /**
   * 检查localStorage是否可用
   */
  isAvailable(): boolean {
    return typeof localStorage !== 'undefined';
  }
}

const storage = new Storage();

/**
 * 主题管理
 */
export const themeStorage = {
  get(): Theme {
    const theme = storage.getItem(STORAGE_KEYS.THEME);
    return theme === 'dark' || theme === 'light' ? theme : 'light';
  },
  
  set(theme: Theme): void {
    storage.setItem(STORAGE_KEYS.THEME, theme);
    // 触发主题变更事件
    const event = new CustomEvent('themeChanged', { detail: theme });
    window.dispatchEvent(event);
  }
};

/**
 * 阅读器配置管理
 */
export const readerStorage = {
  getFontSize(): number {
    const fontSize = storage.getItem(STORAGE_KEYS.READER_FONT_SIZE);
    if (!fontSize) return 16;
    const n = parseInt(fontSize, 10);
    return Number.isNaN(n) ? 16 : Math.min(28, Math.max(12, n));
  },
  
  setFontSize(size: number): void {
    storage.setItem(STORAGE_KEYS.READER_FONT_SIZE, String(size));
  },
  
  getFontFamily(): string {
    return storage.getItem(STORAGE_KEYS.READER_FONT_FAMILY, 'Noto Sans SC');
  },
  
  setFontFamily(family: string): void {
    storage.setItem(STORAGE_KEYS.READER_FONT_FAMILY, family);
  },
  
  getLineHeight(): number {
    const v = storage.getItem(STORAGE_KEYS.READER_LINE_HEIGHT);
    if (!v) return 1.6;
    const n = parseFloat(v);
    return Number.isNaN(n) ? 1.6 : Math.min(2.4, Math.max(1.2, n));
  },
  
  setLineHeight(lineHeight: number): void {
    storage.setItem(STORAGE_KEYS.READER_LINE_HEIGHT, String(lineHeight));
  },

  getLayoutWideReverse(): boolean {
    return storage.getItem(STORAGE_KEYS.READER_LAYOUT_WIDE_REVERSE, '0') === '1';
  },

  setLayoutWideReverse(v: boolean): void {
    storage.setItem(STORAGE_KEYS.READER_LAYOUT_WIDE_REVERSE, v ? '1' : '0');
  },

  getLayoutMobileReverse(): boolean {
    return storage.getItem(STORAGE_KEYS.READER_LAYOUT_MOBILE_REVERSE, '0') === '1';
  },

  setLayoutMobileReverse(v: boolean): void {
    storage.setItem(STORAGE_KEYS.READER_LAYOUT_MOBILE_REVERSE, v ? '1' : '0');
  },
  
  getShowAI(): boolean {
    const value = storage.getItem(STORAGE_KEYS.READER_SHOW_AI);
    if (value === '') return true; // 默认开启
    return value === '1';
  },
  
  setShowAI(show: boolean): void {
    storage.setItem(STORAGE_KEYS.READER_SHOW_AI, show ? '1' : '0');
  },
  
  getAll(): ReaderConfig {
    return {
      fontSize: this.getFontSize(),
      fontFamily: this.getFontFamily(),
      lineHeight: this.getLineHeight(),
      showAI: this.getShowAI(),
      layoutWideReverse: this.getLayoutWideReverse(),
      layoutMobileReverse: this.getLayoutMobileReverse(),
    };
  },
  
  /**
   * 触发阅读器样式变更事件
   */
  emitStyleChange(config: { fontSize?: number; fontFamily?: string; lineHeight?: number; layoutWideReverse?: boolean; layoutMobileReverse?: boolean }): void {
    const event = new CustomEvent('readerStyleChanged', { detail: config });
    window.dispatchEvent(event);
  }
};

/**
 * AI配置管理
 */
export const aiStorage = {
  getApiKey(): string {
    return storage.getItem(STORAGE_KEYS.AI_API_KEY);
  },
  
  setApiKey(key: string): void {
    storage.setItem(STORAGE_KEYS.AI_API_KEY, key);
  },
  
  getBaseUrl(): string {
    return storage.getItem(STORAGE_KEYS.AI_BASE_URL, 'https://api-inference.modelscope.cn/v1');
  },
  
  setBaseUrl(url: string): void {
    storage.setItem(STORAGE_KEYS.AI_BASE_URL, url);
  },
  
  getModel(): string {
    return storage.getItem(STORAGE_KEYS.AI_MODEL, 'Qwen/Qwen3-235B-A22B-Instruct-2507');
  },
  
  setModel(model: string): void {
    storage.setItem(STORAGE_KEYS.AI_MODEL, model);
  },
  
  getUserPrompt(): string {
    return storage.getItem(STORAGE_KEYS.AI_USER_PROMPT, '');
  },
  
  setUserPrompt(prompt: string): void {
    storage.setItem(STORAGE_KEYS.AI_USER_PROMPT, prompt);
  },
  
  getAll(): AIConfig {
    return {
      apiKey: this.getApiKey(),
      baseUrl: this.getBaseUrl(),
      model: this.getModel(),
      userPrompt: this.getUserPrompt(),
    };
  },
  
  setAll(config: Partial<AIConfig>): void {
    if (config.apiKey !== undefined) this.setApiKey(config.apiKey);
    if (config.baseUrl !== undefined) this.setBaseUrl(config.baseUrl);
    if (config.model !== undefined) this.setModel(config.model);
    if (config.userPrompt !== undefined) this.setUserPrompt(config.userPrompt);
  },
  
  /**
   * 检查AI配置是否完整
   */
  isConfigured(): boolean {
    const config = this.getAll();
    return !!(config.apiKey && config.baseUrl && config.model);
  }
};

/**
 * 检查localStorage是否可用
 */
export const isStorageAvailable = storage.isAvailable;

/**
 * 导出默认存储实例（用于其他特殊操作）
 */
export default storage;
