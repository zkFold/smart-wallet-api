export interface GoogleTokens {
    idToken: string;
    accessToken: string;
    tokenType: string;
    expiresIn: number;
    scope: string;
    refreshToken?: string;
}

export class GoogleApi {
    private clientId: string;
    private redirectURL: string;
    private codeVerifier: string = '';

    constructor(clientId: string, redirectURL: string) {
        // Authorization Code Flow with PKCE for client-side applications
        this.clientId = clientId;
        this.redirectURL = redirectURL;
    }

    private generateCodeVerifier(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    private async generateCodeChallenge(codeVerifier: string): Promise<string> {
        const encoder = new TextEncoder();
        const data = encoder.encode(codeVerifier);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return this.base64URLEncode(new Uint8Array(digest));
    }

    private base64URLEncode(buffer: Uint8Array): string {
        const base64 = btoa(String.fromCharCode(...buffer));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    async getAuthUrl(state: string): Promise<string> {
        this.codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge(this.codeVerifier);

        // Store code verifier for later use in token exchange
        if (typeof localStorage !== 'undefined') {
            localStorage.setItem('pkce_code_verifier', this.codeVerifier);
        }

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectURL,
            response_type: 'code',
            scope: 'openid email',
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256'
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async exchangeCodeForTokens(authorizationCode: string): Promise<GoogleTokens | undefined> {
        try {
            // Retrieve the stored code verifier
            let codeVerifier = this.codeVerifier;
            if (!codeVerifier && typeof localStorage !== 'undefined') {
                codeVerifier = localStorage.getItem('pkce_code_verifier') || '';
            }

            if (!codeVerifier) {
                console.error('Code verifier not found');
                return undefined;
            }

            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    code: authorizationCode,
                    code_verifier: codeVerifier,
                    grant_type: 'authorization_code',
                    redirect_uri: this.redirectURL
                })
            });

            if (!response.ok) {
                const error = await response.text();
                console.error('Token exchange failed:', error);
                return undefined;
            }

            const tokenData = await response.json();

            // Clean up stored code verifier
            if (typeof localStorage !== 'undefined') {
                localStorage.removeItem('pkce_code_verifier');
            }

            console.info('Tokens acquired via authorization code flow with PKCE.');
            return {
                idToken: tokenData.id_token,
                accessToken: tokenData.access_token,
                tokenType: tokenData.token_type,
                expiresIn: tokenData.expires_in,
                scope: tokenData.scope,
                refreshToken: tokenData.refresh_token
            };
        } catch (e) {
            console.error('Error exchanging authorization code for tokens:', e);
            return undefined;
        }
    }

    getAuthorizationCode(urlParams: string): string | undefined {
        try {
            // Parse the URL query parameters (not fragment) for authorization code
            // Example: ?code=4/P7q7W91a-oMsCeLvIaQm6bTrgtp7&state=xyz
            const params = new URLSearchParams(urlParams.startsWith('?') ? urlParams.slice(1) : urlParams);
            const authCode = params.get('code');

            if (!authCode) {
                console.error('No authorization code found in URL parameters');
                return undefined;
            }

            return authCode;
        } catch (e) {
            console.error('Error parsing authorization code from URL parameters:', e);
            return undefined;
        }
    }

    // Backward compatibility method - now uses authorization code flow
    async getJWT(urlParams: string): Promise<string | undefined> {
        const authCode = this.getAuthorizationCode(urlParams);
        if (!authCode) {
            return undefined;
        }

        const tokens = await this.exchangeCodeForTokens(authCode);
        return tokens?.idToken;
    }
}




