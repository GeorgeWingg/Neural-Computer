/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

interface BingImageResult {
  contentUrl: string;
  name: string;
  thumbnailUrl?: string;
  hostPageUrl?: string;
}

interface BingVideoResult {
  contentUrl?: string;
  embedHtml?: string;
  name: string;
  thumbnailUrl?: string;
  hostPageUrl?: string;
}

export async function searchBingImages(
  query: string,
  apiKey: string,
  count: number = 10
): Promise<BingImageResult[]> {
  if (!apiKey) {
    console.warn('Missing Bing Search API Key');
    return [];
  }

  const url = new URL('https://api.bing.microsoft.com/v7.0/images/search');
  url.searchParams.append('q', query);
  url.searchParams.append('count', count.toString());
  url.searchParams.append('safeSearch', 'Off'); // Explicitly disable SafeSearch

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bing Image Search API Error: ${response.status}`, errorText);
      throw new Error(`Bing Image Search API Error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.value) {
      return [];
    }

    return data.value.map((item: any) => ({
      contentUrl: item.contentUrl,
      name: item.name,
      thumbnailUrl: item.thumbnailUrl,
      hostPageUrl: item.hostPageUrl,
    }));
  } catch (error) {
    console.error('Failed to fetch images from Bing:', error);
    return [];
  }
}

export async function searchBingVideos(
  query: string,
  apiKey: string,
  count: number = 10
): Promise<BingVideoResult[]> {
  if (!apiKey) {
    console.warn('Missing Bing Search API Key');
    return [];
  }

  const url = new URL('https://api.bing.microsoft.com/v7.0/videos/search');
  url.searchParams.append('q', query);
  url.searchParams.append('count', count.toString());
  url.searchParams.append('safeSearch', 'Off'); // Explicitly disable SafeSearch
  
  // 'pricing' parameter can be set to 'Free' if using the free tier, but usually auto-detected.

  try {
    const response = await fetch(url.toString(), {
      headers: { 'Ocp-Apim-Subscription-Key': apiKey },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Bing Video Search API Error: ${response.status}`, errorText);
      throw new Error(`Bing Video Search API Error: ${response.status}`);
    }

    const data = await response.json();
    if (!data.value) {
      return [];
    }

    return data.value.map((item: any) => ({
      contentUrl: item.contentUrl,
      embedHtml: item.embedHtml,
      name: item.name,
      thumbnailUrl: item.thumbnailUrl,
      hostPageUrl: item.hostPageUrl,
    }));
  } catch (error) {
    console.error('Failed to fetch videos from Bing:', error);
    return [];
  }
}
