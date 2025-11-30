# Usage Examples

## Example API Calls

### 1. Schedule an Event (No Conflicts)

```bash
curl -X POST http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule a team meeting tomorrow at 2pm for 1 hour"
  }'
```

**Response:**
```json
{
  "success": true,
  "event": {
    "id": "abc123xyz",
    "summary": "Team meeting",
    "start": "2024-01-15T14:00:00.000Z",
    "end": "2024-01-15T15:00:00.000Z",
    "description": "Schedule a team meeting tomorrow at 2pm for 1 hour",
    "createdAt": "2024-01-14T10:00:00.000Z"
  },
  "conflicts": [],
  "message": "Event scheduled successfully"
}
```

### 2. Schedule an Event (With Conflicts)

```bash
curl -X POST http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule a meeting tomorrow at 2pm for 1 hour"
  }'
```

**Response (409 Conflict):**
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
    },
    {
      "start": "2024-01-15T13:00:00.000Z",
      "end": "2024-01-15T14:00:00.000Z",
      "reason": "Before \"Existing Meeting\""
    }
  ],
  "parsedEvent": {
    "summary": "Meeting",
    "start": "2024-01-15T14:00:00.000Z",
    "end": "2024-01-15T15:00:00.000Z",
    "duration": 60
  }
}
```

### 3. Force Schedule Despite Conflicts

```bash
curl -X POST http://localhost:3000/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Schedule a meeting tomorrow at 2pm for 1 hour",
    "force": true
  }'
```

### 4. Check for Conflicts Without Scheduling

```bash
curl -X POST http://localhost:3000/api/schedule/check-conflicts \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Team standup Monday at 9am for 30 minutes"
  }'
```

### 5. Parse Natural Language Only

```bash
curl -X POST http://localhost:3000/api/schedule/parse \
  -H "Content-Type: application/json" \
  -d '{
    "text": "Doctor appointment today at 3:30pm"
  }'
```

**Response:**
```json
{
  "parsed": {
    "summary": "Doctor appointment",
    "start": "2024-01-14T15:30:00.000Z",
    "end": "2024-01-14T16:30:00.000Z",
    "description": "Doctor appointment today at 3:30pm",
    "duration": 60
  },
  "validation": {
    "valid": true,
    "errors": []
  }
}
```

### 6. Get All Events

```bash
curl http://localhost:3000/api/schedule/events
```

### 7. Get Events in Date Range

```bash
curl "http://localhost:3000/api/schedule/events?start=2024-01-15T00:00:00Z&end=2024-01-16T00:00:00Z"
```

### 8. Get Specific Event

```bash
curl http://localhost:3000/api/schedule/events/abc123xyz
```

### 9. Delete Event

```bash
curl -X DELETE http://localhost:3000/api/schedule/events/abc123xyz
```

## JavaScript/Node.js Example

```javascript
const axios = require('axios');

const API_BASE = 'http://localhost:3000/api/schedule';

async function scheduleEvent(text, force = false) {
  try {
    const response = await axios.post(`${API_BASE}/schedule`, {
      text,
      force
    });
    
    if (response.status === 200) {
      console.log('✅ Event scheduled:', response.data.event);
      return response.data;
    }
  } catch (error) {
    if (error.response && error.response.status === 409) {
      console.log('⚠️  Conflict detected:', error.response.data.conflicts);
      console.log('💡 Suggestions:', error.response.data.suggestions);
      return error.response.data;
    }
    console.error('❌ Error:', error.message);
  }
}

// Usage
scheduleEvent('Schedule a meeting tomorrow at 2pm for 1 hour');
```

## Python Example

```python
import requests

API_BASE = 'http://localhost:3000/api/schedule'

def schedule_event(text, force=False):
    try:
        response = requests.post(
            f'{API_BASE}/schedule',
            json={'text': text, 'force': force}
        )
        
        if response.status_code == 200:
            print('✅ Event scheduled:', response.json()['event'])
            return response.json()
        elif response.status_code == 409:
            data = response.json()
            print('⚠️  Conflict detected:', data['conflicts'])
            print('💡 Suggestions:', data['suggestions'])
            return data
    except Exception as e:
        print('❌ Error:', str(e))

# Usage
schedule_event('Schedule a meeting tomorrow at 2pm for 1 hour')
```

## Supported Natural Language Patterns

### Dates
- `today`
- `tomorrow`
- `Monday`, `Tuesday`, `Wednesday`, `Thursday`, `Friday`, `Saturday`, `Sunday`

### Times
- `2pm`, `2:30pm`
- `14:00`, `14:30`
- `at 2pm`, `at 2:30pm`

### Durations
- `1 hour`, `2 hours`
- `30 minutes`, `90 minutes`
- `1h 30m`, `1 hour 30 minutes`

### Examples
- `"Schedule a meeting tomorrow at 2pm for 1 hour"`
- `"Add team standup Monday at 9am for 30 minutes"`
- `"Book doctor appointment today at 3:30pm"`
- `"Create project review on Tuesday at 10am"`
- `"Set up lunch meeting tomorrow at 12pm for 1 hour"`

