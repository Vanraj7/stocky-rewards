// src/helpers.js
function startOfDayUTC(d) {
  const dt = new Date(d);
  dt.setUTCHours(0,0,0,0);
  return dt;
}

function isoDateUTC(d) {
  const dt = new Date(d);
  return dt.toISOString().slice(0,10);
}

module.exports = { startOfDayUTC, isoDateUTC };
