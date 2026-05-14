/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'base-100': '#f8fafc', // Light slate for background
        'base-200': '#ffffff', // White for cards
        'primary': '#51c4b5', // Teal/Mint from the design
        'primary-focus': '#45a89a', 
        'sidebar-bg': '#fcfcfc', // Very light grey for sidebar
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      }
    },
  },
  plugins: [require('@tailwindcss/typography')],
}
