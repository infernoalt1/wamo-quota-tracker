// Parse full documents and fragments alike, preserving head content and HTML scripts.
export function buildDocument({ html, css, javascript }) {
  const page = new DOMParser().parseFromString(html, 'text/html');
  if (!page.querySelector('meta[charset]')) {
    const charset = page.createElement('meta');
    charset.setAttribute('charset', 'UTF-8');
    page.head.prepend(charset);
  }
  if (!page.querySelector('meta[name="viewport"]')) {
    const viewport = page.createElement('meta');
    viewport.name = 'viewport';
    viewport.content = 'width=device-width, initial-scale=1';
    page.head.append(viewport);
  }
  const style = page.createElement('style');
  style.textContent = css.replace(/<\/style/gi, '<\\/style');
  page.head.append(style);
  const script = page.createElement('script');
  script.textContent = javascript.replace(/<\/script/gi, '<\\/script');
  page.body.append(script);
  return '<!DOCTYPE html>\n' + page.documentElement.outerHTML;
}
