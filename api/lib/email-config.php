<?php
declare(strict_types=1);

/**
 * Runtime configuration. Secrets are read from environment variables so
 * credentials are never committed to Git or stored in the deployed filesystem.
 */
return [
    'oauth' => [
        'client_id'     => trim((string)(getenv('GOOGLE_CLIENT_ID') ?: '')),
        'client_secret' => trim((string)(getenv('GOOGLE_CLIENT_SECRET') ?: '')),
        'user_email'    => trim((string)(getenv('GMAIL_USER_EMAIL') ?: '')),
        'refresh_token' => trim((string)(getenv('GMAIL_REFRESH_TOKEN') ?: '')),
        'redirect_uri'  => trim((string)(getenv('GOOGLE_REDIRECT_URI') ?: 'http://127.0.0.1:8000/api/oauth-callback.php')),
        'scope'         => 'https://mail.google.com/',
    ],
    'from_email' => trim((string)(getenv('GMAIL_FROM_EMAIL') ?: getenv('GMAIL_USER_EMAIL') ?: '')),
    'from_name'  => trim((string)(getenv('GMAIL_FROM_NAME') ?: 'Southville Gatepass System')),
    'allowed_recipient_domain' => trim((string)(getenv('ALLOWED_RECIPIENT_DOMAIN') ?: '')),
];
