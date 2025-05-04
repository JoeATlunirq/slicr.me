import axios from 'axios';
import process from 'process';

const { NOCODB_API_URL, NOCODB_AUTH_TOKEN } = process.env;
const MUSIC_TABLE_ID = 'mdfijlqr28f4ojj'; // The actual ID for API calls

if (!NOCODB_API_URL || !NOCODB_AUTH_TOKEN) {
    console.error("[Music Service] Missing NocoDB environment variables (NOCODB_API_URL, NOCODB_AUTH_TOKEN).");
    // Allow local dev without vars, but log error. Production needs these.
}

const nocoDbHeaders = { 'xc-token': NOCODB_AUTH_TOKEN || '' };

/**
 * Fetches all music tracks from the NocoDB table.
 * @returns {Promise<Array<Object>>} A promise that resolves to an array of track objects.
 * @throws {Error} If fetching or parsing fails.
 */
export async function getAllMusicTracks() {
    if (!NOCODB_API_URL || !NOCODB_AUTH_TOKEN) {
        throw new Error("NocoDB connection details are not configured on the server.");
    }
    const listUrl = `${NOCODB_API_URL}/tables/${MUSIC_TABLE_ID}/records?limit=1000`; // Add limit just in case
    console.log(`[Music Service] Fetching all tracks: ${listUrl}`);
    try {
        const response = await axios.get(listUrl, { headers: nocoDbHeaders });
        if (response.data?.list && Array.isArray(response.data.list)) {
            console.log(`[Music Service] Fetched ${response.data.list.length} tracks.`);
            // Map to expected format (ensure correct property names)
            return response.data.list.map(record => ({
                Id: record['Id'], // Use the actual column name from NocoDB
                Title: record['Title'], // Use the actual column name
                Description: record['Description'],
                Mood: record['Mood'],
                LUFS: record['Lufs'], // Assuming column names match
                Duration: record['Duration'],
                S3_URL: record['Url (S3)'] 
            }));
        } else {
            console.warn("[Music Service] NocoDB response format unexpected:", response.data);
            return []; // Return empty array on unexpected format
        }
    } catch (error) {
        console.error("[Music Service] Error fetching all tracks:", error.response?.data || error.message);
        throw new Error(`Failed to fetch music tracks from NocoDB: ${error.message}`);
    }
}

/**
 * Fetches a single music track by its ID from NocoDB.
 * @param {string|number} trackId The ID of the track to fetch.
 * @returns {Promise<Object|null>} A promise that resolves to the track object or null if not found.
 * @throws {Error} If fetching fails.
 */
export async function getMusicTrackById(trackId) {
    if (!NOCODB_API_URL || !NOCODB_AUTH_TOKEN) {
        throw new Error("NocoDB connection details are not configured on the server.");
    }
    if (!trackId) {
        console.warn("[Music Service] getMusicTrackById called with null/empty trackId.");
        return null;
    }
    const recordUrl = `${NOCODB_API_URL}/tables/${MUSIC_TABLE_ID}/records?where=(Id,eq,${encodeURIComponent(trackId)})`; // Assuming ID column is 'Id'
    console.log(`[Music Service] Fetching track by ID (${trackId}): ${recordUrl}`);
    try {
        const response = await axios.get(recordUrl, { headers: nocoDbHeaders });
        const record = response.data?.list?.[0];
        if (record) {
             // Map to expected format
             return {
                Id: record['Id'], 
                Title: record['Title'],
                Description: record['Description'],
                Mood: record['Mood'],
                LUFS: record['Lufs'],
                Duration: record['Duration'],
                S3_URL: record['Url (S3)'] 
            };
        } else {
            console.log(`[Music Service] Track ID ${trackId} not found.`);
            return null; // Not found is not necessarily an error
        }
    } catch (error) {
        console.error(`[Music Service] Error fetching track ID ${trackId}:`, error.response?.data || error.message);
        throw new Error(`Failed to fetch music track ${trackId} from NocoDB: ${error.message}`);
    }
} 