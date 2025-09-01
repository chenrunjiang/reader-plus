import { createTheme } from '@mui/material/styles';

// 现代化配色系统
const colorPalette = {
  light: {
    primary: '#667eea',      // 优雅的蓝紫色
    primaryLight: '#8fa5ff', 
    primaryDark: '#4f5bd5',
    secondary: '#f093fb',    // 柔和的粉紫色
    secondaryLight: '#fbc2ff',
    secondaryDark: '#c65bcf',
    success: '#4ade80',      // 清新的绿色
    warning: '#facc15',      // 温暖的黄色
    error: '#f87171',       // 柔和的红色
    background: {
      default: '#f8fafc',   // 极浅的灰蓝色
      paper: '#ffffff',
      accent: '#f1f5f9',    // 微弱的背景色
    },
    text: {
      primary: '#1e293b',   // 深蓝灰色
      secondary: '#64748b', // 中性灰色
      disabled: '#94a3b8',  // 浅灰色
    },
    surface: '#f8fafc',
  },
  dark: {
    primary: '#3b82f6',      // 清新的蓝色
    primaryLight: '#60a5fa',
    primaryDark: '#1d4ed8',
    secondary: '#10b981',    // 现代的绿色
    secondaryLight: '#34d399',
    secondaryDark: '#059669',
    success: '#22c55e',      // 明亮的绿色
    warning: '#f59e0b',      // 温暖的橙色
    error: '#ef4444',       // 清晰的红色
    background: {
      default: '#0a0a0a',   // 纯黑色背景
      paper: '#1a1a1a',     // 深灰色
      accent: '#2a2a2a',    // 中性灰色
    },
    text: {
      primary: '#ffffff',   // 纯白文本
      secondary: '#a3a3a3', // 中性灰色
      disabled: '#525252',  // 深灰色
    },
    surface: '#1a1a1a',
  }
};

export const createAppTheme = (mode: 'light' | 'dark') => {
  const colors = colorPalette[mode];
  
  return createTheme({
    palette: {
      mode,
      primary: {
        main: colors.primary,
        light: colors.primaryLight,
        dark: colors.primaryDark,
        contrastText: mode === 'dark' ? '#0a0a0a' : '#ffffff',
      },
      secondary: {
        main: colors.secondary,
        light: colors.secondaryLight,
        dark: colors.secondaryDark,
        contrastText: mode === 'dark' ? '#0a0a0a' : '#ffffff',
      },
      success: {
        main: colors.success,
      },
      warning: {
        main: colors.warning,
      },
      error: {
        main: colors.error,
      },
      background: {
        default: mode === 'light' ? colors.background.paper : colors.background.default,
        paper: colors.background.paper,
      },
      text: {
        primary: colors.text.primary,
        secondary: colors.text.secondary,
        disabled: colors.text.disabled,
      },
      action: {
        hover: mode === 'dark' ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
        selected: mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
        disabled: colors.text.disabled,
        disabledBackground: mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)',
      },
      divider: mode === 'dark' ? '#404040' : '#e2e8f0',
    },
    typography: {
      fontFamily: [
        'Inter',
        '-apple-system',
        'BlinkMacSystemFont',
        '"Segoe UI"',
        'system-ui',
        'sans-serif'
      ].join(','),
      h1: { fontWeight: 800, fontSize: '2.5rem', lineHeight: 1.2 },
      h2: { fontWeight: 700, fontSize: '2rem', lineHeight: 1.3 },
      h3: { fontWeight: 700, fontSize: '1.5rem', lineHeight: 1.4 },
      h4: { fontWeight: 600, fontSize: '1.25rem', lineHeight: 1.4 },
      h5: { fontWeight: 600, fontSize: '1.125rem', lineHeight: 1.5 },
      h6: { fontWeight: 600, fontSize: '1rem', lineHeight: 1.5 },
      subtitle1: { fontWeight: 500, fontSize: '1rem', lineHeight: 1.6 },
      subtitle2: { fontWeight: 500, fontSize: '0.875rem', lineHeight: 1.6 },
      body1: { fontSize: '1rem', lineHeight: 1.6 },
      body2: { fontSize: '0.875rem', lineHeight: 1.6 },
      button: { fontWeight: 600, textTransform: 'none' },
    },
    shape: {
      borderRadius: 16,
    },
    shadows: mode === 'dark' ? [
      'none',
      '0 1px 3px 0 rgba(255,255,255,0.02)',
      '0 4px 6px -1px rgba(255,255,255,0.04)',
      '0 10px 15px -3px rgba(255,255,255,0.06)',
      '0 20px 25px -5px rgba(255,255,255,0.08)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)',
      '0 25px 50px -12px rgba(255,255,255,0.1)'
    ] as any : [
      'none',
      '0 1px 3px 0 rgba(0,0,0,0.06)',
      '0 4px 6px -1px rgba(0,0,0,0.08)',
      '0 10px 15px -3px rgba(0,0,0,0.1)',
      '0 20px 25px -5px rgba(0,0,0,0.12)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)',
      '0 25px 50px -12px rgba(0,0,0,0.15)'
    ] as any,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          '*': {
            scrollbarWidth: 'thin',
            scrollbarColor: `${colors.text.disabled} transparent`,
          },
          '*::-webkit-scrollbar': {
            width: '6px',
            height: '6px',
          },
          '*::-webkit-scrollbar-track': {
            background: 'transparent',
          },
          '*::-webkit-scrollbar-thumb': {
            backgroundColor: colors.text.disabled,
            borderRadius: '3px',
            '&:hover': {
              backgroundColor: colors.text.secondary,
            },
          },
          '@keyframes pulse': {
            '0%': { opacity: 0.6 },
            '50%': { opacity: 1 },
            '100%': { opacity: 0.6 },
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            backgroundColor: mode === 'light' ? colors.background.default : colors.background.paper,
            backdropFilter: 'blur(20px)',
            borderBottom: `1px solid ${mode === 'dark' ? '#404040' : '#e2e8f0'}`,
            boxShadow: 'none',
          }
        }
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            border: `1px solid ${mode === 'dark' ? '#404040' : '#e2e8f0'}`,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            '&:hover': {
              transform: 'translateY(-2px)',
              boxShadow: mode === 'dark' 
                ? '0 10px 25px -5px rgba(255,255,255,0.1)' 
                : '0 10px 25px -5px rgba(0,0,0,0.15)',
            }
          }
        }
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            fontWeight: 600,
            borderRadius: 12,
            padding: '10px 20px',
            boxShadow: 'none',
            '&:hover': {
              boxShadow: 'none',
              transform: 'translateY(-1px)',
            },
          },
          contained: {
            background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.secondary} 100%)`,
            '&:hover': {
              background: `linear-gradient(135deg, ${colors.primaryDark} 0%, ${colors.secondaryDark} 100%)`,
            }
          },
          outlined: {
            borderWidth: '2px',
            '&:hover': {
              borderWidth: '2px',
            }
          }
        }
      },
      MuiChip: {
        styleOverrides: {
          root: {
            borderRadius: 20,
            fontWeight: 500,
          }
        }
      },
      MuiTextField: {
        styleOverrides: {
          root: {
            '& .MuiOutlinedInput-root': {
              borderRadius: 12,
              '&:hover .MuiOutlinedInput-notchedOutline': {
                borderColor: colors.primary,
              },
            },
          }
        }
      },
      MuiSelect: {
        styleOverrides: {
          root: {
            borderRadius: 12,
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: colors.primary,
            },
          }
        }
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            '&:hover': {
              backgroundColor: mode === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            }
          }
        }
      },
    }
  });
};
