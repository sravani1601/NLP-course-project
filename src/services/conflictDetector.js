/**
 * Conflict Detection Service
 * Detects scheduling conflicts between events
 */
class ConflictDetector {
  /**
   * Check if two time ranges overlap
   * @param {Date} start1 - Start of first event
   * @param {Date} end1 - End of first event
   * @param {Date} start2 - Start of second event
   * @param {Date} end2 - End of second event
   * @returns {boolean} - True if events overlap
   */
  eventsOverlap(start1, end1, start2, end2) {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();

    // Events overlap if: start1 < end2 AND start2 < end1
    return s1 < e2 && s2 < e1;
  }

  /**
   * Check if a new event conflicts with existing events
   * @param {Object} newEvent - New event to check
   * @param {Array} existingEvents - Array of existing events
   * @returns {Object} - { hasConflict: boolean, conflicts: Array }
   */
  checkConflicts(newEvent, existingEvents) {
    const conflicts = [];
    const newStart = new Date(newEvent.start);
    const newEnd = new Date(newEvent.end);

    for (const existingEvent of existingEvents) {
      // Skip the same event if updating
      if (newEvent.id && existingEvent.id === newEvent.id) {
        continue;
      }

      const existingStart = new Date(existingEvent.start);
      const existingEnd = new Date(existingEvent.end);

      if (this.eventsOverlap(newStart, newEnd, existingStart, existingEnd)) {
        conflicts.push({
          event: existingEvent,
          overlapType: this.getOverlapType(newStart, newEnd, existingStart, existingEnd)
        });
      }
    }

    return {
      hasConflict: conflicts.length > 0,
      conflicts
    };
  }

  /**
   * Determine the type of overlap between two events
   * @param {Date} start1 - Start of first event
   * @param {Date} end1 - End of first event
   * @param {Date} start2 - Start of second event
   * @param {Date} end2 - End of second event
   * @returns {string} - Type of overlap: 'full', 'partial-start', 'partial-end', 'contains'
   */
  getOverlapType(start1, end1, start2, end2) {
    const s1 = new Date(start1).getTime();
    const e1 = new Date(end1).getTime();
    const s2 = new Date(start2).getTime();
    const e2 = new Date(end2).getTime();

    // New event completely contains existing event
    if (s1 <= s2 && e1 >= e2) {
      return 'contains';
    }

    // Existing event completely contains new event
    if (s2 <= s1 && e2 >= e1) {
      return 'full';
    }

    // New event overlaps at the start of existing event
    if (s1 < s2 && e1 > s2 && e1 < e2) {
      return 'partial-start';
    }

    // New event overlaps at the end of existing event
    if (s1 > s2 && s1 < e2 && e1 > e2) {
      return 'partial-end';
    }

    return 'partial';
  }

  /**
   * Suggest alternative times for a conflicting event
   * @param {Object} newEvent - New event that conflicts
   * @param {Array} existingEvents - Array of existing events
   * @param {Object} options - Options for suggestions
   * @returns {Array} - Array of suggested alternative times
   */
  suggestAlternatives(newEvent, existingEvents, options = {}) {
    const suggestions = [];
    const duration = new Date(newEvent.end) - new Date(newEvent.start);
    const conflictResult = this.checkConflicts(newEvent, existingEvents);

    if (!conflictResult.hasConflict) {
      return suggestions;
    }

    // Sort conflicts by start time
    const sortedConflicts = conflictResult.conflicts
      .map(c => c.event)
      .sort((a, b) => new Date(a.start) - new Date(b.start));

    // Find gaps between events
    for (let i = 0; i < sortedConflicts.length; i++) {
      const conflict = sortedConflicts[i];
      const conflictEnd = new Date(conflict.end);

      // Check if there's a gap after this conflict
      if (i < sortedConflicts.length - 1) {
        const nextConflict = sortedConflicts[i + 1];
        const nextStart = new Date(nextConflict.start);
        const gapDuration = nextStart - conflictEnd;

        if (gapDuration >= duration) {
          suggestions.push({
            start: conflictEnd.toISOString(),
            end: new Date(conflictEnd.getTime() + duration).toISOString(),
            reason: `After "${conflict.summary}"`
          });
        }
      }
    }

    // Suggest time before first conflict
    if (sortedConflicts.length > 0) {
      const firstConflict = sortedConflicts[0];
      const firstStart = new Date(firstConflict.start);
      const suggestedStart = new Date(firstStart.getTime() - duration);

      // Only suggest if it's in the future
      if (suggestedStart > new Date()) {
        suggestions.push({
          start: suggestedStart.toISOString(),
          end: firstStart.toISOString(),
          reason: `Before "${firstConflict.summary}"`
        });
      }
    }

    // Suggest time after last conflict
    if (sortedConflicts.length > 0) {
      const lastConflict = sortedConflicts[sortedConflicts.length - 1];
      const lastEnd = new Date(lastConflict.end);
      const suggestedStart = lastEnd;

      suggestions.push({
        start: suggestedStart.toISOString(),
        end: new Date(suggestedStart.getTime() + duration).toISOString(),
        reason: `After "${lastConflict.summary}"`
      });
    }

    return suggestions.slice(0, options.maxSuggestions || 3);
  }

  /**
   * Check if event can be rescheduled to avoid conflicts
   * @param {Object} event - Event to reschedule
   * @param {Array} existingEvents - Array of existing events
   * @param {Date} newStart - New start time
   * @param {number} duration - Duration in milliseconds
   * @returns {Object} - { canReschedule: boolean, conflicts: Array }
   */
  checkReschedule(event, existingEvents, newStart, duration) {
    const newEnd = new Date(newStart.getTime() + duration);
    const rescheduledEvent = {
      ...event,
      start: newStart.toISOString(),
      end: newEnd.toISOString()
    };

    return this.checkConflicts(rescheduledEvent, existingEvents);
  }
}

module.exports = new ConflictDetector();

