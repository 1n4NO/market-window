export function isLikelyUrl(value: string): boolean {
  const text = value.trim();
  if (!text) {
    return false;
  }

  try {
    new URL(text);
    return true;
  } catch {
    return /^(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/.*)?$/i.test(text);
  }
}

export function toSearchDestination(value: string): string {
  const text = value.trim();
  if (!text) {
    return 'https://www.google.com/';
  }

  if (isLikelyUrl(text)) {
    if (/^[a-z][a-z0-9+.-]*:\/\//i.test(text)) {
      return text;
    }
    return `https://${text}`;
  }

  return `https://www.google.com/search?q=${encodeURIComponent(text)}`;
}
