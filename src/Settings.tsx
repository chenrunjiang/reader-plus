import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Typography,
  Select,
  SelectChangeEvent,
  MenuItem,
  Box,
  AppBar,
  Toolbar,
  IconButton,
  ThemeProvider,
  Container,
  Card,
  CardContent,
  Slider,
  Divider,
  FormControl,
  InputLabel,
  Grid,
  TextField,
} from '@mui/material';
import {
  ArrowBack as ArrowBackIcon,
  Settings as SettingsIcon,
  Brightness4 as Brightness4Icon,
  Brightness7 as Brightness7Icon,
  AutoAwesome as AutoAwesomeIcon
} from '@mui/icons-material';
import { createAppTheme } from './theme';
import { themeStorage, readerStorage, aiStorage } from './storage';

function Settings() {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => themeStorage.get());
  const [fontSize, setFontSize] = useState<number>(() => readerStorage.getFontSize());
  const [fontFamily, setFontFamily] = useState<string>(() => readerStorage.getFontFamily());
  const [lineHeight, setLineHeight] = useState<number>(() => readerStorage.getLineHeight());
  const [apiKey, setApiKey] = useState<string>(() => aiStorage.getApiKey());
  const [baseUrl, setBaseUrl] = useState<string>(() => aiStorage.getBaseUrl());
  const [model, setModel] = useState<string>(() => aiStorage.getModel());
  const [userPrompt, setUserPrompt] = useState<string>(() => aiStorage.getUserPrompt());
  const navigate = useNavigate();

  // 在线中文字体（通过 Loli 镜像加载）— 使用中文名称展示
  const ONLINE_CN_FONTS: { family: string; label: string }[] = [
    { family: 'Noto Sans SC', label: '思源黑体（Noto Sans SC）' },
    { family: 'Noto Serif SC', label: '思源宋体（Noto Serif SC）' },
  ];

  const isOnlineFont = (family: string) => ONLINE_CN_FONTS.some(f => f.family === family);

  // 在设置页本身注入在线字体，保证示例文本能立即生效
  const ensureFontLinkInPage = (family: string) => {
    if (!isOnlineFont(family)) return;
    const id = `gf-${family.replace(/\s+/g, '-')}`;
    if (document.getElementById(id)) return;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    const familyParam = encodeURIComponent(`${family}:wght@400;500;600;700`);
    link.href = `https://fonts.loli.net/css2?family=${familyParam}&display=swap`;
    document.head.appendChild(link);
  };

  // 初始化字体加载
  useEffect(() => {
    try {
      let ff = readerStorage.getFontFamily();
      if (!ONLINE_CN_FONTS.some(f => f.family === ff)) {
        ff = 'Noto Sans SC';
        readerStorage.setFontFamily(ff);
        setFontFamily(ff);
      }
      ensureFontLinkInPage(ff);
    } catch (err) {
      console.error('加载设置失败:', err);
    }
  }, []);

  const handleThemeChange = (event: SelectChangeEvent<'light' | 'dark'>) => {
    const newTheme = event.target.value as 'light' | 'dark';
    setTheme(newTheme);
    themeStorage.set(newTheme);
  };

  // 使用统一的样式变更事件
  const emitReaderStyleChanged = readerStorage.emitStyleChange;

  const handleFontSizeChange = (_: Event, value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    setFontSize(v);
    readerStorage.setFontSize(v);
    emitReaderStyleChanged({ fontSize: v });
  };

  const handleFontFamilyChange = (event: SelectChangeEvent<string>) => {
    const v = event.target.value as string;
    setFontFamily(v);
    readerStorage.setFontFamily(v);
    emitReaderStyleChanged({ fontFamily: v });
    ensureFontLinkInPage(v);
  };

  const handleLineHeightChange = (_: Event, value: number | number[]) => {
    const v = Array.isArray(value) ? value[0] : value;
    setLineHeight(v);
    readerStorage.setLineHeight(v);
    emitReaderStyleChanged({ lineHeight: v });
  };

  // AI配置处理函数
  const handleApiKeyChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setApiKey(value);
    aiStorage.setApiKey(value);
  };

  const handleBaseUrlChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setBaseUrl(value);
    aiStorage.setBaseUrl(value);
  };

  const handleModelChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setModel(value);
    aiStorage.setModel(value);
  };

  const handleUserPromptChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setUserPrompt(value);
    aiStorage.setUserPrompt(value);
  };

  

  const muiTheme = createAppTheme(theme);

  return (
    <ThemeProvider theme={muiTheme}>
      <Box sx={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', bgcolor: 'background.default' }}>
        <AppBar position="static" color="transparent" elevation={0}>
          <Toolbar sx={{ py: 1 }}>
            <IconButton 
              onClick={() => { if (window.history.length > 1) { navigate(-1); } else { navigate('/'); } }} 
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
          </Toolbar>
        </AppBar>

        <Container maxWidth="md" sx={{ flexGrow: 1, py: 4 }}>
          <Card sx={{
            border: '1px solid',
            borderColor: 'divider',
            background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.01) 0%, rgba(240, 147, 251, 0.01) 100%)',
          }}>
            <CardContent sx={{ p: 3 }}>
              
              <Box sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                mb: 2.5
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  <Box sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                      主题模式
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      选择适合你的视觉主题 • 当前: {theme === 'dark' ? '深色模式' : '浅色模式'}
                    </Typography>
                  </Box>
                  <Select
                    value={theme}
                    onChange={handleThemeChange}
                    sx={{ 
                      minWidth: 120,
                      '& .MuiSelect-select': {
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                        py: 1.5
                      }
                    }}
                  >
                    <MenuItem value="light" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Brightness7Icon sx={{ fontSize: 20 }} />
                      浅色
                    </MenuItem>
                    <MenuItem value="dark" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Brightness4Icon sx={{ fontSize: 20 }} />
                      深色
                    </MenuItem>
                  </Select>
                </Box>
              </Box>

              <Box sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
              }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  阅读排版
                </Typography>
                <Grid container spacing={2.5}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      正文字号：{fontSize}px
                    </Typography>
                    <Slider
                      value={fontSize}
                      min={12}
                      max={28}
                      step={1}
                      onChange={handleFontSizeChange}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <FormControl fullWidth>
                      <InputLabel id="reader-font-label">正文字体</InputLabel>
                      <Select
                        labelId="reader-font-label"
                        value={fontFamily}
                        label="正文字体"
                        onChange={handleFontFamilyChange}
                      >
                        {ONLINE_CN_FONTS.map(item => (
                          <MenuItem key={item.family} value={item.family}>{item.label}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      行高：{lineHeight.toFixed(2)}
                    </Typography>
                    <Slider
                      value={lineHeight}
                      min={1.2}
                      max={2.4}
                      step={0.05}
                      onChange={handleLineHeightChange}
                    />
                  </Grid>
                </Grid>
                <Divider sx={{ my: 2 }} />
                <Typography variant="body2" color="text.secondary">
                  示例：
                </Typography>
                <Typography sx={{ mt: 1 }} style={{ fontSize, lineHeight, fontFamily: `'${fontFamily}', ${fontFamily.includes('Serif') ? 'serif' : 'sans-serif'}` }}>
                  The quick brown fox jumps over the lazy dog. 在「阅+」中优雅阅读，享受清晰的排版体验。
                </Typography>
              </Box>

              <Box sx={{
                p: 2.5,
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                bgcolor: 'background.paper',
                mt: 2.5
              }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
                  <AutoAwesomeIcon sx={{ color: 'primary.main' }} />
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    AI 配置
                  </Typography>
                </Box>
                <Grid container spacing={2.5}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="API 密钥"
                      value={apiKey}
                      onChange={handleApiKeyChange}
                      placeholder="请输入您的 OpenAI API Key"
                      type="password"
                      helperText="用于访问AI服务的API密钥"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="API 基础地址"
                      value={baseUrl}
                      onChange={handleBaseUrlChange}
                      placeholder="https://api.openai.com/v1"
                      helperText="AI服务的API基础URL地址"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="AI 模型"
                      value={model}
                      onChange={handleModelChange}
                      placeholder="gpt-3.5-turbo"
                      helperText="要使用的AI模型名称"
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      multiline
                      minRows={3}
                      maxRows={10}
                      label="用户提示词（可选）"
                      value={userPrompt}
                      onChange={handleUserPromptChange}
                      placeholder={"例：\n- 偏好中文输出，尽量简洁。\n- 更强调事件时间线与结论。"}
                      helperText="填写后将自动加在总结提示词之前，用于个性化指令"
                    />
                  </Grid>
                </Grid>
              </Box>
              
              <Box sx={{ 
                p: 3,
                mt: 2.5,
                borderRadius: 2,
                background: 'linear-gradient(135deg, rgba(102, 126, 234, 0.03) 0%, rgba(240, 147, 251, 0.03) 100%)',
                border: '1px solid rgba(102, 126, 234, 0.1)',
                textAlign: 'center'
              }}>
                <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
                  阅+ • 优雅的AI阅读器
                </Typography>
                <Typography variant="body2" color="text.disabled">
                  版本 v1.0.0
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Container>
      </Box>
    </ThemeProvider>
  );
}

export default Settings;