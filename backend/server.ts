// This backend server handles user authentication and saving chat history to Milvus.
// To run: `ts-node backend/server.ts`
// ---
// REQUIRED DEPENDENCIES:
// You must install these before running the server:
// npm install express @zilliz/milvus2-sdk-node jsonwebtoken bcryptjs cors
// npm install --save-dev @types/express @types/jsonwebtoken @types/bcryptjs @types/cors
// ---

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import { MilvusClient, DataType } from '@zilliz/milvus2-sdk-node';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { exit } from 'process';

// --- Configuration ---
const PORT = process.env.PORT || 3001;
const MILVUS_URL = process.env.MILVUS_URL || 'localhost:19530';
const COLLECTION_NAME = 'chat_history';
const VECTOR_DIMENSION = 768; // Example dimension, should match your embedding model
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-key-that-is-long-and-secure';

// --- In-Memory User Store (for demonstration) ---
// In a production environment, replace this with a proper database (e.g., PostgreSQL, MongoDB).
const users: any[] = [];

// --- Milvus Service ---
const milvusClient = new MilvusClient(MILVUS_URL);

async function ensureCollection() {
    console.log("Checking for Milvus collection...");
    const collections = await milvusClient.showCollections();
    if (collections.data.some(c => c.name === COLLECTION_NAME)) {
        console.log(`Collection '${COLLECTION_NAME}' already exists.`);
        return;
    }

    console.log(`Collection '${COLLECTION_NAME}' does not exist. Creating...`);
    const schema = [
        { name: 'id', data_type: DataType.Int64, is_primary_key: true, autoID: true },
        { name: 'username', data_type: DataType.VarChar, max_length: 256 },
        { name: 'goal', data_type: DataType.VarChar, max_length: 1024 },
        { name: 'result', data_type: DataType.VarChar, max_length: 65535 },
        { name: 'embedding', data_type: DataType.FloatVector, dim: VECTOR_DIMENSION },
    ];

    await milvusClient.createCollection({ collection_name: COLLECTION_NAME, fields: schema });
    console.log(`Collection '${COLLECTION_NAME}' created.`);

    console.log("Creating index for 'embedding' field...");
    await milvusClient.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: 'embedding',
        index_type: 'IVF_FLAT',
        metric_type: 'L2',
        params: { nlist: 1024 },
    });
    console.log("Index for 'embedding' created.");
    
    console.log("Creating index for 'username' field...");
    await milvusClient.createIndex({
        collection_name: COLLECTION_NAME,
        field_name: 'username',
        index_type: 'MARISA_TRIE', // Good for string matching
        metric_type: 'L2', // Metric type is required but not used for string indexes
    });
    console.log("Index for 'username' created.");
}

// --- Express Server ---
const app = express();
app.use(cors()); // Allow cross-origin requests
app.use(express.json());

// --- Authentication Middleware ---
const authenticateToken = (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.sendStatus(401); // if there isn't any token

    jwt.verify(token, JWT_SECRET, (err: any, user: any) => {
        if (err) return res.sendStatus(403); // if token is no longer valid
        (req as any).user = user;
        next(); // pass the execution off to whatever request the client intended
    });
};

// --- API Endpoints ---

// User Registration
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(400).json({ error: 'Username and password are required.' });
    }
    if (users.find(u => u.username === username)) {
        return res.status(409).json({ error: 'Username already exists.' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = { username, password: hashedPassword };
    users.push(user);
    
    console.log(`User registered: ${username}`);
    res.status(201).json({ message: 'User created successfully.' });
});

// User Login
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    if (!user) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
        return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const accessToken = jwt.sign({ username: user.username }, JWT_SECRET, { expiresIn: '1d' });
    console.log(`User logged in: ${username}`);
    res.json({ token: accessToken, username: user.username });
});

// Save Chat History (Protected)
app.post('/api/save_history', authenticateToken, async (req, res) => {
    const { goal, result } = req.body;
    const username = (req as any).user.username;

    if (!goal || !result) {
        return res.status(400).json({ error: 'Goal and result are required.' });
    }

    try {
        const embedding = Array(VECTOR_DIMENSION).fill(0).map(() => Math.random());
        const dataToInsert = [{ username, goal, result, embedding }];

        await milvusClient.loadCollection({ collection_name: COLLECTION_NAME });
        const response = await milvusClient.insert({ collection_name: COLLECTION_NAME, data: dataToInsert });
        await milvusClient.releaseCollection({ collection_name: COLLECTION_NAME });

        console.log(`History saved for user: ${username}`);
        res.status(200).json({ success: true, message: 'History saved.', data: response });

    } catch (error) {
        console.error(`Failed to save history for ${username}:`, error);
        res.status(500).json({ success: false, error: 'Failed to save history to Milvus.' });
    }
});

// Get Chat History (Protected)
app.get('/api/history', authenticateToken, async (req, res) => {
    const username = (req as any).user.username;
    try {
        await milvusClient.loadCollection({ collection_name: COLLECTION_NAME });

        const queryResponse = await milvusClient.query({
            collection_name: COLLECTION_NAME,
            expr: `username == "${username}"`,
            output_fields: ["id", "goal", "result"],
            limit: 100 // a reasonable limit
        });
        
        await milvusClient.releaseCollection({ collection_name: COLLECTION_NAME });
        
        console.log(`History retrieved for user: ${username}`);
        res.status(200).json(queryResponse.data);
    } catch (error) {
        console.error(`Failed to retrieve history for ${username}:`, error);
        res.status(500).json({ success: false, error: 'Failed to retrieve history.' });
    }
});

// --- Server Startup ---
async function startServer() {
    try {
        await ensureCollection();
        app.listen(PORT, () => {
            console.log(`Backend server listening on http://localhost:${PORT}`);
        });
    } catch (error) {
        console.error("Failed to start server or connect to Milvus:", error);
        exit(1);
    }
}

startServer();