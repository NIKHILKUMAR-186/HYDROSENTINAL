import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initializePerformanceOptimizations } from "./lib/mobileOptimization";

// Initialize mobile performance optimizations before rendering
try {
	initializePerformanceOptimizations();
} catch (error) {
	console.warn("[bootstrap] Performance optimization init failed:", error);
}

createRoot(document.getElementById("root")!).render(<App />);
