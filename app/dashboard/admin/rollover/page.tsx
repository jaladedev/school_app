import { getRolloverPreview } from "@/lib/actions/rollover";
import { RolloverWizard } from "@/components/RolloverWizard";

export default async function AcademicYearRolloverPage() {
  const preview = await getRolloverPreview();

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl font-semibold text-ink">Academic year rollover</h1>
      <p className="mb-6 max-w-2xl text-sm text-ink-soft">
        Advance the school to a new academic year in one step: creates next year&apos;s classes,
        promotes (or repeats, or graduates) every student, and updates the current term. Review the
        plan carefully before running it -- this affects every class and student at once.
      </p>

      <RolloverWizard preview={preview} />
    </div>
  );
}
