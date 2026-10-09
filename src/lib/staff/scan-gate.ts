// A ticket must leave the frame for one second before the same ticket is accepted again.
export function createScanGate() {
  let last = '';
  let absentSince: number | null = null;
  return (value: string | null, now: number) => {
    if (!value) {
      absentSince ??= now;
      if (now - absentSince >= 1000) last = '';
      return false;
    }
    absentSince = null;
    if (value === last) return false;
    last = value;
    return true;
  };
}

export function ticketToken(value: string) {
  const token = value.includes('/checkin/')
    ? value.split('/checkin/').pop()?.split(/[?#]/)[0] || ''
    : value.trim();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(token) ? token : null;
}
