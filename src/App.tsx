import { useState, useEffect } from 'react';
import {
  Button,
  Card,
  CardContent,
  CardMedia,
  Typography,
  Box,
  Alert,
  AppBar,
  Toolbar,
  IconButton,
  ThemeProvider,
  Container,
  Grid,
  CardActions,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  Settings as SettingsIcon,
  MenuBook as MenuBookIcon,
  Add as AddIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
} from '@mui/icons-material';
import localforage from 'localforage';
import ePub, { Book as EpubBook } from 'epubjs';
import JSZip from 'jszip';
import { useNavigate } from 'react-router-dom';
import { createAppTheme } from './theme';
import { themeStorage, isStorageAvailable } from './storage';

// 书籍数据结构
type Book = {
  id: string;
  title: string;
  author: string;
  coverDataUrl: string | null; // data:URL，稳定持久
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

function App() {
  const [books, setBooks] = useState<Book[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => themeStorage.get());
  const [isUploading, setIsUploading] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState<null | HTMLElement>(null);
  const [menuBookId, setMenuBookId] = useState<string | null>(null);
  const navigate = useNavigate();

  const BOOKS_KEY = 'books:v2';

  // 将 Blob 转为 data:URL
  const blobToDataUrl = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(typeof reader.result === 'string' ? reader.result : '');
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // 从 ZIP 中提取封面并转成 data:URL（优先使用标准 EPUB 标记）
  const extractCoverDataUrlFromZip = async (ab: ArrayBuffer): Promise<string | null> => {
    try {
      const zip = await JSZip.loadAsync(new Uint8Array(ab));
      const containerFile = zip.file(/META-INF\/container\.xml/i)?.[0];
      if (!containerFile) return null;
      const containerXml = await containerFile.async('string');
      const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
      const rootfileEl = containerDoc.querySelector('rootfile');
      const fullPath = rootfileEl?.getAttribute('full-path') || '';
      if (!fullPath) return null;

      const opfFile = zip.file(new RegExp(fullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))?.[0];
      if (!opfFile) return null;
      const opfXml = await opfFile.async('string');
      const opfDoc = new DOMParser().parseFromString(opfXml, 'application/xml');

      // 尝试 properties="cover-image"
      let coverHref: string | null = null;
      const manifestItems = Array.from(opfDoc.querySelectorAll('manifest > item'));
      const coverItem = manifestItems.find((it) => it.getAttribute('properties')?.includes('cover-image')) as Element | undefined;
      if (coverItem) {
        coverHref = coverItem.getAttribute('href');
      }

      // 尝试 meta name="cover" -> idref
      if (!coverHref) {
        const metaCover = opfDoc.querySelector('metadata > meta[name="cover"]') as Element | null;
        const coverId = metaCover?.getAttribute('content') || null;
        if (coverId) {
          const byId = manifestItems.find((it) => it.getAttribute('id') === coverId) as Element | undefined;
          if (byId) coverHref = byId.getAttribute('href');
        }
      }

      if (!coverHref) return null;

      // 规范化路径（相对 OPF）
      const opfDir = fullPath.substring(0, fullPath.lastIndexOf('/') + 1);
      const normalized = (opfDir || '') + coverHref.replace(/^\.\//, '');
      const coverEntry = zip.file(new RegExp(normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'))?.[0];
      if (!coverEntry) return null;

      const coverBlob = await coverEntry.async('blob');
      const dataUrl = await blobToDataUrl(coverBlob);
      return dataUrl || null;
    } catch {
      return null;
    }
  };

  // Load books from local storage on component mount
  useEffect(() => {
    console.log('🔄 初始化应用，加载已存储的书籍...');
    const loadBooks = async () => {
      try {
        // 读取书籍数据
        const books = await localforage.getItem<Book[]>(BOOKS_KEY);
        if (books && Array.isArray(books)) {
          console.log('📚 读取书库：', books.length, '本');
          setBooks(books);
        } else {
          setBooks([]);
        }
      } catch (err) {
        console.error('❌ 加载书籍失败:', err);
        setError('加载书籍失败。');
      }
    };

    loadBooks();

    // 输出调试信息
    console.log('🔧 环境信息:', {
      userAgent: navigator.userAgent,
      localStorage: isStorageAvailable(),
      indexedDB: typeof window.indexedDB !== 'undefined'
    });

    // 简化启动日志
    console.log('✅ 应用初始化完成');
  }, []);

  // 监听主题变更事件
  useEffect(() => {
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

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('themeChanged', handleThemeChange as EventListener);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('themeChanged', handleThemeChange as EventListener);
    };
  }, []);



  // Save books to local storage whenever the books state changes
  useEffect(() => {
    const saveBooks = async () => {
      try {
        await localforage.setItem(BOOKS_KEY, books);
      } catch (err) {
        console.error('保存书籍失败:', err);
        setError('保存书籍失败。');
      }
    };

    saveBooks();
  }, [books]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    console.log('🚀 开始文件上传处理...');
    setError(null);
    setIsUploading(true);

    const file = event.target.files?.[0];
    console.log('📁 选择的文件:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
      lastModified: file?.lastModified
    });

    if (!file) {
      console.log('❌ 没有选择文件');
      setError('请选择一个文件。');
      setIsUploading(false);
      return;
    }

    // 更宽松的文件类型检查
    const fileName = file.name.toLowerCase();
    const isEpubFile = fileName.endsWith('.epub') || file.type === 'application/epub+zip';

    if (!isEpubFile) {
      console.log('❌ 文件类型不匹配:', file.type, fileName);
      setError('请选择一个有效的 EPUB 文件（.epub格式）。');
      setIsUploading(false);
      return;
    }

    try {
      console.log('📖 开始解析EPUB文件...');
      
      // 同时获取ArrayBuffer用于存储和blob URL用于解析
      const arrayBuffer = await file.arrayBuffer();
      console.log('✅ ArrayBuffer获取成功，大小:', arrayBuffer.byteLength, 'bytes');
      
      // 快速校验：ZIP文件头 (PK\x03\x04 / PK\x05\x06 / PK\x07\x08)
      const sig = new Uint8Array(arrayBuffer.slice(0, 4));
      const isZipHeader = sig[0] === 0x50 && sig[1] === 0x4B &&
        ((sig[2] === 0x03 && sig[3] === 0x04) ||
         (sig[2] === 0x05 && sig[3] === 0x06) ||
         (sig[2] === 0x07 && sig[3] === 0x08));
      if (!isZipHeader) {
        console.error('❌ 非ZIP签名，头部字节:', Array.from(sig));
        setError('该文件不是有效的EPUB（ZIP）文件，无法解析。请确认文件未被错误重命名或损坏。');
        setIsUploading(false);
        return;
      }
      
      console.log('📊 文件详情:', {
        name: file.name,
        size: file.size,
        arrayBufferSize: arrayBuffer.byteLength,
        type: file.type
      });

      let metadata;
      let coverDataUrl: string | null = null;

      // 使用正确的EPUB.js解析方法
      let parseSuccess = false;

      try {
        // 预检：使用 JSZip 检查 container.xml 与 OPF 是否存在
        console.log('🧪 ZIP 预检: 加载压缩包...');
        let zipOk = false;
        try {
          // 尝试使用 Uint8Array 以提升兼容性
          const u8 = new Uint8Array(arrayBuffer);
          const zip = await JSZip.loadAsync(u8);
          const containerEntries = zip.file(/META-INF\/container\.xml/i);
          if (containerEntries && containerEntries.length > 0) {
            const containerXml = await containerEntries[0].async('string');
            const containerDoc = new DOMParser().parseFromString(containerXml, 'application/xml');
            const rootfileEl = containerDoc.querySelector('rootfile');
            const fullPath = rootfileEl?.getAttribute('full-path') || '';
            console.log('🧪 预检: OPF full-path =', fullPath || '(空)');
            if (fullPath) {
              const opfEntries = zip.file(new RegExp(fullPath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));
              if (opfEntries && opfEntries.length > 0) {
                zipOk = true;
              } else {
                console.warn('⚠️ 预检：未在ZIP中找到 OPF 路径 ->', fullPath, '将继续尝试由 epubjs 解析');
              }
            } else {
              console.warn('⚠️ 预检：container.xml 未提供 full-path，将继续尝试由 epubjs 解析');
            }
          } else {
            console.warn('⚠️ 预检：未找到 META-INF/container.xml，将继续尝试由 epubjs 解析');
          }
        } catch (zipErr) {
          console.warn('⚠️ 预检失败（JSZip）：', zipErr);
          // 不中断，继续交给 epubjs 解析
        }

        // 手动创建 Book 并调用 open(ArrayBuffer,'binary') 以获取底层错误
        console.log('🔍 创建EPUB实例（不自动打开）...');
        const book = new EpubBook({ openAs: 'binary' });
        console.log('📚 Book实例创建成功，开始手动 open...');

        try {
          await Promise.race([
            book.open(arrayBuffer, 'binary'),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Book.open 超时')), 12000))
          ]);
          console.log('✅ Book.open 完成，准备读取元数据...');
          
          // 方法2：直接从packaging获取metadata
          if (book.packaging && book.packaging.metadata) {
            console.log('📋 从packaging直接获取元数据:', book.packaging.metadata);
            const epubMetadata = book.packaging.metadata;
            
            metadata = {
              title: epubMetadata?.title || file.name.replace(/\.epub$/i, ''),
              creator: epubMetadata?.creator || '未知作者',
              language: epubMetadata?.language || 'zh',
              publisher: epubMetadata?.publisher || '未知出版社',
              description: epubMetadata?.description || null,
              identifier: epubMetadata?.identifier || null,
              rights: epubMetadata?.rights || null
            };
            
            console.log('✅ 元数据解析成功（直接访问）:', metadata);
            parseSuccess = true;
          } else {
            // 方法3：仍然尝试loaded.metadata但时间更短
            console.log('📖 尝试loaded.metadata方法...');
            const epubMetadata = await Promise.race([
              book.loaded.metadata,
              new Promise((_, reject) => setTimeout(() => reject(new Error('元数据获取超时')), 3000))
            ]) as any;
          
            console.log('📋 原始元数据:', epubMetadata);
            
            metadata = {
              title: epubMetadata?.title || file.name.replace(/\.epub$/i, ''),
              creator: epubMetadata?.creator || '未知作者',
              language: epubMetadata?.language || 'zh',
              publisher: epubMetadata?.publisher || '未知出版社',
              description: epubMetadata?.description || null,
              identifier: epubMetadata?.identifier || null,
              rights: epubMetadata?.rights || null
            };
            
            console.log('✅ 元数据解析成功:', metadata);
            parseSuccess = true;
          }

          // 获取封面（优先从 ZIP 精确解析；失败再尝试 epub.js 提供的 URL 转换）
          try {
            console.log('🖼️ 获取封面...');
            // 方法 A：ZIP 中查找封面
            coverDataUrl = await Promise.race([
              extractCoverDataUrlFromZip(arrayBuffer),
              new Promise<null>((resolve, reject) => setTimeout(() => resolve(null), 3000))
            ]);

            // 方法 B：从 epub.js 返回的 URL 转 data:URL
            if (!coverDataUrl) {
              const coverUrlFromEpub = await Promise.race([
                book.coverUrl(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('封面获取超时')), 3000))
              ]) as string | null;
              if (coverUrlFromEpub) {
                try {
                  const resp = await fetch(coverUrlFromEpub);
                  const blob = await resp.blob();
                  coverDataUrl = await blobToDataUrl(blob);
                } catch {}
              }
            }

            if (coverDataUrl) {
              console.log('✅ 封面 data:URL 获取成功');
            } else {
              console.log('ℹ️ 未找到封面');
            }
          } catch (coverError) {
            console.log('ℹ️ 封面获取失败，跳过:', (coverError as Error).message);
          }

        } catch (metadataError) {
          console.warn('⚠️ 打开或元数据获取失败:', (metadataError as Error).message);
          setError(`导入失败：${(metadataError as Error).message || '无法解析EPUB'}`);
          // 重置输入并中止，不加入书架
          event.target.value = '';
          return;
        } finally {
          // 清理资源
          try {
            book.destroy();
            console.log('🧹 EPUB资源清理完成');
          } catch (cleanupError) {
            console.warn('⚠️ 资源清理时出现错误:', cleanupError);
          }
          
          // ArrayBuffer方式不需要清理URL
        }
        
      } catch (error) {
        console.warn('⚠️ EPUB初始化失败:', error);
      }

      // 若未成功解析，直接提示并中止
      if (!parseSuccess) {
        setError('导入失败：未能解析该EPUB文件。');
        event.target.value = '';
        return;
      }

      console.log('📋 最终元数据:', metadata);
      console.log('🖼️ 封面状态:', coverDataUrl ? '有封面' : '无封面');

      // Create a new book object
      const newBook: Book = {
        id: Date.now().toString(),
        title: metadata?.title || file.name.replace(/\.epub$/i, ''),
        author: metadata?.creator || '未知作者',
        coverDataUrl: coverDataUrl,
        file: arrayBuffer,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        fileName: file.name,
        fileSize: file.size,
        metadata: {
          language: metadata?.language,
          publisher: metadata?.publisher,
          description: metadata?.description || null,
          identifier: metadata?.identifier || null,
          rights: metadata?.rights || null,
        },
        progress: {
          location: null,
          percentage: null,
          lastReadAt: null,
        }
      };

      console.log('📚 新书籍对象创建:', {
        id: newBook.id,
        title: newBook.title,
        author: newBook.author,
        hasCover: !!newBook.coverDataUrl,
        fileSize: arrayBuffer.byteLength
      });

      // Add the new book to the state
      setBooks((prevBooks) => {
        const updatedBooks = [...prevBooks, newBook];
        console.log('📚 书籍列表更新，当前数量:', updatedBooks.length);
        return updatedBooks;
      });

      // Destroy the epub.js book instance to free resources
      console.log('🧹 EPUB解析完成');

      // Reset file input
      event.target.value = '';
      console.log('✅ 文件上传处理完成！');

    } catch (err) {
      console.error('❌ 处理 EPUB 文件时出错:', err);
      console.error('错误堆栈:', err instanceof Error ? err.stack : 'Unknown error');
      setError(`处理 EPUB 文件时出错：${err instanceof Error ? err.message : '未知错误'}`);
    } finally {
      setIsUploading(false);
    }
  };

  // 处理删除书籍
  const handleDeleteClick = (book: Book, event?: React.MouseEvent<HTMLElement>) => {
    event?.stopPropagation();
    setBookToDelete(book);
    setDeleteDialogOpen(true);
    setMenuAnchorEl(null);
  };

  const confirmDelete = async () => {
    if (!bookToDelete) return;
    
    try {
      const updatedBooks = books.filter(book => book.id !== bookToDelete.id);
      setBooks(updatedBooks);
      await localforage.setItem(BOOKS_KEY, updatedBooks);
      
      // 清理独立的进度数据
      const progressKey = `book-progress:${bookToDelete.id}`;
      try {
        await localforage.removeItem(progressKey);
        console.log('🧹 已清理进度数据:', progressKey);
      } catch {
        // ignore cleanup errors
      }
      
      console.log('📚 书籍删除成功:', bookToDelete.title);
    } catch (err) {
      console.error('❌ 删除书籍失败:', err);
      setError('删除书籍失败。');
    } finally {
      setDeleteDialogOpen(false);
      setBookToDelete(null);
    }
  };

  const cancelDelete = () => {
    setDeleteDialogOpen(false);
    setBookToDelete(null);
  };

  // 处理菜单
  const handleMenuClick = (event: React.MouseEvent<HTMLElement>, bookId: string) => {
    event.stopPropagation();
    setMenuAnchorEl(event.currentTarget);
    setMenuBookId(bookId);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
    setMenuBookId(null);
  };

  const muiTheme = createAppTheme(theme);

  // 简化渲染日志
  if (books.length === 0) {
    console.log('📚 当前无书籍，等待用户上传');
  }

  return (
    <ThemeProvider theme={muiTheme}>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ py: 1 }}>
         
            <input
              accept=".epub,application/epub+zip"
              style={{ display: 'none' }}
              id="upload-epub"
              type="file"
              onChange={handleFileUpload}
            />
            <label htmlFor="upload-epub">
              <IconButton
                component="span"
                disabled={isUploading}
                sx={{
                  bgcolor: 'background.paper',
                  border: '1px solid',
                  borderColor: theme === 'light' ? 'divider' : 'white',
                  mr: 2,
                  '&:hover': {
                    bgcolor: 'action.hover',
                    transform: 'scale(1.05)',
                  }
                }}
              >
                <AddIcon />
              </IconButton>
            </label>
            <Typography variant="h5" component="div" sx={{ flexGrow: 1, fontWeight: 700, color: 'primary.main' }}>
            </Typography>

            <IconButton
              onClick={() => navigate('/settings')}
              sx={{
                bgcolor: 'background.paper',
                border: '1px solid',
                borderColor: theme === 'light' ? 'divider' : 'white',
                '&:hover': {
                  bgcolor: 'action.hover',
                  transform: 'scale(1.05)',
                }
              }}
            >
              <SettingsIcon />
            </IconButton>
          </Toolbar>
        </AppBar>

        <Container maxWidth="lg" sx={{ flexGrow: 1, py: 4 }}>

          {error && (
            <Alert
              severity="error"
              onClose={() => setError(null)}
              sx={{
                mb: 4,
                borderRadius: 2,
                '& .MuiAlert-icon': {
                  fontSize: '1.5rem'
                }
              }}
            >
              {error}
            </Alert>
          )}

          {books.length > 0 && (
            <Box>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 4 }}>
                <Typography variant="h3" sx={{ fontWeight: 700, color: theme === 'light' ? 'black' : 'white', flexGrow: 1 }}>
                  我的书库
                </Typography>
                <Chip
                  label={`${books.length} 本书`}
                  color="primary"
                  variant="outlined"
                  sx={{ 
                    fontWeight: 600,
                    color: theme === 'light' ? 'black' : 'white',
                    borderColor: theme === 'light' ? 'black' : 'white'
                  }}
                />
              </Box>

              <Grid container spacing={4}>
                {books.map((book) => (
                  <Grid item xs={12} sm={6} md={4} lg={3} key={book.id}>
                    <Card sx={{
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      position: 'relative',
                      '&::before': {
                        content: '""',
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        height: '3px',
                        background: `linear-gradient(90deg, #667eea 0%, #f093fb 100%)`,
                        opacity: 0,
                        transition: 'opacity 0.3s ease',
                      },
                      '&:hover::before': {
                        opacity: 1,
                      }
                    }}>
                      {/* 菜单按钮 */}
                      <IconButton
                        sx={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          bgcolor: 'rgba(0, 0, 0, 0.5)',
                          color: 'white',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.7)',
                          },
                          zIndex: 2,
                        }}
                        onClick={(e) => handleMenuClick(e, book.id)}
                      >
                        <MoreVertIcon />
                      </IconButton>

                      {book.coverDataUrl ? (
                        <CardMedia
                          component="img"
                          height="240"
                          image={book.coverDataUrl}
                          alt={book.title}
                          sx={{
                            objectFit: 'cover',
                            borderRadius: '16px 16px 0 0',
                          }}
                        />
                      ) : (
                        <Box
                          sx={{
                            height: 240,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: `linear-gradient(135deg, #667eea 0%, #f093fb 100%)`,
                            color: 'white',
                            position: 'relative',
                            '&::after': {
                              content: '""',
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              right: 0,
                              bottom: 0,
                              background: 'url("data:image/svg+xml,%3Csvg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M8 4H32C33.1 4 34 4.9 34 6V34C34 35.1 33.1 36 32 36H8C6.9 36 6 35.1 6 34V6C6 4.9 6.9 4 8 4Z" stroke="rgba(255,255,255,0.2)" stroke-width="1" fill="none"/%3E%3C/svg%3E") repeat',
                              opacity: 0.1,
                            }
                          }}
                        >
                          <MenuBookIcon sx={{ fontSize: 48, mb: 1, color: 'white' }} />
                          <Typography variant="h6" align="center" sx={{
                            p: 3,
                            fontWeight: 600,
                            color: 'white',
                            position: 'relative',
                            zIndex: 1
                          }}>
                            {book.title}
                          </Typography>
                        </Box>
                      )}

                      <CardContent sx={{ flexGrow: 1, p: 3 }}>
                        <Typography variant="h6" gutterBottom sx={{
                          fontWeight: 600,
                          lineHeight: 1.3,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mb: 1
                        }}>
                          {book.title}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 0.5
                        }}>
                          <Box component="span" sx={{
                            width: 4,
                            height: 4,
                            borderRadius: '50%',
                            bgcolor: 'primary.main',
                            opacity: 0.6
                          }} />
                          {book.author}
                        </Typography>
                      </CardContent>

                      <CardActions sx={{ p: 3, pt: 0 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          sx={{
                            borderRadius: 2,
                            py: 1,
                            fontWeight: 600,
                            '&:hover': {
                              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.08) 0%, rgba(240, 147, 251, 0.08) 100%)',
                            }
                          }}
                          onClick={() => navigate(`/read/${book.id}`)}
                        >
                          开始阅读
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Box>
          )}

          {books.length === 0 && (
            <Box sx={{
              textAlign: 'center',
              py: 8,
              px: 4,
              borderRadius: 3,
              background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.02) 0%, rgba(240, 147, 251, 0.02) 100%)',
              border: '1px solid',
              borderColor: theme === 'light' ? 'divider' : '#404040'
            }}>
              <Box sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.1) 0%, rgba(240, 147, 251, 0.1) 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mx: 'auto',
                mb: 3
              }}>
                <MenuBookIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              </Box>
              <Typography variant="h4" sx={{ fontWeight: 600, mb: 2, color: 'primary.main' }}>
                开启AI阅读之旅
              </Typography>
              <Typography variant="body1" color="text.secondary" sx={{
                maxWidth: 400,
                mx: 'auto',
                lineHeight: 1.6,
                mb: 4
              }}>
                还没有任何书籍，上传你的第一本 EPUB 电子书，开始你的数字阅读收藏
              </Typography>
              <label htmlFor="upload-epub">
                <Button
                  component="span"
                  variant="contained"
                  size="large"
                  disabled={isUploading}
                  startIcon={<AddIcon />}
                  sx={{
                    py: 1.5,
                    px: 4,
                    borderRadius: 2,
                    fontWeight: 600,
                  }}
                >
                  {isUploading ? '上传中...' : '添加第一本书'}
                </Button>
              </label>
            </Box>
          )}
        </Container>

        {/* 菜单 */}
        <Menu
          anchorEl={menuAnchorEl}
          open={Boolean(menuAnchorEl)}
          onClose={handleMenuClose}
          transformOrigin={{ horizontal: 'right', vertical: 'top' }}
          anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        >
          <MenuItem 
            onClick={(e) => {
              const book = books.find(b => b.id === menuBookId);
              if (book) handleDeleteClick(book);
              handleMenuClose();
            }}
            sx={{ color: 'error.main' }}
          >
            <ListItemIcon>
              <DeleteIcon fontSize="small" sx={{ color: 'error.main' }} />
            </ListItemIcon>
            <ListItemText>删除书籍</ListItemText>
          </MenuItem>
        </Menu>

        {/* 删除确认对话框 */}
        <Dialog
          open={deleteDialogOpen}
          onClose={cancelDelete}
          aria-labelledby="delete-dialog-title"
          aria-describedby="delete-dialog-description"
        >
          <DialogTitle id="delete-dialog-title">
            确认删除
          </DialogTitle>
          <DialogContent>
            <DialogContentText id="delete-dialog-description">
              确定要删除《{bookToDelete?.title}》吗？此操作无法撤销。
            </DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={cancelDelete} color="primary">
              取消
            </Button>
            <Button onClick={confirmDelete} color="error" variant="contained">
              删除
            </Button>
          </DialogActions>
        </Dialog>
      </Box>
    </ThemeProvider>
  );
}

export default App;