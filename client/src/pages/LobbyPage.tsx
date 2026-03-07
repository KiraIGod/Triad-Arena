import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { store, useAppSelector } from "../store";
import styles from "./LobbyPage.module.css";
import socket from "../shared/socket/socket";
import { fetchUserDeck } from "../shared/api/deckBuilderApi";
import { useLobbyArena } from "../features/customHooks/useLobbyArena";

type DeckSummary = {
  name: string;
  cardsTotal: number;
  cardsMax: number;
  assault: number;
  precision: number;
  arcane: number;
};

const MOCK_MATCHES: Array<{
  date: string;
  opponent: string;
  result: "Victory" | "Defeat";
  turns: number;
  hpLeft: number;
}> = [
  { date: "02.03.25", opponent: "SHADOW_IX", result: "Victory", turns: 12, hpLeft: 45 },
  { date: "01.03.25", opponent: "NOVA_PRIME", result: "Defeat", turns: 8, hpLeft: 0 },
  { date: "28.02.25", opponent: "CRIMSON_7", result: "Victory", turns: 15, hpLeft: 22 },
  { date: "27.02.25", opponent: "ZERO_ONE", result: "Defeat", turns: 10, hpLeft: 0 },
  { date: "25.02.25", opponent: "ECHO_99", result: "Victory", turns: 11, hpLeft: 38 }
];

const RATING_MOCK = "1,847";
const RANK_MOCK = "#24";

function summarizeDeck(
  totalCards: number,
  maxCards: number,
  cards: Array<{ cardId: string; quantity: number; card: { triad_type: string } }>
): DeckSummary {
  const triadCounts = { assault: 0, precision: 0, arcane: 0 };
  for (const item of cards) {
    const t = (item.card?.triad_type || "").toLowerCase();
    if (t in triadCounts) {
      (triadCounts as Record<string, number>)[t] += item.quantity;
    }
  }
  return {
    name: totalCards === maxCards ? "Ready" : "Incomplete",
    cardsTotal: totalCards,
    cardsMax: maxCards,
    assault: triadCounts.assault,
    precision: triadCounts.precision,
    arcane: triadCounts.arcane
  };
}

function DeckPanel({ deck, onEditDeck }: { deck: DeckSummary | null; onEditDeck: () => void }) {
  const d = deck ?? { name: "-", cardsTotal: 0, cardsMax: 20, assault: 0, precision: 0, arcane: 0 };
  const triumphRate = d.cardsMax > 0 ? ((d.cardsTotal / d.cardsMax) * 100).toFixed(1) : "0.0";
  const nickname = useAppSelector(store => store.auth.nickname)
 
  return (
    <section className={styles.sidePanel}>
      <div className={styles.panelLabelRow}>
        <span className={styles.panelDiamond} />
        <span className={styles.panelLabel}>{nickname}</span>
        <span className={styles.panelLine} />
      </div>

      <div className={styles.ratingCard}>
        <p className={styles.kicker}>Resolve</p>
        <p className={styles.ratingNumber}>{RATING_MOCK}</p>
      </div>

      <div className={styles.statCard}>
        <p className={styles.kicker}>Active deck</p>
        <p className={styles.deckName}>{d.name}</p>
        <p className={styles.deckMeta}>
          {d.cardsTotal}/{d.cardsMax} cards
        </p>
      </div>

      <div className={styles.deckTriadGrid}>
        <div className={styles.triadBox}>
          <span>Assault</span>
          <strong>{d.assault}</strong>
        </div>
        <div className={styles.triadBox}>
          <span>Precision</span>
          <strong>{d.precision}</strong>
        </div>
        <div className={styles.triadBox}>
          <span>Arcane</span>
          <strong>{d.arcane}</strong>
        </div>
      </div>

      <div className={styles.statCard}>
        <p className={styles.kicker}>Triumph rate</p>
        <p className={styles.triumphValue}>{triumphRate}%</p>
      </div>

      <button type="button" className={styles.btnEdit} onClick={onEditDeck}>
        {d.cardsTotal === 0 ? "Create deck" : "Edit deck"}
      </button>
    </section>
  );
}

