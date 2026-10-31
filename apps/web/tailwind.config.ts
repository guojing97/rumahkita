import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx,mdx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        surface: 'var(--surface)',
        ink: 'var(--ink)',
        muted: 'var(--muted)',
        primary: {
          DEFAULT: 'var(--primary)',
          hover: '#B5DF53',
        },
        secondary: {
          DEFAULT: 'var(--secondary)',
          hover: '#A5C9F3',
        },
        accent: {
          DEFAULT: 'var(--accent)',
          hover: '#F27650',
        },
        lavender: 'var(--lavender)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        border: 'var(--border)',
      },
      boxShadow: {
        neo: '4px 4px 0 var(--ink)',
        'neo-sm': '2px 2px 0 var(--ink)',
        'neo-hover': '5px 5px 0 var(--ink)',
        'neo-lg': '6px 6px 0 var(--ink)',
        'neo-active': '2px 2px 0 var(--ink)',
        'neo-none': '0 0 0 transparent',
      },
      borderWidth: {
        neo: '2px',
        'neo-thick': '3px',
      },
      borderRadius: {
        badge: '6px',
        btn: '8px',
        input: '8px',
        card: '10px',
        modal: '12px',
      },
      fontFamily: {
        heading: ['var(--font-space-grotesk)', 'Space Grotesk', 'sans-serif'],
        body: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      keyframes: {
        ripple: {
          '0%': { transform: 'scale(0)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '0' },
        },
      },
      animation: {
        ripple: 'ripple 500ms cubic-bezier(0, 0, 0.2, 1) forwards',
      },
    },
  },
  plugins: [],
};

export default config;
