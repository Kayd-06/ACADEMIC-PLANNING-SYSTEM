import { db } from '../index'
import { studentReports, studentReportEntries, users } from '../schema'
import { createReport, listReports, getReportById } from './student-reports'

async function makeTeacher(name = 'Test Teacher') {
  const [teacher] = await db
    .insert(users)
    .values({ name, email: `${name.replace(/\s+/g, '').toLowerCase()}@example.com`, password: 'x', role: 'teacher' })
    .returning()
  return teacher
}

describe('student-reports queries', () => {
  afterEach(async () => {
    await db.delete(studentReportEntries)
    await db.delete(studentReports)
    await db.delete(users)
  })

  it('createReport inserts a report and its entries together', async () => {
    const teacher = await makeTeacher()
    const result = await createReport({
      teacherId: teacher.id,
      teacherName: teacher.name,
      className: 'Grade 10-A',
      subject: 'Physics',
      term: 'Mid-Term',
      entries: [
        { name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B' },
        { name: 'Priya Patel', rollNo: '102', marks: 90, maxMarks: 100, grade: 'A', attendance: 98, remarks: 'Excellent' },
      ],
    })

    expect(result.className).toBe('Grade 10-A')
    expect(result.entries).toHaveLength(2)
    expect(result.entries.find((e) => e.name === 'Priya Patel')?.attendance).toBe(98)
    expect(result.entries.find((e) => e.name === 'Rahul Sharma')?.attendance).toBeNull()
  })

  it('createReport handles an empty entries array without throwing', async () => {
    const teacher = await makeTeacher()
    const result = await createReport({
      teacherId: teacher.id,
      teacherName: teacher.name,
      className: 'Grade 10-A',
      subject: 'Physics',
      term: 'Mid-Term',
      entries: [],
    })
    expect(result.entries).toEqual([])
  })

  it('listReports returns all reports with their student counts when unfiltered', async () => {
    const teacher = await makeTeacher()
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Mid-Term',
      entries: [{ name: 'A', rollNo: '1', marks: 50, maxMarks: 100, grade: 'C' }, { name: 'B', rollNo: '2', marks: 80, maxMarks: 100, grade: 'A' }],
    })
    await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Finals',
      entries: [{ name: 'C', rollNo: '3', marks: 60, maxMarks: 100, grade: 'B' }],
    })

    const reports = await listReports()
    expect(reports).toHaveLength(2)
    const physics = reports.find((r) => r.subject === 'Physics')
    expect(physics?.studentCount).toBe(2)
    const chem = reports.find((r) => r.subject === 'Chemistry')
    expect(chem?.studentCount).toBe(1)
  })

  it('listReports filters by teacherId, class, subject, and term', async () => {
    const teacherA = await makeTeacher('Teacher A')
    const teacherB = await makeTeacher('Teacher B')
    await createReport({ teacherId: teacherA.id, teacherName: teacherA.name, className: 'Grade 10-A', subject: 'Physics', term: 'Mid-Term', entries: [] })
    await createReport({ teacherId: teacherB.id, teacherName: teacherB.name, className: 'Grade 11-B', subject: 'Chemistry', term: 'Finals', entries: [] })

    const byTeacher = await listReports({ teacherId: teacherA.id })
    expect(byTeacher).toHaveLength(1)
    expect(byTeacher[0].subject).toBe('Physics')

    const byClass = await listReports({ class: 'Grade 11-B' })
    expect(byClass).toHaveLength(1)
    expect(byClass[0].subject).toBe('Chemistry')

    const bySubjectAndTerm = await listReports({ subject: 'Physics', term: 'Mid-Term' })
    expect(bySubjectAndTerm).toHaveLength(1)
  })

  it('getReportById returns the report with its entries, or null if missing', async () => {
    const teacher = await makeTeacher()
    const created = await createReport({
      teacherId: teacher.id, teacherName: teacher.name, className: 'Grade 10-A', subject: 'Physics', term: 'Mid-Term',
      entries: [{ name: 'Rahul Sharma', rollNo: '101', marks: 75, maxMarks: 100, grade: 'B' }],
    })

    const fetched = await getReportById(created.id)
    expect(fetched?.entries).toHaveLength(1)
    expect(fetched?.entries[0].name).toBe('Rahul Sharma')

    expect(await getReportById('00000000-0000-0000-0000-000000000000')).toBeNull()
  })
})
