export class GoogleApi {
    private clientId: string;
    private redirectURL: string;
    private codeVerifier: string = '';

    constructor(clientId: string, redirectURL: string) {
        // PKCE OAuth2 - RFC 7636
        this.clientId = clientId;
        this.redirectURL = redirectURL;
    }

    private generateCodeVerifier(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    private base64URLEncode(buffer: Uint8Array): string {
        const base64 = btoa(String.fromCharCode(...buffer));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    private async sha256(plain: string): Promise<ArrayBuffer> {
        const encoder = new TextEncoder();
        const data = encoder.encode(plain);
        return await crypto.subtle.digest('SHA-256', data);
    }

    private async generateCodeChallenge(): Promise<string> {
        const hashed = await this.sha256(this.codeVerifier);
        return this.base64URLEncode(new Uint8Array(hashed));
    }

    async getAuthUrl(state: string): Promise<string> {
        this.codeVerifier = this.generateCodeVerifier();
        const codeChallenge = await this.generateCodeChallenge();

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectURL,
            response_type: 'code',
            scope: 'https://www.googleapis.com/auth/userinfo.email openid',
            state: state,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            access_type: 'offline',
            include_granted_scopes: 'true'
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    async getJWT(code: string): Promise<string | undefined> {
        try {
            const response = await fetch('https://oauth2.googleapis.com/token', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: new URLSearchParams({
                    client_id: this.clientId,
                    code: code,
                    code_verifier: this.codeVerifier,
                    grant_type: 'authorization_code',
                    redirect_uri: this.redirectURL,
                }),
            });

            if (!response.ok) {
                throw new Error(`Token exchange failed: ${response.statusText}`);
            }

            const tokens = await response.json();
            console.info('Tokens acquired via PKCE.');
            return tokens.id_token;
        } catch (e) {
            console.error('PKCE token exchange error:', e);
            return undefined;
        }
    }
}




