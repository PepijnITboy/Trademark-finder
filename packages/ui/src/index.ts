/**
 * Resolvable path to the design tokens stylesheet, for tooling that needs
 * a filesystem path rather than a package import specifier (e.g. custom
 * build scripts). Application code should generally prefer importing
 * `@merkwacht/ui/tokens.css` directly.
 */
export const TOKENS_CSS_IMPORT_PATH = '@merkwacht/ui/tokens.css';
