// Environment variables used on the server. See .env.example for descriptions.
declare namespace NodeJS {
  interface ProcessEnv {
    DATABASE_URL?: string;
    DATABASE_SSL?: string;
    DB_POOL_MAX?: string;
    SITE_URL?: string;
    DEFAULT_STORE_SLUG?: string;
    PLATFORM_ROOT_DOMAIN?: string;
    ADMIN_EMAIL?: string;
    ADMIN_PASSWORD?: string;
    ADMIN_NAME?: string;
    ADMIN_EMAILS?: string;
    NEXT_PUBLIC_GOOGLE_CLIENT_ID?: string;
    STORAGE_DRIVER?: 'local' | 's3';
    STORAGE_LOCAL_DIR?: string;
    S3_ENDPOINT?: string;
    S3_BUCKET?: string;
    S3_REGION?: string;
    S3_ACCESS_KEY_ID?: string;
    S3_SECRET_ACCESS_KEY?: string;
    MIDTRANS_SERVER_KEY?: string;
    MIDTRANS_CLIENT_KEY?: string;
    MIDTRANS_IS_PRODUCTION?: string;
    BITESHIP_API_KEY?: string;
    BITESHIP_API_URL?: string;
    BITESHIP_MODE?: string;
    BITESHIP_ORIGIN_POSTAL_CODE?: string;
  }
}
