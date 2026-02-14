/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface GoogleSearchResult {
  title: string;
  link: string;
  snippet: string;
}

/**
 * Fetches general search results from Google Custom Search API.
 */
export async function searchGoogle(
  query: string,
  apiKey: string,
  cx: string,
  count: number = 5
): Promise<GoogleSearchResult[]> {
  if (!apiKey || !cx) return [];

  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.append('key', apiKey);
  url.searchParams.append('cx', cx);
  url.searchParams.append('q', query);
  url.searchParams.append('num', count.toString());
  url.searchParams.append('safe', 'active');

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Google API Error: ${response.status}`);

    const data = await response.json();
    if (!data.items) return [];

    return data.items.map((item: any) => ({
      title: item.title,
      link: item.link,
      snippet: item.snippet
    }));
  } catch (error) {
    console.error('Google Search Failed:', error);
    return [];
  }
}