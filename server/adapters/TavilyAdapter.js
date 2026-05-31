import axios from 'axios';
import { ISearchService } from '../ports/ISearchService.js';

/**
 * TavilyAdapter - Production implementation of ISearchService
 *
 * Changes (Issue 4):
 * - Single focused search query instead of 3 separate calls.
 * - max_results capped at 6 (as per product spec).
 * - Returns rich source objects { title, url, content, score } for UI display.
 * - Builds a richer summary from actual content (up to 1500 chars combined)
 *   rather than just the first result's snippet.
 */

export class TavilyAdapter extends ISearchService {
  constructor(apiKey = process.env.TAVILY_API_KEY) {
    super();
    this.apiKey = apiKey;
    this.apiUrl = 'https://api.tavily.com/search';
  }

  async searchSongInfo(title, artist) {
    if (!this.apiKey || this.apiKey === 'your-tavily-api-key') {
      console.warn('[Tavily] ✗ No API key configured — skipping song research. Set TAVILY_API_KEY in .env');
      return this._noApiKeyResponse(title, artist);
    }

    const query = `${title} ${artist} song production analysis technique`;
    console.log(`[Tavily] Searching (max 6 results): "${query}"`);

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          query,
          max_results: 6,
          include_raw_content: false,
          exclude_domains: [
            'spotify.com',
            'open.spotify.com',
            'youtube.com',
            'youtu.be',
            'music.youtube.com',
            'soundcloud.com',
            'music.apple.com',
            'amazon.com',
            'instagram.com',
            'facebook.com',
            'tiktok.com',
            'deezer.com',
            'tidal.com',
            'bandcamp.com',
            'vimeo.com',
            'dailymotion.com',
            'pinterest.com',
            'twitter.com',
            'x.com'
          ]
        },
        {
          timeout: 12000,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const rawResults = response.data.results || [];
      console.log(`[Tavily] ✓ Got ${rawResults.length} results`);

      // Build structured source objects for UI display and AI context
      const sources = rawResults.slice(0, 6).map((r) => ({
        title: r.title || 'Untitled',
        url: r.url || '',
        content: (r.content || r.snippet || '').substring(0, 600),
        score: r.score || 0,
      }));

      const summary = this._buildRichSummary(sources, title, artist);

      return {
        query,
        results: sources,
        summary,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error('[Tavily] Search error:', error.message);
      return {
        query,
        results: [],
        summary: `Research fetch failed: ${error.message}`,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async search(query, maxResults = 10) {
    if (!this.apiKey || this.apiKey === 'your-tavily-api-key') {
      console.warn('[Tavily] ✗ No API key configured — returning empty results.');
      return { query, results: [] };
    }

    console.log(`[Tavily] General Search (max ${maxResults} results): "${query}"`);

    try {
      const response = await axios.post(
        this.apiUrl,
        {
          query,
          max_results: maxResults,
          include_raw_content: false,
          exclude_domains: [
            'spotify.com',
            'open.spotify.com',
            'youtube.com',
            'youtu.be',
            'music.youtube.com',
            'soundcloud.com',
            'music.apple.com',
            'amazon.com',
            'instagram.com',
            'facebook.com',
            'tiktok.com',
            'deezer.com',
            'tidal.com',
            'bandcamp.com',
            'vimeo.com',
            'dailymotion.com',
            'pinterest.com',
            'twitter.com',
            'x.com'
          ]
        },
        {
          timeout: 12000,
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const rawResults = response.data.results || [];
      console.log(`[Tavily] ✓ Got ${rawResults.length} general results`);

      const sources = rawResults.slice(0, maxResults).map((r) => ({
        title: r.title || 'Untitled',
        url: r.url || '',
        content: (r.content || r.snippet || '').substring(0, 800),
        score: r.score || 0,
      }));

      return {
        query,
        results: sources,
      };
    } catch (error) {
      console.error('[Tavily] General Search error:', error.message);
      return {
        query,
        results: [],
      };
    }
  }

  /**
   * Build a rich multi-source summary for the AI template prompt.
   * Concatenates meaningful content from up to 3 top sources (up to 1500 chars).
   * @private
   */
  _buildRichSummary(sources, title, artist) {
    if (!sources || sources.length === 0) return 'No research results found.';

    // Take up to 3 best-scored sources
    const top = [...sources].sort((a, b) => b.score - a.score).slice(0, 3);

    const parts = top
      .filter((s) => s.content && s.content.length > 30)
      .map((s) => `[${s.title}]: ${s.content}`);

    const combined = parts.join('\n\n');
    return combined.substring(0, 1500) || sources[0]?.content || 'No research content available.';
  }

  /** @private */
  _noApiKeyResponse(title, artist) {
    return {
      query: `${title} by ${artist}`,
      results: [],
      summary: 'No research data available. Configure TAVILY_API_KEY in .env to enable song research.',
      timestamp: new Date().toISOString(),
    };
  }
}
