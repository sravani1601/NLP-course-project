# NLP Calendar Scheduler

A minimal NLP-powered calendar scheduling system with conflict detection, built with Node.js and Express. Now integrated with Hugging Face models via Python.

## Features

- **Natural Language Processing**: Parse scheduling requests from plain English
- **Conflict Detection**: Automatically detect scheduling conflicts
- **Alternative Suggestions**: Get suggested times when conflicts occur
- **Hugging Face Integration**: Uses Python-based HF models for plan generation
- **Minimal Setup**: Simple file-based storage (no database required)

## Installation

### Node.js Dependencies

```bash
npm install
```

### Python Dependencies (for Hugging Face model)

```bash
pip install -r requirements.txt
```

Or install manually:
```bash
pip install torch transformers accelerate
```

## Environment Variables

Create a `.env` file (optional):

```env
PORT=3000
CLIENT_URL=http://localhost:3000
HF_MODEL=google/gemma-2-2b-it  # Hugging Face model name
HF_TOKEN=your_huggingface_token  # Optional, for private models
```

## Usage

### Start the server

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

The server will run on `http://localhost:3000` by default (configurable via `PORT` environment variable).

## API Endpoints

### Schedule an Event

**POST** `/api/schedule`

Schedule an event from natural language text.

**Request Body:**
```json
{
  "text": "Schedule a meeting tomorrow at 2pm for 1 hour",
  "force": false  // Optional: set to true to schedule despite conflicts
}
```

**Response (Success):**
```json
{
  "success": true,
  "event": {
    "id": "abc123",
    "summary": "Meeting",
    "start": "2024-01-15T14:00:00.000Z",
    "end": "2024-01-15T15:00:00.000Z",
    "description": "Schedule a meeting tomorrow at 2pm for 1 hour",
    "createdAt": "2024-01-14T10:00:00.000Z"
  },
  "conflicts": [],
  "message": "Event scheduled successfully"
}
```

**Response (Conflict):**
```json
{
  "error": "Scheduling conflict detected",
  "conflicts": [
    {
      "event": {
        "id": "xyz789",
        "summary": "Existing Meeting",
        "start": "2024-01-15T14:00:00.000Z",
        "end": "2024-01-15T15:00:00.000Z"
      },
      "overlapType": "full"
    }
  ],
  "suggestions": [
    {
      "start": "2024-01-15T15:00:00.000Z",
      "end": "2024-01-15T16:00:00.000Z",
      "reason": "After \"Existing Meeting\""
    }
  ],
  "parsedEvent": { ... }
}
```

### Generate Plan from Goal

**POST** `/api/plan`

Generate a weekly plan with milestones from a goal description. Uses Hugging Face model with JSON postprocessing.

**Request Body:**
```json
{
  "goal": "I want to run 3 times a week early morning and train to run 10k in 8 weeks",
  "profile": {
    "chronotype": "morning",
    "timezone": "UTC",
    "preferences": {}
  },
  "busy_intervals": ["2024-01-15T09:00:00Z/2024-01-15T17:00:00Z"],
  "model_name": "google/gemma-2-2b-it"
}
```

**Response:**
```json
{
  "success": true,
  "plan": {
    "weekly_plan": [
      {
        "weekdayIndex": 0,
        "time": "07:00",
        "activity": "Morning run"
      },
      {
        "weekdayIndex": 2,
        "time": "07:00",
        "activity": "Morning run"
      }
    ],
    "milestones": [
      {
        "date": "2024-01-15T00:00:00.000Z",
        "goal": "Run 5k without stopping"
      }
    ]
  }
}
```

**Features:**
- JSON sanitization (handles markdown code blocks, trailing commas)
- Time normalization (12-hour to 24-hour format)
- Date normalization (ISO 8601 format)
- Day name normalization (Monday → weekdayIndex 0)
- Text trimming and validation
- Falls back to mock response if Python/HF model unavailable

### Check for Conflicts

**POST** `/api/schedule/check-conflicts`

Check if a scheduling request would conflict with existing events without actually scheduling.

**Request Body:**
```json
{
  "text": "Meeting tomorrow at 2pm for 1 hour"
}
```

### Parse Natural Language

**POST** `/api/schedule/parse`

Parse natural language text into structured event data without scheduling.

