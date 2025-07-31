export class GoogleApi {
    private clientId: string;
    private redirectURL: string;
    private nonce: string = '';

    constructor(clientId: string, redirectURL: string) {
        // Implicit OAuth2 Flow for client-side applications
        this.clientId = clientId;
        this.redirectURL = redirectURL;
    }

    private generateNonce(): string {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return this.base64URLEncode(array);
    }

    private base64URLEncode(buffer: Uint8Array): string {
        const base64 = btoa(String.fromCharCode(...buffer));
        return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    }

    async getAuthUrl(state: string): Promise<string> {
        this.nonce = this.generateNonce();

        const params = new URLSearchParams({
            client_id: this.clientId,
            redirect_uri: this.redirectURL,
            response_type: 'id_token',
            scope: 'https://www.googleapis.com/auth/userinfo.email openid',
            state: state,
            nonce: this.nonce,
            include_granted_scopes: 'true'
        });

        return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
    }

    getJWT(urlFragment: string): string | undefined {
        try {
            // Parse the URL fragment that comes after the # in the redirect URL
            // Example: #id_token=eyJ...&state=xyz&token_type=Bearer&expires_in=3600
            const params = new URLSearchParams(urlFragment.startsWith('#') ? urlFragment.slice(1) : urlFragment);
            const idToken = params.get('id_token');

            if (!idToken) {
                console.error('No id_token found in URL fragment');
                return undefined;
            }

            // Verify the nonce in the JWT matches what we sent
            const parts = idToken.split(".");
            if (parts.length !== 3) {
                console.error('Invalid JWT format');
                return undefined;
            }

            const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

            if (payload.nonce !== this.nonce) {
                console.error('Nonce mismatch in JWT');
                return undefined;
            }

            console.info('JWT acquired via implicit flow.');
            return idToken;
        } catch (e) {
            console.error('Error parsing JWT from URL fragment:', e);
            return undefined;
        }
    }
}




