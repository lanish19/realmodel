// Utility functions for extracting information from HTML content.

/**
 * Extracts plain text from an HTML string by removing HTML tags.
 * This is a basic implementation using regular expressions.
 * 
 * @param html_content - The HTML string to process.
 * @returns The extracted plain text content.
 */
export function extract_text_from_html(html_content: string): string {
  if (!html_content) {
    return "";
  }
  // Basic regex to strip HTML tags.
  // Replace any character between < and > (non-greedy) with an empty string.
  // Also, decode common HTML entities.
  let text = html_content.replace(/<[^>]*>?/gm, '');
  text = text.replace(/&nbsp;/g, ' ')
             .replace(/&amp;/g, '&')
             .replace(/&lt;/g, '<')
             .replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"')
             .replace(/&#39;/g, "'");
  return text.trim();
}

/**
 * Extracts tables from an HTML string.
 * Placeholder implementation.
 * 
 * In a full implementation, this function would parse the HTML,
 * find all <table> elements, and then iterate through <tr> (rows)
 * and <td>/<th> (cells) to build a 2D array representation of each table.
 * 
 * @param html_content - The HTML string to process.
 * @returns An array of tables, where each table is an array of rows, 
 *          and each row is an array of cell strings. Currently returns an empty array.
 */
export function extract_tables_from_html(html_content: string): Array<Array<Array<string>>> {
  console.log("Placeholder: extract_tables_from_html would parse HTML to find <table> elements and extract their data.");
  // Placeholder: A real implementation would use a proper HTML parser.
  // For example, it might look for <table>, then <tr>, then <td>/<th>.
  // const tables: Array<Array<Array<string>>> = [];
  // const tableElements = html_content.match(/<table[^>]*>.*?<\/table>/gis); // Very naive
  // if (tableElements) {
  //   // ... further parsing logic ...
  // }
  return []; 
}

/**
 * Extracts links (<a> tags) from an HTML string.
 * Placeholder implementation.
 * 
 * In a full implementation, this function would parse the HTML,
 * find all <a> elements, extract their `href` attribute and inner text.
 * It would also resolve relative URLs using the provided `base_url`.
 * 
 * @param html_content - The HTML string to process.
 * @param base_url - The base URL to resolve relative links.
 * @returns An array of link objects, each containing `text` and `href` (fully qualified URL). 
 *          Currently returns an empty array.
 */
export function extract_links_from_html(html_content: string, base_url: string): Array<{text: string, href: string}> {
  console.log(`Placeholder: extract_links_from_html would parse HTML to find <a> tags, extract href and text, and resolve relative links using base_url: ${base_url}.`);
  // Placeholder: A real implementation would use a proper HTML parser.
  // For example, it might look for <a href="...">text</a>
  // const links: Array<{text: string, href: string}> = [];
  // const anchorElements = html_content.match(/<a\s+(?:[^>]*?\s+)?href="([^"]*)"[^>]*>(.*?)<\/a>/gis); // Very naive
  // if (anchorElements) {
  //   // ... further parsing logic to extract href, text, and resolve with base_url ...
  // }
  return [];
}
