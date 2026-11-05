export function renderSiteMetadata(html: string, origin: string): string {
  return html.replaceAll('__APP_ORIGIN__', origin);
}
