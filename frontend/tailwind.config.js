/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          dark: "#120924",
          indigo: "#2b1154",
          purple: "#7c1a6e",
          pink: "#e11d74",
          rose: "#f43f85",
          lavender: "#f5f3ff",
          surface: "#ffffff"
        },
        ink: "#120924",
        teal: "#7c1a6e",
        mint: "#fdf2f8",
        coral: "#e11d74",
      },
      backgroundImage: {
        'brand-gradient': "linear-gradient(135deg, #2b1154 0%, #7c1a6e 50%, #e11d74 100%)",
        'insta-gradient': "linear-gradient(90deg, #3b1262 0%, #85166f 55%, #e62872 100%)",
        'soft-glow': "radial-gradient(circle at 50% 0%, rgba(225, 29, 116, 0.08) 0%, transparent 70%)",
      },
      boxShadow: {
        'brand-sm': "0 2px 10px rgba(124, 26, 110, 0.08)",
        'brand-md': "0 8px 30px rgba(124, 26, 110, 0.12)",
        'brand-glow': "0 10px 30px -5px rgba(225, 29, 116, 0.3)",
      }
    }
  },
  plugins: []
};