function MatchHistoryPanel() {
  return (
    <section className={styles.historyPanel}>
      <div className={styles.historyHeader}>
        <span className={styles.panelDiamondBlood} />
        <span className={styles.panelLabel}>Battle Chronicle</span>
        <span className={styles.panelLine} />
      </div>

      <div className={styles.matchList}>
        {MOCK_MATCHES.map((m, i) => (
          <div key={i} className={styles.matchCard}>
            <span
              className={
                m.result === "Victory" ? styles.matchIndicatorVictory : styles.matchIndicatorDefeat
              }
              aria-hidden
            />
            <div className={styles.matchMain}>
              <div className={styles.matchRow}>
                <span className={styles.matchOpponent}>{m.opponent}</span>
                <span className={m.result === "Victory" ? styles.matchResultVictory : styles.matchResultDefeat}>
                  {m.result}
                </span>
              </div>
              <div className={styles.matchRow}>
                <span className={styles.matchMeta}>{m.date}</span>
                <span className={styles.matchMeta}>Turns: {m.turns}</span>
              </div>
            </div>
            <div className={styles.damageBox}>
              <span className={styles.damageLabel}>HP Left</span>
              <strong className={styles.damageValue}>{m.hpLeft}</strong>
            </div>
          </div>
        ))}
      </div>

      <button type="button" className={styles.btnViewAll}>
        View all data
      </button>
    </section>
  );
}

export default function LobbyPage() {
  const navigate = useNavigate()
  const token = useAppSelector((s) => s.auth.token)
  const userId = useAppSelector((s) => s.auth.userId)
  const [deck, setDeck] = useState<DeckSummary | null>(null)
  const { isCreatingArena, isJoiningArena, handleCreateArena, handleJoinArena, isOnline, error } = useLobbyArena(token)

  const displayName = userId != null ? `PILOT_${userId}` : "PILOT_ZERO";

  useEffect(() => {
    if (!token) return;
    fetchUserDeck(token)
      .then((res) => setDeck(summarizeDeck(res.totalCards, res.maxCards, res.cards)))
      .catch(() => setDeck(null));
  }, [token]);



  const handleOpenDeckBuilder = () => {
    navigate("/deck-builder");
  };

  return (
    <div className={styles.page}>
      <div className={styles.bgImage} />
      <div className={`${styles.bgTexture} parchment-texture`} />
      <div className={`${styles.bgVignette} darkest-vignette`} />

      <header className={styles.header}>
        <div className={styles.brandWrap}>
          <div className={styles.brandAccent} />
          <div className={styles.brand}>
            <h1 className={styles.title}>Triad Arena</h1>
            <p className={styles.subtitle}>Sector_7 // Encampment</p>
          </div>
        </div>

        <div className={styles.headerRight}>
          <p className={styles.status}>
            Status{" "}
            <span className={isOnline ? styles.statusOnline : styles.statusOffline}>
              {isOnline ? "Online" : "Offline"}
            </span>
          </p>
          <p className={styles.userLabel}>User: {displayName}</p>
        </div>
      </header>

      <div className={styles.layout}>
        <DeckPanel deck={deck} onEditDeck={handleOpenDeckBuilder} />

        <section className={styles.centerColumn}>
          <button type="button" className={styles.btnBattle} disabled={isJoiningArena} onClick={handleJoinArena}>
            {isJoiningArena ? (
              <>
                <span className={styles.loader} />
                Searching for opponent...
              </>
            ) : (
              <>
                <span className={styles.btnArenaIcon} aria-hidden>
                  +
                </span>
                Find Arena
              </>
            )}
          </button>

          <button type="button" className={styles.btnBattle} disabled={isCreatingArena} onClick={handleCreateArena}>
            {isCreatingArena ? (
              <>
                <span className={styles.loader} />
                Creating Arena...
              </>
            ) : (
              <>
                <span className={styles.btnArenaIcon} aria-hidden>
                  +
                </span>
                Create Arena
              </>
            )}
          </button>

          {error && <p>{error}</p>}
          {/* {isSearching && <p className={styles.searchingText}>Searching for opponent...</p>} */}

          <div className={styles.ratingBlock}>
            <p className={styles.ratingLine}>
              Rating <span className={styles.ratingValue}>{RATING_MOCK}</span>
            </p>
            <p className={styles.ratingLine}>
              Rank <span className={styles.ratingValue}>{RANK_MOCK}</span>
            </p>
          </div>
        </section>

        <MatchHistoryPanel />
      </div>
    </div>
  );
}
