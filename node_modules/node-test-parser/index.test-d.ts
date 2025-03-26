import { Readable } from 'stream'
import { expectType } from 'tsd'
import parseReport, { Report } from '.'

const report = await parseReport(Readable.toWeb(Readable.from([])))

expectType<Report>(report)
