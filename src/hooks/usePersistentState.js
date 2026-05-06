import { useEffect, useRef, useState } from "react";

function isQuotaExceeded(error) {
  if (!error) {
    return false;
  }

  return (
    error.name === "QuotaExceededError" ||
    error.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
    error.code === 22 ||
    error.code === 1014
  );
}

function stripDesignBackground(design) {
  if (!design || typeof design !== "object") {
    return design;
  }

  const backgroundImage = design.backgroundImage;
  if (!backgroundImage || !backgroundImage.dataUrl) {
    return design;
  }

  return {
    ...design,
    backgroundImage: {
      ...backgroundImage,
      dataUrl: "",
      fileName: "",
    },
  };
}

function createStorageSafeSnapshot(state) {
  if (!state || typeof state !== "object") {
    return state;
  }

  const snapshot = {
    ...state,
    templates: Array.isArray(state.templates)
      ? state.templates.map((template) => ({
          ...template,
          design: stripDesignBackground(template.design),
        }))
      : state.templates,
    letters: Array.isArray(state.letters)
      ? state.letters.map((letter) =>
          letter.templateSnapshot
            ? {
                ...letter,
                templateSnapshot: {
                  ...letter.templateSnapshot,
                  design: stripDesignBackground(letter.templateSnapshot.design),
                },
              }
            : letter,
        )
      : state.letters,
  };

  return snapshot;
}

export function usePersistentState(key, createInitialValue, normalizeValue) {
  const [state, setState] = useState(() => {
    const fallback = createInitialValue();

    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return fallback;
      }

      const parsed = JSON.parse(raw);
      return normalizeValue ? normalizeValue(parsed) : parsed;
    } catch (error) {
      console.warn(`Unable to restore ${key} from localStorage.`, error);
      return fallback;
    }
  });

  const compactModeRef = useRef(false);
  const hasWarnedRef = useRef(false);

  useEffect(() => {
    const valueToPersist = compactModeRef.current ? createStorageSafeSnapshot(state) : state;

    try {
      window.localStorage.setItem(key, JSON.stringify(valueToPersist));
    } catch (error) {
      if (isQuotaExceeded(error)) {
        compactModeRef.current = true;

        try {
          window.localStorage.setItem(key, JSON.stringify(createStorageSafeSnapshot(state)));
          if (!hasWarnedRef.current) {
            console.warn(
              `localStorage quota exceeded for ${key}. Background images are skipped in saved data to keep the app running.`,
            );
            hasWarnedRef.current = true;
          }
        } catch (compactError) {
          if (!hasWarnedRef.current) {
            console.warn(
              `localStorage quota exceeded for ${key}. Changes remain in-memory for this tab; reduce template image size before reload.`,
              compactError,
            );
            hasWarnedRef.current = true;
          }
        }

        return;
      }

      console.warn(`Unable to persist ${key} in localStorage.`, error);
    }
  }, [key, state]);

  return [state, setState];
}
