import Palette from '../../core/Palette.js';
import {
  getIdFromObject,
  getHistoricalCanvasSize,
  getMaxTiledZoom,
  getToday,
  dateToString,
} from '../../core/utils.js';
import {
  DEFAULT_SCALE,
  DEFAULT_CANVAS_ID,
  PENCIL_MODE,
} from '../../core/constants.js';
import { BRUSH_SHAPES, normalizeMatrix } from '../../core/brush.js';

function readCookie(name) {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
    return m ? decodeURIComponent(m[1]) : null;
  } catch (e) {
    return null;
  }
}

/*
 * checks if toggling historical view is neccessary
 * in given state or if properties have to change.
 * Changes the state inplace.
 * @param state
 * @return same state with fixed historical view
 */
function fixHistoryIfNeccessary(state) {
  const { canvasEndDate, is3D } = state;
  let { isHistoricalView, historicalDate } = state;

  if (is3D) {
    isHistoricalView = false;
  } else if (canvasEndDate) {
    isHistoricalView = true;
  }
  state.isHistoricalView = isHistoricalView;
  if (isHistoricalView) {
    if (!historicalDate) {
      historicalDate = dateToString(getToday());
    }
    if (canvasEndDate && Number(historicalDate) > Number(canvasEndDate)) {
      historicalDate = dateToString(canvasEndDate);
    }
    state.historicalDate = historicalDate;
    if (!state.historicalTime) {
      state.historicalTime = '0000';
    }
    const {
      canvasId,
      canvasSize,
      canvases,
    } = state;
    state.historicalCanvasSize = getHistoricalCanvasSize(
      historicalDate,
      canvasSize,
      canvases[canvasId]?.historicalSizes,
    );
  }
  return state;
}

/*
 * parse canvas data
 * @param canvas object from api/me
 * @param prevCoords from state
 * @return partial canvas specific state
 */
function getCanvasArgs(canvas, prevCoords) {
  const clrIgnore = canvas.cli || 0;
  const {
    size: canvasSize,
    sd: canvasStartDate = null,
    ed: canvasEndDate = null,
    ident: canvasIdent,
    colors,
  } = canvas;
  const is3D = !!canvas.v;
  const palette = new Palette(colors, 0);
  return {
    clrIgnore,
    canvasSize,
    canvasStartDate,
    canvasEndDate,
    canvasIdent,
    is3D,
    palette,
    view: prevCoords?.view || [0, 0, DEFAULT_SCALE],
    selectedColor: prevCoords?.selectedColor || clrIgnore,
    pencilMode: prevCoords?.pencilMode || PENCIL_MODE.COLOR,
  };
}

/**
 * parse url hash and sets view to coordinates
 * @param canvases Object with all canvas information
 * @return incomplete state based on URL, null if failed
 */
function getViewFromURL(canvases, defaultCanvas) {
  const { hash } = window.location;
  const almost = decodeURIComponent(hash).substring(1)
    .split(',');

  let canvasIdent = almost[0];
  let canvasId = getIdFromObject(canvases, canvasIdent);
  if (!canvasId && defaultCanvas) {
    canvasId = defaultCanvas;
  }
  if (!canvasId || (!window.ssv?.backupurl && canvases[canvasId].ed)) {
    canvasId = DEFAULT_CANVAS_ID;
    const canvas = canvases[DEFAULT_CANVAS_ID];
    if (!canvas) {
      return null;
    }
    canvasIdent = canvas.ident;
  }
  const is3D = !!canvases[canvasId].v;

  const x = parseInt(almost[1], 10) || 0;
  const y = parseInt(almost[2], 10) || 0;
  let z = parseInt(almost[3], 10);
  /*
    * third number in 3D is z coordinate
    * in 2D it is logarithmic scale
    */
  if (Number.isNaN(z)) {
    z = (is3D) ? 0 : DEFAULT_SCALE;
  } else if (!is3D) {
    z = 2 ** (z / 10);
  }

  return {
    canvasId,
    canvasIdent,
    view: [x, y, z],
  };
}

const initialState = {
  // canvasId will be a string or null, it can not be a number,
  // because of Object.keys in canvases
  canvasId: null,
  canvasIdent: 'xx',
  canvases: {},
  canvasSize: 65536,
  historicalCanvasSize: 65536,
  is3D: null,
  canvasStartDate: null,
  defaultCanvas: DEFAULT_CANVAS_ID,
  canvasEndDate: null,
  canvasMaxTiledZoom: getMaxTiledZoom(65536),
  palette: new Palette([[0, 0, 0]]),
  clrIgnore: 0,
  selectedColor: 0,
  // from where the pencil takes its color from
  pencilMode: PENCIL_MODE.COLOR,
  // view is not up-to-date, changes are delayed compared to renderer.view
  view: [0, 0, DEFAULT_SCALE],
  isHistoricalView: false,
  historicalDate: dateToString(getToday()),
  historicalTime: '0000',
  hover: null,
  // brush settings
  brushShape: (readCookie('brushShape') || BRUSH_SHAPES.classic),
  brushSize: Math.max(1, Math.min(5, Number(readCookie('brushSize') || 1))),
  brushMatrix: normalizeMatrix((() => { try { return JSON.parse(readCookie('brushCustom') || '[]'); } catch (e) { return []; } })() || [
    [false, false, false, false, false],
    [false, false, false, false, false],
    [false, false, true,  false, false],
    [false, false, false, false, false],
    [false, false, false, false, false],
  ]),
  // last canvas view and selectedColor
  // just used to get back to the previous state when switching canvases
  // { [canvasId]: { view: [x, y, z], selectedColor: c }, ... }
  prevCanvasState: {},
};

