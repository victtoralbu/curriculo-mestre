import type { Config } from 'tailwindcss';

/**
 * Design System — Nova Paleta Oficial Currículo Mestre:
 * - #306D64 (Teal / Verde-petróleo principal)
 * - #04332D (Verde-pinho profundo)
 * - #040606 (Obsidiana / Preto profundo)
 * - #4C1507 (Mogno / Terracota profundo)
 * - #B53F0D (Terracota / Laranja queimado vibrante)
 * - #D77428 (Âmbar / Ocre dourado)
 */
const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'system-ui', '-apple-system', 'sans-serif'],
        inter: ['var(--font-inter)', 'Inter', 'sans-serif'],
        roboto: ['var(--font-inter)', 'Inter', 'sans-serif'],
      },
      colors: {
        palette: {
          teal: '#306D64',
          pine: '#04332D',
          obsidian: '#040606',
          mahogany: '#4C1507',
          terracotta: '#B53F0D',
          ochre: '#D77428',
        },
        brand: {
          50: '#F2F7F6',
          100: '#DCECE9',
          200: '#B8D8D3',
          300: '#84B9B1',
          400: '#529389',
          500: '#306D64',
          600: '#B53F0D', // Ações principais / CTAs em Terracota vibrante (#B53F0D)
          700: '#04332D', // Identidade profunda em Verde-pinho (#04332D)
          800: '#4C1507', // Mogno profundo (#4C1507)
          900: '#040606', // Obsidiana (#040606)
          950: '#040606',
        },
        slate: {
          50: '#F5F7F6',
          100: '#E8EFED',
          200: '#CFDDD9',
          300: '#A9C2BC',
          400: '#6D8F88',
          500: '#306D64',
          600: '#23534C',
          700: '#04332D',
          800: '#04332D',
          900: '#040606',
          950: '#040606',
        },
        emerald: {
          50: '#F0F6F5',
          100: '#D8EAE7',
          200: '#B2D5CF',
          300: '#7FB6AD',
          400: '#4D9187',
          500: '#306D64',
          600: '#306D64',
          700: '#04332D',
          800: '#04332D',
          900: '#040606',
        },
        amber: {
          50: '#FDF6F0',
          100: '#F9E6D6',
          200: '#F2CBA9',
          300: '#E5A26B',
          400: '#D77428',
          500: '#D77428',
          600: '#B53F0D',
          700: '#B53F0D',
          800: '#4C1507',
          900: '#4C1507',
          950: '#4C1507',
        },
        indigo: {
          50: '#FDF6F0',
          100: '#F9E6D6',
          200: '#F2CBA9',
          300: '#D77428',
          400: '#D77428',
          500: '#B53F0D',
          600: '#B53F0D',
          700: '#4C1507',
          800: '#4C1507',
          900: '#040606',
        },
        purple: {
          300: '#D77428',
          400: '#D77428',
          500: '#B53F0D',
          600: '#4C1507',
        },
        red: {
          50: '#FBF2EF',
          100: '#F5DDD6',
          200: '#E8B8AA',
          500: '#B53F0D',
          600: '#B53F0D',
          700: '#4C1507',
          800: '#4C1507',
          900: '#4C1507',
          950: '#4C1507',
        },
      },
    },
  },
  plugins: [],
};

export default config;
