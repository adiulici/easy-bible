import styles from "./StickyHeader.module.css";

interface StickyHeaderProps {
  bookName: string;
  translationCode: string;
  translationLabel: string;
  visible: boolean;
}

/**
 * Condensed fixed header (book name + translation code) shown once the
 * page's main header has scrolled out of view.
 * @param bookName - Current book name, e.g. "Ioan".
 * @param translationCode - Current translation code, e.g. "VDC".
 * @param translationLabel - Full translation name, shown as a tooltip.
 * @param visible - Whether the sticky header should be slid into view.
 * @returns The fixed header element.
 */
export default function StickyHeader({
  bookName,
  translationCode,
  translationLabel,
  visible,
}: StickyHeaderProps) {
  return (
    <div className={`${styles.stickyHeader} ${visible ? styles.visible : ""}`}>
      <span className={styles.bookName}>{bookName}</span>
      <span className={styles.translation} title={translationLabel}>
        {translationCode}
      </span>
    </div>
  );
}
