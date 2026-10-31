export interface HeadHunterStatus {
  available: boolean;
  configured: boolean;
  connected: boolean;
  renewable: boolean;
  clientId: string;
  redirectUri: string;
  authorizationPending?: boolean;
  account?: { id: string; name: string; employer: { id: string; name: string } };
}

export interface HeadHunterSettings {
  clientId: string;
  clientSecret?: string;
}

export interface HeadHunterCallback {
  code?: string;
  state?: string;
  error?: string;
}
