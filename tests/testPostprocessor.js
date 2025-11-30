/**
 * Test file for planPostprocessor
 * Run with: node tests/testPostprocessor.js
 */

const { sanitizeJSON, normalizeTime, normalizeDate, postprocessPlan } = require('../src/services/planPostprocessor');

console.log('🧪 Testing JSON Sanitization...\n');

// Test 1: Valid JSON
console.log('Test 1: Valid JSON');
try {
  const valid = '{"test": "value"}';
  const result = sanitizeJSON(valid);
  console.log('✅ Passed:', result === valid);
} catch (e) {
  console.log('❌ Failed:', e.message);
}

// Test 2: JSON in markdown code block
console.log('\nTest 2: JSON in markdown code block');
try {
  const withMarkdown = '```json\n{"test": "value"}\n```';
  const result = sanitizeJSON(withMarkdown);
  const parsed = JSON.parse(result);
  console.log('✅ Passed:', parsed.test === 'value');
} catch (e) {
  console.log('❌ Failed:', e.message);
}

// Test 3: JSON with trailing comma
console.log('\nTest 3: JSON with trailing comma');
try {
  const withTrailing = '{"test": "value",}';
  const result = sanitizeJSON(withTrailing);
  const parsed = JSON.parse(result);
  console.log('✅ Passed:', parsed.test === 'value');
} catch (e) {
  console.log('❌ Failed:', e.message);
}

console.log('\n🧪 Testing Time Normalization...\n');

// Test 4: 12-hour format with AM
console.log('Test 4: 12-hour format (AM)');
try {
  const result = normalizeTime('7:30 AM');
  console.log('✅ Passed:', result === '07:30');
} catch (e) {
  console.log('❌ Failed:', e.message);
}

// Test 5: 12-hour format with PM
console.log('\nTest 5: 12-hour format (PM)');
try {
  const result = normalizeTime('2:45 PM');
  console.log('✅ Passed:', result === '14:45');
} catch (e) {
  console.log('❌ Failed:', e.message);
}

// Test 6: 24-hour format
console.log('\nTest 6: 24-hour format');
try {
  const result = normalizeTime('14:30');
  console.log('✅ Passed:', result === '14:30');
} catch (e) {
  console.log('❌ Failed:', e.message);
}

console.log('\n🧪 Testing Date Normalization...\n');

// Test 7: Date normalization
console.log('Test 7: Date normalization');
try {
  const result = normalizeDate('2024-01-15');
  console.log('✅ Passed:', result.includes('2024-01-15'));
} catch (e) {
  console.log('❌ Failed:', e.message);
}

console.log('\n🧪 Testing Full Plan Postprocessing...\n');

// Test 8: Full plan postprocessing
console.log('Test 8: Full plan postprocessing');
try {
  const mockLLMOutput = JSON.stringify({
    weekly_plan: [
      { day: "Monday", time: "7:00 AM", activity: "Morning run" },
      { day: "Wednesday", time: "7:00 AM", activity: "Morning run" }
    ],
    milestones: [
      { date: "2024-01-15", goal: "Run 5k" }
    ]
  });

  const result = postprocessPlan(mockLLMOutput);
  console.log('✅ Passed:', 
    result.weekly_plan.length === 2 &&
    result.weekly_plan[0].weekdayIndex === 0 &&
    result.weekly_plan[0].time === '07:00' &&
    result.milestones.length === 1
  );
  console.log('Result:', JSON.stringify(result, null, 2));
} catch (e) {
  console.log('❌ Failed:', e.message);
}

console.log('\n✅ All tests completed!');

