// Settings a company is likely to want to change, kept in one place rather
// than scattered through the seed, the import template and the forms.

/**
 * The currency amounts are reported in. Used for the unit on new dollar-metric
 * KPIs, in the import template, and in the sample data. Individual KPIs can
 * still override it — the unit is just a label stored per KPI.
 */
export const DEFAULT_CURRENCY = "BND";

/**
 * Largest Excel workbook the importer accepts. Kept in step with the server
 * action body limit in next.config.ts, which sits just above it.
 */
export const MAX_IMPORT_BYTES = 10 * 1024 * 1024;
