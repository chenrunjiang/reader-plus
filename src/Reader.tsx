import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import localforage from 'localforage';
import { ThemeProvider } from '@mui/material/styles';
import {
  AppBar,
  Box,
  Container,
  IconButton,
  LinearProgress,
  Toolbar,
  Typography,
  Alert,
  Button,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  useMediaQuery,
  GlobalStyles,
} from '@mui/material';
import { ArrowBack as ArrowBackIcon, Settings as SettingsIcon, Toc as TocIcon, AutoAwesome as AutoAwesomeIcon } from '@mui/icons-material';
import { ReactReader, ReactReaderStyle, EpubViewStyle } from 'react-reader';
import { createAppTheme } from './theme';
import { themeStorage, readerStorage } from './storage';
import AIPanel from './AIPanel';

type Book = {
  id: string;
  title: string;
  author: string;
  coverDataUrl: string | null;
  file: ArrayBuffer | null;
  createdAt: number;
  updatedAt: number;
  fileName?: string;
  fileSize?: number;
  metadata?: {
    language?: string;
    publisher?: string;
    description?: string | null;
    identifier?: string | null;
    rights?: string | null;
  };
  progress: {
    location: string | number | null;
    percentage?: number | null;
    lastReadAt?: number | null;
  };
};

function Reader() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [theme, setTheme] = useState<'light' | 'dark'>(() => themeStorage.get());
  const [book, setBook] = useState<Book | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [location, setLocation] = useState<string | number | null>(null);
  const [rendition, setRendition] = useState<any | null>(null);
  const [showAppBar, setShowAppBar] = useState<boolean>(false);
  const [fontSize, setFontSize] = useState<number>(() => readerStorage.getFontSize());
  const [fontFamily, setFontFamily] = useState<string>(() => readerStorage.getFontFamily());
  const [tocOpen, setTocOpen] = useState<boolean>(false);
  const [tocItems, setTocItems] = useState<any[]>([]);
  const [showAI, setShowAI] = useState<boolean>(() => readerStorage.getShowAI());
  const [lineHeight, setLineHeight] = useState<number>(() => readerStorage.getLineHeight());

  useEffect(() => {
    // 主题初始化在state中已完成，这里不需要再次读取

    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'appTheme' && e.newValue) {
        if (e.newValue === 'dark' || e.newValue === 'light') {
          setTheme(e.newValue);
        }
      }
    };

    const handleThemeChange = (e: CustomEvent) => {
      if (e.detail === 'dark' || e.detail === 'light') {
        setTheme(e.detail);
      }
    };

    const handleReaderStyleChange = (e: CustomEvent) => {
      const d = e.detail || {};
      if (typeof d.fontSize === 'number') setFontSize(Math.min(28, Math.max(12, d.fontSize)));
      if (typeof d.fontFamily === 'string') setFontFamily(d.fontFamily);
      if (typeof d.lineHeight === 'number') setLineHeight(Math.min(2.4, Math.max(1.2, d.lineHeight)));
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('themeChanged', handleThemeChange as EventListener);
    window.addEventListener('readerStyleChanged', handleReaderStyleChange as EventListener);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('themeChanged', handleThemeChange as EventListener);
      window.removeEventListener('readerStyleChanged', handleReaderStyleChange as EventListener);
    };
  }, []);

  useEffect(() => {
    let isMounted = true;
    const load = async () => {
      if (!id) {
        setError('缺少书籍ID');
        setIsLoading(false);
        return;
      }
      try {
        // 读取书籍数据
        const books = await localforage.getItem<Book[]>('books:v2');
        const foundBook = (books || []).find(b => b.id === id) || null;
        if (foundBook) {
          if (!isMounted) return;
          if (!foundBook.file) {
            setError('该书籍缺少文件内容，无法阅读。');
          } else {
            setBook(foundBook);
            
            // 优先从独立进度存储中读取最新进度
            try {
              const progressKey = `book-progress:${id}`;
              const latestProgress = await localforage.getItem<{location: string | number, lastReadAt: number}>(progressKey);
              if (latestProgress && latestProgress.location) {
                console.log('📖 加载最新阅读进度:', latestProgress.location);
                setLocation(latestProgress.location);
              } else {
                setLocation(foundBook.progress?.location ?? null);
              }
            } catch {
              // 如果读取独立进度失败，使用书籍中保存的进度
              setLocation(foundBook.progress?.location ?? null);
            }
          }
        } else {
          if (!isMounted) return;
          setError('未找到对应书籍，可能已被删除。');
        }
      } catch (e) {
        setError('加载书籍时发生错误');
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    load();
    return () => {
      isMounted = false;
    };
  }, [id]);

  const muiTheme = useMemo(() => createAppTheme(theme), [theme]);
  // 更宽松的平板识别：md 断点 或 横屏且宽度 ≥ 768px
  const isMdUp = useMediaQuery(muiTheme.breakpoints.up('md'));
  const isTabletLandscape = useMediaQuery('(orientation: landscape) and (min-width: 600px)');
  const isWide = isMdUp || isTabletLandscape;

  const readerStyles = useMemo(() => {
    const p = muiTheme.palette;
    return {
      ...ReactReaderStyle,
      container: {
        ...ReactReaderStyle.container,
        background: 'transparent',
        color: p.text.primary,
      },
      readerArea: {
        ...ReactReaderStyle.readerArea,
        backgroundColor: p.background.default,
      },
      reader: {
        ...ReactReaderStyle.reader,
        background: 'transparent',
      },
      tocBackground: {
        ...ReactReaderStyle.tocBackground,
        background: 'transparent',
      },
      toc: {
        ...ReactReaderStyle.toc,
        color: p.text.primary,
      },
      tocArea: {
        ...ReactReaderStyle.tocArea,
        background: p.background.paper,
      },
      tocAreaButton: {
        ...ReactReaderStyle.tocAreaButton,
        background: 'transparent',
        color: p.text.primary,
        border: 'none',
        borderBottom: 'none',
        boxShadow: 'none',
      },
      tocButton: {
        ...ReactReaderStyle.tocButton,
        background: 'transparent',
        display: 'none',
      },
      tocButtonExpanded: {
        ...ReactReaderStyle.tocButtonExpanded,
        background: p.background.paper,
        display: 'none',
      },
      tocButtonBar: {
        ...ReactReaderStyle.tocButtonBar,
        background: p.text.secondary,
      },
      tocButtonBarTop: {
        ...ReactReaderStyle.tocButtonBarTop,
        background: p.text.secondary,
      },
      tocButtonBottom: {
        ...ReactReaderStyle.tocButtonBottom,
        background: p.text.secondary,
      },
      arrow: {
        ...ReactReaderStyle.arrow,
        display: 'none',
      },
      arrowHover: {
        ...ReactReaderStyle.arrowHover,
        display: 'none',
      },
      swipeWrapper: {
        ...ReactReaderStyle.swipeWrapper,
        background: 'transparent',
      },
      titleArea: {
        ...ReactReaderStyle.titleArea,
        color: p.text.primary,
      },
    };
  }, [muiTheme]);

  const epubViewStyles = useMemo(() => {
    const p = muiTheme.palette;
    return {
      ...EpubViewStyle,
      viewHolder: {
        ...EpubViewStyle.viewHolder,
        background: 'transparent',
      },
      view: {
        ...EpubViewStyle.view,
        background: 'transparent',
      },
    };
  }, [muiTheme]);

  // 记住 AI 面板开关状态
  useEffect(() => {
    readerStorage.setShowAI(showAI);
  }, [showAI]);



  // 同步 Reader 内部样式主题
  useEffect(() => {
    if (!rendition) return;
    const palette = muiTheme.palette;
    try {
      rendition.themes.register('light', {
        'html, body': { background: 'transparent !important', color: `${palette.text.primary} !important` },
        'p': { color: palette.text.primary, lineHeight: String(lineHeight) },
        'a': { color: palette.primary.main },
        'img': { maxWidth: '100%' },
      });
      rendition.themes.register('dark', {
        'html, body': { background: 'transparent !important', color: `${palette.text.primary} !important` },
        'p': { color: palette.text.primary, lineHeight: String(lineHeight) },
        'a': { color: palette.primary.light },
        'img': { maxWidth: '100%' },
      });
      rendition.themes.select(theme);
      // 应用字号/字体
      rendition.themes.fontSize(`${fontSize}px`);
      if (fontFamily && fontFamily !== 'system') rendition.themes.font(`'${fontFamily}', sans-serif`);
      else rendition.themes.font('');
    } catch {
      // ignore
    }
  }, [rendition, muiTheme, theme, fontSize, fontFamily, lineHeight]);

  // 切换顶部菜单或目录抽屉时，强制阅读区域重新布局
  useEffect(() => {
    const rafId = window.requestAnimationFrame(() => {
      try {
        if (rendition && typeof (rendition as any).resize === 'function') {
          (rendition as any).resize();
        }
      } catch {}
      try {
        window.dispatchEvent(new Event('resize'));
      } catch {}
    });
    return () => window.cancelAnimationFrame(rafId);
  }, [showAppBar, tocOpen, showAI, rendition]);

  return (
    <ThemeProvider theme={muiTheme}>
      <>
        <GlobalStyles styles={{
          '#reader-root [style*="inset: 50px 50px 20px"]': {
            inset: '0 !important',
          },
          '#reader-root, #reader-root *': {
            WebkitTapHighlightColor: 'transparent',
          },
          '#reader-root button, #reader-root a, #reader-root [role="button"], #reader-root .MuiIconButton-root': {
            WebkitTapHighlightColor: 'transparent',
            outline: 'none',
          },
        }} />
        <Box id="reader-root" sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="fixed" color="transparent" elevation={0} sx={{ display: showAppBar ? 'block' : 'none' }}>
          <Toolbar sx={{ py: 1 }}>
            <IconButton 
              disableRipple
              disableFocusRipple
              onClick={() => navigate('/')} 
              sx={{ 
                mr: 2,
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                  transform: 'scale(1.05)',
                }
              }}
            >
              <ArrowBackIcon />
            </IconButton>
            <Typography variant="h6" sx={{ fontWeight: 600, flexGrow: 1, color: 'text.primary' }}>
              {book?.title || '阅读器'}
            </Typography>
            <Button
              disableRipple
              disableFocusRipple
              onClick={() => { setShowAI(true); setShowAppBar(false); }}
              startIcon={<AutoAwesomeIcon fontSize="small" />}
              sx={{
                mr: 1,
                color: 'common.white',
                background: 'linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)',
                px: 2,
                '&:hover': {
                  background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                  transform: 'scale(1.05)',
                }
              }}
            >
              AI
            </Button>
            <IconButton 
              disableRipple
              disableFocusRipple
              onClick={() => navigate('/settings')} 
              sx={{ 
                mr: 1,
                color: 'text.primary',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                  transform: 'scale(1.05)',
                }
              }}
            >
              <SettingsIcon />
            </IconButton>
            <IconButton 
              disableRipple
              disableFocusRipple
              onClick={() => setTocOpen(true)} 
              sx={{ 
                color: 'text.primary',
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': {
                  bgcolor: 'action.hover',
                  transform: 'scale(1.05)',
                }
              }}
              aria-label="打开目录"
            >
              <TocIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Drawer
          anchor="left"
          open={tocOpen}
          onClose={() => setTocOpen(false)}
          PaperProps={{ sx: { width: 320, bgcolor: 'background.paper' } }}
        >
          <Box sx={{ p: 1 }}>
            <Typography variant="subtitle1" sx={{ px: 1, py: 1, fontWeight: 600 }}>目录</Typography>
            <List>
              {(() => {
                const renderItems = (items: any[], depth: number = 0) => (
                  items.map((it: any, idx: number) => (
                    <Box key={`${it.href || it.id || idx}-${depth}`}>
                      <ListItemButton
                        dense
                        onClick={() => { setLocation(it.href); setTocOpen(false); }}
                        sx={{ pl: 2 + depth * 2 }}
                      >
                        <ListItemText
                          primaryTypographyProps={{ noWrap: true }}
                          primary={typeof it.label === 'string' ? it.label : (it.label?.trim?.() || 'Untitled')}
                        />
                      </ListItemButton>
                      {Array.isArray(it.subitems) && it.subitems.length > 0 && (
                        <Box sx={{ ml: 0 }}>
                          {renderItems(it.subitems, depth + 1)}
                        </Box>
                      )}
                    </Box>
                  ))
                );
                return renderItems(tocItems || []);
              })()}
            </List>
          </Box>
        </Drawer>

        {isLoading && (
          <LinearProgress />
        )}

        <Container disableGutters maxWidth={false} sx={{ flexGrow: 1, height: '100%', display: 'flex' }}>
          {error && (
            <Box sx={{ p: 2, width: '100%' }}>
              <Alert severity="error" onClose={() => setError(null)}>{error}</Alert>
            </Box>
          )}

          {!error && book?.file && (
            <Box sx={{
              flex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: isWide ? 'row' : 'column',
              gap: 1,
              minHeight: '100vh',
            }}>
              {/* 阅读器区域 */}
              <Box sx={{ flex: 1, height: '100vh', position: 'relative' }}>
                <ReactReader
                  url={book.file as ArrayBuffer}
                  location={location}
                  getRendition={(r: any) => {
                    setRendition(r);
                    // 禁止 EpubJS 内部点击穿透导致页面翻页冲突
                    try {
                      r.hooks.content.register((contents: any) => {
                        const doc = contents.document as Document;
                        // 阻止阅读器内部默认点击引发的翻页（保留链接点击）
                        doc.addEventListener('click', (ev) => {
                          const target = ev.target as HTMLElement | null;
                          if (target && target.closest('a')) return;
                          ev.stopPropagation();
                        }, true);
                        // 注入在线字体链接（仅在选择在线字体时）
                        const head = doc.querySelector('head');
                        if (head && fontFamily && fontFamily !== 'system') {
                          const id = `gf-${fontFamily.replace(/\s+/g, '-')}`;
                          if (!doc.getElementById(id)) {
                            const link = doc.createElement('link');
                            link.id = id;
                            link.rel = 'stylesheet';
                            // 动态选择字体加载源
                            const family = encodeURIComponent(fontFamily + ':wght@400;500;600;700');
                            const base = 'https://fonts.loli.net';
                            link.href = `${base}/css2?family=${family}&display=swap`;
                            head.appendChild(link);
                          }
                        }
                      });
                    } catch {}
                  }}
                  readerStyles={readerStyles}
                  epubViewStyles={epubViewStyles}
                  tocChanged={(toc: any[]) => setTocItems(Array.isArray(toc) ? toc : [])}
                  locationChanged={async (epubcfi: string | number) => {
                    setLocation(epubcfi);
                    if (!id) return;
                    
                    try {
                      // 优化方案：首先独立保存进度，避免读取整个书籍列表
                      const progressKey = `book-progress:${id}`;
                      const progress = {
                        location: epubcfi,
                        percentage: null, // 可以后续计算
                        lastReadAt: Date.now(),
                      };
                      
                      // 快速保存进度到独立key
                      await localforage.setItem(progressKey, progress);
                      
                      // 异步更新主书籍列表（降低优先级，避免阻塞阅读体验）
                      setTimeout(async () => {
                        try {
                          const books = await localforage.getItem<Book[]>('books:v2');
                          if (Array.isArray(books)) {
                            // 检查书籍是否仍然存在，避免恢复已删除的书籍
                            const bookExists = books.find((b) => b.id === id);
                            if (!bookExists) {
                              console.log('📚 书籍已被删除，清理进度数据:', id);
                              await localforage.removeItem(progressKey);
                              navigate('/');
                              return;
                            }
                            
                            const next = books.map((b) => b.id === id ? {
                              ...b,
                              updatedAt: Date.now(),
                              progress: {
                                ...b.progress,
                                location: epubcfi,
                                lastReadAt: Date.now(),
                              }
                            } : b);
                            await localforage.setItem('books:v2', next);
                          }
                        } catch (err) {
                          console.warn('⚠️ 异步更新书籍列表失败:', err);
                        }
                      }, 100); // 延迟100ms执行，避免阻塞UI
                      
                    } catch (err) {
                      console.warn('⚠️ 保存阅读进度失败:', err);
                    }
                  }}
                />
                {/* 三分屏点击区域：左/中/右 */}
                <Box sx={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 300, pointerEvents: 'auto' }}>
                  <Box
                    onPointerUp={(e) => { e.stopPropagation(); setShowAppBar(false); if (rendition) rendition.prev(); }}
                    sx={{ flex: 1, height: '100%', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                  />
                  <Box
                    onPointerUp={(e) => { e.stopPropagation(); setShowAppBar(v => !v); }}
                    sx={{ flex: 1, height: '100%', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                  />
                  <Box
                    onPointerUp={(e) => { e.stopPropagation(); setShowAppBar(false); if (rendition) rendition.next(); }}
                    sx={{ flex: 1, height: '100%', cursor: 'pointer', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                  />
                </Box>
              </Box>

              {/* AI 面板组件 */}
              <AIPanel
                open={showAI}
                onClose={() => setShowAI(false)}
                book={book}
                rendition={rendition}
                currentLocation={location}
                progress={{
                  percentage: book?.progress?.percentage || null,
                  currentPage: undefined, // TODO: 从 rendition 获取当前页数
                  totalPages: undefined, // TODO: 从 rendition 获取总页数
                }}
                selectedText={undefined} // TODO: 实现文本选择功能
                isWide={isWide}
              />
            </Box>
          )}
        </Container>
      </Box>
      </>
    </ThemeProvider>
  );
}

export default Reader;


