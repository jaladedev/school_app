import Link from "next/link";

const SUBJECT_TABS = [
  {
    name: "Basic Science & Technology",
    color: "#2F6B4F",
    topic: "Classification of Living Things",
  },
  { name: "Mathematics", color: "#B24C3C", topic: "Fractions and Decimals" },
  { name: "English Studies", color: "#C98F00", topic: "Comprehension and Composition" },
  { name: "Social Studies", color: "#3B5B8C", topic: "Our Community and Its Leaders" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-paper bg-notebook-lines">
      {/* Nav */}
      <header className="flex items-center justify-between px-8 py-6">
        <p className="font-display text-xl font-semibold text-ink">School</p>
        <Link
          href="/login"
          className="rounded-lg border border-ink px-4 py-2 text-sm font-medium text-ink transition hover:bg-ink hover:text-paper"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <section className="grid grid-cols-1 gap-12 px-8 pb-20 pt-8 md:grid-cols-2 md:px-16">
        <div className="flex flex-col justify-center">
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-leaf">
            Primary 1–6 · NERDC Curriculum
          </p>
          <h1 className="mb-5 font-display text-4xl font-semibold leading-tight text-ink md:text-5xl">
            One place for lessons,
            <br />
            notes, records and
            <br />
            timetables.
          </h1>
          <p className="mb-8 max-w-md text-base leading-relaxed text-ink-soft">
            Every topic, term, and class period a student, teacher, or admin needs — already
            organized, already written, ready the moment an account is created.
          </p>
          <div className="flex gap-3">
            <Link
              href="/login"
              className="rounded-lg bg-marigold px-5 py-3 font-medium text-ink transition hover:bg-marigold-dark"
            >
              Sign in to your school
            </Link>
          </div>
        </div>

        {/* Signature element: stacked notebook tabs, each a subject with a real topic preview */}
        <div className="relative flex items-center justify-center">
          <div className="w-full max-w-sm">
            {SUBJECT_TABS.map((subject, i) => (
              <div
                key={subject.name}
                className="group relative mb-3 rounded-r-xl border border-l-4 border-rule bg-white px-5 py-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
                style={{ borderLeftColor: subject.color, marginLeft: i * 14 }}
              >
                <p className="font-display text-base font-semibold text-ink">{subject.name}</p>
                <p className="mt-1 text-sm text-ink-soft">
                  Next up: <span className="text-ink">{subject.topic}</span>
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Role sections — grounded in real features, not generic icons+text */}
      <section className="grid grid-cols-1 gap-6 border-t border-rule px-8 py-16 md:grid-cols-3 md:px-16">
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-leaf">For students</p>
          <h2 className="mb-2 font-display text-xl font-semibold text-ink">
            Every topic note, term by term
          </h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            Browse subjects by term, read notes with diagrams and tables built in, and check grades
            and attendance without asking a teacher.
          </p>
        </div>
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-clay">For teachers</p>
          <h2 className="mb-2 font-display text-xl font-semibold text-ink">
            Mark, grade, and author in one flow
          </h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            Take attendance per lesson, enter grades against the term&apos;s assessments, and write
            or edit topic notes your students see immediately once published.
          </p>
        </div>
        <div>
          <p className="mb-2 font-mono text-xs uppercase tracking-widest text-marigold-dark">
            For administrators
          </p>
          <h2 className="mb-2 font-display text-xl font-semibold text-ink">
            Classes, timetables, and staff — governed centrally
          </h2>
          <p className="text-sm leading-relaxed text-ink-soft">
            Manage enrollments, build conflict-free timetables, and see every class&apos;s records
            without chasing paper files.
          </p>
        </div>
      </section>

      <footer className="border-t border-rule px-8 py-6 text-xs text-ink-soft md:px-16">
        Built for Nigerian primary schools · NERDC-aligned curriculum
      </footer>
    </div>
  );
}
