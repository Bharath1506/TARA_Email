const https = require('https');

const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJfaWQiOiI2Mjc0ZTIzNjk2YmY5ODI0ZTQ0MWJlMTYiLCJuYW1lIjoiU3VwZXIgQWRtaW4iLCJlbWFpbCI6InN1cGVyYWRtaW5AZ21haWwuY29tIiwibW9iaWxlTnVtYmVyIjoxMjM0NTEyMzQ1LCJyb2xlIjoiU3VwZXIgQWRtaW4iLCJkZXBhcnRtZW50IjoiIiwiY29tcGFueSI6IlRhbGVudHNwb3RpZnkgUHJpdmF0ZSBMaW1pdGVkIiwicHJvZmlsZVBpY3R1cmUiOiIvc3RhdGljL21lZGlhL21hbGUuMDMxNzA2NWEyNDQzMjEyNGQ1MmEucG5nIiwibGluTWFuYWdlciI6IiIsImNvbXBhbnlJZCI6IjYzOTZmN2Q3MDM1NDY1MDAwODZmMDIwMCIsImlhdCI6MTc2OTA3NjM2NSwiZXhwIjoxNzY5MjQ5MTY1fQ.C59lyahish42UR6lh1jD2_-gojFVAUo6rm2SHC31h1Q';
const COMPANY_ID = '6396f7d703546500086f0200';

function request(url, options = {}) {
    return new Promise((resolve, reject) => {
        const urlObj = new URL(url);
        const reqOptions = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: options.method || 'GET',
            headers: options.headers || {}
        };

        const req = https.request(reqOptions, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                } catch (e) {
                    resolve(data);
                }
            });
        });
        req.on('error', reject);
        if (options.body) req.write(options.body);
        req.end();
    });
}

async function findLatestReview() {
    const url = `https://ai.talentspotifyapp.com/api/reviewForm/getAllReviewsForm/${COMPANY_ID}`;
    console.log('Fetching reviews from:', url);

    try {
        const data = await request(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TOKEN}`,
                'Content-Type': 'application/json'
            }
        });

        console.log('Data received status:', data.success);

        let reviews = [];
        if (Array.isArray(data)) reviews = data;
        else if (data && Array.isArray(data.data)) reviews = data.data;

        if (reviews.length > 0) {
            reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            const latest = reviews[0];
            console.log('LATEST_REVIEW_ID=' + latest._id);
            console.log('EMPLOYEE_ID=' + latest.employeeId);
            console.log('MANAGER_ID=' + latest.managerId);
            console.log('Review Object:', JSON.stringify(latest, null, 2));
        } else {
            console.log('No reviews found.');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

findLatestReview();
