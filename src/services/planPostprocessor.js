/**
 * JSON Sanitization and Validation Utilities
 * 
 * This module provides utilities to validate and normalize JSON responses from LLMs
 * before they are stored in the database. It handles common LLM output issues like:
 * - Markdown code blocks wrapping JSON
 * - Trailing commas
 * - Inconsistent date/time formats
 * - Extra whitespace
 */

/**
 * Sanitize and extract JSON from LLM response
 * @param {string} raw - Raw text that may contain JSON
 * @returns {string} - Clean JSON string ready for parsing
 * @throws {Error} - If JSON cannot be extracted or repaired
 */
function sanitizeJSON(raw) {
  console.log('🧹 [SANITIZE] Starting JSON sanitization...');
  console.log('📥 [SANITIZE] Raw input length:', raw.length);
  
  // First, try to parse as-is
  try {
    JSON.parse(raw);
    console.log('✅ [SANITIZE] JSON is already valid, no sanitization needed');
    return raw; // Already valid JSON
  } catch (e) {
    console.log('⚠️  [SANITIZE] Initial parse failed, attempting sanitization...');
  }

  let sanitized = raw;

  // Extract JSON from markdown code blocks
  const codeBlockMatch = sanitized.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    console.log('🔍 [SANITIZE] Found markdown code block, extracting...');
    sanitized = codeBlockMatch[1].trim();
  }

  // Try parsing after code block extraction
  try {
    JSON.parse(sanitized);
    console.log('✅ [SANITIZE] JSON valid after markdown extraction');
    return sanitized;
  } catch (e) {
    console.log('⚠️  [SANITIZE] Still invalid, trying trailing comma removal...');
  }

  // Remove trailing commas before closing brackets/braces
  // This regex handles trailing commas before ] or }
  sanitized = sanitized.replace(/,(\s*[}\]])/g, '$1');

  // Try parsing after trailing comma removal
  try {
    JSON.parse(sanitized);
    console.log('✅ [SANITIZE] JSON valid after trailing comma removal');
    return sanitized;
  } catch (e) {
    // If still invalid, throw descriptive error
    console.log('❌ [SANITIZE] Failed to sanitize JSON:', e.message);
    throw new Error("Failed to parse JSON: " + e.message);
  }
}

/**
 * Normalize time string to 24-hour HH:MM format
 * @param {string} time - Time in various formats (e.g., "2:30 PM", "14:30", "2pm")
 * @returns {string} - Time in HH:MM format
 * @throws {Error} - If time format is invalid
 */
function normalizeTime(time) {
  console.log('⏰ [TIME] Normalizing time:', time);
  
  // Remove all whitespace before processing
  let t = time.replace(/\s+/g, "").toLowerCase();

  // Handle 12-hour format (AM/PM)
  if (t.includes("am") || t.includes("pm")) {
    const isPM = t.includes("pm");
    
    // Remove am/pm to get the time part
    let timePart = t.replace(/am|pm/g, "");
    
    // Parse hours and minutes
    let hours, minutes;
    if (timePart.includes(":")) {
      const parts = timePart.split(":");
      hours = parseInt(parts[0], 10);
      minutes = parseInt(parts[1], 10);
    } else {
      // Handle times without minutes (e.g., "2pm")
      hours = parseInt(timePart, 10);
      minutes = 0;
    }
    
    // Validate parsed values
    if (isNaN(hours) || isNaN(minutes) || hours < 1 || hours > 12 || minutes < 0 || minutes > 59) {
      throw new Error("Invalid time: " + time);
    }
    
    // Convert to 24-hour format
    if (isPM && hours !== 12) {
      hours += 12;
    } else if (!isPM && hours === 12) {
      hours = 0;
    }
    
    // Format as HH:MM with leading zeros
    const formattedHours = String(hours).padStart(2, "0");
    const formattedMinutes = String(minutes).padStart(2, "0");
    const result = `${formattedHours}:${formattedMinutes}`;
    console.log('✅ [TIME] Converted 12-hour to 24-hour:', time, '→', result);
    return result;
  }

  // Handle 24-hour format
  // Support both HH:MM and H:MM formats
  const timeMatch = t.match(/^(\d{1,2}):(\d{2})$/);
  if (timeMatch) {
    const hours = parseInt(timeMatch[1], 10);
    const minutes = parseInt(timeMatch[2], 10);
    
    // Validate HH:MM format
    if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
      console.log('❌ [TIME] Invalid 24-hour time:', time);
      throw new Error("Invalid time: " + time);
    }
    
    // Format with leading zeros
    const formattedHours = String(hours).padStart(2, "0");
    const formattedMinutes = String(minutes).padStart(2, "0");
    const result = `${formattedHours}:${formattedMinutes}`;
    console.log('✅ [TIME] Formatted 24-hour time:', time, '→', result);
    return result;
  }

  console.log('❌ [TIME] Unrecognized time format:', time);
  throw new Error("Invalid time: " + time);
}

