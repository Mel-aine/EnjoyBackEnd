import axios from 'axios';

const BASE_URL = 'http://localhost:3333';

// Test data for hotel creation - using correct field names from validator
const testHotelData = {
  hotelName: 'Test Hotel Rollback',
  address: '123 Test Street',
  city: 'Test City',
  stateProvince: 'Test State',
  country: 'Test Country',
  postalCode: '12345',
  phone: '+1234567890',
  email: 'test@testhotel.com',
  website: 'https://testhotel.com',
  description: 'A test hotel for rollback testing',
  taxRate: 10.5,
  checkInTime: '15:00',
  checkOutTime: '11:00',
  currency: 'USD',
  timezone: 'America/New_York',
  administrator: {
    firstName: 'Test',
    lastName: 'Admin',
    email: 'admin@testhotel.com',
    phoneNumber: '+1234567890'
  }
};

// Test data with invalid admin email to trigger rollback
const testHotelDataInvalidEmail = {
  ...testHotelData,
  hotelName: 'Test Hotel Rollback Invalid',
  administrator: {
    firstName: 'Test',
    lastName: 'Admin',
    email: 'invalid-email-format', // This should cause validation error
    phoneNumber: '+1234567890'
  }
};

async function testHotelCreationRollback() {
  console.log('🧪 Testing hotel creation rollback functionality...\n');

  try {
    // Test 1: Valid hotel creation (should succeed)
    console.log('📝 Test 1: Valid hotel creation');
    console.log('Payload:', JSON.stringify(testHotelData, null, 2));
    
    const response1 = await axios.post(`${BASE_URL}/api/hotels`, testHotelData, {
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ Valid hotel creation successful');
    console.log('Response status:', response1.status);
    console.log('Hotel ID:', response1.data.hotel?.id);
    console.log('Admin user created:', response1.data.admin?.id ? 'Yes' : 'No');
    console.log('---\n');

    // Test 2: Invalid hotel creation (should trigger rollback)
    console.log('📝 Test 2: Invalid hotel creation (should trigger rollback)');
    console.log('Payload with invalid email:', JSON.stringify(testHotelDataInvalidEmail, null, 2));
    
    try {
      const response2 = await axios.post(`${BASE_URL}/api/hotels`, testHotelDataInvalidEmail, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log('❌ Unexpected success - rollback test failed');
      console.log('Response:', response2.data);
    } catch (error) {
      if (error.response) {
        console.log('✅ Expected error occurred (rollback should have happened)');
        console.log('Error status:', error.response.status);
        console.log('Error message:', error.response.data.message || error.response.data);
        
        // Verify that no partial data was created
        console.log('🔍 Verifying rollback - checking if hotel was created despite error...');
        
        try {
          // Try to find the hotel that should have been rolled back
          const checkResponse = await axios.get(`${BASE_URL}/api/hotels`);
          const hotels = checkResponse.data.hotels || checkResponse.data;
          const rolledBackHotel = hotels.find(h => h.name === testHotelDataInvalidEmail.hotelName || h.hotelName === testHotelDataInvalidEmail.hotelName);
          
          if (rolledBackHotel) {
            console.log('❌ ROLLBACK FAILED - Hotel was created despite error:', rolledBackHotel.id);
          } else {
            console.log('✅ ROLLBACK SUCCESSFUL - No hotel created with invalid data');
          }
        } catch (checkError) {
          console.log('⚠️  Could not verify rollback (API error):', checkError.message);
        }
      } else {
        console.log('❌ Network error:', error.message);
      }
    }

  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
    if (error.response) {
      console.error('Response status:', error.response.status);
      console.error('Response data:', error.response.data);
    }
  }
}

// Run the test
testHotelCreationRollback();