// Utility functions for extracting information from HTML content.

import * as cheerio from 'cheerio';

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
 *          and each row is an array of cell strings.
 */
export function extract_tables_from_html(html_content: string): Array<Array<Array<string>>> {
  if (!html_content) {
    return [];
  }
  const $ = cheerio.load(html_content);
  const tables: Array<Array<Array<string>>> = [];

  $('table').each((tableIndex, tableElement) => {
    const table: Array<Array<string>> = [];
    $(tableElement).find('tr').each((rowIndex, rowElement) => {
      const row: Array<string> = [];
      $(rowElement).find('th, td').each((cellIndex, cellElement) => {
        row.push($(cellElement).text().trim());
      });
      table.push(row);
    });
    tables.push(table);
  });

  return tables;
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
 */
export function extract_links_from_html(html_content: string, base_url: string): Array<{text: string, href: string}> {
  if (!html_content) {
    return [];
  }
  const $ = cheerio.load(html_content);
  const links: Array<{text: string, href: string}> = [];

  $('a[href]').each((linkIndex, linkElement) => {
    const linkText = $(linkElement).text().trim();
    const rawHref = $(linkElement).attr('href');

    if (rawHref) {
      try {
        const absoluteHref = new URL(rawHref, base_url).href;
        links.push({ text: linkText, href: absoluteHref });
      } catch (error) {
        console.warn(`Skipping malformed link: '${rawHref}' (base: ${base_url}). Error: ${error instanceof Error ? error.message : String(error)}`);
        // Optionally, could add the raw link if it's useful, or a link with an error indicator
        // links.push({ text: linkText, href: rawHref, error: "Malformed URL" });
      }
    }
  });

  return links;
}
