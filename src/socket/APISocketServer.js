/*
 *
 * This WebSocket is used for connecting
 * to minecraft server.
 * The minecraft server can set pixels and report user logins
 * and more.
 *
 */

import WebSocket from 'ws';

import socketEvents from './socketEvents.js';
import { dehydrateOnlineCounter } from './packets/server.js';
import chatProvider from '../core/ChatProvider.js';
import { setPixelByCoords } from '../core/setPixel.js';
import logger from '../core/logger.js';
import { APISOCKET_KEY } from '../core/config.js';
import authenticateAPIClient from './authenticateAPIClient.js';


class APISocketServer {
  wss; // WebSocket.Server

  initialize() {
    logger.info('Starting API websocket server');

    const wss = new WebSocket.Server({
      perMessageDeflate: false,
      clientTracking: true,
      maxPayload: 65536,
      noServer: true,
    });
    this.wss = wss;

    wss.on('error', (e) => {
      logger.error(`APIWebSocket Server Error ${e.message}`);
    });

    wss.on('connection', async (ws) => {
      ws.isAlive = true;
      ws.subChat = false;
      ws.subPxl = false;
      ws.subOnline = false;
      ws.subReloadUser = false;
      ws.on('pong', () => {
        ws.isAlive = true;
      });

      ws.on('message', (data, isBinary) => {
        if (!isBinary) {
          const message = data.toString();
          this.onTextMessage(message, ws);
        }
      });
    });

    this.broadcastOnlineCounter = this.broadcastOnlineCounter.bind(this);
    this.broadcastPixelBuffer = this.broadcastPixelBuffer.bind(this);
    this.reloadUser = this.reloadUser.bind(this);
    this.ping = this.ping.bind(this);
    this.broadcastChatMessage = this.broadcastChatMessage.bind(this);

    socketEvents.onAsync('onlineCounter', this.broadcastOnlineCounter);
    socketEvents.onAsync('pixelUpdate', this.broadcastPixelBuffer);
    socketEvents.onAsync('chatMessage', this.broadcastChatMessage);
    socketEvents.onAsync('reloadUser', this.reloadUser);

    setInterval(this.ping, 45 * 1000);
  }

  async handleUpgrade(request, socket, head) {
    await authenticateAPIClient(request);
    const { headers } = request;
    const { ipString: ip } = request.ip;

    if (!headers.authorization
      || !APISOCKET_KEY
      || headers.authorization !== `Bearer ${APISOCKET_KEY}`) {
      logger.warn(`API ws request from ${ip} not authenticated`);
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }
    logger.warn(`API ws request from ${ip} successfully authenticated`);

    this.wss.handleUpgrade(request, socket, head, (ws) => {
      this.wss.emit('connection', ws, request);
    });
  }

  broadcastChatMessage(
    name,
    msg,
    channelId,
    id,
    country,
    sendapi,
    ws = null,
  ) {
    if (!sendapi) {
      return;
    }
    // send only messages from default and lang channels
    if (!chatProvider.publicChannelIds.includes(channelId)) {
      return;
    }

    const sendmsg = JSON.stringify([
      'msg',
      name,
      parseInt(id, 10),
      msg,
      country,
      parseInt(channelId, 10),
    ]);
    this.wss.clients.forEach((client) => {
      if (client !== ws
        && client.subChat
        && client.readyState === WebSocket.OPEN) {
        client.send(sendmsg);
      }
    });
  }

  broadcast(data, filter = null) {
    if (typeof data === 'string') {
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          if (!filter || filter(ws)) {
            ws.send(data);
          }
        }
      });
    } else {
      const frame = WebSocket.Sender.frame(data, {
        readOnly: true,
        mask: false,
        rsv1: false,
        opcode: 2,
        fin: true,
      });
      this.wss.clients.forEach((ws) => {
        if (ws.readyState === WebSocket.OPEN) {
          if (!filter || filter(ws)) {
            frame.forEach((buffer) => {
              try {
                // eslint-disable-next-line no-underscore-dangle
                ws._socket.write(buffer);
              } catch (error) {
                logger.error(`WebSocket broadcast error: ${error.message}`);
              }
            });
          }
        }
      });
    }
  }

  broadcastOnlineCounter(online) {
    const buffer = dehydrateOnlineCounter(online);
    this.broadcast(buffer, (client) => client.subOnline);
  }

  broadcastPixelBuffer(canvasId, chunkid, buffer) {
    // just canvas 0 for now
    if (canvasId !== 0 && canvasId !== '0') {
      return;
    }
    this.broadcast(buffer, (client) => client.subPxl);
  }

  reloadUser(userId) {
    this.broadcast(
      JSON.stringify(['reloadUser', userId]),
      (client) => client.subReloadUser,
    );
  }

  static getPublicChannels() {
    const chanReply = ['chans'];
    const defaultChanKeys = Object.keys(chatProvider.defaultChannels);
    const langChanKeys = Object.keys(chatProvider.langChannels);
    for (let i = 0; i < defaultChanKeys.length; i += 1) {
      const id = defaultChanKeys[i];
      const [name] = chatProvider.defaultChannels[id];
      chanReply.push([parseInt(id, 10), name]);
    }
    for (let i = 0; i < langChanKeys.length; i += 1) {
      const name = langChanKeys[i];
      const { id } = chatProvider.langChannels[name];
      chanReply.push([id, name]);
    }
    return chanReply;
  }

  async onTextMessage(message, ws) {
    try {
      const packet = JSON.parse(message);
      const command = packet[0];
      packet.shift();
      if (!command) {
        return;
      }
      if (command === 'sub') {
        const even = packet[0];
        if (even === 'chat') {
          ws.subChat = true;
          ws.send(JSON.stringify(APISocketServer.getPublicChannels()));
        } else if (even === 'pxl') {
          ws.subPxl = true;
        } else if (even === 'online') {
          ws.subOnline = true;
        } else if (even === 'reloadUser') {
          ws.subReloadUser = true;
        } else {
          logger.info(`APISocket wanted to sub to nonexistent  ${even}`);
        }
        logger.info(`APISocket client subscribed to ${even}`);
        return;
      }
      if (command === 'setpxl') {
        const [minecraftid, ip, x, y, clr] = packet;
        if (clr < 0 || clr > 32) return;
        // be aware that user null has no cd
        if (!minecraftid && !ip) {
          setPixelByCoords('0', clr, x, y);
          ws.send(JSON.stringify(['retpxl', null, null, true, 0, 0]));
        }
        // minecraftid support got removed
        return;
      }
      if (command === 'chat') {
        const [name, id, msg, country, channelId] = packet;
        const uid = id || chatProvider.apiSocketUserId;
        /*
         * do not send message back up ws that sent it
         */
        chatProvider.broadcastChatMessage(
          name,
          msg,
          channelId,
          uid,
          country,
          false,
        );
        this.broadcastChatMessage(
          name,
          msg,
          channelId,
          uid,
          country,
          true,
          ws,
        );
        return;
      }
      logger.info(`Received unknown api-ws message ${message}`);
    } catch (err) {
      logger.error(`Got undecipherable api-ws message ${message}, ${err}`);
    }
  }

  ping() {
    this.wss.clients.forEach((ws) => {
      if (!ws.isAlive) {
        return ws.terminate();
      }

      ws.isAlive = false;
      ws.ping(() => {});
      return null;
    });
  }
}

export default APISocketServer;
