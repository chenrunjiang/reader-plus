import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Card,
  CardContent,
  CircularProgress,
  useTheme,
  TextField,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Close as CloseIcon, AutoAwesome as AutoAwesomeIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { aiStorage, readerStorage } from './storage';
import localforage from 'localforage';

// AI面板组件的Props接口
export interface AIPanelProps {
  // 控制面板显示/隐藏
  open: boolean;
  onClose: () => void;
  
  // 当前书籍信息
  book?: {
    id: string;
    title: string;
    author: string;
    metadata?: {
      language?: string;
      publisher?: string;
      description?: string | null;
      identifier?: string | null;
      rights?: string | null;
    };
  } | null;
  
  // EpubJS渲染对象和相关信息
  rendition?: any;
  currentLocation?: string | number | null;
  
  // 阅读进度信息
  progress?: {
    percentage?: number | null;
    currentPage?: number;
    totalPages?: number;
  };
  
  // 当前选中的文本
  selectedText?: string;
  
  // 样式相关
  isWide?: boolean;
}

const AIPanel: React.FC<AIPanelProps> = ({
  open,
  onClose,
  book,
  rendition,
  currentLocation,
  progress,
  selectedText,
  isWide = false,
}) => {
  const navigate = useNavigate();
  const theme = useTheme();
  
  // AI 配置状态
  const [aiConfigStatus, setAiConfigStatus] = useState<{configured: boolean; missing: string[]}>({
    configured: false,
    missing: []
  });
  
  // 当前页面内容状态
  const [pageContent, setPageContent] = useState<string>('');
  const [isExtractingContent, setIsExtractingContent] = useState<boolean>(false);
  
  // AI 总结相关状态
  const [completion, setCompletion] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // 读取阅读器字体设置
  const [readerFontSize, setReaderFontSize] = useState<number>(() => readerStorage.getFontSize());
  const [readerFontFamily, setReaderFontFamily] = useState<string>(() => readerStorage.getFontFamily());
  
  // 用于跟踪当前位置，避免重复请求
  const lastLocationRef = useRef<string | number | null>(null);
  const isInitializedRef = useRef<boolean>(false);
  
  // 用于取消请求
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 用于自动滚动
  const completionBoxRef = useRef<HTMLDivElement | null>(null);
  // 翻页延时定时器
  const pendingTimerRef = useRef<number | null>(null);
  // 当前页提示词：草稿与已提交版本（不做缓存，翻页清空）
  const [pagePromptDraft, setPagePromptDraft] = useState<string>('');
  const [pagePromptSaved, setPagePromptSaved] = useState<string>('');

  // 自动滚动到底部的函数
  const scrollToBottom = () => {
    setTimeout(() => {
      if (completionBoxRef.current) {
        completionBoxRef.current.scrollTop = completionBoxRef.current.scrollHeight;
      }
    }, 10);
  };

  // 当completion更新时自动滚动
  useEffect(() => {
    if (completion) {
      scrollToBottom();
    }
  }, [completion]);

  // 监听阅读器样式变更事件，更新字体与字号
  useEffect(() => {
    const onStyleChanged = (e: any) => {
      const d = e?.detail || {};
      if (typeof d.fontSize === 'number') setReaderFontSize(Math.min(28, Math.max(12, d.fontSize)));
      if (typeof d.fontFamily === 'string') setReaderFontFamily(d.fontFamily);
    };
    window.addEventListener('readerStyleChanged', onStyleChanged as EventListener);
    return () => window.removeEventListener('readerStyleChanged', onStyleChanged as EventListener);
  }, []);

  // 检查 AI 配置状态
  useEffect(() => {
    const checkAiConfig = () => {
      const config = aiStorage.getAll();
      const missing: string[] = [];
      
      if (!config.apiKey.trim()) missing.push('API Key');
      if (!config.baseUrl.trim()) missing.push('Base URL');
      if (!config.model.trim()) missing.push('Model');

      setAiConfigStatus({
        configured: missing.length === 0,
        missing
      });
    };

    checkAiConfig();

    // 监听存储变化
    const handleStorageChange = () => {
      checkAiConfig();
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // 识别段落的选择器（尽量覆盖常见块级文本）
  const PARAGRAPH_SELECTOR = 'p, li, blockquote, article, section, div, h1, h2, h3, h4, h5, h6';

  const normalizeWhitespace = (text: string): string => {
    return text.replace(/\s+/g, ' ').trim();
  };

  const getNearestBlockElement = (node: Node | null): HTMLElement | null => {
    let current: Node | null = node;
    while (current) {
      if (current.nodeType === 1) {
        const el = current as HTMLElement;
        if (el.matches && el.matches(PARAGRAPH_SELECTOR)) return el;
      }
      current = (current as ChildNode)?.parentNode;
    }
    return null;
  };

  const collectParagraphElements = (body: HTMLElement): HTMLElement[] => {
    const nodes = Array.from(body.querySelectorAll(PARAGRAPH_SELECTOR)) as HTMLElement[];
    // 过滤掉过短/无实际文字的块
    return nodes.filter((el) => {
      const text = normalizeWhitespace(el.textContent || '');
      // 避免采集纯容器类div
      return text.length >= 20;
    });
  };

  // 上下文预算（基于模型262,144 tokens，近似换算为字符，留安全余量）
  const CONTEXT_TOKENS_LIMIT = 131072;
  const TOKEN_TO_CHAR_APPROX = 3; // 粗略估算
  const CONTEXT_SAFETY_RATIO = 0.7; // 预留余量，避免溢出
  const charBudgetCap = Math.floor(CONTEXT_TOKENS_LIMIT * TOKEN_TO_CHAR_APPROX * CONTEXT_SAFETY_RATIO);
  const fallbackMaxChars = Math.min(charBudgetCap, 20000); // 兜底截断上限，避免极端超长

  // 提取当前页面内容（基于可视区域的前后段落聚合，控制字符预算）
  type ExtractResult = {
    content: string;
    cacheKey: string | null;
    groupPrefix: string | null;
    sigSource: string | null;
  };

  const extractPageContent = async (): Promise<ExtractResult> => {
    if (!rendition) return { content: '', cacheKey: null, groupPrefix: null, sigSource: null };
    setIsExtractingContent(true);
    try {
      const contents = rendition.getContents();
      if (!contents || contents.length === 0) return { content: '无法提取页面内容', cacheKey: null, groupPrefix: null, sigSource: null };
      const first = contents[0];
      const doc: Document | undefined = first?.document as Document | undefined;
      const body: HTMLElement | null = doc?.body || null;
      if (!doc || !body) return { content: '无法获取页面文档', cacheKey: null, groupPrefix: null, sigSource: null };
      // 获取可视区域起止CFI并定位到最近块级元素
      let startBlock: HTMLElement | null = null;
      let endBlock: HTMLElement | null = null;
      let spineId: string | null = null;
      let startCfi: string | null = null;
      let endCfi: string | null = null;
      try {
        const loc = typeof rendition.currentLocation === 'function' ? rendition.currentLocation() : null;
        startCfi = loc?.start?.cfi || null;
        endCfi = loc?.end?.cfi || null;
        spineId = loc?.start?.index != null ? String(loc.start.index) : null;
        if (startCfi && typeof rendition.getRange === 'function') {
          const r1: Range | null = rendition.getRange(startCfi) || null;
          startBlock = getNearestBlockElement(r1?.startContainer || null);
        }
        if (endCfi && typeof rendition.getRange === 'function') {
          const r2: Range | null = rendition.getRange(endCfi) || null;
          endBlock = getNearestBlockElement(r2?.endContainer || r2?.startContainer || null);
        }
      } catch {}

      // 收集段落元素
      const paragraphs = collectParagraphElements(body);
      if (paragraphs.length === 0) {
        const fallback = normalizeWhitespace(body.textContent || '').slice(0, 2000);
        return { content: fallback || '无法提取有效内容', cacheKey: null, groupPrefix: null, sigSource: null };
      }

      // 兜底起止块
      if (!startBlock && !endBlock) {
        startBlock = paragraphs[Math.floor(paragraphs.length / 2)];
        endBlock = startBlock;
      }
      if (!startBlock && endBlock) startBlock = endBlock;
      if (!endBlock && startBlock) endBlock = startBlock;
      if (!startBlock || !endBlock) {
        const fallback = normalizeWhitespace(body.textContent || '').slice(0, 2000);
        return { content: fallback || '无法提取有效内容', cacheKey: null, groupPrefix: null, sigSource: null };
      }

      // 构造起止范围内的小段集合
      const betweenRange = doc.createRange();
      try {
        betweenRange.setStartBefore(startBlock);
        betweenRange.setEndAfter(endBlock);
      } catch {}
      const inBetween: HTMLElement[] = [];
      for (const el of paragraphs) {
        try {
          if (betweenRange.intersectsNode(el)) inBetween.push(el);
        } catch {}
      }
      if (inBetween.length === 0) inBetween.push(startBlock);

      // 裁剪为一小段：优先保留起止段落的完整文本，再补充中间段落
      // 基于大模型超长上下文能力提升预算（保留安全余量）
      const charBudget = Math.min(charBudgetCap, 40000); // 4万字符左右，远低于上限，兼顾性能
      const maxParas = 300; // 放宽段落数上限，主要由字符预算限制
      let total = 0;
      const texts: string[] = [];
      const selectedIdxs: number[] = [];

      const pushIdx = (idx: number) => {
        if (idx < 0 || idx >= inBetween.length) return false;
        if (selectedIdxs.includes(idx)) return false;
        const t = normalizeWhitespace(inBetween[idx].textContent || '');
        if (!t) return false;
        const next = total + t.length + (texts.length ? 2 : 0);
        if (texts.length >= maxParas) return false;
        if (texts.length >= 2 && next > charBudget) return false; // 起止已入选后才受预算限制
        texts.push(t);
        selectedIdxs.push(idx);
        total = next;
        return true;
      };

      // 强制先加入起止段（若相同则只加一次）
      pushIdx(0);
      if (inBetween.length > 1) pushIdx(inBetween.length - 1);

      // 再从两端向中间补充
      let step = 1;
      while (texts.length < maxParas && total < charBudget && (step < inBetween.length)) {
        const leftIdx = step;
        const rightIdx = inBetween.length - 1 - step;
        if (leftIdx <= rightIdx) {
          pushIdx(leftIdx);
          if (rightIdx !== leftIdx) pushIdx(rightIdx);
        }
        step += 1;
        if ((leftIdx > rightIdx)) break;
      }

      const context = texts.join('\n\n');

      // 以首尾段文本作为签名来源，提升稳定性
      const startText = normalizeWhitespace(inBetween[0]?.textContent || '');
      const endText = normalizeWhitespace(inBetween[inBetween.length - 1]?.textContent || '');
      const paraHashSource = `${startText.slice(0, 120)}|${endText.slice(0, 120)}`;
      const stableHash = (str: string): string => {
        let h = 0;
        for (let i = 0; i < str.length; i += 1) {
          h = (h * 131 + str.charCodeAt(i)) >>> 0;
        }
        return h.toString(16);
      };
      const bookId = book?.id || 'unknown';
      const spinePart = spineId || '0';
      const startIdx = paragraphs.findIndex((el) => el === startBlock);
      const endIdx = paragraphs.findIndex((el) => el === endBlock);
      const centerPart = `${Math.min(startIdx, endIdx)}-${Math.max(startIdx, endIdx)}`;
      const contentSig = stableHash(paraHashSource);
      const cacheKey = `ai-summary:${bookId}:${spinePart}:${centerPart}:${contentSig}`;
      const groupPrefix = `ai-summary:${bookId}:${spinePart}:`;

      if (context && context.length >= 50) return { content: context, cacheKey, groupPrefix, sigSource: paraHashSource };

      // 兜底：退化为全文本截断
      const fallback = normalizeWhitespace(body.textContent || '').slice(0, fallbackMaxChars);
      return { content: fallback || '无法提取有效内容', cacheKey: null, groupPrefix, sigSource: paraHashSource };
    } catch (error) {
      console.warn('提取页面内容失败:', error);
      return { content: '提取页面内容时出现错误', cacheKey: null, groupPrefix: null, sigSource: null };
    } finally {
      setIsExtractingContent(false);
    }
  };

  // 停止当前请求
  const stopGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsLoading(false);
  };

  // 生成AI总结
  const generateSummary = async (content: string, overridePagePrompt?: string) => {
    if (!content || !aiConfigStatus.configured) return;
    
    // 停止之前的请求
    stopGeneration();
    
    const userPromptText = (aiStorage.getUserPrompt() || '').trim();
    const pagePromptText = (((overridePagePrompt ?? pagePromptSaved) || '').toString().trim());

    const systemMsg = `你是精炼的中文阅读总结助手。严格遵循以下优先级并据此生成回答：
1) 当前页提示词（最高优先级）
2) 全局用户提示词
3) 输出要求
若各项出现冲突，始终以前者为准。`;

    const rulesMsg = `输出要求：
- 若存在提示词，请先阅读并严格遵循提示词的要求；在满足提示词的前提下对正文进行总结（提示词优先于其它规则）。
- 先用1-2句给出整体概述（核心观点/情节/主题）。
- 再用3-7条要点（使用「- 」列表）展开关键信息：背景/原因/过程/结论/影响/关键术语等。
- 如有必要，可引用1句原文短句（加引号）佐证或点题（可选）。
- 只输出总结内容本身，不要任何前缀/后缀/致谢/免责声明。
- 不要输出书名、作者、来源等信息；不要出现“本段出自…/以下是…”等话术。
- 总长度不超过1000字，避免冗长和重复。`;

    const messages: Array<{ role: 'system' | 'user'; content: string }> = [
      { role: 'system', content: systemMsg },
    ];
    if (pagePromptText) messages.push({ role: 'user', content: `当前页提示词：\n${pagePromptText}` });
    if (userPromptText) messages.push({ role: 'user', content: `全局用户提示词：\n${userPromptText}` });
    messages.push({ role: 'user', content: rulesMsg });
    messages.push({ role: 'user', content: `正文：\n${content}` });

    // 输出请求内容到控制台
    console.log('🤖 AI 请求信息:');
    console.log('书籍标题:', book?.title || '未知');
    console.log('书籍作者:', book?.author || '未知');
    console.log('页面内容长度:', content.length);
    console.log('消息条数:', messages.length);
    console.log('messages 预览:', messages);
    console.log('---');

    const config = aiStorage.getAll();
    
    // 创建新的 AbortController
    abortControllerRef.current = new AbortController();
    
    setIsLoading(true);
    setCompletion('');

    try {
      const response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
        },
        body: JSON.stringify({
          model: config.model,
          messages,
          stream: true,
          max_tokens: CONTEXT_TOKENS_LIMIT,
          temperature: 0.7,
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.error?.message || 
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      if (!reader) {
        throw new Error('无法读取响应流');
      }

      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === '' || trimmed === 'data: [DONE]') continue;
          
          if (trimmed.startsWith('data: ')) {
            try {
              const jsonData = JSON.parse(trimmed.slice(6));
              const delta = jsonData.choices?.[0]?.delta?.content;
              
              if (delta) {
                accumulatedContent += delta;
                setCompletion(accumulatedContent);
                
                // 输出流式内容到控制台
                console.log('📝 AI 流式响应:', delta);
              }
            } catch (parseError) {
              console.warn('解析响应数据失败:', parseError);
            }
          }
        }
      }

      console.log('✅ AI 总结完成');
      console.log('完整响应:', accumulatedContent);
      
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('❌ AI 请求被取消');
      } else {
        console.error('❌ AI 总结失败:', error);
        setCompletion('生成总结时出现错误，请重试。');
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  };

  // 处理面板打开和位置变化
  useEffect(() => {
    if (!open || !aiConfigStatus.configured) return;

    const shouldTriggerSummary = 
      // 初次打开
      (!isInitializedRef.current) ||
      // 位置发生变化
      (currentLocation !== lastLocationRef.current && currentLocation !== null);

    if (shouldTriggerSummary) {
      // 清除已有定时器
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }

      // 停止之前的请求
      stopGeneration();

      // 延迟1秒再触发提取与生成
      pendingTimerRef.current = window.setTimeout(() => {
        // 更新引用
        lastLocationRef.current = currentLocation ?? null;
        isInitializedRef.current = true;

        // 提取内容并生成总结（带缓存）
        extractPageContent().then(async (res) => {
          const content = res.content;
          const key = res.cacheKey;
          const groupPrefix = res.groupPrefix;
          const sigSource = res.sigSource;
          // 翻页时清空当前页提示词
          setPagePromptDraft('');
          setPagePromptSaved('');
          setPageContent(content);

          // 先查缓存：精确命中
          if (key) {
            try {
              const cached = await localforage.getItem<string>(key);
              if (cached && cached.length > 0) {
                console.log('💾 命中AI缓存:', key);
                setCompletion(cached);
                return;
              }
            } catch {}
          }

          // 80% 相似度模糊命中（同章节 group 内）
          if (!key && groupPrefix && sigSource) {
            try {
              const keys = await localforage.keys();
              const groupKeys = keys.filter(k => typeof k === 'string' && k.startsWith(groupPrefix));
              const similarity = (a: string, b: string): number => {
                const setA = new Set(a.split(/\s+/).filter(Boolean));
                const setB = new Set(b.split(/\s+/).filter(Boolean));
                let inter = 0;
                for (const t of setA) if (setB.has(t)) inter += 1;
                const union = setA.size + setB.size - inter;
                return union === 0 ? 0 : inter / union;
              };
              let bestKey: string | null = null;
              let bestScore = 0;
              for (const k of groupKeys) {
                const cachedText = await localforage.getItem<string>(k);
                if (!cachedText) continue;
                const cachedWindow = cachedText.slice(0, 400);
                const curWindow = content.slice(0, 400);
                const score = similarity(curWindow, cachedWindow);
                if (score > bestScore) {
                  bestScore = score;
                  bestKey = k;
                }
              }
              if (bestKey && bestScore >= 0.8) {
                const cached = await localforage.getItem<string>(bestKey);
                if (cached && cached.length > 0) {
                  console.log('💾 模糊命中AI缓存:', bestKey, '相似度:', bestScore.toFixed(2));
                  setCompletion(cached);
                  return;
                }
              }
            } catch {}
          }

          // 未命中缓存，生成并写入
          await generateSummary(content);
          if (key) {
            try {
              setTimeout(async () => {
                if (completion && completion.length > 0) {
                  await localforage.setItem(key, completion);
                  console.log('💾 写入AI缓存:', key);
                }
              }, 300);
            } catch {}
          }
        });
      }, 1000);
    }
  }, [open, currentLocation, aiConfigStatus.configured, book, rendition]);

  // 面板关闭时取消请求
  useEffect(() => {
    if (!open) {
      stopGeneration();
      isInitializedRef.current = false;
      lastLocationRef.current = null;
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    }
  }, [open]);

  // 手动刷新总结
  const handleRefreshSummary = async () => {
    stopGeneration();
    const res = await extractPageContent();
    const content = res.content;
    const key = res.cacheKey;
    setPageContent(content);

    if (key) {
      try {
        await localforage.removeItem(key); // 主动刷新时失效旧缓存
      } catch {}
    }
    await generateSummary(content);
  };

  if (!open) return null;

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        borderLeft: isWide ? '1px solid' : 'none',
        borderTop: isWide ? 'none' : '1px solid',
        borderColor: 'divider',
        width: isWide ? '50%' : '100%',
        height: isWide ? '100vh' : '50vh',
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* 头部 */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2, py: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AutoAwesomeIcon fontSize="small" sx={{ color: 'text.primary' }} />
          <Typography variant="subtitle1" sx={{ fontWeight: 600, color: 'text.primary' }}>AI</Typography>
          
          {/* 加载状态提示 */}
          {aiConfigStatus.configured && (isLoading || isExtractingContent) && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
              <CircularProgress size={14} />
              <Typography variant="caption" color="text.secondary">
                {isExtractingContent ? '提取中...' : '生成中...'}
              </Typography>
            </Box>
          )}
        </Box>
        
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          {/* 关闭按钮 */}
          <IconButton
            onClick={onClose}
            sx={{
              color: 'text.primary',
              bgcolor: 'background.paper',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' }
            }}
            aria-label="关闭 AI 面板"
          >
            <CloseIcon />
          </IconButton>
        </Box>
      </Box>
      
      {/* 内容区域 */}
      <Box sx={{ flex: 1, p: 1, display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
        
        {/* 配置不完整时显示配置提示 */}
        {!aiConfigStatus.configured && (
          <Card variant="outlined">
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 1 }}>
                需要完成配置
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                缺少配置项：{aiConfigStatus.missing.join(', ')}
              </Typography>
              <Button
                variant="contained"
                fullWidth
                onClick={() => navigate('/settings')}
                sx={{ 
                  bgcolor: 'primary.main',
                  '&:hover': { bgcolor: 'primary.dark' }
                }}
              >
                前往设置页面
              </Button>
            </CardContent>
          </Card>
        )}

        {/* 配置完成时显示AI功能区域 */}
        {aiConfigStatus.configured && (
          <Box sx={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
            {/* 生成中居中提示（仅当暂无线程内容时显示） */}
            {(isLoading || isExtractingContent) && !completion && (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={18} />
                  <Typography variant="body2" color="text.secondary">
                    {isExtractingContent ? '提取中...' : '生成中...'}
                  </Typography>
                </Box>
              </Box>
            )}

            {/* AI总结内容 */}
            {completion && (
              <Box 
                ref={completionBoxRef}
                sx={{ 
                  bgcolor: theme.palette.mode === 'dark' ? 'grey.900' : 'grey.50',
                  p: 2,
                  pt: 0,
                  borderRadius: 1, 
                  border: '1px solid',
                  borderColor: theme.palette.mode === 'dark' ? 'grey.700' : 'grey.300',
                  flex: 1,
                  overflowY: 'auto',
                  scrollBehavior: 'smooth',
                  minHeight: 0, // 确保flex子元素可以缩小
                  color: 'text.primary',
                  fontSize: `${readerFontSize}px`,
                  fontFamily: readerFontFamily && readerFontFamily !== 'system' ? `'${readerFontFamily}', sans-serif` : undefined,
                  '& h1, & h2, & h3, & h4, & h5, & h6': {
                    color: 'text.primary',
                    margin: '0.5rem 0',
                    lineHeight: 1.3,
                  },
                  '& p, & li': {
                    color: 'text.primary',
                    lineHeight: 1.8,
                  },
                  '& code': {
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
                    padding: '0 4px',
                    borderRadius: 4,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
                    fontSize: '0.9em',
                  },
                  '& pre': {
                    backgroundColor: theme.palette.mode === 'dark' ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.03)',
                    padding: '12px',
                    borderRadius: 8,
                    overflowX: 'auto',
                  },
                  '& a': {
                    color: 'primary.main',
                    textDecoration: 'none',
                    '&:hover': { textDecoration: 'underline' },
                  },
                  '& ul': {
                    paddingInlineStart: '20px'
                  }
                }}
              >
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ node, ...props }) => <p {...props} style={{ margin: '0.5rem 0', lineHeight: 1.8 }} />,
                    li: ({ node, ...props }) => <li {...props} style={{ margin: '0.25rem 0', lineHeight: 1.8 }} />,
                    h1: ({ node, ...props }) => <h1 {...props} style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0.75rem 0' }} />,
                    h2: ({ node, ...props }) => <h2 {...props} style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0.6rem 0' }} />,
                    h3: ({ node, ...props }) => <h3 {...props} style={{ fontSize: '1rem', fontWeight: 700, margin: '0.5rem 0' }} />,
                    code: ({ className, children, ...props }) => (
                      <code {...props} className={className as string}>
                        {children as any}
                      </code>
                    ),
                  }}
                >
                  {completion}
                </ReactMarkdown>
              </Box>
            )}

            {/* 无内容提示 */}
            {!completion && !isLoading && !isExtractingContent && (
              <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', textAlign: 'center' }}>
                  翻页或点击下方更新按钮来获取当前页面的AI总结
                </Typography>
              </Box>
            )}

            {/* 当前页提示词输入与更新 */}
            <Box sx={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: 1, mt: 1, borderTop: '1px solid', borderColor: 'divider', pt: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="为当前页添加提示词（仅影响本页总结）"
                value={pagePromptDraft}
                onChange={(e) => setPagePromptDraft(e.target.value)}
                sx={{ flex: 1 }}
              />
              <Button
                variant="contained"
                size="small"
                onClick={async () => {
                  const res = await extractPageContent();
                  setPagePromptSaved(pagePromptDraft);
                  await generateSummary(res.content, pagePromptDraft);
                }}
                disabled={isLoading || isExtractingContent}
                sx={{
                  whiteSpace: 'nowrap',
                  px: 2,
                  flexShrink: 0,
                  minWidth: 72,
                  bgcolor: 'common.white',
                  color: 'text.primary',
                  border: '1px solid',
                  borderColor: 'divider',
                  boxShadow: 'none',
                  '&:hover': {
                    bgcolor: 'grey.100',
                    boxShadow: 'none'
                  },
                  '&:disabled': { opacity: 0.6 }
                }}
              >
                更新
              </Button>
            </Box>
          </Box>
        )}
      </Box>
    </Box>
  );
};

export default AIPanel;
