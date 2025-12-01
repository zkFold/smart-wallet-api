import axios from 'axios'
import { GoogleTokenResponse, GoogleCertKey } from '../Types'

export class GoogleApi {
    private clientId: string
    private clientSecret: string
    private redirectURL: string

    constructor(clientId: string, clientSecret: string, redirectURL: string) {
        /**
         * To use OAuth2 authentication, we need access to a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI
         * from the client_secret.json file. To get these credentials for your application, visit
         * https://console.cloud.google.com/apis/credentials.
         */
        this.clientId = clientId
        this.clientSecret = clientSecret
        this.redirectURL = redirectURL
    }

    /**
     * Generates the Google OAuth2 authorization URL.
     * @param {string} state - A unique state string to prevent CSRF attacks.
     * @returns {string} The Google OAuth2 authorization URL.
     */
    public getAuthUrl(state: string): string {
        // Example access scopes for Web2 login: user email is used.
        const scopes = [
            'https://www.googleapis.com/auth/userinfo.email',
            'openid',
        ]

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectURL,
            response_type: 'code',
            scope: scopes.join(' '),
            access_type: 'offline',
            include_granted_scopes: 'true',
            state: state
        })

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    }

    /**
     * Exchanges an authorization code for a JWT.
     * @param {string} code - The authorization code received from Google.
     * @returns {Promise<string | null>} A promise that resolves to the JWT or null if not found.
     */
    public async getJWTFromCode(code: string): Promise<string | null> {
        const tokenEndpoint = 'https://oauth2.googleapis.com/token'

        const params = new URLSearchParams({
            client_id: this.clientId,
            client_secret: this.clientSecret,
            code: code,
            grant_type: 'authorization_code',
            redirect_uri: this.redirectURL
        })

        const { data } = await axios.post<GoogleTokenResponse>(
            tokenEndpoint,
            params.toString(),
            {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
            }
        )

        return data.id_token || null
    }

    /**
     * Fetches Google's public keys and returns the one matching the given key ID.
     * @param {string} keyId - The key ID to match.
     * @returns {Promise<GoogleCertKey | null>} A promise that resolves to the matching key or null if not found.
     */
    public async getMatchingKey(keyId: string): Promise<GoogleCertKey | null> {
        const { data } = await axios.get<{ keys: GoogleCertKey[] }>('https://www.googleapis.com/oauth2/v3/certs')

        for (const k of data.keys) {
            if (k.kid === keyId) {
                k.e = k.e.replace(/-/g, '+').replace(/_/g, '/')
                k.n = k.n.replace(/-/g, '+').replace(/_/g, '/')
                return k
            }
        }
        return null
    }

    /**
     * Extracts the key ID from a JWT.
     * @param {string} jwt - The JWT string.
     * @returns {string} The key ID.
     */
    public getKeyId(jwt: string): string {
        const parts = jwt.split(".")
        const header = atob(parts[0].replace(/-/g, '+').replace(/_/g, '/'))
        return JSON.parse(header).kid
    }

    /**
     * Extracts the user ID (email) from a JWT.
     * @param {string} jwt - The JWT string.
     * @returns {string} The user ID (email).
     */
    public getUserId(jwt: string): string {
        const parts = jwt.split(".")
        const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')))
        return payload.email
    }

    /**
     * Extracts the signature from a JWT.
     * @param {string} jwt - The JWT string.
     * @returns {string} The signature.
     */
    public getSignature(jwt: string): string {
        const parts = jwt.split(".")
        return parts[2].replace(/-/g, '+').replace(/_/g, '/')
    }

    /**
     * Strips the signature from a JWT.
     * @param {string} jwt - The JWT string.
     * @returns {string} The JWT without the signature.
     */
    public stripSignature(jwt: string): string {
        const parts = jwt.split(".")
        return `${parts[0]}.${parts[1]}`
    }
}