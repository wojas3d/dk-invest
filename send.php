<?php
// Contact form handler: sends the message to the company address via the server's mail().
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const RECIPIENT = 'dkinvestdeweloper@gmail.com';
const SENDER    = 'formularz@dkinvest.net.pl'; // should be an address on the site's own domain

function respond($ok, $code = 200) {
    http_response_code($code);
    echo json_encode(['success' => $ok]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') respond(false, 405);

$in = json_decode(file_get_contents('php://input'), true);
if (!is_array($in)) respond(false, 400);

// Bots fill the hidden field: pretend success and drop the message.
if (!empty($in['_honey'])) respond(true);

// Basic throttle: one message per IP every 20 seconds.
$lock = sys_get_temp_dir() . '/dk_form_' . md5($_SERVER['REMOTE_ADDR'] ?? '');
if (is_file($lock) && time() - filemtime($lock) < 20) respond(false, 429);
touch($lock);

// Strip control characters / line breaks and cap length (prevents header injection).
function clean($v, $max = 400) {
    $v = is_string($v) ? $v : '';
    $v = trim(preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/u', '', $v));
    return mb_substr($v, 0, $max);
}
function oneline($v) { return trim(preg_replace('/\s+/', ' ', $v)); }

$name    = oneline(clean($in['Imię i nazwisko'] ?? ''));
$company = oneline(clean($in['Firma'] ?? ''));
$phone   = oneline(clean($in['Telefon'] ?? ''));
$email   = oneline(clean($in['E-mail'] ?? ''));
$message = clean($in['Wiadomość'] ?? '', 2000);

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) respond(false, 422);

$body = "Nowa wiadomość ze strony dkinvest.net.pl\n\n"
      . "Imię i nazwisko: $name\n"
      . "Firma: $company\n"
      . "Telefon: $phone\n"
      . "E-mail: $email\n\n"
      . "Wiadomość:\n$message\n";

$headers = [
    'From: DK Invest - formularz <' . SENDER . '>',
    'Reply-To: ' . $email,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
];
$subject = '=?UTF-8?B?' . base64_encode('Nowa wiadomość ze strony DK Invest') . '?=';

$sent = mail(RECIPIENT, $subject, $body, implode("\r\n", $headers), '-f' . SENDER);
respond($sent, $sent ? 200 : 500);
