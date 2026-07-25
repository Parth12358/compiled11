// File-based response cache (PRD risk mitigation: demo reads cache)
// Cache key = hash of (query + engine)

export async function getCached(key: string): Promise<unknown | null> {
  return null;
}

export async function setCache(key: string, value: unknown): Promise<void> {}
