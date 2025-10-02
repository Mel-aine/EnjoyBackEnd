const http = require('http');

// Test data for the POS receipt endpoint
const testTransactionId = '1'; // You may need to adjust this to a valid transaction ID

const options = {
  hostname: '127.0.0.1',
  port: 58727,
  path: `/api/reports/pos-receipt/${testTransactionId}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    // Note: You may need to add authentication headers if required
    // 'Authorization': 'Bearer your-token-here'
  }
};

console.log(`Testing POS receipt endpoint: http://${options.hostname}:${options.port}${options.path}`);

const req = http.request(options, (res) => {
  console.log(`Status Code: ${res.statusCode}`);
  console.log(`Headers:`, res.headers);

  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ POS Receipt PDF generated successfully!');
      console.log(`Content-Type: ${res.headers['content-type']}`);
      console.log(`Content-Length: ${data.length} bytes`);
      
      if (res.headers['content-type'] === 'application/pdf') {
        console.log('✅ Response is a valid PDF file');
      }
    } else {
      console.log('❌ Error response:');
      try {
        const errorData = JSON.parse(data);
        console.log(JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.log('Raw response:', data);
      }
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Request failed:', error.message);
});

req.end();