/**
 * Simple test file to demonstrate NLP Scheduler functionality
 * Run with: node tests/test.js
 */

const nlpParser = require('../src/services/nlpParser');
const conflictDetector = require('../src/services/conflictDetector');

console.log('🧪 Testing NLP Parser...\n');

// Test cases
const testCases = [
  'Schedule a meeting tomorrow at 2pm for 1 hour',
  'Add team standup Monday at 9am for 30 minutes',
  'Book doctor appointment today at 3:30pm',
  'Create project review on Tuesday at 10am',
  'Set up lunch meeting tomorrow at 12pm for 1 hour'
];

testCases.forEach((text, index) => {
  console.log(`Test ${index + 1}: "${text}"`);
  try {
    const parsed = nlpParser.parseScheduleRequest(text);
    const validation = nlpParser.validateEventData(parsed);
    
    console.log('  Parsed:', {
      summary: parsed.summary,
      start: new Date(parsed.start).toLocaleString(),
      end: new Date(parsed.end).toLocaleString(),
      duration: parsed.duration + ' minutes'
    });
    console.log('  Valid:', validation.valid);
    if (!validation.valid) {
      console.log('  Errors:', validation.errors);
    }
  } catch (error) {
    console.log('  Error:', error.message);
  }
  console.log('');
});

console.log('🧪 Testing Conflict Detector...\n');

// Mock events
const existingEvents = [
  {
    id: '1',
    summary: 'Morning Meeting',
    start: new Date('2024-01-15T09:00:00Z').toISOString(),
    end: new Date('2024-01-15T10:00:00Z').toISOString()
  },
  {
    id: '2',
    summary: 'Lunch',
    start: new Date('2024-01-15T12:00:00Z').toISOString(),
    end: new Date('2024-01-15T13:00:00Z').toISOString()
  }
];

// Test conflict detection
const newEvent = {
  summary: 'Team Sync',
  start: new Date('2024-01-15T09:30:00Z').toISOString(),
  end: new Date('2024-01-15T10:30:00Z').toISOString()
};

console.log('New Event:', {
  summary: newEvent.summary,
  start: new Date(newEvent.start).toLocaleString(),
  end: new Date(newEvent.end).toLocaleString()
});

console.log('\nExisting Events:');
existingEvents.forEach(event => {
  console.log(`  - ${event.summary}: ${new Date(event.start).toLocaleString()} to ${new Date(event.end).toLocaleString()}`);
});

const conflictCheck = conflictDetector.checkConflicts(newEvent, existingEvents);
console.log('\nConflict Check:', {
  hasConflict: conflictCheck.hasConflict,
  conflicts: conflictCheck.conflicts.length
});

if (conflictCheck.hasConflict) {
  console.log('\nConflicts:');
  conflictCheck.conflicts.forEach((conflict, i) => {
    console.log(`  ${i + 1}. ${conflict.event.summary} (${conflict.overlapType} overlap)`);
  });
  
  const suggestions = conflictDetector.suggestAlternatives(newEvent, existingEvents);
  console.log('\nSuggestions:');
  suggestions.forEach((suggestion, i) => {
    console.log(`  ${i + 1}. ${new Date(suggestion.start).toLocaleString()} - ${new Date(suggestion.end).toLocaleString()} (${suggestion.reason})`);
  });
} else {
  console.log('\n✅ No conflicts detected!');
}

console.log('\n✅ Tests completed!');