/**
 * Normalize date string to ISO 8601 format
 * @param {string} dateString - Date in any parseable format
 * @returns {string} - Date in ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
 * @throws {Error} - If date is invalid or unparseable
 */
function normalizeDate(dateString) {
  console.log('📅 [DATE] Normalizing date:', dateString);
  
  // Attempt to parse the date string
  const parsedDate = new Date(dateString);
  
  // Validate that the parsed date is valid
  if (isNaN(parsedDate.getTime())) {
    console.log('❌ [DATE] Invalid date:', dateString);
    throw new Error("Invalid date: " + dateString);
  }
  
  // Convert to full ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)
  const result = parsedDate.toISOString();
  console.log('✅ [DATE] Converted to ISO 8601:', dateString, '→', result);
  return result;
}

/**
 * Validate and normalize LLM JSON response for goals/tasks/events
 * This is a general-purpose validator that can be used before storing data in the database
 * 
 * @param {string} raw - Raw JSON string from LLM
 * @returns {Object} - Validated and normalized data
 * @throws {Error} - If validation fails
 */
function validateLLMResponse(raw) {
  let data;
  try {
    const sanitized = sanitizeJSON(raw);
    data = JSON.parse(sanitized);
  } catch (e) {
    // Preserve descriptive error message from sanitizeJSON
    if (e.message.startsWith("Failed to parse JSON:")) {
      throw e; // Re-throw with original descriptive message
    }
    throw new Error("Model returned invalid JSON: " + e.message);
  }

  // Trim all text fields to remove extra whitespace
  if (data.title) data.title = data.title.trim();
  if (data.description) data.description = data.description.trim();
  if (data.activity) data.activity = data.activity.trim();
  if (data.goal) data.goal = data.goal.trim();
  if (data.text) data.text = data.text.trim();

  // Normalize dates if present
  if (data.date) {
    data.date = normalizeDate(data.date);
  }
  if (data.deadline) {
    data.deadline = normalizeDate(data.deadline);
  }
  if (data.target_date) {
    data.target_date = normalizeDate(data.target_date);
  }

  // Normalize times if present
  if (data.time) {
    data.time = normalizeTime(data.time);
  }
  if (data.start_time) {
    data.start_time = normalizeTime(data.start_time);
  }
  if (data.end_time) {
    data.end_time = normalizeTime(data.end_time);
  }

  // Normalize milestones array if present
  if (Array.isArray(data.milestones)) {
    data.milestones = data.milestones.map((ms) => {
      const normalized = { ...ms };
      if (normalized.text) normalized.text = normalized.text.trim();
      if (normalized.goal) normalized.goal = normalized.goal.trim();
      if (normalized.date) normalized.date = normalizeDate(normalized.date);
      return normalized;
    });
  }

  return data;
}

/**
 * Legacy function for backward compatibility with /api/plan route
 * Validates and normalizes weekly plan data from LLM
 * @param {string} raw - Raw JSON string from LLM
 * @returns {Object} - Normalized plan with weekly_plan and milestones
 */
