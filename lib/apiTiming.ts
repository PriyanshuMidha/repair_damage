export function startApiTimer(label: string) {
  const startedAt = performance.now();
  return {
    logSuccess(detail = "") {
      const suffix = detail ? ` ${detail}` : "";
      console.info(`[repair-app] ${label}${suffix} in ${Math.round(performance.now() - startedAt)}ms.`);
    },
    logError(error: unknown) {
      console.error(`[repair-app] ${label} failed after ${Math.round(performance.now() - startedAt)}ms.`, error);
    },
  };
}
