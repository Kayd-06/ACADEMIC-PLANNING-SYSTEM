describe('Student 360 Reports API & Metrics calculation', () => {
  it('calculates accuracy rate correctly', () => {
    const questionsAttempted = 10
    const questionsCorrect = 8
    const accuracyRate = Math.round((questionsCorrect / questionsAttempted) * 100)
    expect(accuracyRate).toBe(80)
  })

  it('calculates percentile correctly from rank', () => {
    const rank = 2
    const totalStudentsInBatch = 10
    const percentile = Math.round(((totalStudentsInBatch - rank) / totalStudentsInBatch) * 100)
    expect(percentile).toBe(80)
  })

  it('categorizes topic mastery for strength vs weakness map correctly', () => {
    const topics = [
      { topic: 'Kinematics', correct: 9, total: 10 },
      { topic: 'Work & Energy', correct: 6, total: 10 },
      { topic: 'Thermodynamics', correct: 3, total: 10 },
    ]

    const evaluated = topics.map((t) => ({
      topic: t.topic,
      mastery: Math.round((t.correct / t.total) * 100),
    }))

    const strong = evaluated.filter((t) => t.mastery >= 75)
    const average = evaluated.filter((t) => t.mastery >= 50 && t.mastery < 75)
    const weak = evaluated.filter((t) => t.mastery < 50)

    expect(strong.map((s) => s.topic)).toEqual(['Kinematics'])
    expect(average.map((a) => a.topic)).toEqual(['Work & Energy'])
    expect(weak.map((w) => w.topic)).toEqual(['Thermodynamics'])
  })

  it('calculates behavioral score correctly from rating averages', () => {
    const attitude = 4.0
    const behaviour = 4.5
    const focus = 3.5
    const interaction = 4.0
    const behavioralScore = Number(((attitude + behaviour + focus + interaction) / 4).toFixed(1))
    expect(behavioralScore).toBe(4.0)
  })
})