**Request Body:**
```json
{
  "text": "Team standup Monday at 9am for 30 minutes"
}
```

**Response:**
```json
{
  "parsed": {
    "summary": "Team standup",
    "start": "2024-01-15T09:00:00.000Z",
    "end": "2024-01-15T09:30:00.000Z",
    "description": "Team standup Monday at 9am for 30 minutes",
    "duration": 30
  },
  "validation": {
    "valid": true,
    "errors": []
  }
}
```

### Get All Events

**GET** `/api/schedule/events`

Get all scheduled events, optionally filtered by date range.

**Query Parameters:**
- `start` (optional): Start date (ISO string)
- `end` (optional): End date (ISO string)

### Get Event by ID

**GET** `/api/schedule/events/:id`

Get a specific event by its ID.

### Delete Event

**DELETE** `/api/schedule/events/:id`

Delete an event by its ID.

## Natural Language Examples

The NLP parser supports various natural language formats:

- `"Schedule a meeting tomorrow at 2pm for 1 hour"`
- `"Add team standup Monday at 9am for 30 minutes"`
- `"Book doctor appointment today at 3:30pm"`
- `"Create project review on Tuesday at 10am"`
- `"Set up lunch meeting tomorrow at 12pm for 1 hour"`

### Supported Time Formats

- **Relative dates**: `today`, `tomorrow`, `Monday`, `Tuesday`, etc.
- **Time formats**: 
  - `2pm`, `2:30pm`, `14:00`, `14:30`
  - `at 2pm`, `at 2:30pm`
- **Duration formats**:
  - `1 hour`, `30 minutes`, `1h 30m`
  - `2 hours`, `90 minutes`

## Project Structure

```
nlp-scheduler/
├── src/
│   ├── models/
│   │   └── Calendar.js          # File-based calendar storage
│   ├── services/
│   │   ├── nlpParser.js         # NLP parsing service
│   │   ├── conflictDetector.js  # Conflict detection service
│   │   ├── planPostprocessor.js # JSON sanitization & validation
│   │   ├── chatActionService.js # LLM integration service
│   │   └── planner_model.py     # Python HF model service
│   ├── routes/
│   │   ├── scheduleRoutes.js    # Schedule API routes
│   │   └── planRoutes.js        # Plan generation routes
│   ├── data/                    # Data storage (auto-created)
│   │   └── events.json
│   └── index.js                 # Main server file
├── public/
│   └── index.html              # Web UI
├── tests/                       # Test files
│   ├── test.js                  # Basic functionality tests
│   └── testPostprocessor.js    # Postprocessor tests
├── requirements.txt            # Python dependencies
├── package.json
└── README.md
```

## Differences from AlthyPlanner

This project uses a **minimal setup** compared to AlthyPlanner:

- ✅ File-based storage (no database required)
- ✅ No authentication (single-user)
- ✅ No external calendar integrations
- ✅ Focused on NLP parsing and conflict detection
- ✅ Simplified event model
- ✅ Minimal dependencies (Express, Natural, CORS, dotenv)
- ✅ Python integration for Hugging Face models

## Testing

Example API calls using curl:

```bash
# Schedule an event
curl -X POST http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{"text": "Schedule a meeting tomorrow at 2pm for 1 hour"}'

# Check for conflicts
curl -X POST http://localhost:3000/api/schedule/check-conflicts \
  -H "Content-Type: application/json" \
  -d '{"text": "Meeting tomorrow at 2pm"}'

# Get all events
curl http://localhost:3000/api/schedule/events

# Generate plan from goal
curl -X POST http://localhost:3000/api/plan \
  -H "Content-Type: application/json" \
  -d '{"goal": "I want to run 3 times a week early morning and train to run 10k in 8 weeks"}'
```

### Run Tests

```bash
# Test basic functionality
node tests/test.js

# Test postprocessor
node tests/testPostprocessor.js
```

## Hugging Face Model Setup

The project uses a Python service to call Hugging Face models. The default model is `google/gemma-2-2b-it`, but you can specify a different model:

1. Set `HF_MODEL` environment variable
2. Or pass `model_name` in the API request

The Python service will:
- Load the model on first use
- Generate plans based on goals
- Handle JSON parsing and validation
- Fall back gracefully if Python/model unavailable

## License

MIT
