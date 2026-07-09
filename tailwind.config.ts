import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        paper: "#FBF9F4",       // notebook page background
        ink: "#1F2A44",         // primary text — deep navy ink
        "ink-soft": "#4A5468",  // secondary text
        marigold: "#F2B705",    // primary interactive accent
        "marigold-dark": "#C98F00",
        leaf: "#2F6B4F",        // subject accent (science) / success states
        "leaf-soft": "#E4F0E9",
        rule: "#D9D3C4",        // hairline "notebook rule" lines
        clay: "#B24C3C",        // alerts / disciplinary notes
      },
      fontFamily: {
        display: ["Baloo 2", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
      backgroundImage: {
        "notebook-lines":
          "repeating-linear-gradient(to bottom, transparent, transparent 39px, #D9D3C4 40px)",
      },
    },
  },
  plugins: [],
};

export default config;