function postprocessPlan(raw) {
  console.log('\n🚀 [POSTPROCESS] Starting plan post-processing...');
  console.log('📥 [POSTPROCESS] Raw LLM output:', raw.substring(0, 200) + '...');
  
  let data;
  let metadata = null;
  
  try {
    const sanitized = sanitizeJSON(raw);
    data = JSON.parse(sanitized);
    console.log('✅ [POSTPROCESS] JSON parsed successfully');
    
    // Extract metadata if present (from Python service)
    if (data.metadata) {
      metadata = data.metadata;
      // Use the output field if present (Python format)
      if (data.output) {
        data = data.output;
      }
    }
  } catch (e) {
    console.log('❌ [POSTPROCESS] JSON parsing failed:', e.message);
    if (e.message.startsWith("Failed to parse JSON:")) {
      throw e;
    }
    throw new Error("Model returned invalid JSON: " + e.message);
  }

  if (!data.weekly_plan || !data.milestones) {
    console.log('❌ [POSTPROCESS] Missing required fields');
    console.log('   Has weekly_plan:', !!data.weekly_plan);
    console.log('   Has milestones:', !!data.milestones);
    throw new Error("Missing weekly_plan or milestones");
  }
  
  console.log('📋 [POSTPROCESS] Processing', data.weekly_plan.length, 'weekly activities');
  console.log('🎯 [POSTPROCESS] Processing', data.milestones.length, 'milestones');

  // Normalize day names to weekday indices
  const normalizeDay = (day) => {
    const days = {
      monday: 0, mon: 0,
      tuesday: 1, tue: 1,
      wednesday: 2, wed: 2,
      thursday: 3, thu: 3,
      friday: 4, fri: 4,
      saturday: 5, sat: 5,
      sunday: 6, sun: 6,
    };
    const key = day.trim().toLowerCase();
    if (!(key in days)) throw new Error("Invalid day: " + day);
    return days[key];
  };

  const weekly = data.weekly_plan.map((item, index) => {
    console.log(`\n📌 [POSTPROCESS] Processing activity ${index + 1}/${data.weekly_plan.length}`);
    console.log('   Day:', item.day);
    console.log('   Time:', item.time || item.start_time);
    console.log('   Activity:', item.activity || item.task_name);
    
    // Handle both 'activity' and 'task_name' fields
    const activity = (item.activity || item.task_name || '').trim();
    const time = item.time || item.start_time || '09:00';
    
    // Preserve all fields from Python model output
    const processed = {
      weekdayIndex: normalizeDay(item.day),
      time: normalizeTime(time),
      activity: activity,
    };
    
    // Preserve additional fields if present
    if (item.duration_minutes !== undefined) {
      processed.duration_minutes = item.duration_minutes;
    }
    if (item.recurrence) {
      processed.recurrence = item.recurrence;
    }
    if (item.location) {
      processed.location = item.location;
    }
    if (item.notes) {
      processed.notes = item.notes;
    }
    
    return processed;
  });

  const milestones = data.milestones.map((ms, index) => {
    console.log(`\n🎯 [POSTPROCESS] Processing milestone ${index + 1}/${data.milestones.length}`);
    console.log('   Date:', ms.date);
    console.log('   Goal:', ms.goal);
    
    return {
      date: normalizeDate(ms.date),
      goal: ms.goal.trim(),
    };
  });

  console.log('\n✅ [POSTPROCESS] Post-processing complete!');
  console.log('📊 [POSTPROCESS] Result:', JSON.stringify({ weekly_plan: weekly, milestones }, null, 2));
  
  const result = { weekly_plan: weekly, milestones };
  
  // Include metadata if available
  if (metadata) {
    result.metadata = metadata;
  }
  
  return result;
}

module.exports = { 
  sanitizeJSON,
  normalizeTime,
  normalizeDate,
  validateLLMResponse,
  postprocessPlan
};

