/**
 *
 */

import React, {
  useRef, useLayoutEffect, useState, useEffect, useCallback, useContext,
} from 'react';
import useStayScrolled from 'react-stay-scrolled';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import WindowContext from '../context/window.js';
import useLink from '../hooks/link.js';
import ContextMenu from '../contextmenus/index.jsx';
import ChatMessage from '../ChatMessage.jsx';
import ChannelDropDown from '../contextmenus/ChannelDropDown.jsx';

import {
  markChannelAsRead,
  sendChatMessage,
  sendChatTyping,
} from '../../store/actions/index.js';
import {
  fetchChatMessages,
} from '../../store/actions/thunks.js';


const Chat = () => {
  const listRef = useRef();
  const targetRef = useRef();
  const inputRef = useRef();
  const lastTypingRef = useRef(0);
  const typingStopTimerRef = useRef(null);

  const [blockedIds, setBlockedIds] = useState([]);
  const [btnSize, setBtnSize] = useState(20);
  const [cmArgs, setCmArgs] = useState({});

  const dispatch = useDispatch();

  const ownName = useSelector((state) => state.user.name);
  const ownId = useSelector((state) => state.user.id);
  const fetching = useSelector((state) => state.fetching.fetchingChat);
  const { channels, messages, blocked } = useSelector((state) => state.chat);
  const typingMap = useSelector((state) => state.chatRead.typing);

  const {
    args,
    setArgs,
    setTitle,
  } = useContext(WindowContext);

  const {
    chatChannel = 1,
  } = args;

  const link = useLink();

  const setChannel = useCallback((cid) => {
    dispatch(markChannelAsRead(cid));
    setArgs({
      chatChannel: Number(cid),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const addToInput = useCallback((msg) => {
    const inputElem = inputRef.current;
    if (!inputElem) {
      return;
    }
    let newInputMessage = inputElem.value;
    if (newInputMessage.slice(-1) !== ' ') {
      newInputMessage += ' ';
    }
    newInputMessage += `${msg} `;
    inputElem.value = newInputMessage;
    inputRef.current.focus();
  }, []);

  const closeCm = useCallback(() => {
    setCmArgs({});
  }, []);

  const openUserCm = useCallback((x, y, name, uid) => {
    setCmArgs({
      type: 'USER',
      x,
      y,
      args: {
        name,
        uid,
        setChannel,
        addToInput,
      },
    });
  }, [setChannel, addToInput]);

  const { stayScrolled } = useStayScrolled(listRef, {
    initialScroll: Infinity,
    inaccuracy: 10,
  });

  const channelMessages = messages[chatChannel] || [];
  useEffect(() => {
    if (channels[chatChannel] && !messages[chatChannel] && !fetching) {
      dispatch(fetchChatMessages(chatChannel));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, messages, chatChannel, fetching]);

  useEffect(() => {
    if (channels[chatChannel]) {
      const channelName = channels[chatChannel][0];
      setTitle(`Chan: ${channelName}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatChannel, channels]);

  useLayoutEffect(() => {
    stayScrolled();
  }, [channelMessages.length, stayScrolled]);

  const recentTypingNames = (() => {
    const now = Date.now();
    const chanTyping = typingMap[chatChannel] || {};
    const names = Object.entries(chanTyping)
      .filter(([uid, obj]) => obj && obj.ts && (now - obj.ts) < 2000 && Number(uid) !== ownId)
      .map(([, obj]) => obj.name)
      .filter((n, i, arr) => n && arr.indexOf(n) === i);
    return names.slice(0, 3);
  })();

  useEffect(() => {
    setTimeout(() => {
      const fontSize = Math.round(targetRef.current.offsetHeight / 10);
      setBtnSize(Math.min(28, fontSize));
    }, 330);
  }, [targetRef]);

  useEffect(() => {
    const bl = [];
    for (let i = 0; i < blocked.length; i += 1) {
      bl.push(blocked[i][0]);
    }
    setBlockedIds(bl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked.length]);

  function handleSubmit(evt) {
    evt.preventDefault();
    const inptMsg = inputRef.current.value.trim();
    if (!inptMsg) return;
    // send message via websocket
    dispatch(sendChatMessage(inptMsg, chatChannel));
    inputRef.current.value = '';
    if (typingStopTimerRef.current) {
      clearTimeout(typingStopTimerRef.current);
      typingStopTimerRef.current = null;
    }
    dispatch(sendChatTyping(chatChannel, false));
  }

  /*
   * if selected channel isn't in channel list anymore
   * for whatever reason (left faction etc.)
   * set channel to first available one
   */
  useEffect(() => {
    if (!chatChannel || !channels[chatChannel]) {
      const cids = Object.keys(channels);
      if (cids.length) {
        setChannel(cids[0]);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, chatChannel]);

  return (
    <div
      ref={targetRef}
      className="chat-container"
    >
      <ContextMenu
        type={cmArgs.type}
        x={cmArgs.x}
        y={cmArgs.y}
        args={cmArgs.args}
        close={closeCm}
        align={cmArgs.align}
      />
      <ul
        className="chatarea"
        ref={listRef}
        style={{ flexGrow: 1 }}
        role="presentation"
      >
        {
          (!channelMessages.length)
          && (
          <ChatMessage
            uid={0}
            name="info"
            avatar={null}
            msg={t`Start chatting here`}
          />
          )
        }
        {
          channelMessages.map((message) => ((blockedIds.includes(message[3]))
            ? null : (
              <ChatMessage
                name={message[0]}
                msg={message[1]}
                avatar={message[2]}
                uid={message[3]}
                ts={message[4]}
                key={message[5]}
                openCm={openUserCm}
              />
            )))
        }
      </ul>
      {(recentTypingNames.length > 0) && (
        <div
          className="chat-typing"
          style={{
            padding: '6px 10px',
            fontSize: 12,
            opacity: 0.8,
          }}
        >
          {recentTypingNames.length === 1 && (
            <span>{`${recentTypingNames[0]} is typing...`}</span>
          )}
          {recentTypingNames.length === 2 && (
            <span>{`${recentTypingNames[0]}, ${recentTypingNames[1]} are typing...`}</span>
          )}
          {recentTypingNames.length === 3 && (
            <span>{`${recentTypingNames[0]}, ${recentTypingNames[1]} and ${recentTypingNames[2]} are typing...`}</span>
          )}
        </div>
      )}
      <form
        className="chatinput"
        onSubmit={(e) => handleSubmit(e)}
        style={{
          display: 'flex',
        }}
      >
        {(ownName) ? (
          <React.Fragment key="chtipt">
            <input
              style={{
                flexGrow: 1,
                minWidth: 40,
              }}
              ref={inputRef}
              autoComplete="off"
              maxLength="200"
              type="text"
              className="chtipt"
              placeholder={t`Chat here`}
              onInput={() => {
                const now = Date.now();
                if (now - lastTypingRef.current > 2500) {
                  lastTypingRef.current = now;
                  dispatch(sendChatTyping(chatChannel, true));
                }
                if (typingStopTimerRef.current) {
                  clearTimeout(typingStopTimerRef.current);
                }
                typingStopTimerRef.current = setTimeout(() => {
                  dispatch(sendChatTyping(chatChannel, false));
                }, 1000);
              }}
              onBlur={() => {
                if (typingStopTimerRef.current) {
                  clearTimeout(typingStopTimerRef.current);
                  typingStopTimerRef.current = null;
                }
                dispatch(sendChatTyping(chatChannel, false));
              }}
            />
            <button
              id="sendbtn"
              style={{ flexGrow: 0 }}
              type="submit"
            >
              ‣
            </button>
          </React.Fragment>
        ) : (
          <div
            className="modallink"
            key="nlipt"
            onClick={(evt) => {
              evt.stopPropagation();
              link('USERAREA', { target: 'fullscreen' });
            }}
            style={{
              textAlign: 'center',
              fontSize: 13,
              flexGrow: 1,
            }}
            role="button"
            tabIndex={0}
          >
            {t`You must be logged in to chat`}
          </div>
        )}
        <ChannelDropDown
          key="cdd"
          setChatChannel={setChannel}
          chatChannel={chatChannel}
        />
      </form>
      <div
        className="chatlink"
        style={{
          fontSize: btnSize,
        }}
      >
        <span
          onClick={(event) => {
            const {
              clientX: x,
              clientY: y,
            } = event;
            setCmArgs({
              type: 'CHANNEL',
              x,
              y,
              args: { cid: chatChannel },
              align: 'tr',
            });
          }}
          role="button"
          title={t`Channel settings`}
          tabIndex={-1}
        >⚙</span>
      </div>
    </div>
  );
};

export default Chat;
