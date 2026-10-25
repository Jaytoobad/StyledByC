export function money(n: number) {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS',
    maximumFractionDigits: 0,
  }).format(n);
}

export function dateLabel(s: string) {
  return new Date(`${s}T12:00:00`).toLocaleDateString('en-GH', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function timeLabel(s: string) {
  const [h, m] = s.split(':').map(Number);
  return new Date(2000, 0, 1, h, m).toLocaleTimeString('en-GH', {
    hour: 'numeric',
    minute: '2-digit',
  });
}
