const STAT_TONES = ["blue", "green", "orange", "red"];

function normalizeTone(tone) {
  const normalizedTone = String(tone || "blue").trim().toLowerCase();
  return STAT_TONES.includes(normalizedTone) ? normalizedTone : "blue";
}

export default function StatCard({ title, value, hint, tone = "blue", icon: Icon }) {
  const safeTone = normalizeTone(tone);
  const hasIcon = typeof Icon === "function";

  return (
    <article className={`eg-stat-card tone-${safeTone}`}>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        {hint && <small>{hint}</small>}
      </div>
      {hasIcon && (
        <div className="eg-stat-icon" aria-hidden="true">
          <Icon size={28} weight="duotone" />
        </div>
      )}
    </article>
  );
}