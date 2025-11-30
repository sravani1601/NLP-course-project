const natural = require('natural');

/**
 * NLP Parser Service
 * Parses natural language scheduling requests into structured event data
 */
class NLPParser {
  constructor() {
    this.tokenizer = new natural.WordTokenizer();
    this.stemmer = natural.PorterStemmer;
  }

  /**
   * Extract date and time from natural language text
   * @param {string} text - Natural language text
   * @param {Date} referenceDate - Reference date for relative dates (default: now)
   * @returns {Object} - { date: Date, time: string, duration: number (minutes) }
   */
  parseDateTime(text, referenceDate = new Date()) {
    const lowerText = text.toLowerCase();
    const result = {
      date: null,
      time: null,
      duration: 60 // Default 1 hour
    };

    // Parse relative dates
    if (lowerText.includes('today')) {
      result.date = new Date(referenceDate);
      result.date.setHours(0, 0, 0, 0);
    } else if (lowerText.includes('tomorrow')) {
      result.date = new Date(referenceDate);
      result.date.setDate(result.date.getDate() + 1);
      result.date.setHours(0, 0, 0, 0);
    } else if (lowerText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/)) {
      const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayMatch = lowerText.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
      if (dayMatch) {
        const targetDay = dayNames.indexOf(dayMatch[0]);
        const currentDay = referenceDate.getDay();
        let daysAhead = targetDay - currentDay;
        if (daysAhead <= 0) daysAhead += 7; // Next occurrence
        result.date = new Date(referenceDate);
        result.date.setDate(result.date.getDate() + daysAhead);
        result.date.setHours(0, 0, 0, 0);
      }
    }

    // Parse time (12-hour or 24-hour format)
    const timePatterns = [
      { pattern: /(\d{1,2}):(\d{2})\s*(am|pm)?/i, hasMinutes: true },
      { pattern: /(\d{1,2})\s*(am|pm)/i, hasMinutes: false },
      { pattern: /at\s+(\d{1,2}):?(\d{2})?\s*(am|pm)?/i, hasMinutes: true }
    ];

    for (const { pattern, hasMinutes } of timePatterns) {
      const match = text.match(pattern);
      if (match) {
        let hours = parseInt(match[1]);
        let minutes = 0;
        
        if (hasMinutes && match[2] && !isNaN(parseInt(match[2]))) {
          minutes = parseInt(match[2]);
        }
        
        // Find am/pm in the match array
        const ampmIndex = hasMinutes ? 3 : 2;
        const ampm = match[ampmIndex] ? match[ampmIndex].toLowerCase() : null;

        if (ampm === 'pm' && hours !== 12) hours += 12;
        if (ampm === 'am' && hours === 12) hours = 0;

        result.time = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        break;
      }
    }

    // Parse duration
    const durationPatterns = [
      { pattern: /(\d+)\s*(?:hour|hr|h)\s*(?:and\s*)?(\d+)?\s*(?:min|minute|m)?/i, multiplier: 60 },
      { pattern: /(\d+)\s*(?:min|minute|m)/i, multiplier: 1 },
      { pattern: /(\d+)\s*(?:hour|hr|h)/i, multiplier: 60 }
    ];

    for (const { pattern, multiplier } of durationPatterns) {
      const match = text.match(pattern);
      if (match) {
        const value = parseInt(match[1]);
        const additionalMinutes = match[2] ? parseInt(match[2]) : 0;
        result.duration = (value * multiplier) + additionalMinutes;
        break;
      }
    }

