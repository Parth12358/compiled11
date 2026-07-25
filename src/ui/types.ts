// Part C — TypeScript mirror of the fixture.json contract (parent PRD §5).
// The shape is frozen; A and B emit it, the UI consumes it.

export interface Client {
  url: string;
  repo: string;
  name: string;
}

export interface Score {
  visibility: number; // 0..1
  cited_queries: number;
  total_queries: number;
}

export interface Source {
  domain: string;
  citation_count: number;
  client_present: boolean;
}

export interface Gap {
  keyword: string;
  type: string; // "missing_page" | "thin_content" | ...
  citations: number;
  competing_domains?: string[]; // optional enrichment (contract.ts / scripts/act.ts)
}

export interface Action {
  type: string; // "meta" | "new_page" | ...
  file: string;
  before?: string; // absent for newly created files
  after: string;
}

export interface Report {
  client: Client;
  score: Score;
  sources: Source[];
  gaps: Gap[];
  actions: Action[];
  pr_url: string | null;
  indexnow_submitted_at: string | null;
}
