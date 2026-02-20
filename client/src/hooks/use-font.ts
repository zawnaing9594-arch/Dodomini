import { useState, useEffect, useCallback } from "react";

const FONT_FAMILIES = [
  { label: "Default", value: "'Inter', 'Noto Sans Myanmar', sans-serif" },
  { label: "Noto Sans Myanmar", value: "'Noto Sans Myanmar', sans-serif" },
  { label: "Padauk", value: "'Padauk', 'Noto Sans Myanmar', sans-serif" },
  { label: "Pyidaungsu", value: "'Pyidaungsu', 'Noto Sans Myanmar', sans-serif" },
  { label: "System UI", value: "system-ui, -apple-system, 'Segoe UI', sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, 'Times New Roman', serif" },
  { label: "Roboto", value: "'Roboto', sans-serif" },
  { label: "Poppins", value: "'Poppins', sans-serif" },
];

export function useFontFamily() {
  const [fontIndex, setFontIndex] = useState(() => {
    try {
      const saved = typeof window !== "undefined" ? localStorage.getItem("fontFamily") : null;
      return saved ? Math.min(parseInt(saved), FONT_FAMILIES.length - 1) : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    const font = FONT_FAMILIES[fontIndex];
    if (font) {
      document.documentElement.style.fontFamily = font.value;
      if (font.label === "Padauk" || font.label === "Roboto" || font.label === "Poppins") {
        const linkId = `google-font-${font.label.toLowerCase()}`;
        if (!document.getElementById(linkId)) {
          const link = document.createElement("link");
          link.id = linkId;
          link.rel = "stylesheet";
          link.href = `https://fonts.googleapis.com/css2?family=${font.label}:wght@300;400;500;600;700&display=swap`;
          document.head.appendChild(link);
        }
      }
    }
  }, [fontIndex]);

  const setFont = useCallback((index: number) => {
    const clamped = Math.max(0, Math.min(FONT_FAMILIES.length - 1, index));
    setFontIndex(clamped);
    localStorage.setItem("fontFamily", String(clamped));
  }, []);

  return {
    fontIndex,
    fontLabel: FONT_FAMILIES[fontIndex]?.label || "Default",
    fonts: FONT_FAMILIES,
    setFont,
  };
}