    return result;
  }

  /**
   * Extract event title/summary from text
   * @param {string} text - Natural language text
   * @returns {string} - Event title
   */
  extractTitle(text) {
    // Pattern to extract the main event description
    // Look for patterns like: "schedule X", "add X", "book X", etc.
    // Or just extract the main noun phrase
    
    let cleaned = text.trim();
    
    // Remove leading action verbs and their articles
    cleaned = cleaned.replace(/^(schedule|add|create|book|set up|plan|set)\s+(a|an|the)?\s*/i, '');
    
    // Remove time expressions (more carefully)
    cleaned = cleaned.replace(/\s+at\s+\d{1,2}:?\d{0,2}\s*(am|pm|AM|PM)?/gi, '');
    cleaned = cleaned.replace(/\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)/gi, '');
    
    // Remove duration expressions (more carefully - preserve the word before "for")
    cleaned = cleaned.replace(/\s+for\s+\d+\s*(hour|hr|h|minute|min|m)s?/gi, '');
    
    // Remove trailing scheduling phrases
    cleaned = cleaned.replace(/\s+(on|at|for)\s+(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday).*$/i, '');
    
    // Clean up extra spaces
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    
    // If we have a reasonable title, use it
    if (cleaned.length > 3 && cleaned.length < 100) {
      // Capitalize first letter
      return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    }
    
    // Fallback: try to extract key phrases
    const tokens = this.tokenizer.tokenize(text.toLowerCase());
    const stopwords = natural.stopwords;
    
    // Find the main noun phrase (usually after action verbs)
    let startIdx = 0;
    const actionVerbs = ['schedule', 'add', 'create', 'book', 'set', 'plan'];
    for (let i = 0; i < tokens.length; i++) {
      if (actionVerbs.includes(tokens[i])) {
        startIdx = i + 1;
        break;
      }
    }
    
    // Skip articles
    if (tokens[startIdx] === 'a' || tokens[startIdx] === 'an' || tokens[startIdx] === 'the') {
      startIdx++;
    }
    
    // Collect meaningful tokens (up to 5 words)
    const meaningfulTokens = [];
    for (let i = startIdx; i < tokens.length && meaningfulTokens.length < 5; i++) {
      const token = tokens[i];
      // Stop at time/duration indicators
      if (/^\d+$/.test(token) || 
          ['at', 'on', 'for', 'today', 'tomorrow'].includes(token) ||
          /^(am|pm|hour|hr|minute|min)$/.test(token)) {
        break;
      }
      if (token.length > 2 && !stopwords.includes(token)) {
        meaningfulTokens.push(token);
      }
    }
    
    if (meaningfulTokens.length > 0) {
      const title = meaningfulTokens.join(' ');
      return title.charAt(0).toUpperCase() + title.slice(1);
    }

    return 'New Event';
  }

  /**
   * Parse a complete scheduling request
   * @param {string} text - Natural language scheduling request
   * @param {Date} referenceDate - Reference date for relative dates
   * @returns {Object} - Parsed event data
   */
  parseScheduleRequest(text, referenceDate = new Date()) {
    const dateTimeInfo = this.parseDateTime(text, referenceDate);
    const title = this.extractTitle(text);

    // Build start and end dates
    let startDate;
    if (dateTimeInfo.date) {
      // Use parsed date (e.g., tomorrow, Monday)
      startDate = new Date(dateTimeInfo.date);
    } else {
      // Use reference date (today)
      startDate = new Date(referenceDate);
    }

    // Set time if provided
    if (dateTimeInfo.time) {
      const [hours, minutes] = dateTimeInfo.time.split(':').map(Number);
      startDate.setHours(hours, minutes, 0, 0);
    } else {
      // Default to current time if no time specified
      startDate = new Date(referenceDate);
    }

    const endDate = new Date(startDate);
    endDate.setMinutes(endDate.getMinutes() + dateTimeInfo.duration);

    return {
      summary: title,
      start: startDate.toISOString(),
      end: endDate.toISOString(),
      description: text, // Keep original text as description
      duration: dateTimeInfo.duration
    };
  }

  /**
   * Validate parsed event data
   * @param {Object} eventData - Parsed event data
   * @returns {Object} - { valid: boolean, errors: string[] }
   */
  validateEventData(eventData) {
    const errors = [];

    if (!eventData.summary || eventData.summary.trim().length === 0) {
      errors.push('Event title is required');
    }

    if (!eventData.start) {
      errors.push('Start time is required');
    }

    if (!eventData.end) {
      errors.push('End time is required');
    }

    if (eventData.start && eventData.end) {
      const start = new Date(eventData.start);
      const end = new Date(eventData.end);
      if (end <= start) {
        errors.push('End time must be after start time');
      }
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }
}

module.exports = new NLPParser();

