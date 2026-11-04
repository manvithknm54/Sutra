export default function Logo({ size = 28 }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, display: "inline-grid", placeItems: "center",
      borderRadius: 8, background: "var(--teal)", color: "#fff", flex: "none" }}>
      <svg viewBox="0 0 24 24" width={size * 0.6} height={size * 0.6} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
        <path d="M17 7.5c-1.4-2.4-9-2.6-9 1.5 0 4.2 9 2.2 9 6.4 0 4.2-7.6 4-10 .6" />
      </svg>
    </span>
  );
}