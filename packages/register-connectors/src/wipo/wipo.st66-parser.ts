import type { RegisterCode } from '../core/register-types.js';
import { ConnectorParseError } from '../core/register-errors.js';
import { wipoTransactionRecordSchema, type WipoTransactionRecord } from './wipo.schemas.js';

const WIPO_REGISTRY_CODE: RegisterCode = 'WIPO';

/**
 * Extracts `TransactionData` elements from a WIPO Standard ST.66 XML
 * document (as delivered by the Madrid FTP daily delta / base files) into
 * flattened {@link WipoTransactionRecord}s.
 *
 * This is a **minimal, regex-based extractor**, not a full ST.66 schema
 * parser: real ST.66 documents nest far more data (design elements,
 * holder/representative details, designated-office-specific fields,
 * multiple `ClassDescriptionDetails` per class, etc.) than Merkwacht
 * currently needs. It only pulls the fields `wipo.mapper.ts` maps to
 * `CandidateApplicationInput`, and - like every other parser in this
 * package - never guesses at missing fields: an element that doesn't
 * match the expected shape is simply skipped rather than partially
 * mapped, since `wipoTransactionRecordSchema.safeParse` will reject it.
 * See `docs/connectors/wipo.md` for the real production requirement (a
 * proper XML/schema-validating parser) once a WIPO FTP data-license
 * agreement is in place.
 */
export function parseSt66XmlToRecords(xml: string): readonly WipoTransactionRecord[] {
  const records: WipoTransactionRecord[] = [];

  for (const block of xml.matchAll(/<TransactionData>([\s\S]*?)<\/TransactionData>/gi)) {
    const body = block[1] ?? '';
    const applicationNumber = extractTag(body, 'ApplicationNumber');
    const markText = extractTag(body, 'MarkVerbalElementText');
    const applicantName = extractTag(body, 'ApplicantName');
    const filingDate = extractTag(body, 'FilingDate');
    const publicationDate = extractTag(body, 'PublicationDate');
    const status = extractTag(body, 'MarkCurrentStatusCode') || undefined;
    const niceClasses = [...body.matchAll(/<ClassNumber>(\d+)<\/ClassNumber>/gi)].map((m) => Number(m[1]));

    const candidate = {
      applicationNumber,
      markText,
      niceClasses,
      applicantName,
      filingDate,
      publicationDate,
      ...(status === undefined ? {} : { status }),
    };

    const parsed = wipoTransactionRecordSchema.safeParse(candidate);
    if (parsed.success) {
      records.push(parsed.data);
    }
    // Records that don't match the expected shape are skipped rather than
    // guessed at - see the "no fake data" rule in
    // `docs/connectors/connector-contract.md`. A production parser should
    // log these loudly (ConnectorParseError-style) rather than silently
    // drop them; kept minimal here pending the real ST.66 schema parser.
  }

  if (records.length === 0 && xml.includes('<TransactionData>')) {
    throw new ConnectorParseError(WIPO_REGISTRY_CODE, 'ST.66 XML contained transactions but none matched the expected shape');
  }

  return records;
}

function extractTag(xml: string, tagName: string): string {
  const match = new RegExp(`<${tagName}>([^<]*)</${tagName}>`, 'i').exec(xml);
  return match?.[1]?.trim() ?? '';
}
