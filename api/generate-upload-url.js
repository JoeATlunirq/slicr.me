import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from 'crypto'; // For generating unique filenames

// --- AWS S3 Configuration (ensure these are set in your Vercel environment variables) ---
const { AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_REGION, S3_BUCKET_NAME } = process.env;

if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY || !AWS_REGION || !S3_BUCKET_NAME) {
    console.error("[API Generate URL] Missing required AWS environment variables.");
    // In a real app, you might throw an error or have a more robust check
}

const s3Client = new S3Client({
    region: AWS_REGION,
    credentials: {
        accessKeyId: AWS_ACCESS_KEY_ID || '', // Provide default empty string if undefined
        secretAccessKey: AWS_SECRET_ACCESS_KEY || ''
    }
});

// Define allowed origins for UI requests (add your production domain here)
const ALLOWED_UI_ORIGINS = [
  'http://localhost:8080', // Vite default dev server
  'https://www.slicr.me'   // Your production domain
  // Add other potential origins if needed (e.g., staging)
];

// Optional: Vercel specific config (though not strictly necessary for this simple endpoint)
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb', // Keep body parser for this endpoint small as it only expects JSON
    },
  },
};

export default async function handler(req, res) {
    // --- CORS Headers ---
    const requestOrigin = req.headers['origin'];
    if (requestOrigin && ALLOWED_UI_ORIGINS.includes(requestOrigin)) {
        res.setHeader('Access-Control-Allow-Origin', requestOrigin);
    } else if (!requestOrigin) {
        // Allow requests with no origin (e.g. server-to-server, Postman)
        // For more strict control, you might remove this or check against a list of allowed IPs/keys
        res.setHeader('Access-Control-Allow-Origin', '*'); 
    } else {
        // Origin not in allow list
        console.warn(`[API Generate URL] Origin ${requestOrigin} not allowed.`);
        res.status(403).json({ success: false, error: "Origin not allowed" });
        return;
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');

    if (req.method === 'OPTIONS') {
        res.status(204).end();
        return;
    }

    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        res.status(405).json({ success: false, error: 'Method Not Allowed' });
        return;
    }

    try {
        const { fileName, contentType } = req.body;

        if (!fileName || !contentType) {
            res.status(400).json({ success: false, error: "Missing fileName or contentType in request body." });
            return;
        }

        // Basic sanitization for filename (you might want to enhance this)
        const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9_.-]/g, '_');
        const uniqueKey = `uploads/${randomUUID()}-${sanitizedFileName}`;

        const params = {
            Bucket: S3_BUCKET_NAME,
            Key: uniqueKey,
            ContentType: contentType,
            // ACL: 'public-read', // Uncomment if you want the uploaded files to be publicly readable by default
            // You can add other parameters like Metadata here
        };

        const command = new PutObjectCommand(params);
        // The expiration time for the signed URL, in seconds. Default is 900 (15 minutes).
        // Max is 604800 (7 days) for IAM user credentials.
        const expiresIn = 3600; // 1 hour

        const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
        
        console.log(`[API Generate URL] Generated pre-signed URL for ${uniqueKey} of type ${contentType}`);

        res.status(200).json({
            success: true,
            uploadUrl: signedUrl,
            s3Key: uniqueKey, // The client will need this to tell /api/process which file to use
        });

    } catch (error) {
        console.error('[API Generate URL] Error generating pre-signed URL:', error);
        res.status(500).json({ success: false, error: 'Failed to generate pre-signed URL.', details: error.message });
    }
} 