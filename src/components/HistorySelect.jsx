/*
 * LogIn Form
 */
import React, {
  useState, useCallback, useRef, useEffect, useMemo,
} from 'react';
import { useSelector, shallowEqual, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  dateToString, getToday, stringToDate, stringToTime,
} from '../core/utils.js';
import { selectHistoricalTime } from '../store/actions/index.js';
import { requestHistoricalTimes } from '../store/actions/fetch.js';

const TIME_CACHE = new Map();

const HistorySelect = ({ id, aggregateByHour = false }) => {
  const dateSelect = useRef(null);

  const [submitting, setSubmitting] = useState(false);
  const [times, setTimes] = useState([]);
  const [max] = useState(getToday());

  const [
    canvasId,
    canvasStartDate,
    canvasEndDate,
    historicalDate,
    historicalTime,
  ] = useSelector((state) => [
    state.canvas.canvasId,
    state.canvas.canvasStartDate,
    state.canvas.canvasEndDate,
    state.canvas.historicalDate,
    state.canvas.historicalTime,
  ], shallowEqual);

  const dispatch = useDispatch();

  const setTime = useCallback((date, time) => {
    const timeString = time.substring(0, 2) + time.substring(3, 5);
    const dateString = dateToString(date);
    dispatch(selectHistoricalTime(dateString, timeString));
  }, [dispatch]);

  const makeDisplayTimes = useCallback((list) => {
    if (!aggregateByHour) return list;
    const picked = new Map();
    for (const t of list) {
      const h = t.substring(0, 2);
      const prev = picked.get(h);
      if (!prev || t > prev) {
        picked.set(h, t);
      }
    }
    const hours = Array.from(picked.keys()).sort();
    return hours.map((h) => picked.get(h));
  }, [aggregateByHour]);

  const displayTimes = useMemo(() => makeDisplayTimes(times), [times, makeDisplayTimes]);

  const handleDateChange = useCallback(async (date) => {
    const key = `${date}/${canvasId}`;
    const cache = TIME_CACHE.get(key);
    if (cache && cache[1] > Date.now() - 30 * 60 * 1000) {
      return cache[0];
    }
    setSubmitting(true);
    const newTimes = await requestHistoricalTimes(date, canvasId);
    TIME_CACHE.set(key, [newTimes, Date.now()]);
    setSubmitting(false);
    return newTimes;
  }, [canvasId]);

  const changeTime = useCallback(async (diff) => {
    if (!displayTimes.length || !dateSelect.current?.value) {
      return;
    }

    const newPos = displayTimes.indexOf(stringToTime(historicalTime)) + diff;
    let date = dateSelect.current.value;
    if (newPos >= displayTimes.length || newPos < 0) {
      if (newPos < 0) {
        dateSelect.current.stepDown(1);
      } else {
        dateSelect.current.stepUp(1);
      }
      date = dateSelect.current.value;
      const newTimes = await handleDateChange(date);
      const newDisp = makeDisplayTimes(newTimes);
      let newTime;
      if (newPos < 0 && newDisp.length > 0) {
        newTime = newDisp[newDisp.length - 1];
      } else {
        newTime = newDisp[0] || '00:00';
      }
      setTimes(newTimes);
      setTime(date, newTime);
      return;
    }
    setTime(date, displayTimes[newPos]);
  }, [historicalTime, displayTimes, handleDateChange, setTime, makeDisplayTimes]);

  // account for store getting changed somewhere else
  useEffect(() => {
    (async () => {
      const date = stringToDate(historicalDate);
      const key = `${date}/${canvasId}`;
      const cache = TIME_CACHE.get(key);
      if (!cache || times !== cache[0]) {
        setTimes(await handleDateChange(date));
      }
      const cachedDisp = cache ? makeDisplayTimes(cache[0]) : [];
      if (cachedDisp && cachedDisp.length
      && !cachedDisp.includes(stringToTime(historicalTime))
      ) {
        setTime(date, cachedDisp[0]);
      }
    })();
  }, [
    historicalDate, historicalTime, canvasId, handleDateChange, setTime, times, makeDisplayTimes,
  ]);

  const selectedDate = stringToDate(historicalDate);
  const selectedTime = stringToTime(historicalTime);

  return (
    <div className="historyselect" id={id}>
      <input
        type="date"
        pattern="\d{4}-\d{2}-\d{2}"
        key="dateinput"
        value={selectedDate}
        min={canvasStartDate}
        max={canvasEndDate || max}
        ref={dateSelect}
        onChange={async (evt) => {
          const date = evt.target.value;
          const newTimes = await handleDateChange(date);
          const newDisp = makeDisplayTimes(newTimes);
          setTimes(newTimes);
          setTime(date, newDisp[0] || '00:00');
        }}
      />
      <div key="timeselcon">
        { (!!displayTimes.length && historicalTime && !submitting)
          && (
            <div key="timesel">
              <button
                type="button"
                className="hsar"
                onClick={() => changeTime(-1)}
              >←</button>
              <select
                value={selectedTime}
                onChange={(evt) => setTime(selectedDate, evt.target.value)}
              >
                {displayTimes.map((value) => (
                  <option
                    key={value}
                    value={value}
                  >
                    {aggregateByHour ? `${value.substring(0, 2)}:00` : value}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="hsar"
                onClick={() => changeTime(+1)}
              >→</button>
            </div>
          )}
        { (submitting) && <p>{`${t`Loading`}...`}</p> }
        { (!displayTimes.length && !submitting) && <p>{t`Select Date above`}</p> }
      </div>
    </div>
  );
};

export default React.memo(HistorySelect);
