const express = require('express');
const router = express.Router();
const Calendar = require('../models/Calendar');
const nlpParser = require('../services/nlpParser');
const conflictDetector = require('../services/conflictDetector');

/**
 * POST /api/schedule
 * Schedule an event from natural language
 * Body: { text: string, force: boolean (optional) }
 */
router.post('/', async (req, res) => {
  try {
    const { text, force } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'Text is required',
        message: 'Please provide a natural language scheduling request'
      });
    }

    // Parse the natural language request
    const parsedEvent = nlpParser.parseScheduleRequest(text);

    // Validate parsed data
    const validation = nlpParser.validateEventData(parsedEvent);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid event data',
        errors: validation.errors,
        parsed: parsedEvent
      });
    }

    // Check for conflicts
    const existingEvents = await Calendar.getAllEvents();
    const conflictCheck = conflictDetector.checkConflicts(parsedEvent, existingEvents);

    // If conflicts exist and force is not true, return conflict information
    if (conflictCheck.hasConflict && !force) {
      const suggestions = conflictDetector.suggestAlternatives(parsedEvent, existingEvents, {
        maxSuggestions: 3
      });

      return res.status(409).json({
        error: 'Scheduling conflict detected',
        conflicts: conflictCheck.conflicts.map(c => ({
          event: {
            id: c.event.id,
            summary: c.event.summary,
            start: c.event.start,
            end: c.event.end
          },
          overlapType: c.overlapType
        })),
        suggestions: suggestions,
        parsedEvent: parsedEvent,
        message: 'Use force=true to schedule anyway, or choose one of the suggested times'
      });
    }

    // Create the event
    const createdEvent = await Calendar.createEvent(parsedEvent);

    res.json({
      success: true,
      event: createdEvent,
      conflicts: conflictCheck.hasConflict ? conflictCheck.conflicts : [],
      message: conflictCheck.hasConflict 
        ? 'Event scheduled despite conflicts (force=true was used)'
        : 'Event scheduled successfully'
    });
  } catch (error) {
    console.error('Error scheduling event:', error);
    res.status(500).json({
      error: 'Failed to schedule event',
      message: error.message
    });
  }
});

/**
 * POST /api/schedule/check-conflicts
 * Check for conflicts without scheduling
 * Body: { text: string }
 */
router.post('/check-conflicts', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'Text is required'
      });
    }

    // Parse the natural language request
    const parsedEvent = nlpParser.parseScheduleRequest(text);

    // Validate parsed data
    const validation = nlpParser.validateEventData(parsedEvent);
    if (!validation.valid) {
      return res.status(400).json({
        error: 'Invalid event data',
        errors: validation.errors,
        parsed: parsedEvent
      });
    }

    // Check for conflicts
    const existingEvents = await Calendar.getAllEvents();
    const conflictCheck = conflictDetector.checkConflicts(parsedEvent, existingEvents);

    const suggestions = conflictCheck.hasConflict
      ? conflictDetector.suggestAlternatives(parsedEvent, existingEvents, {
          maxSuggestions: 5
        })
      : [];

    res.json({
      hasConflict: conflictCheck.hasConflict,
      conflicts: conflictCheck.conflicts.map(c => ({
        event: {
          id: c.event.id,
          summary: c.event.summary,
          start: c.event.start,
          end: c.event.end
        },
        overlapType: c.overlapType
      })),
      suggestions: suggestions,
      parsedEvent: parsedEvent
    });
  } catch (error) {
    console.error('Error checking conflicts:', error);
    res.status(500).json({
      error: 'Failed to check conflicts',
      message: error.message
    });
  }
});

/**
 * POST /api/schedule/parse
 * Parse natural language without scheduling
 * Body: { text: string }
 */
router.post('/parse', async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || typeof text !== 'string') {
      return res.status(400).json({ 
        error: 'Text is required'
      });
    }

    // Parse the natural language request
    const parsedEvent = nlpParser.parseScheduleRequest(text);

    // Validate parsed data
    const validation = nlpParser.validateEventData(parsedEvent);

    res.json({
      parsed: parsedEvent,
      validation: validation
    });
  } catch (error) {
    console.error('Error parsing text:', error);
    res.status(500).json({
      error: 'Failed to parse text',
      message: error.message
    });
  }
});

/**
 * GET /api/schedule/events
 * Get all scheduled events
 */
router.get('/events', async (req, res) => {
  try {
    const { start, end } = req.query;
    
    let events;
    if (start && end) {
      events = await Calendar.getEventsByDateRange(new Date(start), new Date(end));
    } else {
      events = await Calendar.getAllEvents();
    }

    res.json({ events });
  } catch (error) {
    console.error('Error fetching events:', error);
    res.status(500).json({
      error: 'Failed to fetch events',
      message: error.message
    });
  }
});

/**
 * GET /api/schedule/events/:id
 * Get a specific event
 */
router.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const event = await Calendar.getEventById(id);

    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ event });
  } catch (error) {
    console.error('Error fetching event:', error);
    res.status(500).json({
      error: 'Failed to fetch event',
      message: error.message
    });
  }
});

/**
 * DELETE /api/schedule/events/:id
 * Delete an event
 */
router.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await Calendar.deleteEvent(id);
    res.json(result);
  } catch (error) {
    if (error.message === 'Event not found') {
      return res.status(404).json({ error: 'Event not found' });
    }
    console.error('Error deleting event:', error);
    res.status(500).json({
      error: 'Failed to delete event',
      message: error.message
    });
  }
});

module.exports = router;

