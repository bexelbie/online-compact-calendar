// ABOUTME: Calculates the compact calendar grid for a given year.
// ABOUTME: Produces ISO 8601 weeks (Monday start) with month markers.

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}

export function generateYear(year) {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const jan1Dow = jan1.getUTCDay() || 7; // Mon=1 .. Sun=7
  const startDate = new Date(Date.UTC(year, 0, 1 - (jan1Dow - 1)));

  const dec31 = new Date(Date.UTC(year, 11, 31));
  const dec31Dow = dec31.getUTCDay() || 7;
  const endDate = new Date(Date.UTC(year, 11, 31 + (7 - dec31Dow)));

  const weeks = [];
  const current = new Date(startDate);

  while (current <= endDate) {
    const days = [];
    let month = null;

    for (let i = 0; i < 7; i++) {
      const day = new Date(Date.UTC(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate()));
      days.push(day);
      if (day.getUTCDate() === 1) {
        month = MONTH_NAMES[day.getUTCMonth()];
      }
      current.setUTCDate(current.getUTCDate() + 1);
    }

    weeks.push({
      weekNumber: getISOWeekNumber(days[0]),
      days,
      month,
    });
  }

  return weeks;
}
