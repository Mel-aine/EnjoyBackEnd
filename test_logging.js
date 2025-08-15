const { ActivityLog } = require('./build/app/models/activity_log.js');

async function testLogging() {
  try {
    console.log('Testing ActivityLog creation...');
    
    // Create a test log entry
    const testLog = await ActivityLog.create({
      userId: 1,
      username: 'Test User',
      action: 'TEST_LOG',
      entityType: 'Test',
      entityId: 1,
      description: 'This is a test log entry',
      changes: { test: 'data' },
      createdBy: 1,
      ipAddress: '127.0.0.1',
      userAgent: 'Test Agent'
    });
    
    console.log('Test log created successfully:', testLog.id);
    
    // Fetch recent logs
    const recentLogs = await ActivityLog.query()
      .orderBy('createdAt', 'desc')
      .limit(5);
    
    console.log('Recent logs count:', recentLogs.length);
    recentLogs.forEach(log => {
      console.log(`- ${log.action} on ${log.entityType} (${log.createdAt})`);
    });
    
  } catch (error) {
    console.error('Error testing logging:', error);
  }
}

testLogging();