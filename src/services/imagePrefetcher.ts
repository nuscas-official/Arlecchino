/**
 * Image Prefetcher for Arlecchino Quiz Engine
 * Warm the browser cache before starting the timed quiz window,
 * and maintain a rolling window lookahead for upcoming image-bearing questions.
 */

const prefetchedUrls = new Set<string>();

export function prefetchImage(url: string): Promise<void> {
  if (!url || prefetchedUrls.has(url)) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      prefetchedUrls.add(url);
      resolve();
    };
    img.onerror = () => {
      // Resolve regardless to prevent blocking prefetch pipeline
      resolve();
    };
    img.src = url;
  });
}

/**
 * Prefetch a batch of image URLs in parallel.
 */
export async function prefetchBatch(urls: (string | null | undefined)[]): Promise<void> {
  const validUrls = urls.filter((u): u is string => typeof u === 'string' && u.length > 0);
  await Promise.all(validUrls.map(prefetchImage));
}

/**
 * Rolling prefetch for upcoming questions starting from currentIndex.
 * Looks ahead for the next `windowSize` image-bearing questions.
 */
export function prefetchUpcomingQuestions(
  questions: Array<{ imageUrl?: string | null }>,
  currentIndex: number,
  windowSize = 4
) {
  const upcomingImages: string[] = [];
  let found = 0;

  for (let i = currentIndex + 1; i < questions.length && found < windowSize; i++) {
    const imgUrl = questions[i].imageUrl;
    if (imgUrl) {
      upcomingImages.push(imgUrl);
      found++;
    }
  }

  prefetchBatch(upcomingImages).catch((err) => {
    console.warn('[Prefetcher] Non-critical error during rolling prefetch:', err);
  });
}
