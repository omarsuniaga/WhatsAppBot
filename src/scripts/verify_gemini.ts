
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';
import { getErrorMessage } from '../server/utils/errorUtils';

// Fix path to .env (it's in root, script is in src/scripts)
const envPath = path.resolve(__dirname, '../../.env');
dotenv.config({ path: envPath });

async function verifyGemini() {
    console.log('----------------------------------------');
    console.log('🔍 Starting Gemini Integration Verification');
    console.log('----------------------------------------');

    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ ERROR: GEMINI_API_KEY not found in .env');
        console.log('Please configure it in the .env file or the Dashboard.');
        process.exit(1);
    }

    console.log('✅ API Key found');

    const genAI = new GoogleGenerativeAI(apiKey);
    const modelName = 'gemini-2.0-flash'; // Usage the new priority model

    console.log(`🤖 Attempting to connect to model: ${modelName}...`);

    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "Hello from Gemini 2.0" to verify connection.');
        const response = await result.response;
        const text = response.text();

        console.log('----------------------------------------');
        console.log('✅ SUCCESS! Gemini generated response:');
        console.log(`"${text.trim()}"`);
        console.log('----------------------------------------');
        console.log('The AI integration is working correctly.');
        console.log('Please restarting your server to pick up the code changes.');
        process.exit(0);

    } catch (error: unknown) {
        console.error('----------------------------------------');
        console.error('❌ FAILURE: Could not generate content.');
        console.error(`Error details: ${getErrorMessage(error)}`);
        console.error('----------------------------------------');

        if (getErrorMessage(error).includes('404')) {
            console.error('Tip: The model name might be invalid for your API key/region.');
        } else if (getErrorMessage(error).includes('API_KEY_INVALID')) {
            console.error('Tip: Your API Key appears to be invalid.');
        }

        process.exit(1);
    }
}

verifyGemini();
