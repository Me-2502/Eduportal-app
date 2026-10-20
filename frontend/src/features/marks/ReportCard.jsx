import { ClipboardList } from 'lucide-react'

import { EmptyState } from '@/components/states'
import { EXAM_LABELS, EXAMS } from '@/lib/constants'
import { formatScore } from '@/lib/format'

const examOrder = Object.fromEntries(EXAMS.map((exam, i) => [exam.value, i]))

function scoreText(mark) {
  if (!mark) return '–'
  return mark.max_score === 100
    ? formatScore(mark.score)
    : `${formatScore(mark.score)}/${formatScore(mark.max_score)}`
}

/** One standard's results laid out like a printed report card: subjects down, exams across. */
function StandardCard({ standard, results }) {
  const exams = [...results].sort((a, b) => examOrder[a.exam] - examOrder[b.exam])
  const subjects = new Map()
  for (const result of exams) {
    for (const mark of result.subjects) subjects.set(mark.subject.code, mark.subject.name)
  }
  const lookup = (result, code) => result.subjects.find((m) => m.subject.code === code)

  return (
    <section className="overflow-hidden rounded-lg border bg-card">
      <h2 className="border-b px-4 py-3 font-serif text-lg font-semibold">Standard {standard}</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 text-left font-medium">Subject</th>
              {exams.map((result) => (
                <th key={result.exam} className="w-32 px-4 py-2 text-right font-medium whitespace-nowrap">
                  {EXAM_LABELS[result.exam] ?? result.exam}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {[...subjects].map(([code, name]) => (
              <tr key={code}>
                <td className="px-4 py-2">{name}</td>
                {exams.map((result) => (
                  <td key={result.exam} className="px-4 py-2 text-right tabular">
                    {scoreText(lookup(result, code))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 font-medium">
            <tr>
              <td className="px-4 py-2 text-muted-foreground">Total</td>
              {exams.map((result) => (
                <td key={result.exam} className="px-4 py-2 text-right tabular">
                  {formatScore(result.total)}
                  <span className="font-normal text-muted-foreground">/{formatScore(result.max_total)}</span>
                </td>
              ))}
            </tr>
            <tr>
              <td className="px-4 pb-3 text-muted-foreground">Percentage</td>
              {exams.map((result) => (
                <td key={result.exam} className="px-4 pb-3 text-right font-serif text-base font-semibold tabular">
                  {result.percentage.toFixed(1)}%
                </td>
              ))}
            </tr>
          </tfoot>
        </table>
      </div>
    </section>
  )
}

export function ReportCard({ results, emptyText = 'No marks recorded yet.' }) {
  if (results.length === 0) return <EmptyState icon={ClipboardList} title={emptyText} />

  // latest standard first
  const byStandard = [...Map.groupBy(results, (r) => r.standard)].sort(([a], [b]) => b - a)
  return (
    <div className="space-y-6">
      {byStandard.map(([standard, items]) => (
        <StandardCard key={standard} standard={standard} results={items} />
      ))}
    </div>
  )
}
