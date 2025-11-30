const { spawn } = require('child_process');
const path = require('path');

/**
 * Call Hugging Face model for plan generation via Python service
 * @param {string} userGoal - User's goal description
 * @param {Object} options - Optional parameters
 * @param {Object} options.profile - User profile (chronotype, timezone, preferences)
 * @param {Array} options.busyIntervals - Array of busy interval strings
 * @returns {Promise<string>} - Raw JSON string from LLM
 */
async function callChatGPTForPlan(userGoal, options = {}) {
  const { profile, busyIntervals, modelName } = options;
  
  console.log('🤖 [LLM] Generating plan for goal:', userGoal);
  
  // Check if Python is available
  return new Promise((resolve, reject) => {
    const pythonScript = path.join(__dirname, 'planner_model.py');
    
    // Prepare input data
    const inputData = {
      goal: userGoal,
      profile: profile || {
        user_id: null,
        chronotype: 'neutral',
        timezone: 'UTC',
        preferences: {}
      },
      busy_intervals: busyIntervals || [],
      model_name: modelName || process.env.HF_MODEL || 'google/gemma-2-2b-it'
    };
    
    // Spawn Python process
    const pythonProcess = spawn('python3', [pythonScript], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    // Send input data
    pythonProcess.stdin.write(JSON.stringify(inputData));
    pythonProcess.stdin.end();
    
    // Collect stdout
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    // Collect stderr
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('🐍 [Python]', data.toString());
    });
    
    // Handle process completion
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('❌ [Python] Process exited with code:', code);
        console.error('❌ [Python] stderr:', stderr);
        
        // Fallback to mock if Python fails
        console.log('⚠️  [LLM] Falling back to mock response');
        const mockResponse = JSON.stringify({
          weekly_plan: [
            {
              day: "Monday",
              time: "7:00 AM",
              activity: "Morning run"
            },
            {
              day: "Wednesday",
              time: "7:00 AM",
              activity: "Morning run"
            },
            {
              day: "Friday",
              time: "7:00 AM",
              activity: "Morning run"
            }
          ],
          milestones: [
            {
              date: "2024-01-15",
              goal: "Run 5k without stopping"
            },
            {
              date: "2024-02-15",
              goal: "Run 10k"
            }
          ]
        }, null, 2);
        return resolve(mockResponse);
      }
      
      try {
        const result = JSON.parse(stdout);
        
        if (result.success && result.output) {
          // Return the full format matching Python output
          // Keep all fields: task_name, start_time, duration_minutes, recurrence, location, notes
          const formattedPlan = {
            weekly_plan: result.output.weekly_plan || [],
            milestones: result.output.milestones || []
          };
          
          // Also include metadata if available
          if (result.metadata) {
            formattedPlan.metadata = result.metadata;
          }
          
          console.log('✅ [LLM] Plan generated successfully');
          console.log('📊 [LLM] Conflicts before:', result.metadata?.conflicts_before || 0);
          console.log('📊 [LLM] Conflicts after:', result.metadata?.conflicts_after || 0);
          resolve(JSON.stringify(formattedPlan, null, 2));
        } else {
          console.error('❌ [LLM] Model returned error:', result.error);
          // Fallback to mock
          const mockResponse = JSON.stringify({
            weekly_plan: [
              { day: "Monday", time: "7:00 AM", activity: "Morning run" }
            ],
            milestones: [{ date: "2024-01-15", goal: "Run 5k" }]
          }, null, 2);
          resolve(mockResponse);
        }
      } catch (parseError) {
        console.error('❌ [LLM] Failed to parse Python output:', parseError);
        console.error('Raw output:', stdout);
        // Fallback to mock
        const mockResponse = JSON.stringify({
          weekly_plan: [
            { day: "Monday", time: "7:00 AM", activity: "Morning run" }
          ],
          milestones: [{ date: "2024-01-15", goal: "Run 5k" }]
        }, null, 2);
        resolve(mockResponse);
      }
    });
    
    // Handle process errors
    pythonProcess.on('error', (error) => {
      console.error('❌ [Python] Failed to start process:', error.message);
      console.log('⚠️  [LLM] Python not available, falling back to mock');
      
      // Fallback to mock if Python is not available
      const mockResponse = JSON.stringify({
        weekly_plan: [
          { day: "Monday", time: "7:00 AM", activity: "Morning run" }
        ],
        milestones: [{ date: "2024-01-15", goal: "Run 5k" }]
      }, null, 2);
      resolve(mockResponse);
    });
  });
}

module.exports = {
  callChatGPTForPlan
};

