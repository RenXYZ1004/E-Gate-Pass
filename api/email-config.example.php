<?php
return [
    'oauth' => [
        'client_id'     => 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com',
        'client_secret' => 'YOUR_GOOGLE_CLIENT_SECRET',
        'user_email'    => 'YOUR_GMAIL@gmail.com',
        'redirect_uri'  => 'https://YOUR-DOMAIN.example/api/oauth-callback.php',
        'scope'         => 'https://mail.google.com/',
        'token_file'    => __DIR__ . '/gmail-oauth-token.json',
    ],
    'from_email' => 'YOUR_GMAIL@gmail.com',
    'from_name'  => 'e-Gatepass System',
    'allowed_recipient_domain' => '',
];
