import {google} from 'googleapis';

export class GoogleApi {
    private oauth2Client: any;

    constructor(clientId: string, clientSecret: string, redirectURL: string) {
        /**
         * To use OAuth2 authentication, we need access to a CLIENT_ID, CLIENT_SECRET, AND REDIRECT_URI
         * from the client_secret.json file. To get these credentials for your application, visit
         * https://console.cloud.google.com/apis/credentials.
         */
        this.oauth2Client = new google.auth.OAuth2(
          clientId, 
          clientSecret, 
          redirectURL 
        );
            
    }

    getAuthUrl(state: string): Promise<string> {
        // Example access scopes for zkLogin: user email and public profile info are used.
        const scopes = [
          'https://www.googleapis.com/auth/userinfo.email',
          'openid',
        ];

        const authorizationUrl = this.oauth2Client.generateAuthUrl({
          // 'online' (default) or 'offline' (gets refresh_token)
          access_type: 'offline',
          /** Pass in the scopes array defined above.
            * Alternatively, if only one scope is needed, you can pass a scope URL as a string */
          scope: scopes,
          // Enable incremental authorization. Recommended as a best practice.
          include_granted_scopes: true,
          // Include the state parameter to reduce the risk of CSRF attacks.
          state: state
        });
        return authorizationUrl;
    };

    async getJWT(code: string): Promise<string | undefined> {
        try {
            const { tokens } = await this.oauth2Client.getToken(code);
            console.info('Tokens acquired.');
            this.oauth2Client.setCredentials(tokens);
            return tokens.id_token;
        } catch (e) {
            console.log(e);
        }
    }
}




