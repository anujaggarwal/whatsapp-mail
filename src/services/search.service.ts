import { QueryTypes } from 'sequelize';
import { sequelize } from '../models/index.js';

interface SearchOptions {
  chatId?: number;
  messageType?: string;
  dateFrom?: string;
  dateTo?: string;
  limit?: number;
  offset?: number;
}

interface SearchResult {
  results: unknown[];
  total: number;
}

class SearchService {
  static async fullTextSearch(query: string, options: SearchOptions = {}): Promise<SearchResult> {
    const { chatId, messageType, dateFrom, dateTo, limit = 50, offset = 0 } = options;

    // Convert search query to tsquery format
    const tsQuery = query
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .join(' & ');

    try {
      let whereClause = `
        WHERE to_tsvector('english', COALESCE(m.body, '')) @@ to_tsquery('english', :query)
          AND m.is_deleted = FALSE
      `;

      const replacements: Record<string, unknown> = { query: tsQuery };

      if (chatId) {
        whereClause += ' AND m.chat_id = :chatId';
        replacements.chatId = chatId;
      }

      if (messageType) {
        whereClause += ' AND m.message_type = :messageType';
        replacements.messageType = messageType;
      }

      if (dateFrom) {
        whereClause += ' AND m.timestamp >= :dateFrom';
        replacements.dateFrom = dateFrom;
      }

      if (dateTo) {
        whereClause += ' AND m.timestamp <= :dateTo';
        replacements.dateTo = dateTo;
      }

      const resultsQuery = `
        SELECT m.*, c.name as chat_name, c.chat_type,
          ts_rank(to_tsvector('english', COALESCE(m.body, '')), to_tsquery('english', :query)) as rank
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        ${whereClause}
        ORDER BY rank DESC, m.timestamp DESC
        LIMIT :limit OFFSET :offset
      `;

      const countQuery = `
        SELECT COUNT(*) as total
        FROM messages m
        JOIN chats c ON m.chat_id = c.id
        ${whereClause}
      `;

      const [results, countResult] = await Promise.all([
        sequelize.query(resultsQuery, {
          replacements: { ...replacements, limit, offset },
          type: QueryTypes.SELECT,
        }),
        sequelize.query(countQuery, {
          replacements,
          type: QueryTypes.SELECT,
        }),
      ]);

      const total = parseInt(String((countResult[0] as Record<string, unknown>)?.total ?? '0'), 10);

      return { results, total };
    } catch (error) {
      throw error;
    }
  }
}

export { SearchService };
export default SearchService;
