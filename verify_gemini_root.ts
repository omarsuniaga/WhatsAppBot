
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as dotenv from 'dotenv';
import path from 'path';

// Load .env
dotenv.config();

async function verifyGemini() {
    console.log('----------------------------------------');
    console.log('🔍 Starting Gemini Integration Verification (Root Script)');
    console.log('----------------------------------------');

    // Check environment first
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        console.error('❌ ERROR: GEMINI_API_KEY not found in process.env');
        console.log('Make sure you have a .env file and dotenv is installed.');
        process.exit(1);
    }

    console.log('✅ API Key found');

    const genAI = new GoogleGenerativeAI(apiKey);
    // Use the model we want to test: gemini-2.0-flash
    const modelName = 'gemini-2.0-flash';

    console.log(`🤖 Attempting to connect to model: ${modelName}...`);

    try {
        const model = genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent('Say "Hello from Root Verification Script" to confirm connection.');
        const response = await result.response;
        const text = response.text();

        console.log('----------------------------------------');
        console.log('✅ SUCCESS! Gemini generated response:');
        console.log(`"${text.trim()}"`);
        console.log('----------------------------------------');
        process.exit(0);

    } catch (error: any) {
        console.error('----------------------------------------');
        console.error('❌ FAILURE: Could not generate content.');
        console.error(`Error details: ${error.message}`);
        console.error('----------------------------------------');
        process.exit(1);
    }
}

verifyGemini();
