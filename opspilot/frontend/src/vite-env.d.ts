/// <reference types="vite/client" />

// Augment Vite's env typing with OpsPilot-specific variables.
interface ImportMetaEnv {
  /** Base URL of the OpsPilot backend API (defaults to http://localhost:8000). */
  readonly VITE_API_BASE_URL?: string
}
