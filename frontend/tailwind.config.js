/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{html,js,svelte,ts}"],
  theme: {
    extend: {
      colors: {
        primary: "#d4a373",
        "primary-dark": "#bc8a5f",
        bg: "#faf7f2",
        text: "#3d2b1f",
        muted: "#8b7355",
        border: "#e8d5c4",
      },
    },
  },
  plugins: [],
};
