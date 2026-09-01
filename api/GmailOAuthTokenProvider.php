<?php
declare(strict_types=1);

namespace GatePass;

use PHPMailer\PHPMailer\OAuthTokenProvider;
use RuntimeException;

final class GmailOAuthTokenProvider implements OAuthTokenProvider
{
    private const TOKEN_URL = 'https://oauth2.googleapis.com/token';
    private const REQUIRED_SCOPE = 'https://mail.google.com/';

    private string $email;
    private string $clientId;
    private string $clientSecret;
    private string $refreshToken;

    private ?string $accessToken = null;
    private int $expiresAt = 0;

    public function __construct(
        string $email,
        string $clientId,
        string $clientSecret,
        string $refreshToken
    ) {
        $this->email = trim($email);
        $this->clientId = trim($clientId);
        $this->clientSecret = trim($clientSecret);
        $this->refreshToken = trim($refreshToken);

        if ($this->email === '') {
            throw new RuntimeException(
                'Gmail OAuth email is empty.'
            );
        }

        if ($this->clientId === '') {
            throw new RuntimeException(
                'Google OAuth client ID is empty.'
            );
        }

        if ($this->clientSecret === '') {
            throw new RuntimeException(
                'Google OAuth client secret is empty.'
            );
        }

        if ($this->refreshToken === '') {
            throw new RuntimeException(
                'Google OAuth refresh token is empty.'
            );
        }
    }

    /**
     * PHPMailer calls this to obtain the XOAUTH2 string.
     */
    public function getOauth64(): string
    {
        if (
            $this->accessToken === null ||
            time() >= ($this->expiresAt - 60)
        ) {
            $this->refreshAccessToken();
        }

        if ($this->accessToken === null || $this->accessToken === '') {
            throw new RuntimeException(
                'Google did not provide a usable access token.'
            );
        }

        /*
         * XOAUTH2 format required by Gmail:
         *
         * user=email
         * auth=Bearer ACCESS_TOKEN
         *
         * followed by two NULL characters.
         */
        $oauthString =
            'user=' . $this->email .
            "\001" .
            'auth=Bearer ' . $this->accessToken .
            "\001\001";

        return base64_encode($oauthString);
    }

    /**
     * Exchange the Google refresh token for a short-lived access token.
     */
    private function refreshAccessToken(): void
    {
        $postData = http_build_query(
            [
                'client_id' => $this->clientId,
                'client_secret' => $this->clientSecret,
                'refresh_token' => $this->refreshToken,
                'grant_type' => 'refresh_token',
            ],
            '',
            '&',
            PHP_QUERY_RFC3986
        );

        $ch = curl_init(self::TOKEN_URL);

        if ($ch === false) {
            throw new RuntimeException(
                'Unable to initialize cURL for Google OAuth.'
            );
        }

        curl_setopt_array(
            $ch,
            [
                CURLOPT_POST => true,

                CURLOPT_POSTFIELDS => $postData,

                CURLOPT_RETURNTRANSFER => true,

                CURLOPT_FOLLOWLOCATION => false,

                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/x-www-form-urlencoded',
                    'Accept: application/json',
                ],

                CURLOPT_CONNECTTIMEOUT => 10,

                CURLOPT_TIMEOUT => 20,

                CURLOPT_SSL_VERIFYPEER => true,

                CURLOPT_SSL_VERIFYHOST => 2,
            ]
        );

        $body = curl_exec($ch);

        $curlError = curl_error($ch);

        $httpStatus = (int) curl_getinfo(
            $ch,
            CURLINFO_HTTP_CODE
        );

        curl_close($ch);

        /*
         * cURL itself failed.
         */
        if ($body === false) {
            throw new RuntimeException(
                'Google OAuth request failed: ' .
                ($curlError !== ''
                    ? $curlError
                    : 'Unknown cURL error.')
            );
        }

        /*
         * Parse Google's response regardless of HTTP status,
         * because Google's error response contains the useful
         * reason.
         */
        $data = json_decode(
            (string) $body,
            true
        );

        if (!is_array($data)) {
            throw new RuntimeException(
                'Google OAuth returned invalid JSON ' .
                '(HTTP ' . $httpStatus . ').'
            );
        }

        /*
         * Google OAuth error.
         */
        if (
            $httpStatus < 200 ||
            $httpStatus >= 300
        ) {
            $error = (string) (
                $data['error'] ?? 'unknown_error'
            );

            $description = (string) (
                $data['error_description']
                ?? 'No additional information was provided.'
            );

            throw new RuntimeException(
                'Google OAuth token refresh failed ' .
                '(HTTP ' . $httpStatus . '): ' .
                $error .
                ' - ' .
                $description
            );
        }

        /*
         * Access token must exist.
         */
        $accessToken = trim(
            (string) (
                $data['access_token'] ?? ''
            )
        );

        if ($accessToken === '') {
            throw new RuntimeException(
                'Google OAuth response did not contain ' .
                'an access_token.'
            );
        }

        /*
         * Google normally returns the scope associated with
         * the access token. If it does, verify it.
         *
         * IMPORTANT:
         * A refresh token originally authorized only for
         * gmail.send cannot be upgraded here to mail.google.com.
         */
        if (isset($data['scope'])) {

            $returnedScopes = preg_split(
                '/\s+/',
                trim((string) $data['scope'])
            );

            if (
                !is_array($returnedScopes) ||
                !in_array(
                    self::REQUIRED_SCOPE,
                    $returnedScopes,
                    true
                )
            ) {
                throw new RuntimeException(
                    'Google returned an OAuth token without ' .
                    'the required Gmail SMTP scope. ' .
                    'Required scope: ' .
                    self::REQUIRED_SCOPE .
                    '. Re-authorize the Gmail account with ' .
                    'this scope.'
                );
            }
        }

        /*
         * Save token in memory.
         */
        $this->accessToken = $accessToken;

        $expiresIn = (int) (
            $data['expires_in'] ?? 3600
        );

        /*
         * Protect against invalid/very short expiry values.
         */
        if ($expiresIn <= 0) {
            $expiresIn = 3600;
        }

        $this->expiresAt =
            time() + $expiresIn;
    }
}