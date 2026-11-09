export function HDReviewWordmark({
  compact = false,
  showCompany = true,
}: {
  compact?: boolean;
  showCompany?: boolean;
}) {
  return (
    <span className={compact ? "hd-brand hd-brand--compact" : "hd-brand"}>
      <span className="hd-brand-mark" aria-hidden="true">
        HD<span className="hd-brand-spark" />
      </span>
      <span className="hd-brand-lockup">
        <span className="hd-brand-title">
          <span className="sr-only">HD </span>Review<span className="hd-brand-point">.</span>
        </span>
        {showCompany && <span className="hd-brand-byline">
          <img
            src="/da-smarketing-logo.svg"
            alt=""
            width={18}
            height={18}
            className="hd-brand-company-mark"
          />
          by DA Smarketing Solutions
        </span>}
      </span>
    </span>
  );
}
