/** "Try it" buttons anywhere on the page send their SQL to the query box with this event. */
export const TRY_EVENT = 'sql:try';

export function tryQuery(sql?: string) {
  window.dispatchEvent(new CustomEvent(TRY_EVENT, { detail: sql }));
}

/**
 * Whether a snippet can run as written: a whole statement (after any leading
 * comments), with no elisions or stand-in table names.
 */
export function isRunnable(sql: string): boolean {
  const body = sql.replace(/^\s*(--[^\n]*\n\s*)*/, '');
  return /^(select|with)\b/i.test(body) && !/…|\.\.\.|\bfrom (t|a)\b|condition_1/.test(sql);
}
