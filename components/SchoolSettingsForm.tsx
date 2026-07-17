"use client";

import { useState, useTransition } from "react";
import { saveSchoolSettings } from "@/lib/actions/settings";
import type { GradeScaleEntry, SchoolSettings } from "@/types/database";

export function SchoolSettingsForm({ settings }: { settings: SchoolSettings }) {
  const [name, setName] = useState(settings.name);
  const [motto, setMotto] = useState(settings.motto ?? "");
  const [address, setAddress] = useState(settings.address ?? "");
  const [logoUrl, setLogoUrl] = useState(settings.logo_url ?? "");
  const [academicYear, setAcademicYear] = useState(settings.current_academic_year);
  const [term, setTerm] = useState(settings.current_term);
  const [gradeScale, setGradeScale] = useState<GradeScaleEntry[]>(settings.grade_scale);
  const [isPending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateGrade(index: number, field: "grade" | "min", value: string) {
    setGradeScale((prev) =>
      prev.map((g, i) =>
        i === index ? { ...g, [field]: field === "min" ? Number(value) : value } : g
      )
    );
  }

  function handleSave() {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      try {
        await saveSchoolSettings({
          name,
          motto,
          address,
          logoUrl,
          currentAcademicYear: academicYear,
          currentTerm: term,
          gradeScale,
        });
        setSaved(true);
      } catch (err: any) {
        setError(err.message ?? "Something went wrong.");
      }
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <div className="rounded-xl border border-rule bg-white p-4">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">School identity</h2>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
              School name
            </label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
              Motto (optional)
            </label>
            <input
              value={motto}
              onChange={(e) => setMotto(e.target.value)}
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
              Address (optional)
            </label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
              Logo URL (optional)
            </label>
            <p className="mb-1 text-xs text-ink-soft">
              A hosted image URL — shown on report cards. Uploading a file directly isn&apos;t
              supported yet; paste a link to an image hosted elsewhere.
            </p>
            <div className="flex items-center gap-3">
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…"
                className="flex-1 rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
              />
              {logoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={logoUrl}
                  alt=""
                  className="h-10 w-10 rounded object-contain"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.visibility = "hidden";
                  }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-rule bg-white p-4">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Current session</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Used as the default term/year across the app where a page doesn&apos;t have its own
          selector.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
              Academic year
            </label>
            <input
              value={academicYear}
              onChange={(e) => setAcademicYear(e.target.value)}
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm outline-none focus-visible:border-marigold"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-soft">
              Current term
            </label>
            <select
              value={term}
              onChange={(e) => setTerm(Number(e.target.value))}
              className="w-full rounded-lg border border-rule px-3 py-2 text-sm"
            >
              <option value={1}>Term 1</option>
              <option value={2}>Term 2</option>
              <option value={3}>Term 3</option>
            </select>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-rule bg-white p-4">
        <h2 className="mb-3 font-display text-lg font-semibold text-ink">Grade scale</h2>
        <p className="mb-3 text-xs text-ink-soft">
          Minimum percentage required for each letter grade, used on report cards.
        </p>
        <div className="space-y-2">
          {gradeScale.map((g, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={g.grade}
                onChange={(e) => updateGrade(i, "grade", e.target.value)}
                className="w-16 rounded-lg border border-rule px-2 py-1 text-center text-sm"
              />
              <span className="text-sm text-ink-soft">min score</span>
              <input
                type="number"
                value={g.min}
                onChange={(e) => updateGrade(i, "min", e.target.value)}
                className="w-20 rounded-lg border border-rule px-2 py-1 text-sm"
              />
              <span className="text-sm text-ink-soft">%</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-marigold px-4 py-2 text-sm font-medium text-ink hover:bg-marigold-dark disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save settings"}
        </button>
        {saved && <span className="ml-3 text-sm text-leaf">Saved.</span>}
        {error && <p className="mt-2 text-sm text-clay">{error}</p>}
      </div>
    </div>
  );
}
