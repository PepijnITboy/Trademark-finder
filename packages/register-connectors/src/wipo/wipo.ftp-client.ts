/**
 * WIPO Madrid System register data is not available as a REST/JSON API.
 * The Madrid Monitor web UI and Global Brand Database are for interactive,
 * human use only - scraping them is against WIPO's terms of use and is
 * explicitly out of scope for Merkwacht.
 *
 * The supported machine-readable path is **WIPO's commercial FTP data
 * feed**: daily delta files (`yyyymmdd.zip`, each containing one or more
 * ST.66 XML transaction records - see `wipo.st66-parser.ts`) plus a full
 * weekly/monthly base file. Access requires a paid data-license agreement
 * directly with WIPO (pricing is negotiated per organization and not
 * publicly listed) provisioning FTP(S) credentials. See
 * `docs/connectors/wipo.md` for the full procurement/setup notes.
 *
 * `WipoFtpClient` is defined as an interface (rather than a concrete
 * implementation using e.g. `basic-ftp`) so:
 * - Tests can inject an in-memory fake without a real FTP server.
 * - The concrete FTP transport can be swapped/upgraded independently of
 *   `WipoMadridConnector` and `wipo.st66-parser.ts`.
 * - No FTP client dependency is added to this package until a real WIPO
 *   data-license agreement is in place and the production adapter is
 *   implemented and reviewed.
 */
export interface WipoFtpCredentials {
  readonly host: string;
  readonly user: string;
  readonly password: string;
  /** Remote directory containing daily delta files. Defaults to `/wipo/madrid/romarin` (WIPO's Madrid Romarin data product path) if unset. */
  readonly remoteDir?: string;
}

/** Minimal FTP client contract `WipoMadridConnector` depends on. Inject a real FTP(S) implementation in production; tests inject an in-memory fake. */
export interface WipoFtpClient {
  /** Lists available daily delta file names (expected format: `yyyymmdd.zip`) in the configured remote directory. */
  listDailyDeltaNames(): Promise<readonly string[]>;
  /** Downloads one daily delta file's raw (zipped) bytes. Production implementations must unzip before handing the XML to `parseSt66XmlToRecords`. */
  downloadDailyDelta(fileName: string): Promise<Buffer>;
}

/** Resolves `WipoFtpCredentials` from `WIPO_FTP_HOST`/`WIPO_FTP_USER`/`WIPO_FTP_PASSWORD`/`WIPO_FTP_REMOTE_DIR`, or `null` if any required var is missing. */
export function resolveWipoFtpCredentialsFromEnv(env: NodeJS.ProcessEnv = process.env): WipoFtpCredentials | null {
  const host = env['WIPO_FTP_HOST'];
  const user = env['WIPO_FTP_USER'];
  const password = env['WIPO_FTP_PASSWORD'];
  if (!host || !user || !password) return null;

  const remoteDir = env['WIPO_FTP_REMOTE_DIR'];
  return remoteDir === undefined
    ? { host, user, password }
    : { host, user, password, remoteDir };
}

const DAILY_DELTA_FILENAME_PATTERN = /^(\d{8})\.zip$/i;

/** Extracts the `yyyymmdd` checkpoint value from a daily delta filename like `20260728.zip`. Returns `null` if the filename doesn't match the expected pattern. */
export function parseWipoDeltaFileDate(fileName: string): string | null {
  const match = DAILY_DELTA_FILENAME_PATTERN.exec(fileName);
  return match?.[1] ?? null;
}
