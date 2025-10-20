const initialState = {
  leaderboard: { page: 1, size: 20, total: 0, data: [] },
  mine: null,
  invites: null,
};

export default function factions(state = initialState, action) {
  switch (action.type) {
    case 'REC_FACTION_LEADERBOARD':
      return { ...state, leaderboard: action.payload };
    case 'REC_FACTION_MINE':
      return { ...state, mine: action.payload };
    case 'REC_FACTION_INVITES':
      return { ...state, invites: action.payload };
    default:
      return state;
  }
}
