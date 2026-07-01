import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        void: '#000000',
        surface: { DEFAULT: '#09090B', 2: '#111113' },
        card: { DEFAULT: '#18181B', hover: '#27272A' },
        border: { DEFAULT: 'rgba(255,255,255,0.08)', hover: 'rgba(255,255,255,0.18)' },
        text: { primary: '#FFFFFF', secondary: '#A1A1AA', muted: '#71717A' },
        accent: {
          DEFAULT: '#FBBF24',
          hover: '#FCD34D',
          glow: 'rgba(251,187,36,0.15)',
          bg: 'rgba(251,187,36,0.08)',
        },
        encrypted: {
          DEFAULT: '#A78BFA',
          bg: 'rgba(167,139,250,0.10)',
          glow: 'rgba(167,139,250,0.15)',
        },
        success: '#34D399',
        error: '#EF4444',
        warning: '#F59E0B',
      },
      fontFamily: {
        sans: ['Space Grotesk', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'system-ui', 'sans-serif'],
        mono: ['IBM Plex Mono', 'ui-monospace', 'monospace'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.5s ease-out',
        'grain': 'grain 8s steps(10) infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'blur-in': 'blurIn 0.7s cubic-bezier(0.4,0,0.2,1)',
        'shimmer': 'shimmer 2.5s linear infinite',
        'encrypted-pulse': 'encryptedPulse 2s ease-in-out infinite',
      },
      keyframes: {
        fadeInUp: { '0%': { opacity: '0', transform: 'translateY(16px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        grain: { '0%,100%': { transform: 'translate(0,0)' }, '10%': { transform: 'translate(-2%,-3%)' }, '30%': { transform: 'translate(3%,-1%)' }, '50%': { transform: 'translate(-1%,2%)' }, '70%': { transform: 'translate(2%,1%)' }, '90%': { transform: 'translate(-3%,3%)' } },
        glowPulse: { '0%,100%': { boxShadow: '0 0 20px rgba(251,187,36,0.1)' }, '50%': { boxShadow: '0 0 40px rgba(251,187,36,0.25)' } },
        blurIn: { '0%': { filter: 'blur(8px)', opacity: '0' }, '100%': { filter: 'blur(0)', opacity: '1' } },
        shimmer: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(100%)' } },
        encryptedPulse: { '0%,100%': { opacity: '0.6' }, '50%': { opacity: '1' } },
      },
      backdropBlur: { '2xl': '40px', '3xl': '64px' },
    },
  },
  plugins: [],
} satisfies Config;
