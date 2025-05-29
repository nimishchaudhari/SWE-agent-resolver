const express = require('express');
const githubHandler = require('../src/github');

const app = express();
const port = process.env.PORT || 3000;

// Middleware to capture raw body for signature validation
app.use('/webhook', express.raw({ type: 'application/json' }));

// GitHub webhook endpoint
app.post('/webhook', async (req, res) => {
  const startTime = Date.now();
  
  try {
    const rawPayload = req.body.toString();
    const headers = req.headers;
    
    console.log('Received webhook:', {
      event: headers['x-github-event'],
      delivery: headers['x-github-delivery'],
      contentLength: rawPayload.length
    });
    
    const result = await githubHandler.processWebhook(rawPayload, headers);
    
    const processingTime = Date.now() - startTime;
    
    if (result.processed) {
      console.log('Webhook processed successfully:', {
        type: result.result?.type,
        processingTime: `${processingTime}ms`
      });
      
      res.status(200).json({
        success: true,
        processed: true,
        type: result.result?.type,
        processingTime
      });
    } else {
      console.log('Webhook skipped:', result.reason);
      
      res.status(200).json({
        success: true,
        processed: false,
        reason: result.reason
      });
    }
    
  } catch (error) {
    console.error('Webhook processing failed:', error);
    
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  const health = githubHandler.healthCheck();
  const metrics = githubHandler.getMetrics();
  
  res.json({
    ...health,
    metrics
  });
});

// Metrics endpoint
app.get('/metrics', (req, res) => {
  const metrics = githubHandler.getMetrics();
  res.json(metrics);
});

// Example: Direct component access for testing
app.get('/test/trigger/:text', (req, res) => {
  const { TriggerDetector } = githubHandler.getComponents();
  const trigger = TriggerDetector.detectTrigger(req.params.text);
  
  res.json({
    text: req.params.text,
    trigger
  });
});

app.listen(port, () => {
  console.log(`GitHub webhook handler listening on port ${port}`);
  
  const health = githubHandler.healthCheck();
  console.log('Handler status:', health);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  process.exit(0);
});