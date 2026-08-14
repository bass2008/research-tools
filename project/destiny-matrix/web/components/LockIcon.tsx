// Замок для закрытого раздела: корпус и отдельная скоба, чтобы её можно было отвести
// в сторону на наведении (анимация в globals.css, класс .lockico).
export default function LockIcon() {
  return (
    <svg className="lockico" viewBox="0 0 14 17" fill="none" aria-hidden="true" focusable="false">
      <path
        className="shackle"
        d="M4 7V4.8a3 3 0 0 1 6 0V7"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      <rect x="1.2" y="7" width="11.6" height="9" rx="2.2" fill="currentColor" opacity="0.16" />
      <rect
        x="1.2"
        y="7"
        width="11.6"
        height="9"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <circle cx="7" cy="11.5" r="1.15" fill="currentColor" />
    </svg>
  );
}
