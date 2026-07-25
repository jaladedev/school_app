import { PrintButton } from "@/components/PrintButton";

export type IdCardData = {
  id: string;
  fullName: string;
  role: "Student" | "Teacher" | "Admin" | "Parent";
  idNumber: string | null; // admission_no, staff_id, or fallback to a slice of the uuid
  subLabel: string | null; // class name+arm for a student, staff role for a teacher
  photoUrl: string | null;
};

export function IdCardBatch({
  schoolName,
  schoolMotto,
  logoUrl,
  academicYear,
  cards,
}: {
  schoolName: string;
  schoolMotto: string | null;
  logoUrl: string | null;
  academicYear: string;
  cards: IdCardData[];
}) {
  return (
    <div>
      <div className="mb-4 flex items-center justify-between print:hidden">
        <p className="text-sm text-ink-soft">
          {cards.length} ID card{cards.length === 1 ? "" : "s"} — standard CR80 size (85.6mm ×
          53.98mm), 8 per A4 sheet
        </p>
        <PrintButton />
      </div>

      {!cards.length && (
        <p className="text-sm text-ink-soft print:hidden">
          Nobody matches this selection — nothing to print.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 print:grid-cols-2 print:gap-3">
        {cards.map((card) => (
          <div
            key={card.id}
            className="id-card flex flex-col justify-between rounded-xl border border-rule bg-white p-4 print:break-inside-avoid print:rounded-none print:border-ink print:p-3"
          >
            <div className="flex items-center gap-2 border-b border-rule pb-2">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-leaf-soft text-xs font-semibold text-leaf">
                  {schoolName.slice(0, 1)}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-ink">{schoolName}</p>
                {schoolMotto && <p className="truncate text-[10px] text-ink-soft">{schoolMotto}</p>}
              </div>
              <span className="bg-marigold-soft rounded-full px-2 py-0.5 text-[10px] font-medium text-ink">
                {academicYear}
              </span>
            </div>

            <div className="flex flex-1 items-center gap-3 py-3">
              {card.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.photoUrl}
                  alt=""
                  className="h-16 w-16 shrink-0 rounded-lg border border-rule object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-rule bg-leaf-soft text-lg font-semibold text-leaf">
                  {card.fullName
                    .split(" ")
                    .map((p) => p[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase()}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{card.fullName}</p>
                <p className="text-xs text-ink-soft">{card.role}</p>
                {card.subLabel && <p className="truncate text-xs text-ink-soft">{card.subLabel}</p>}
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-rule pt-2">
              <span className="text-[10px] text-ink-soft">ID No.</span>
              <span className="font-mono text-xs font-medium text-ink">
                {card.idNumber ?? card.id.slice(0, 8).toUpperCase()}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/*
        No QR/verification code on the card itself — generating a scannable
        QR code without a client-side library isn't something worth doing
        with hand-rolled SVG (it needs real error-correction encoding, not
        just a pattern that looks like one). If a scannable verification
        code is wanted later, that's an actual QR library dependency to
        add deliberately, not something to fake here.
      */}
    </div>
  );
}
