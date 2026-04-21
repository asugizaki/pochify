const BASE_URL = "https://go.pochify.com";
const SOURCE_PAGES_URL = `${BASE_URL}/api/source-pages`;

export async function loadSourcePages() {
  const res = await fetch(SOURCE_PAGES_URL);
  const contentType = res.headers.get("content-type") || "";
  const raw = await res.text();

  if (!contentType.includes("application/json")) {
    throw new Error(`source-pages returned non-JSON (${res.status}): ${raw.slice(0, 500)}`);
  }

  const data = JSON.parse(raw);
  if (!res.ok) {
    throw new Error(`Failed to load source pages: ${res.status}`);
  }

  return data.items || [];
}
