import { useState, useEffect } from 'react';

export default function CountdownTimer({ releaseAt, onReleased }) {
  const [timeLeft, setTimeLeft] = useState('');
  const [released, setReleased] = useState(false);

  useEffect(() => {
    if (!releaseAt) {
      setTimeLeft('No release time set');
      return;
    }

    const interval = setInterval(() => {
      const now = new Date();
      const release = new Date(releaseAt);
      const diff = release - now;

      if (diff <= 0) {
        setTimeLeft('Released!');
        setReleased(true);
        if (onReleased) onReleased();
        clearInterval(interval);
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${hours}h ${minutes}m ${seconds}s`);
    }, 1000);

    return () => clearInterval(interval);
  }, [releaseAt]);

  if (released) {
    return (
      <span className="text-green-600 font-semibold">✅ Available</span>
    );
  }

  return (
    <span className="text-amber-600 font-semibold">⏳ {timeLeft}</span>
  );
}
