/** @type {import('tailwindcss').Config} */
export const neoBrutalismPreset = {
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
        heading: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
    },
  },
};
