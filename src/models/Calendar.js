const fs = require('fs').promises;
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const EVENTS_FILE = path.join(DATA_DIR, 'events.json');

/**
 * Ensure data directory and files exist
 */
async function ensureFiles() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(EVENTS_FILE);
  } catch (e) {
    await fs.writeFile(EVENTS_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Read JSON file
 */
async function readJson(file) {
  await ensureFiles();
  const content = await fs.readFile(file, 'utf8');
  return content.trim() ? JSON.parse(content) : [];
}

/**
 * Write JSON file
 */
async function writeJson(file, data) {
  await ensureFiles();
  await fs.writeFile(file, JSON.stringify(data, null, 2));
}

/**
 * Generate unique ID
 */
function generateId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/**
 * Calendar Model
 * Simplified file-based calendar storage
 */
class CalendarModel {
  /**
   * Get all events
   * @returns {Promise<Array>} - Array of events
   */
  static async getAllEvents() {
    return await readJson(EVENTS_FILE);
  }

  /**
   * Get events in a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} - Array of events in range
   */
  static async getEventsByDateRange(startDate, endDate) {
    const events = await this.getAllEvents();
    const start = new Date(startDate).getTime();
    const end = new Date(endDate).getTime();

    return events.filter(event => {
      const eventStart = new Date(event.start).getTime();
      const eventEnd = new Date(event.end).getTime();
      // Include events that overlap with the range
      return (eventStart >= start && eventStart <= end) ||
             (eventEnd >= start && eventEnd <= end) ||
             (eventStart <= start && eventEnd >= end);
    });
  }

  /**
   * Get event by ID
   * @param {string} id - Event ID
   * @returns {Promise<Object|null>} - Event or null
   */
  static async getEventById(id) {
    const events = await this.getAllEvents();
    return events.find(e => e.id === id) || null;
  }

  /**
   * Create a new event
   * @param {Object} eventData - Event data
   * @returns {Promise<Object>} - Created event
   */
  static async createEvent(eventData) {
    const events = await this.getAllEvents();
    
    const newEvent = {
      id: generateId(),
      summary: (eventData.summary || '').trim(),
      start: eventData.start,
      end: eventData.end,
      description: eventData.description || '',
      location: eventData.location || '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    events.push(newEvent);
    await writeJson(EVENTS_FILE, events);
    return newEvent;
  }

  /**
   * Update an event
   * @param {string} id - Event ID
   * @param {Object} updates - Event updates
   * @returns {Promise<Object>} - Updated event
   */
  static async updateEvent(id, updates) {
    const events = await this.getAllEvents();
    const index = events.findIndex(e => e.id === id);
    
    if (index === -1) {
      throw new Error('Event not found');
    }

    events[index] = {
      ...events[index],
      ...updates,
      summary: updates.summary ? updates.summary.trim() : events[index].summary,
      updatedAt: new Date().toISOString()
    };

    await writeJson(EVENTS_FILE, events);
    return events[index];
  }

  /**
   * Delete an event
   * @param {string} id - Event ID
   * @returns {Promise<Object>} - Deletion result
   */
  static async deleteEvent(id) {
    const events = await this.getAllEvents();
    const index = events.findIndex(e => e.id === id);
    
    if (index === -1) {
      throw new Error('Event not found');
    }

    events.splice(index, 1);
    await writeJson(EVENTS_FILE, events);
    return { message: 'Event deleted successfully', id };
  }

  /**
   * Clear all events
   * @returns {Promise<Object>} - Clear result
   */
  static async clearAllEvents() {
    await writeJson(EVENTS_FILE, []);
    return { message: 'All events cleared' };
  }
}

module.exports = CalendarModel;

