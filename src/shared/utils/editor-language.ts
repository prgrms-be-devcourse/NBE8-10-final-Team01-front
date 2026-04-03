const EDITOR_LANGUAGE_STORAGE_KEY = "bracket:editor-language:v1";

export function readPreferredEditorLanguage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage.getItem(EDITOR_LANGUAGE_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function writePreferredEditorLanguage(language: string) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(EDITOR_LANGUAGE_STORAGE_KEY, language);
  } catch {
    // ignore storage errors
  }
}

