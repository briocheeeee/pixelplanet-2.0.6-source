const initialState = {
  open: false,
  text: null,
  by: null,
  at: null,
};

export default function announcement(
  state = initialState,
  action,
) {
  switch (action.type) {
    case 'SHOW_ANNOUNCEMENT': {
      const { text, by, at } = action;
      return {
        open: true,
        text,
        by: by || null,
        at: at || Date.now(),
      };
    }
    case 'HIDE_ANNOUNCEMENT':
      return initialState;
    case 'persist/REHYDRATE':
      return initialState;
    default:
      return state;
  }
}
