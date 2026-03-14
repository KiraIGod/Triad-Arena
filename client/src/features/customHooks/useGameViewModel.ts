import { useMemo } from "react";
import type { CardModel } from "../../components/Card";
import type { PlayedBoardCard } from "./useMatchBoard";
import type { MatchStatePayload, UnitInstance } from "../../shared/socket/matchSocket";

type ViewStatus = { type: string; turns?: number; amount?: number };

type ViewPlayerState = {
  hp: number;
  shield: number;
  energy: number;
  statuses: ViewStatus[];
  board: UnitInstance[];
  hand?: MatchStatePayload["state"]["players"]["player1"]["hand"];
  deckCount?: number;
  discardCount?: number;
};

type UseGameViewModelParams = {
  match: MatchStatePayload | null;
  userIdStr: string | null;
  finishReason: string | null;
  winnerId: string | null;
  spellNotice: string | null;
  spellNoticeFading: boolean;
  battlefieldHint: string | null;
  battlefieldHintFading: boolean;
  handHint: string | null;
  handHintFading: boolean;
  playedCards: PlayedBoardCard[];
  cardCatalog: Record<string, CardModel>;
  isSameUser: (value: string | number | null | undefined) => boolean;
};

type TriadComboInfo = { type: string; count: number; bonus: number } | null;

const DEFAULT_PLAYER_STATE: ViewPlayerState = {
  hp: 0,
  shield: 0,
  energy: 0,
  statuses: [],
  board: [],
};

export function useGameViewModel({
  match,
  userIdStr,
  finishReason,
  winnerId,
  spellNotice,
  spellNoticeFading,
  battlefieldHint,
  battlefieldHintFading,
  handHint,
  handHintFading,
  playedCards,
  cardCatalog,
  isSameUser,
}: UseGameViewModelParams) {
  const baseState = useMemo(() => {
    const defaultResult = {
      playerHPPercent: 100,
      opponentHPPercent: 100,
      currentEnergy: 0,
      isMyTurn: false,
      selfIndex: -1,
      selfKey: "player1" as "player1" | "player2",
      oppKey: "player2" as "player1" | "player2",
      selfStats: DEFAULT_PLAYER_STATE,
      oppStats: DEFAULT_PLAYER_STATE,
    };

    if (!match || !userIdStr) return defaultResult;

    const idxFromState = (() => {
      const p1Id = match.state.players.player1?.id;
      const p2Id = match.state.players.player2?.id;
      if (isSameUser(p1Id)) return 0;
      if (isSameUser(p2Id)) return 1;
      return -1;
    })();

    const idx = idxFromState >= 0 ? idxFromState : match.players.findIndex((id) => isSameUser(id));
    if (idx < 0) return defaultResult;

    const selfKey = idx === 0 ? "player1" : "player2";
    const oppKey = selfKey === "player1" ? "player2" : "player1";
    const self = match.state.players[selfKey];
    const opp = match.state.players[oppKey];
    const clampPercent = (value: number | null) =>
      value == null ? 0 : Math.max(0, Math.min(100, (value / 30) * 100));

    return {
      playerHPPercent: clampPercent(self.hp),
      opponentHPPercent: clampPercent(opp.hp),
      currentEnergy: self.energy ?? 0,
      isMyTurn: isSameUser(match.state.activePlayer) && !match.state.finished,
      selfIndex: idx,
      selfKey,
      oppKey,
      selfStats: { ...self, statuses: self.statuses ?? [], board: self.board ?? [] },
      oppStats: { ...opp, statuses: opp.statuses ?? [], board: opp.board ?? [] },
    };
  }, [isSameUser, match, userIdStr]);

  const handCards = useMemo<CardModel[]>(() => {
    if (!match || !userIdStr || baseState.selfIndex < 0) return [];
    const playerHand = match.state.players[baseState.selfKey].hand || [];
    return playerHand.map<CardModel>((card, index) => ({
      id: `${card.id}:${index}`,
      name: card.name,
      image: card.image || "crimson_duelist.png",
      type: String(card.type).toUpperCase() as CardModel["type"],
      triad_type: String(card.triad_type).toUpperCase() as CardModel["triad_type"],
      mana_cost: card.mana_cost,
      attack: card.attack,
      hp: card.hp,
      description: card.description,
      created_at: card.created_at,
    }));
  }, [baseState.selfIndex, baseState.selfKey, match, userIdStr]);

  const selfDeckCount = useMemo(() => {
    if (!match || baseState.selfIndex < 0) return 0;
    return match.state.players[baseState.selfKey].deckCount ?? 0;
  }, [baseState.selfIndex, baseState.selfKey, match]);

  const selfDiscardCount = useMemo(() => {
    if (!match || baseState.selfIndex < 0) return 0;
    return match.state.players[baseState.selfKey].discardCount ?? 0;
  }, [baseState.selfIndex, baseState.selfKey, match]);

  const matchResultLabel = useMemo(() => {
    if (finishReason === "opponent_left") return "Opponent cowardly left the arena";
    if (!winnerId || !userIdStr) return null;
    return isSameUser(winnerId) ? "Victory" : "Defeat";
  }, [finishReason, isSameUser, userIdStr, winnerId]);

  const isMatchFinished = Boolean(match?.state.finished || finishReason || winnerId);
  const boardNotice = spellNotice ?? battlefieldHint ?? handHint;
  const isBoardNoticeFading = spellNotice
    ? spellNoticeFading
    : battlefieldHint
      ? battlefieldHintFading
      : handHint
        ? handHintFading
        : false;
  const boardNoticeTone = spellNotice ? "default" as const : "warning" as const;

  const playedCardIdsThisTurn = useMemo(() => {
    if (!match || !userIdStr) return new Set<string>();
    const ids = match.state.turnActions
      .filter((action) => isSameUser(action.playerId) && action.cardId != null)
      .map((action) => action.cardId as string);
    return new Set(ids);
  }, [isSameUser, match, userIdStr]);

  const triadComboInfo = useMemo<TriadComboInfo>(() => {
    if (!match || !userIdStr) return null;

    const myCardActions = match.state.turnActions
      .filter((action) =>
        action.cardId != null &&
        action.triadType != null &&
        action.playerId != null &&
        isSameUser(action.playerId)
      )
      .sort((left, right) => (left.actionIndex ?? 0) - (right.actionIndex ?? 0));

    if (myCardActions.length === 0) return null;

    const latestCardAction = myCardActions[myCardActions.length - 1];
    const latestCardId = String(latestCardAction.cardId ?? "");
    const latestCard =
      cardCatalog[latestCardId] ||
      [...playedCards]
        .reverse()
        .find((entry) => isSameUser(entry.playerId) && entry.card.id === latestCardId)?.card;

    if (!latestCard || latestCard.type !== "SPELL") return null;

    const triadType = String(latestCardAction.triadType || "").toLowerCase();
    const comboCount = myCardActions.filter(
      (action) =>
        (action.actionIndex ?? 0) <= (latestCardAction.actionIndex ?? 0) &&
        String(action.triadType || "").toLowerCase() === triadType
    ).length;

    if (comboCount < 2) return null;
    return { type: triadType, count: comboCount, bonus: comboCount >= 3 ? 4 : 2 };
  }, [cardCatalog, isSameUser, match, playedCards, userIdStr]);

  return {
    ...baseState,
    handCards,
    selfDeckCount,
    selfDiscardCount,
    matchResultLabel,
    isMatchFinished,
    boardNotice,
    isBoardNoticeFading,
    boardNoticeTone,
    playedCardIdsThisTurn,
    triadComboInfo,
  };
}
