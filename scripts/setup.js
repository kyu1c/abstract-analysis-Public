const fs = require('fs');
const path = require('path');

const setupPath = path.join(__dirname, '..', 'setup.json');
const envPath = path.join(__dirname, '..', '.env.local');

try {
    if (!fs.existsSync(setupPath)) {
        console.error('Error: setup.json not found!');
        process.exit(1);
    }

    const config = JSON.parse(fs.readFileSync(setupPath, 'utf8'));
    
    let envContent = '';
    
    console.log('Generating .env.local...');

    // API Keys
    if (config.api_keys) {
        if (config.api_keys.google_generative_ai_api_key) {
            envContent += `GOOGLE_GENERATIVE_AI_API_KEY=${config.api_keys.google_generative_ai_api_key}\n`;
        }
    }

    // Firebase
    if (config.firebase) {
        const fb = config.firebase;
        // Use empty string fallback to avoid undefined being written
        envContent += `NEXT_PUBLIC_FIREBASE_API_KEY=${fb.apiKey || ''}\n`;
        envContent += `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=${fb.authDomain || ''}\n`;
        envContent += `NEXT_PUBLIC_FIREBASE_PROJECT_ID=${fb.projectId || ''}\n`;
        envContent += `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=${fb.storageBucket || ''}\n`;
        envContent += `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=${fb.messagingSenderId || ''}\n`;
        envContent += `NEXT_PUBLIC_FIREBASE_APP_ID=${fb.appId || ''}\n`;
        envContent += `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=${fb.measurementId || ''}\n`;
    }

    fs.writeFileSync(envPath, envContent);
    console.log('Successfully generated .env.local from setup.json');

} catch (error) {
    console.error('Error running setup script:', error);
    process.exit(1);
}
