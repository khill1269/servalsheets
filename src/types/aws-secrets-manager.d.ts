/**
 * Minimal type declarations for @aws-sdk/client-secrets-manager (optional dependency)
 * Used by AwsSecretsManagerProvider via dynamic import.
 * Install the full SDK for complete types: npm install @aws-sdk/client-secrets-manager
 */
declare module '@aws-sdk/client-secrets-manager' {
  export interface SecretsManagerClientConfig {
    region?: string;
  }

  export class SecretsManagerClient {
    constructor(config: SecretsManagerClientConfig);
    send(command: GetSecretValueCommand): Promise<GetSecretValueCommandOutput>;
  }

  export interface GetSecretValueCommandInput {
    SecretId: string;
    VersionId?: string;
    VersionStage?: string;
  }

  export interface GetSecretValueCommandOutput {
    ARN?: string;
    Name?: string;
    SecretString?: string;
    SecretBinary?: Uint8Array;
    VersionId?: string;
  }

  export class GetSecretValueCommand {
    constructor(input: GetSecretValueCommandInput);
  }
}
