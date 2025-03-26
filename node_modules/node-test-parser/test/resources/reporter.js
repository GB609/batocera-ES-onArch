import parseReport from '../../index.js'

export default async function* jsonReporter(source) {
  const report = await parseReport(source)
  yield JSON.stringify(report, null, 2)
}
