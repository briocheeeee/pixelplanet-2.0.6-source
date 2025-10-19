// allow the websocket to be noisy on the console
/* eslint-disable no-console */

import {
  hydratePixelUpdate,
  hydratePixelReturn,
  hydrateOnlineCounter,
  hydrateCoolDown,
  hydrateCaptchaReturn,
  hydrateFishAppears,
  hydrateFishCatched,
  dehydrateRegCanvas,
  dehydrateRegChunk,
  dehydrateRegMChunks,
  dehydrateDeRegMChunks,
  dehydratePixelUpdate,
  dehydratePing,
  dehydrateCatchFish,
} from './packets/client.js';
import {
  PIXEL_UPDATE_OP,
  PIXEL_RETURN_OP,
  ONLINE_COUNTER_OP,
  COOLDOWN_OP,
  CHANGE_ME_OP,
  CAPTCHA_RETURN_OP,
  REFRESH_OP,
  FISH_APPEARS_OP,
  FISH_CATCHED_OP,
} from './packets/op.js';
import {
  socketOpen,
  socketClose,
  receiveOnline,
  receiveCoolDown,
  receiveChatMessage,
  receiveTyping,
  addChatChannel,
  removeChatChannel,
} from '../store/actions/socket.js';
import { pRefresh, fishAppears, catchedFish } from '../store/actions/index.js';
import { showAnnouncement } from '../store/actions/index.js';
import { fetchMe } from '../store/actions/thunks.js';

class SocketClient {
  store = null;
  pixelTransferController = null;
  ws = null;
  getRenderer;

  constructor() {
    console.log('Creating WebSocketClient');
    this.channelId = 0;
    /*
     * properties set in connect and open:
     * this.timeLastConnecting
     * this.timeLastPing
     * this.timeLastSent
     */
    this.readyState = WebSocket.CLOSED;
    this.msgQueue = [];
    this.reqQueue = [];

    this.checkHealth = this.checkHealth.bind(this);
    setInterval(this.checkHealth, 2000);
  }

  initialize(store, pixelTransferController, getRenderer) {
    this.store = store;
    if (pixelTransferController) {
      this.pixelTransferController = pixelTransferController;
    }
    if (getRenderer) {
      this.getRenderer = getRenderer;
    }
    return this.connect();
  }

  connect() {
    this.readyState = WebSocket.CONNECTING;
    if (this.ws) {
      /*
       * TODO there seems to be no return for ages now,
       * needs testing if there even should be one
       */
      console.log('WebSocket already open, not starting');
    }
    this.timeLastConnecting = Date.now();
    const url = `${
      window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    }//${
      // eslint-disable-next-line max-len
      (window.ssv?.apiUrl) ? window.ssv.apiUrl.substring(window.ssv.apiUrl.indexOf('//') + 2) : window.location.host + (window.ssv?.basename || '')
    }/ws`;
    this.ws = new WebSocket(url);
    this.ws.binaryType = 'arraybuffer';
    this.ws.onopen = this.onOpen.bind(this);
    this.ws.onmessage = this.onMessage.bind(this);
    this.ws.onclose = this.onClose.bind(this);
    this.ws.onerror = (err) => {
      console.error('Socket encountered error, closing socket', err);
    };
  }

  checkHealth() {
    if (this.readyState === WebSocket.OPEN) {
      const now = Date.now();
      if (now - 30000 > this.timeLastPing) {
        // server didn't send anything, probably dead
        console.log('Server is silent, killing websocket');
        this.readyState = WebSocket.CLOSING;
        this.ws.close();
      }
      if (now - 23000 > this.timeLastSent) {
        // make sure we send something at least all 25s
        this.send(dehydratePing());
        this.timeLastSent = now;
      }
    }
  }

  sendWhenReady(msg) {
    /*
     * if websocket is closed, store messages and send
     * them later, once connection is established again.
     * Do NOT use this method for things that wouldn't be useful after reconnect
     */
    this.timeLastSent = Date.now();
    if (this.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    } else {
      console.log('Tried sending message when websocket was closed!');
      this.msgQueue.push(msg);
    }
  }

  send(msg) {
    if (this.readyState === WebSocket.OPEN) {
      this.ws.send(msg);
    }
  }

  processMsgQueue() {
    while (this.msgQueue.length > 0) {
      this.sendWhenReady(this.msgQueue.shift());
    }
  }

  onOpen() {
    const now = Date.now();
    this.timeLastPing = now;
    this.timeLastSent = now;

    this.store.dispatch(socketOpen());
    this.readyState = WebSocket.OPEN;
    this.send(dehydrateRegCanvas(
      this.store.getState().canvas.canvasId,
    ));
    // register chunks
    const chunkids = this.getRenderer?.().recChunkIds;
    if (chunkids?.length) {
      console.log(`Register ${chunkids.length} chunks`);
      this.send(dehydrateRegMChunks(chunkids));
    }
    // flush queue
    this.processMsgQueue();
  }

  setCanvas(canvasId) {
    if (canvasId === null) {
      return;
    }
    console.log(
      `Notify websocket server that we changed canvas to ${canvasId}`,
    );
    this.send(dehydrateRegCanvas(canvasId));
  }

  registerChunk(chunkid) {
    const buffer = dehydrateRegChunk(chunkid);
    if (this.readyState === WebSocket.OPEN) {
      this.send(buffer);
    }
  }

  deRegisterChunks(chunkids) {
    const buffer = dehydrateDeRegMChunks(chunkids);
    if (this.readyState === WebSocket.OPEN) {
      this.send(buffer);
    }
  }

