export function fmtDateTime(value: string | Date): string {
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

export function fmtDate(value: string): string {
  try {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return value;
  }
}

export function shortId(id: string, len = 18): string {
  return id.length > len ? `${id.slice(0, len)}…` : id;
}

export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname === '/' ? u.host : u.host + u.pathname).replace(/\/$/, '') || u.host;
  } catch {
    return url;
  }
}
