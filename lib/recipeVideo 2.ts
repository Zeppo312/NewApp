export const extractYouTubeVideoId = (value: string): string | null => {
  const input = value.trim();
  if (!input) return null;

  try {
    const url = new URL(input);
    const host = url.hostname.replace(/^www\./, "").toLowerCase();

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0] ?? "";
      return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
    }

    if (host === "youtube.com" || host === "m.youtube.com") {
      if (url.pathname === "/watch") {
        const id = url.searchParams.get("v") ?? "";
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }

      if (url.pathname.startsWith("/embed/") || url.pathname.startsWith("/shorts/")) {
        const id = url.pathname.split("/").filter(Boolean)[1] ?? "";
        return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null;
      }
    }
  } catch {
    return null;
  }

  return null;
};

export const normalizeRecipeVideoUrl = (value?: string | null): string | null => {
  const trimmed = value?.trim();
  if (!trimmed) return null;

  const videoId = extractYouTubeVideoId(trimmed);
  if (!videoId) return null;

  return `https://www.youtube.com/watch?v=${videoId}`;
};

export const getRecipeVideoEmbedUrl = (videoId: string) => {
  const params = new URLSearchParams({
    autoplay: "0",
    controls: "0",
    disablekb: "1",
    fs: "0",
    iv_load_policy: "3",
    playsinline: "1",
    rel: "0",
    enablejsapi: "1",
  });

  return `https://www.youtube-nocookie.com/embed/${videoId}?${params.toString()}`;
};

export const getRecipeVideoThumbnailUrl = (videoId: string) =>
  `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
