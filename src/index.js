require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const scheduleRoutes = require('./routes/scheduleRoutes');
const planRoutes = require('./routes/planRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(cors({
  origin: process.env.CLIENT_URL || '*',
  credentials: true
}));

// Serve static files (UI)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Routes
app.use('/api/schedule', scheduleRoutes);
app.use('/api/plan', planRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'NLP Scheduler'
  });
});

// Root endpoint - serve UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// API info endpoint
app.get('/api', (req, res) => {
  res.json({
    message: 'NLP Calendar Scheduler API',
    version: '1.0.0',
    endpoints: {
      schedule: 'POST /api/schedule',
      checkConflicts: 'POST /api/schedule/check-conflicts',
      parse: 'POST /api/schedule/parse',
      getEvents: 'GET /api/schedule/events',
      getEvent: 'GET /api/schedule/events/:id',
      deleteEvent: 'DELETE /api/schedule/events/:id',
      plan: 'POST /api/plan'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ NLP Scheduler server running on port ${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
  console.log(`📚 API docs: http://localhost:${PORT}/`);
});