export default function canvasReducer(
  state = initialState,
  action,
) {
  switch (action.type) {
    case 'SET_HISTORICAL_TIME': {
      const {
        date,
        time,
      } = action;
      return fixHistoryIfNeccessary({
        ...state,
        historicalDate: date,
        historicalTime: time,
      });
    }

    case 's/TGL_HISTORICAL_VIEW': {
      if (state.is3D || state.canvasEndDate) {
        return state;
      }
      return fixHistoryIfNeccessary({
        ...state,
        isHistoricalView: !state.isHistoricalView,
      });
    }

    case 'UPDATE_VIEW': {
      const { view } = action;
      const { canvasId } = state;
      return {
        ...state,
        view: [...view],
        prevCanvasState: {
          ...state.prevCanvasState,
          [canvasId]: {
            ...state.prevCanvasState[canvasId],
            view: [...view],
          },
        },
      };
    }

    case 'RELOAD_URL': {
      const { canvases } = state;
      const urlState = getViewFromURL(canvases);
      if (!urlState) {
        return state;
      }
      if (urlState.canvasId !== state.canvasId) {
        const { canvasId } = urlState;
        const canvas = canvases[canvasId];
        const canvasState = getCanvasArgs(
          canvas,
          state.prevCanvasState[canvasId],
        );
        return {
          ...state,
          ...canvasState,
          ...urlState,
        };
      }
      return {
        ...state,
        ...urlState,
      };
    }

    case 'SELECT_COLOR': {
      const { color: selectedColor } = action;
      const { canvasId } = state;
      return {
        ...state,
        selectedColor,
        prevCanvasState: {
          ...state.prevCanvasState,
          [canvasId]: {
            ...state.prevCanvasState[canvasId],
            selectedColor,
          },
        },
      };
    }

    case 'SET_HOVER': {
      const { hover } = action;
      return {
        ...state,
        hover,
      };
    }

    case 'UNSET_HOVER': {
      return {
        ...state,
        hover: null,
      };
    }

    case 's/SELECT_PENCIL_MODE': {
      const pencilMode = action.value;
      const { canvasId } = state;
      return {
        ...state,
        pencilMode,
        prevCanvasState: {
          ...state.prevCanvasState,
          [canvasId]: {
            ...state.prevCanvasState[canvasId],
            pencilMode,
          },
        },
      };
    }

    case 's/SET_BRUSH_SHAPE': {
      const { shape } = action;
      return {
        ...state,
        brushShape: shape,
      };
    }

    case 's/SET_BRUSH_SIZE': {
      let { size } = action;
      size = Math.max(1, Math.min(5, Math.floor(size || 1)));
      return {
        ...state,
        brushSize: size,
      };
    }

    case 's/SET_BRUSH_MATRIX': {
      const { matrix } = action;
      return {
        ...state,
        brushMatrix: normalizeMatrix(matrix),
      };
    }

    case 's/TGL_BRUSH_CELL': {
      let { x, y } = action;
      x = Math.max(0, Math.min(4, x|0));
      y = Math.max(0, Math.min(4, y|0));
      const matrix = state.brushMatrix.map((row, yy) => (
        row.map((val, xx) => (
          (xx === x && yy === y) ? !val : val
        ))
      ));
      return {
        ...state,
        brushMatrix: matrix,
      };
    }

    case 's/SELECT_CANVAS': {
      let { canvasId } = action;
      const {
        canvases,
        prevCanvasState,
        canvasId: prevCanvasId,
      } = state;
      let canvas = canvases[canvasId];
      if (!canvas) {
        canvasId = DEFAULT_CANVAS_ID;
        canvas = canvases[DEFAULT_CANVAS_ID];
      }
      const canvasState = getCanvasArgs(canvas, prevCanvasState[canvasId]);

      return fixHistoryIfNeccessary({
        ...state,
        ...canvasState,
        canvasId,
        // reset if last canvas was retired
        isHistoricalView: (!state.canvasEndDate && state.isHistoricalView),
        // remember canvas specific settings
        prevCanvasState: {
          ...state.prevCanvasState,
          [prevCanvasId]: {
            view: state.view,
            selectedColor: state.selectedColor,
            pencilMode: state.pencilMode,
          },
        },
      });
    }

    case 's/REC_ME': {
      const { canvases, defaultCanvas } = action;
      let {
        canvasId,
        view,
      } = state;

      if (canvasId === null) {
        ({ canvasId, view } = getViewFromURL(canvases, defaultCanvas));
      }
      const canvas = canvases[canvasId];
      const canvasState = getCanvasArgs(
        canvas,
        state.prevCanvasState[canvasId],
      );

      return fixHistoryIfNeccessary({
        ...state,
        ...canvasState,
        canvasId,
        canvases,
        defaultCanvas,
        view,
      });
    }

    default:
      return state;
  }
}
