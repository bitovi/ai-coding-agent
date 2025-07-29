#!/usr/bin/env node

/**
 * Complete authentication flow test
 */

console.log('🧪 Testing Complete Authentication Flow\n');

// Test 1: Unauthenticated access to dashboard
console.log('Test 1: Testing unauthenticated access to dashboard...');
fetch('http://localhost:3000/', {
    redirect: 'manual' // Don't follow redirects
})
.then(response => {
    if (response.status === 302) {
        const location = response.headers.get('location');
        console.log('✅ Correctly redirected to:', location);
    } else {
        console.log('❌ Expected redirect but got status:', response.status);
    }
})
.catch(error => {
    console.error('❌ Error:', error.message);
});

// Test 2: Login page accessibility
setTimeout(() => {
    console.log('\nTest 2: Testing login page accessibility...');
    fetch('http://localhost:3000/login')
    .then(response => {
        if (response.ok) {
            console.log('✅ Login page accessible');
        } else {
            console.log('❌ Login page not accessible, status:', response.status);
        }
    })
    .catch(error => {
        console.error('❌ Error:', error.message);
    });
}, 500);

// Test 3: Magic link request
setTimeout(() => {
    console.log('\nTest 3: Testing magic link request...');
    fetch('http://localhost:3000/auth/request-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'justin@bitovi.com' })
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            console.log('✅ Magic link requested successfully');
            console.log('📨 Check server console for the magic link');
        } else {
            console.log('❌ Magic link request failed:', data.message);
        }
    })
    .catch(error => {
        console.error('❌ Error:', error.message);
    });
}, 1000);

console.log('\n📋 Manual Testing Steps:');
console.log('1. Visit http://localhost:3000 (should redirect to login)');
console.log('2. Visit http://localhost:3000/login (should show login form)');
console.log('3. Enter email and submit (should get success message)');
console.log('4. Check server console for magic link');
console.log('5. Click magic link (should log in and show dashboard with user info)');
console.log('6. Verify logout button appears in dashboard');
console.log('7. Click logout (should redirect to login with logout message)');
