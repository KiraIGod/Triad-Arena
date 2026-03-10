import api from "./axios";

function withAuth(token: string) {
  return { headers: { Authorization: `Bearer ${token}` } };
}

export type MatchHistoryEntry = {
  matchId: string;
  opponent: string;
  result: "Victory" | "Defeat" | "Draw";
  turns: number;
  hpLeft: number;
  date: string | null;
};

export type PlayerStats = {
  rating: number;
  wins: number;
  losses: number;
  games_played: number;
  rank: number | null;
};

export async function fetchMatchHistory(token: string): Promise<MatchHistoryEntry[]> {
  const { data } = await api.get<{ matches: MatchHistoryEntry[] }>(
    "/matches/history",
    withAuth(token)
  );
  return data.matches;
}

export async function fetchPlayerStats(token: string): Promise<PlayerStats> {
  const { data } = await api.get<PlayerStats>("/players/me/stats", withAuth(token));
  return data;
}
