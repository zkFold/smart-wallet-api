export type GoogleTokenResponse = {
    id_token?: string
    [key: string]: unknown
}

export type GoogleCertKey = {
    kid: string
    n: string
    e: string
    [key: string]: unknown
}
