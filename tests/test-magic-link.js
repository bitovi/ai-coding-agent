#!/usr/bin/env node

/**
 * Test script for magic link authentication
 */

console.log('🧪 Testing Magic Link Authentication\n');

// Test 1: Request magic link
console.log('Test 1: Requesting magic link...');
fetch('http://localhost:3000/auth/request-login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    body: JSON.stringify({ 
        email: 'justin@bitovi.com' 
    })
})
.then(response => response.json())
.then(data => {
    console.log('✅ Magic link request response:', data);
    
    if (data.success) {
        console.log('📧 Check the server console for the magic link email content');
    } else {
        console.log('❌ Magic link request failed:', data.message);
    }
})
.catch(error => {
    console.error('❌ Error testing magic link:', error.message);
});

// Test 2: Test unauthorized email
console.log('\nTest 2: Testing unauthorized email...');
setTimeout(() => {
    fetch('http://localhost:3000/auth/request-login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
            email: 'unauthorized@example.com' 
        })
    })
    .then(response => response.json())
    .then(data => {
        console.log('✅ Unauthorized email response:', data);
        console.log('   (Note: For security, same message is shown regardless)');
    })
    .catch(error => {
        console.error('❌ Error:', error.message);
    });
}, 1000);

console.log('\n📋 To complete the test:');
console.log('1. Check the server console for the email content');
console.log('2. Copy the login URL from the email');
console.log('3. Visit the URL in your browser');
console.log('4. You should be redirected to the dashboard');
console.log('\n🔗 Visit http://localhost:3000/login to try the UI');
