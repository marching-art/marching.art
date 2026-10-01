// Show-time weather chip for schedule cards (extracted from pages/ScheduleParts).

import React from 'react';

/** @typedef {{ summary?: string, tempF?: number, code?: number, hour?: number } | null | undefined} WeatherLike */

// An emoji for a WMO weather code (the backend stores show-time conditions on
// each competition as { summary, tempF, code }). Falls back to a thermometer so
// a code we don't map still renders a chip rather than nothing.
/** @param {unknown} code */
const weatherEmoji = (code) => {
  const c = Number(code);
  if (c === 0) return '☀️';
  if (c === 1) return '🌤️';
  if (c === 2) return '⛅';
  if (c === 3) return '☁️';
  if (c === 45 || c === 48) return '🌫️';
  if (c >= 51 && c <= 57) return '🌦️';
  if (c >= 61 && c <= 67) return '🌧️';
  if (c >= 71 && c <= 77) return '❄️';
  if (c >= 80 && c <= 82) return '🌦️';
  if (c === 85 || c === 86) return '🌨️';
  if (c >= 95 && c <= 99) return '⛈️';
  return '🌡️';
};

// The show-time weather chip shared by every schedule card: the sky as an emoji
// and the temperature, with the full conditions line in the tooltip. Renders
// nothing until the backend has stamped weather on the competition (the
// producer dates every show — regular, major, championship — from the season
// calendar, so this is the venue's forecast for the night the show is actually
// played this season).
/** @param {{ weather: WeatherLike }} props */
export const WeatherChip = ({ weather }) => {
  if (!weather?.summary) return null;
  const hour = typeof weather.hour === 'number' ? weather.hour : 20;
  const clock =
    hour === 0 ? '12 AM' : hour < 12 ? `${hour} AM` : hour === 12 ? '12 PM' : `${hour - 12} PM`;
  return (
    <span
      className="flex items-center gap-1 flex-shrink-0 tabular-nums"
      title={`${clock} · ${weather.summary}`}
      aria-label={`Show-time weather: ${weather.summary}`}
    >
      <span aria-hidden="true">{weatherEmoji(weather.code)}</span>
      {typeof weather.tempF === 'number' && <span>{weather.tempF}°</span>}
    </span>
  );
};
