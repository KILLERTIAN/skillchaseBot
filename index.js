const express = require('express');
const bodyParser = require('body-parser');
const dotenv = require('dotenv');
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');

// Load environment variables from .env file
dotenv.config();
const { GoogleGenerativeAI } = require("@google/generative-ai");

const systemInstruction = fs.readFileSync('./systemInstructions.txt', 'utf-8');

// Create an instance of Express
const app = express();
const port = process.env.PORT || 3000;

// Middleware for parsing JSON bodies
app.use(bodyParser.json());

// Initialize WhatsApp Client with LocalAuth
const client = new Client({
    authStrategy: new LocalAuth(),
});

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey);

const model = genAI.getGenerativeModel({
    model: "gemini-1.5-flash",
    systemInstruction: systemInstruction
});

const generationConfig = {
    temperature: 0.4,
    topP: 0.95,
    topK: 64,
    maxOutputTokens: 2000,
};

// Function to generate a response from the AI model and reply to the user
async function generate(prompt, message, targetLanguage = 'en') {
    try {
        const chatSession = model.startChat({
            generationConfig,
            history: [
                {
                    "role": "user",
                    "parts": [
                        "hello how are you?\n",
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        "Hello! I'm doing great, thanks for asking.  How are you all doing today? 😊  Ready to tackle those internship tasks? \n",
                    ],
                },
                {
                    "role": "user",
                    "parts": [
                        "hello what is your name?\n",
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        "Hi there! My name is Hu Tao.  It's a pleasure to meet you all. 😊  What can I do for you today? \n",
                    ],
                },
                {
                    "role": "user",
                    "parts": [
                        "who is the team lead?\n",
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        "Praneeth is the team lead. 😊  He's got a great vision for the project, so make sure to listen to his guidance! \n",
                    ],
                },
                {
                    "role": "user",
                    "parts": [
                        "who is the assistant leader",
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        "Om is the assistant leader.  He's a great support to Praneeth and can help answer any questions you might have.  Feel free to reach out to him if needed! 😊 \n",
                    ],
                },
                {
                    "role": "user",
                    "parts": [
                        "what internship we are doing?\n",
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        "we are doing web development internship at skill chase \n",
                    ],
                },
                {
                    "role": "user",
                    "parts": [
                        "can you help me with a error ? i can't solve it",
                    ],
                },
                {
                    "role": "model",
                    "parts": [
                        "Of course!  Tell me more about the error you're facing.  What are you working on?  What code are you using?  The more details you give me, the better I can help. 😊  Maybe you can even share your code with me so I can take a look. \n\nDon't worry, we'll figure it out together! 💪 \n",
                    ],
                },
            ],
        });

        let result = await chatSession.sendMessage(prompt);
        let text = await result.response.text();

        // If translation to another language is required
        if (targetLanguage && targetLanguage !== 'en') {
            const translationPrompt = `Translate the following text to ${targetLanguage}: ${text}`;
            result = await chatSession.sendMessage(translationPrompt);
            text = await result.response.text();
        }

        await message.reply(text);
    } catch (error) {
        console.error('Error generating response:', error);
        console.error('Error details:', error.response ? error.response.data : error.message);
        await message.reply('Sorry, I encountered an error while processing your request.');
    }
}

// Event listeners for client status
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
});

client.on('authenticated', () => {
    console.log('Client is authenticated!');
});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('disconnected', () => {
    console.log('Client is disconnected!');
});

client.on('auth_failure', () => {
    console.log('Client authentication failed!');
});

// Handling incoming messages
client.on('message', async (message) => {
    const chat = await message.getChat();
    const messageContent = message.body.toLowerCase();

    // Handle .tao prompt
    if (messageContent.startsWith('.tao')) {
        const prompt = message.body.substring(4).trim(); // Extract the prompt after .tao
        if (prompt) {
            await generate(prompt, message);
        } else {
            await message.reply('Please provide a prompt after the .tao command.');
        }
    }
    // Handle .tagall command
    else if (messageContent.includes('.tagall')) {
        if (chat.isGroup) {
            const groupSize = chat.participants.length;
            const batchSize = 500; // Batch size for mentions
            const delay = 1000; // Delay between batches in milliseconds

            for (let i = 0; i < groupSize; i += batchSize) {
                const batchMentions = chat.participants.slice(i, i + batchSize).map(participant => participant.id._serialized);
                await chat.sendMessage('@everyone', { mentions: batchMentions });

                // Adding delay between batches
                if (i + batchSize < groupSize) {
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        } else {
            await message.reply('The .tagall command can only be used in group chats.');
        }
    }
    // Handle translation request
    else if (messageContent.includes('translate to')) {
        const [_, targetLanguage] = messageContent.split('translate to');
        const textToTranslate = messageContent.replace(`translate to ${targetLanguage}`, '').trim();
        await generate(textToTranslate, message, targetLanguage.trim());
    }
});

// Start the Express server
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});

client.initialize();