  /*
   * send captcha solution
   * @param solution text
   * @return promise that resolves when response arrives
   */
  sendCaptchaSolution(solution, captchaid, challengeSolution) {
    return new Promise((resolve, reject) => {
      let id;
      const queueObj = ['cs', (arg) => {
        resolve(arg);
        clearTimeout(id);
      }];
      this.reqQueue.push(queueObj);
      id = setTimeout(() => {
        const pos = this.reqQueue.indexOf(queueObj);
        if (~pos) this.reqQueue.splice(pos, 1);
        reject(new Error('Timeout'));
      }, 20000);
      const args = [solution, captchaid];
      if (challengeSolution) {
        args.push(challengeSolution);
      }
      this.sendWhenReady(
        `cs,${JSON.stringify(args)}`,
      );
    });
  }

  /*
   * Send pixel request
   * @param i, j chunk coordinates
   * @param pixel Array of [[offset, color],...]  pixels within chunk
   */
  sendPixelUpdate(i, j, pixels) {
    return new Promise((resolve, reject) => {
      let id;
      const queueObj = ['pu', (arg) => {
        resolve(arg);
        clearTimeout(id);
      }];
      this.reqQueue.push(queueObj);
      id = setTimeout(() => {
        const pos = this.reqQueue.indexOf(queueObj);
        if (~pos) this.reqQueue.splice(pos, 1);
        reject(new Error('Timeout'));
      }, 20000);
      this.sendWhenReady(dehydratePixelUpdate(i, j, pixels));
    });
  }

  /*
   * send attempt to catch fish
   */
  sendCatchFish() {
    this.sendWhenReady(dehydrateCatchFish());
  }

  sendChatMessage(message, channelId) {
    this.sendWhenReady(
      `cm,${JSON.stringify([message, channelId])}`,
    );
  }

  sendTyping(channelId, isTyping = true) {
    this.sendWhenReady(
      `ct,${JSON.stringify([channelId, isTyping])}`,
    );
  }

  onMessage({ data: message }) {
    try {
      if (typeof message === 'string') {
        this.onTextMessage(message);
      } else {
        this.onBinaryMessage(message);
      }
    } catch (err) {
      console.log(
        `An error occurred while parsing websocket message ${message}`,
        err,
      );
    }
  }

  onTextMessage(message) {
    const comma = message.indexOf(',');
    if (comma === -1) {
      return;
    }
    const key = message.slice(0, comma);
    const val = JSON.parse(message.slice(comma + 1));
    switch (key) {
      case 'cm':
        this.store.dispatch(receiveChatMessage(...val));
        break;
      case 'ct': {
        const [name, channel, user, isTyping] = val;
        this.store.dispatch(receiveTyping(name, channel, user, isTyping));
        break;
      }
      case 'an': {
        const [text, at, by] = val;
        this.store.dispatch(showAnnouncement(text, by, at));
        break;
      }
      case 'ac':
        this.store.dispatch(addChatChannel(val));
        break;
      case 'rc':
        this.store.dispatch(removeChatChannel(val));
        break;
      default:
        // nothing
    }
  }

  onBinaryMessage(buffer) {
    if (buffer.byteLength === 0) return;
    const data = new DataView(buffer);
    const opcode = data.getUint8(0);

    this.timeLastPing = Date.now();

    switch (opcode) {
      case PIXEL_UPDATE_OP:
        if (this.pixelTransferController) {
          this.pixelTransferController.receivePixelUpdate(
            hydratePixelUpdate(data),
          );
        }
        break;
      case PIXEL_RETURN_OP: {
        const pos = this.reqQueue.findIndex((q) => q[0] === 'pu');
        if (~pos) {
          this.reqQueue.splice(pos, 1)[0][1](hydratePixelReturn(data));
        }
        break;
      }
      case ONLINE_COUNTER_OP:
        this.store.dispatch(receiveOnline(hydrateOnlineCounter(data)));
        break;
      case COOLDOWN_OP:
        this.store.dispatch(receiveCoolDown(hydrateCoolDown(data)));
        break;
      case CHANGE_ME_OP:
        console.log('Websocket requested api/me reload');
        this.store.dispatch(fetchMe());
        this.reconnect();
        break;
      case CAPTCHA_RETURN_OP: {
        const pos = this.reqQueue.findIndex((q) => q[0] === 'cs');
        if (~pos) {
          this.reqQueue.splice(pos, 1)[0][1](hydrateCaptchaReturn(data));
        }
        break;
      }
      case REFRESH_OP: {
        this.store.dispatch(pRefresh());
        break;
      }
      case FISH_APPEARS_OP: {
        this.store.dispatch(fishAppears(...hydrateFishAppears(data)));
        break;
      }
      case FISH_CATCHED_OP: {
        this.store.dispatch(catchedFish(...hydrateFishCatched(data)));
        break;
      }
      default:
        console.error(`Unknown op_code ${opcode} received`);
        break;
    }
  }

  onClose(e) {
    this.store.dispatch(socketClose());
    this.ws = null;
    this.readyState = WebSocket.CONNECTING;
    // reconnect in 1s if last connect was longer than 7s ago, else 5s
    const timeout = this.timeLastConnecting < Date.now() - 7000 ? 1000 : 5000;
    console.warn(
      `Socket is closed. Reconnect will be attempted in ${timeout} ms.`,
      e.reason,
    );
    setTimeout(() => this.connect(), timeout);
  }

  reconnect() {
    if (this.readyState === WebSocket.OPEN) {
      this.readyState = WebSocket.CLOSING;
      console.log('Restarting WebSocket');
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.close();
      this.ws = null;
      this.connect();
    }
  }
}

export default new SocketClient();
