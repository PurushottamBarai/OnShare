/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#1A1D23',
          surface: '#242830',
          elevated: '#2E333D',
        },
        accent: {
          primary: '#F5A623',
          hover: '#FFB84D',
        },
        text: {
          primary: '#F5F6F7',
          secondary: '#9CA3AF',
        },
        border: {
          subtle: '#3A3F4B',
        },
        status: {
          success: '#3DDC84',
          warning: '#F5A623',
          error: '#E5484D',
          pending: '#6B7280',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
